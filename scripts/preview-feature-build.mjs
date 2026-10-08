import { spawn } from "node:child_process";
import { loadPortwaysEnv } from "./portways-env.mjs";
await loadPortwaysEnv();
// Verification only: reuse the already running loopback bridge.
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3001"],{env:{...process.env,ARCUS_DIST_DIR:".next-verify"},stdio:"inherit"});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>{process.exitCode=code??1;});
