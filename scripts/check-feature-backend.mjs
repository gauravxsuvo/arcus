import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";
import { createTemplateProgram } from "../src/features/programs/templates.ts";
await loadPortwaysEnv();
const origin=process.env.ARCUS_TEST_URL??"http://127.0.0.1:3000";
const pool=createPortwaysPool({max:1});
const accounts=[];
async function request(path,{body,cookie,status=200,method}={}){
 await pause(1100);
 const response=await fetch(origin+path,{method:method??(body?path==="/api/auth/profile"?"PUT":"POST":"GET"),headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,status,`${path} status`);
 return {data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
try{
 for(let i=0;i<2;i++){
  const username=`feature_check_${randomUUID().slice(0,8)}`,password=randomBytes(24).toString("base64url");
  accounts.push({username,password});
  const signup=await request("/api/auth/signup",{body:{username,password,email:`${username}@example.invalid`,name:"Disposable feature check"},status:201});
  Object.assign(accounts[i],{id:signup.data.user.id,cookie:signup.cookie});
 }
 const account=accounts[0];
 const profileData={preferences:{units:"imperial",theme:"light",defaultRestTimer:120,weekStart:"sunday",effortSystem:"rir"},bodyMetrics:{weight:82,bodyFat:18},bodyMetricsHistory:[{id:randomUUID(),date:"2026-10-07",weight:82,bodyFat:18}],dateOfBirth:"2000-01-01",targetGoals:[{id:randomUUID(),type:"bodyweight",targetValue:80,startValue:82,targetDate:"2026-12-01",createdAt:new Date().toISOString()}]};
 await request("/api/auth/profile",{body:{profileData},cookie:account.cookie});
 const login=await request("/api/auth/login",{body:{username:account.username,password:account.password}});
 assert.deepEqual(Object.fromEntries(Object.keys(profileData).map(key=>[key,login.data.user.profile[key]])),profileData);
 await request("/api/auth/profile",{body:{profileData:{...profileData,bodyMetrics:{weight:82,bodyFat:80}}},cookie:account.cookie,status:400});
 console.log("PASS: Profile preferences, dated metrics and goals survive a new login; invalid metrics are rejected.");
 const now=new Date().toISOString(),program=createTemplateProgram("full-body");
 const entries=[{kind:"program",id:program.id,payload:program,updatedAt:program.updatedAt},{kind:"favorite",id:"barbell-bench-press",payload:{id:"barbell-bench-press",favorite:true,useCount:2,usedAt:now,updatedAt:now},updatedAt:now}];
 const accepted=await request("/api/sync/library",{body:{entries},cookie:account.cookie});assert.equal(accepted.data.accepted.length,2);
 const library=await request("/api/sync/library",{cookie:account.cookie});assert.equal(library.data.entries.length,2);assert.equal(library.data.entries.find(e=>e.kind==="program").payload.days.length,3);
 const other=await request("/api/sync/library",{cookie:accounts[1].cookie});assert.equal(other.data.entries.length,0);
 await request("/api/sync/library",{body:{entries:[{...entries[0],payload:{id:program.id}}]},cookie:account.cookie,status:400});
 const older=await request("/api/sync/library",{body:{entries:[{...entries[0],updatedAt:new Date(Date.parse(now)-60000).toISOString()}]},cookie:account.cookie});assert.equal(older.data.accepted.length,0);
 console.log("PASS: Programs and favorites round trip; ownership, payload validation and stale revision protection work.");
 const workout={id:randomUUID(),name:"Feature check",startedAt:now,completedAt:now,status:"completed",notes:"Check RIR and groups",tags:["High Energy"],restUntil:null,updatedAt:now,exercises:[{id:randomUUID(),exerciseId:"barbell-bench-press",name:"Barbell Bench Press",muscle:"Chest",equipment:"Barbell",restSeconds:90,groupId:"group-check",sets:[{id:randomUUID(),index:0,weight:80,reps:8,rpe:null,rir:2,setType:"working",completed:true,completedAt:now}]}]};
 await request("/api/sync/workout",{body:workout,cookie:account.cookie});
 const restored=await request("/api/sync/workout",{cookie:account.cookie});assert.deepEqual(restored.data.workouts[0],workout);
 const otherWorkouts=await request("/api/sync/workout",{cookie:accounts[1].cookie});assert.equal(otherWorkouts.data.workouts.length,0);
 await request("/api/sync/workout",{body:{id:workout.id},cookie:account.cookie,status:400});
 const stale=await request("/api/sync/workout",{body:{...workout,updatedAt:new Date(Date.parse(now)-60000).toISOString()},cookie:account.cookie});assert.equal(stale.data.accepted,false);
 console.log("PASS: Complete workouts preserve RIR, tags and groups; another account cannot retrieve them.");
}finally{
 await pause(1100);
 for(const account of accounts)await pool.query("delete from public.arcus_accounts where username_normalized=$1 and ($2::uuid is null or id=$2::uuid)",[account.username,account.id??null]);
 await pool.end();console.log("Disposable accounts and their feature data removed.");
}
