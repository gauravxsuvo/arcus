#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPortwaysEnv } from "./portways-env.mjs";

await loadPortwaysEnv();

const mode = process.argv[2];
if (!new Set(["dev", "start"]).has(mode)) {
  console.error("Usage: node scripts/run-portways-app.mjs <dev|start>");
  process.exit(1);
}

const required = ["PORTWAYS_DB_TOKEN", "PGUSER", "PGPASSWORD", "PGDATABASE"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing Portways environment variables: ${missing.join(", ")}. Add them to .env.local or your deployment settings.`);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = spawn(process.execPath, [
  path.join(root, "node_modules", "next", "dist", "bin", "next"),
  mode,
  "--hostname",
  "127.0.0.1",
], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  if (!app.killed) app.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

app.once("error", (error) => {
  console.error(`Could not start the Next.js app: ${error.message}`);
  process.exitCode = 1;
});

app.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
