#!/usr/bin/env node

import { createServer } from "node:net";
import { WebSocket } from "ws";
import { loadPortwaysEnv } from "./portways-env.mjs";

await loadPortwaysEnv();

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const TOKEN = process.env.PORTWAYS_DB_TOKEN || "";
const GATEWAY = process.env.PORTWAYS_DB_GATEWAY || arg("gateway", "wss://db.portways.app/v1");
const PORT = Number(arg("port", process.env.PORTWAYS_DB_PORT || 5432));
const HOST = "127.0.0.1";

if (!TOKEN) {
  console.error("No token. Set PORTWAYS_DB_TOKEN in the environment or .env.portways.local.");
  process.exit(1);
}

if (!GATEWAY.startsWith("wss://") && !GATEWAY.startsWith("ws://")) {
  console.error(`Gateway must be a ws:// or wss:// URL, got: ${GATEWAY}`);
  process.exit(1);
}

if (GATEWAY.startsWith("ws://")) {
  console.error("Warning: ws:// is unencrypted. The database password crosses the network in the clear.");
}

let active = 0;

const server = createServer((sock) => {
  const id = ++active;
  sock.setNoDelay(true);

  const ws = new WebSocket(GATEWAY, { headers: { Authorization: `Bearer ${TOKEN}` } });
  ws.binaryType = "nodebuffer";

  const pending = [];
  let open = false;
  let closed=false;

  sock.on("data", (chunk) => (open ? ws.send(chunk) : pending.push(chunk)));

  ws.on("open", () => {
    open = true;
    for (const chunk of pending) ws.send(chunk);
    pending.length = 0;
  });

  ws.on("message", (data) => sock.write(data));

  const shutdown = (why) => {
    if(closed)return;
    closed=true;
    if (why) console.error(`[${id}] ${why}`);
    try { sock.destroy(); } catch {}
    try { ws.close(); } catch {}
  };

  ws.on("unexpected-response",(_request,response)=>{
    let body="";
    response.on("data",chunk=>{if(body.length<4096)body+=chunk.toString().slice(0,4096-body.length);});
    response.on("end",()=>{
      const message=body.replaceAll(TOKEN,"[redacted]").replaceAll(process.env.DATABASE_URL||"\0","[redacted]").replace(/[\r\n]+/g," ");
      const retry=response.headers["retry-after"];
      shutdown(`gateway refused the connection: ${response.statusCode} ${message}${retry?` (Retry-After: ${retry})`:""}`);
    });
    response.on("error",()=>shutdown(`gateway refused the connection: ${response.statusCode}`));
  });

  ws.on("error", (err) => shutdown(`gateway error: ${err.message}`));
  ws.on("close", (code) => shutdown(code === 1000 ? null : `gateway closed (${code})`));
  sock.on("error", () => shutdown(null));
  sock.on("close", () => shutdown(null));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use -- a local Postgres, probably. Try --port 55432.`);
    process.exit(1);
  }

  console.error(err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Portways bridge: ${HOST}:${PORT} -> ${GATEWAY}`);
  console.log(`Connect with: postgresql://<user>:<password>@${HOST}:${PORT}/<database>`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
