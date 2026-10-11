import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as model from "../src/features/social/model.ts";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";
await loadPortwaysEnv();
const pool=createPortwaysPool({max:1});
const client=await pool.connect();
const source=await readFile(new URL("../src/features/social/actions.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let actor;
const compiledModule={exports:{}};
runInNewContext(compiled,{module:compiledModule,exports:compiledModule.exports,require:name=>{
  if(name==="@/lib/auth/server")return {getCurrentAccount:async()=>actor};
  if(name==="@/lib/db/pool")return {getDatabasePool:()=>client};
  if(name==="./model")return model;
  if(name==="zod")return {z};
  throw new Error("Unexpected test dependency");
}});
const api=compiledModule.exports;
try {
  await client.query("begin");
  await client.query("set local statement_timeout='15s'");
  const feed=await api.getFeedWorkouts();
  assert.ok(feed.length<=20);
  for(const post of feed)assert.deepEqual(Object.keys(post.user).sort(),["avatarUrl","following","handle","id","name"]);
  if(feed.length) {
    const post=feed[0];
    const account=await client.query("select id from public.arcus_accounts where id<>$1 and is_banned=false and is_suspended=false limit 1",[post.ownerId]);
    assert.ok(account.rows[0]);
    actor={id:account.rows[0].id};
    const target={ownerId:post.ownerId,workoutId:post.id};
    await api.setFollowing({userId:post.ownerId,following:true});
    await api.setWorkoutLike({...target,liked:true});
    assert.ok((await api.getFeedWorkouts("following")).some(row=>row.ownerId===post.ownerId));
    assert.ok((await api.getFeedWorkouts()).find(row=>row.id===post.id && row.ownerId===post.ownerId)?.liked);
    const text="Social QA validation "+Date.now();
    await api.addWorkoutComment({...target,text});
    const comment=(await api.getWorkoutComments(target)).find(row=>row.text===text);
    assert.ok(comment);
    actor={id:post.ownerId};
    await assert.rejects(api.deleteWorkoutComment(comment.id),/Unauthorized/);
    actor={id:account.rows[0].id};
    await assert.rejects(api.setWorkoutVisibility({...target,isPublic:false}),/Unauthorized/);
    await api.deleteWorkoutComment(comment.id);
    actor={id:post.ownerId};
    await api.setWorkoutVisibility({...target,isPublic:false});
    assert.ok(!(await api.getFeedWorkouts()).some(row=>row.id===post.id && row.ownerId===post.ownerId));
    await assert.rejects(api.getWorkoutComments(target),/unavailable/);
    const users=await api.searchUsers(post.user.handle.slice(0,2));
    assert.ok(users.length<=5);
  }
  console.log("Live PostgreSQL social reads, likes, follows, comments, ownership and private-workout checks passed; all writes rolled back.");
} catch(error) {
  console.error("Social database verification failed:",error?.code ?? error?.name ?? "unknown");
  process.exitCode=1;
} finally {
  await client.query("rollback").catch(()=>{});
  client.release();
  await pool.end();
}
