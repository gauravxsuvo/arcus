import "server-only";
import pg from "pg";
import { WebSocket } from "ws";
import { Duplex } from "stream";

const { Pool } = pg;

const shared = globalThis as typeof globalThis & { arcusDatabasePool?: pg.Pool };

function createPortwaysStream() {
  let ws: WebSocket;
  const token = process.env.PORTWAYS_DB_TOKEN;
  const gateway = process.env.PORTWAYS_DB_GATEWAY || "wss://db.portways.app/v1";

  const stream = new Duplex({
    read() {},
    write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
      if (!ws) return callback(new Error("No WebSocket"));
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk, (err?: Error) => callback(err));
      } else {
        ws.once("open", () => ws.send(chunk, (err?: Error) => callback(err)));
      }
    },
    destroy(err: Error | null, callback: (error: Error | null) => void) {
      if (ws) ws.close();
      callback(err);
    }
  });

  (stream as any).setNoDelay = function() { return this; };
  (stream as any).setKeepAlive = function() { return this; };
  (stream as any).ref = function() { return this; };
  (stream as any).unref = function() { return this; };

  (stream as any).connect = function() {
    ws = new WebSocket(gateway, { headers: { Authorization: `Bearer ${token}` } });
    ws.binaryType = "nodebuffer";
    ws.on("open", () => stream.emit("connect"));
    ws.on("message", (data: any) => stream.push(data));
    ws.on("close", () => stream.push(null));
    ws.on("error", (err: Error) => stream.destroy(err));
    return this;
  };

  return stream;
}

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!shared.arcusDatabasePool) {
    const config: pg.PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10 * 60 * 1000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
    };

    if (process.env.PORTWAYS_DB_TOKEN) {
      config.stream = createPortwaysStream as any;
    }

    const pool = new Pool(config);
    pool.on("error", () => {
      console.warn("An idle PostgreSQL connection was dropped; the pool will open a replacement when needed.");
    });
    shared.arcusDatabasePool = pool;
  }
  return shared.arcusDatabasePool;
}
