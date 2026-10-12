import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as model from "../src/features/social/model.ts";
import { readProfileBody } from "../src/lib/auth/avatar.ts";
const source=await readFile(new URL("../src/features/social/actions.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020 } }).outputText;
const owner="00000000-0000-4000-8000-000000000001";
const other="00000000-0000-4000-8000-000000000002";
const workout="00000000-0000-4000-8000-000000000003";
function actions(session,query) {
  const compiledModule={ exports:{} };
  runInNewContext(compiled,{ module:compiledModule,exports:compiledModule.exports,require:name=>{
    if(name==="@/lib/auth/server")return { getCurrentAccount:async()=>session };
    if(name==="@/lib/db/pool")return { getDatabasePool:()=>({ query,connect:async()=>({query,release:()=>undefined}) }) };
    if(name==="next/cache")return { unstable_cache:fn=>fn, revalidateTag:()=>undefined };
    if(name==="./model")return model;
    if(name==="zod")return { z };
    assert.fail("Unexpected dependency "+name);
  } });
  return compiledModule.exports;
}
test("all social mutations authenticate before validation or database access",async()=>{
  const api=actions(null,()=>assert.fail("Unauthorized query"));
  for(const name of ["setFollowing","setWorkoutLike","addWorkoutComment","deleteWorkoutComment","setWorkoutVisibility"])
    await assert.rejects(api[name]({}),/Unauthorized/);
});
test("invalid HTML/empty/oversized comments, non-boolean toggles and IDs are rejected",()=>{
  for(const text of [" ","<script>alert(1)</script>","x".repeat(501)])
    assert.equal(model.commentSchema.safeParse({ownerId:owner,workoutId:workout,text}).success,false);
  assert.equal(model.commentSchema.parse({ownerId:owner,workoutId:workout,text:" Great session "}).text,"Great session");
  assert.equal(model.likeSchema.safeParse({ownerId:owner,workoutId:workout,liked:"true"}).success,false);
  assert.equal(model.followSchema.safeParse({userId:"invalid",following:true}).success,false);
});
test("cross-account comment deletion and visibility changes never write",async()=>{
  let reads=0;
  const api=actions({id:owner},async sql=>{ if(sql.trim().toLowerCase().startsWith("select ")){ reads++; return {rows:[{account_id:other,workout_owner_id:other,workout_id:workout}],rowCount:1}; } return {rows:[],rowCount:1}; });
  await assert.rejects(api.deleteWorkoutComment(workout),/Unauthorized/);
  await assert.rejects(api.setWorkoutVisibility({ownerId:other,workoutId:workout,isPublic:false}),/Unauthorized/);
  assert.equal(reads,2);
});
test("private or unavailable workouts cannot be liked or read",async()=>{
  const api=actions({id:owner},async sql=>{assert.match(sql,/w.is_public=true/); return {rows:[],rowCount:0};});
  await assert.rejects(api.setWorkoutLike({ownerId:other,workoutId:workout,liked:true}),/unavailable/);
  await assert.rejects(api.getWorkoutComments({ownerId:other,workoutId:workout}),/unavailable/);
});
test("like counters update atomically only when the like row changes",async()=>{
  const statements=[];
  const api=actions({id:owner},async sql=>{
    statements.push(sql.trim().toLowerCase());
    if(sql.includes("select w.account_id"))return {rows:[{account_id:other}],rowCount:1};
    if(sql.includes("insert into public.arcus_workout_likes"))return {rows:[{workout_id:workout}],rowCount:1};
    return {rows:[],rowCount:1};
  });
  await api.setWorkoutLike({ownerId:other,workoutId:workout,liked:true});
  const begin = statements.indexOf("begin");
  assert.equal(statements[begin+1]?.startsWith("insert into public.arcus_workout_likes"),true);
  assert.equal(statements[begin+2]?.startsWith("update public.arcus_workouts set likes_count=likes_count+1"),true);
  assert.equal(statements[begin+3],"commit");

  statements.length=0;
  const duplicate=actions({id:owner},async sql=>{
    statements.push(sql.trim().toLowerCase());
    if(sql.includes("insert into public.arcus_workout_likes"))return {rows:[],rowCount:0};
    if(sql.includes("select w.account_id"))return {rows:[{account_id:other}],rowCount:1};
    return {rows:[],rowCount:1};
  });
  await duplicate.setWorkoutLike({ownerId:other,workoutId:workout,liked:true});
  assert.ok(!statements.some(sql=>sql.startsWith("update public.arcus_workouts set likes_count")));
});
test("feed joins user identity, caps results, and explicitly strips sensitive fields",async()=>{
  let calls=0;
  const api=actions({id:owner},async(sql,values)=>{
    calls++;
    if(sql.includes("with recent as")) {
      assert.match(sql,/join public.arcus_accounts/); assert.match(sql,/limit 21/); // 20 rows plus one cursor lookahead
      assert.match(sql,/w\.total_volume_kg/); assert.match(sql,/w\.exercise_summary/);
      assert.doesNotMatch(sql,/jsonb_array_elements|arcus_workout_(likes|comments).*count/i);
      assert.ok(!sql.includes("password_hash")&&!sql.includes("a.email")); assert.equal(values[0],null);
      return {rows:[{id:workout,ownerId:other,userId:other,name:"Lifter",handle:"lifter",avatarUrl:null,title:"Training",completedAt:"2026-10-10T10:30:00Z",startedAt:"2026-10-10T10:00:00Z",volume:"100",totalSets:3,prs:1,exercises:[],likes:0,comments:0,email:"hidden",password:"hidden",stripeCustomerId:"hidden"}]};
    }
    assert.equal(values[0],owner);
    return {rows:[]};
  });
  const rows=await api.getFeedWorkouts();
  assert.equal(rows[0].durationMinutes,30); assert.equal(rows[0].volumeKg,100); assert.equal(calls,3);
  assert.deepEqual(Object.keys(rows[0].user).sort(),["avatarUrl","following","handle","id","name"]);
  assert.ok(!JSON.stringify(rows).includes("hidden"));
});
test("feed keyset cursor uses the stable descending tuple and returns at most twenty posts",async()=>{
  const cursor={updatedAt:"2026-10-10T10:00:00.000Z",id:workout,ownerId:owner};
  const rows=Array.from({length:21},(_,index)=>({
    id:`00000000-0000-4000-8000-${String(index+10).padStart(12,"0")}`,ownerId:other,cursorUpdatedAt:new Date(Date.UTC(2026,9,10,9,59,59-index)).toISOString(),
    userId:other,name:"Lifter",handle:"lifter",avatarUrl:null,following:false,title:"Training",completedAt:"2026-10-10T10:30:00Z",startedAt:"2026-10-10T10:00:00Z",volume:"100",exercises:[],likes:0,comments:0,liked:false,
  }));
  const api=actions({id:owner},async(sql,values)=>{
    if(sql.includes("with recent as")) {
      assert.match(sql,/\(w\.updated_at,w\.id,w\.account_id\)</);
      assert.match(sql,/order by w\.updated_at desc,w\.id desc,w\.account_id desc limit 21/);
      assert.equal(JSON.stringify(values.slice(2)),JSON.stringify([cursor.updatedAt,cursor.id,cursor.ownerId]));
      return {rows};
    }
    return {rows:[]};
  });
  const page=await api.getFeedWorkoutsPage({tab:"discover",cursor});
  assert.equal(page.posts.length,20);
  assert.equal(page.nextCursor?.id,rows[19].id);
  assert.equal(page.nextCursor?.ownerId,other);
});
test("search literal wildcard characters are escaped and query injection remains parameterized",async()=>{
  const input="a%' OR 1=1 --";
  const api=actions({id:owner},async(sql,values)=>{
    assert.match(sql,/limit 5/); assert.match(sql,/display_name ilike.*or a.username ilike/);
    assert.ok(!sql.includes(input)); assert.ok(values[0].includes("\\%"));
    return {rows:[]};
  });
  await api.searchUsers(input);
});
test("nested API text is rejected, while opaque passwords preserve all characters",async()=>{
  const request=body=>new Request("http://localhost",{method:"POST",body:JSON.stringify(body)});
  await assert.rejects(readProfileBody(request({payload:{notes:"<img onerror='x'>"}})),/HTML/);
  assert.equal((await readProfileBody(request({password:"a<b>password"}))).password,"a<b>password");
});
