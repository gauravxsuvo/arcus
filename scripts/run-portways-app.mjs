#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPortwaysEnv } from "./portways-env.mjs";

await loadPortwaysEnv();

const mode = process.argv[2];
if (!new Set(["dev", "start"]).has(mode)) {
  console.error("Usage: node scripts/run-portways-app.mjs <dev|start>");
  process.exit(1);
}

if (!process.env.PORTWAYS_DB_TOKEN) {
  console.error("PORTWAYS_DB_TOKEN is required in the environment or .env.portways.local.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in the environment or .env.portways.local.");
  process.exit(1);
}

let databaseUrl;
try {
  databaseUrl = new URL(process.env.DATABASE_URL);
} catch {
  console.error("DATABASE_URL is not a valid PostgreSQL URL.");
  process.exit(1);
}

if (databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== "127.0.0.1" || databaseUrl.username !== "remote_3" || databaseUrl.searchParams.get("sslmode") !== "disable") {
  console.error("DATABASE_URL must use remote_3 through 127.0.0.1 with sslmode=disable.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedPort = Number(databaseUrl.port || 5432);

function canListen(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

let bridgePort = requestedPort;
if (!(await canListen(bridgePort))) {
  if (requestedPort !== 5432 || !(await canListen(55432))) {
    console.error(`Cannot start the bridge on 127.0.0.1:${requestedPort}; the port is already in use.`);
    process.exit(1);
  }
  bridgePort = 55432;
  databaseUrl.port = String(bridgePort);
  process.env.DATABASE_URL = databaseUrl.toString();
  console.log("Port 5432 is busy; using the local bridge on 127.0.0.1:55432 for this app process.");
}

const bridge = spawn(process.execPath, [
  path.join(root, "scripts", "portways-db-bridge.mjs"),
  "--gateway",
  process.env.PORTWAYS_DB_GATEWAY || "wss://db.portways.app/v1",
  "--port",
  String(bridgePort),
], {
  cwd: root,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

let app;
let shuttingDown = false;
let bridgeReady = false;

function redact(text) {
  let decodedPassword = databaseUrl.password;
  try {
    decodedPassword = decodeURIComponent(databaseUrl.password);
  } catch {
    // Keep the encoded form in the redaction set if the URI contains invalid escapes.
  }
  const secrets = [
    process.env.PORTWAYS_DB_TOKEN,
    databaseUrl.password,
    decodedPassword,
    process.env.DATABASE_URL,
  ].filter(Boolean);
  return secrets.reduce((safe, secret) => safe.replaceAll(secret, "[redacted]"), text);
}

bridge.stdout.on("data", (chunk) => {
  const output = redact(chunk.toString());
  process.stdout.write(output);
  if (output.includes("Portways bridge: 127.0.0.1:")) bridgeReady = true;
});
bridge.stderr.on("data", (chunk) => process.stderr.write(redact(chunk.toString())));

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  if (app && !app.killed) app.kill();
  if (!bridge.killed) bridge.kill();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Bridge did not start listening within 15 seconds.")), 15_000);
    const onReady = () => {
      if (!bridgeReady) return;
      clearTimeout(timeout);
      resolve();
    };
    bridge.stdout.on("data", onReady);
    bridge.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    bridge.once("exit", (code) => {
      if (bridgeReady) return;
      clearTimeout(timeout);
      reject(new Error(`Bridge exited before listening (exit code ${code ?? "unknown"}).`));
    });
  });
} catch (error) {
  console.error(error.message);
  shutdown(1);
  if (bridge.exitCode === null && bridge.signalCode === null) {
    await Promise.race([
      new Promise((resolve) => bridge.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
  process.exit(1);
}

app = spawn(process.execPath, [
  path.join(root, "node_modules", "next", "dist", "bin", "next"),
  mode,
  "--hostname",
  "127.0.0.1",
], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

bridge.once("exit", (code) => {
  if (shuttingDown) return;
  console.error(`Portways bridge stopped unexpectedly (exit code ${code ?? "unknown"}); stopping the app.`);
  shutdown(1);
});

app.once("error", (error) => {
  console.error(`Could not start the Next.js app: ${error.message}`);
  shutdown(1);
});

app.once("exit", (code, signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code ?? (signal ? 1 : 0);
  if (!bridge.killed) bridge.kill();
});
