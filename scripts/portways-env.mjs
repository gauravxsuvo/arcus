import { readFile } from "node:fs/promises";

// Prefer the shared app configuration; retain the Portways-only file as a
// fallback for existing bridge tooling. Values already in the process win.
const envFiles = [new URL("../.env.local", import.meta.url), new URL("../.env.portways.local", import.meta.url)];

function parseEnv(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

export async function loadPortwaysEnv() {
  for (const envFile of envFiles) {
    let contents;
    try {
      contents = await readFile(envFile, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    for (const [name, value] of parseEnv(contents)) {
      if (process.env[name] === undefined) process.env[name] = value;
    }
  }
}
