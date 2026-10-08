import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createTemplateProgram } from "../src/features/programs/templates.ts";
const origin=process.env.ARCUS_TEST_URL??"http://127.0.0.1:3001";
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 const context=await browser.newContext({viewport:{width:375,height:812}});
 const page=await context.newPage(),errors=[];page.on("pageerror",error=>errors.push(error.message));
 await page.goto(origin+"/dashboard");
 await page.waitForFunction(()=>document.documentElement.dataset.offlineReady==="true",{},{timeout:45000});
 const now=new Date(),past=new Date(now);past.setDate(past.getDate()-8);
 const program={...createTemplateProgram("full-body"),syncStatus:"synced"};
 const base={name:"Offline session",startedAt:past.toISOString(),completedAt:past.toISOString(),status:"completed",notes:"Offline journal",tags:["High Energy"],restUntil:null,syncStatus:"synced",updatedAt:now.toISOString(),exercises:[{id:randomUUID(),exerciseId:"barbell-bench-press",name:"Barbell Bench Press",muscle:"Chest",equipment:"Barbell",restSeconds:90,sets:[{id:randomUUID(),index:0,weight:80,reps:8,rpe:8,completed:true,completedAt:past.toISOString()}]}]};
 const completed={...base,id:randomUUID()},active={...base,id:randomUUID(),name:"Offline active workout",startedAt:now.toISOString(),completedAt:null,status:"active",restUntil:new Date(now.getTime()+90000).toISOString()};
 const user={id:randomUUID(),username:"offline_check",name:"Offline check",email:"offline@example.invalid",passwordHash:"isolated-browser-only",createdAt:now.toISOString(),syncStatus:"synced",profile:{experience:"beginner",goals:[],height_cm:180,bodyMetrics:{weight:80,bodyFat:18},preferences:{units:"metric",defaultRestTimer:90,theme:"dark",weekStart:"monday",effortSystem:"rpe"},activeProgram:{programId:program.id,startDate:now.toISOString().slice(0,10)}}};
 await page.evaluate(async({user,program,completed,active})=>{
  for(const [name,version,records] of [["ARCUS-local-data",4,{users:[user],sessions:[{id:"current",userId:user.id}],programs:[program]}],["ARCUS-training",1,{workouts:[completed,active]}]]){
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(name,version);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   await new Promise((resolve,reject)=>{const transaction=db.transaction(Object.keys(records),"readwrite");for(const [store,rows] of Object.entries(records))for(const row of rows)transaction.objectStore(store).put(row);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});db.close();
  }
 },{user,program,completed,active});
 await context.setOffline(true);
 // These routes were not visited in this browser before going offline.
 for(const [path,text] of [["/progress","Body composition"],["/exercises/incline-dumbbell-bench","Incline Dumbbell Press"],[`/history/${completed.id}`,"Offline session"],[`/programs/${program.id}`,program.name],["/recaps","week of progress"],["/profile/data","Restore an ARCUS backup"]]){
  await page.goto(origin+path);await page.getByText(text,{exact:false}).first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} fits mobile offline`);
 }
 console.log("PASS: New pages, unvisited record detail routes, charts and weekly recaps hydrate completely offline.");
 await page.goto(origin+"/workout");await page.getByLabel("Edit remaining rest time").waitFor();await page.getByText("Barbell plate calculator",{exact:true}).click();await page.getByLabel("Target · kg").fill("100");await page.getByText("Total 100 kg",{exact:true}).waitFor();
 await page.getByRole("link",{name:"Leave session"}).click();await page.waitForURL("**/dashboard");await page.getByRole("heading",{name:"Home",exact:true}).waitFor();
 console.log("PASS: Draft/rest recovery, lazy plate calculator and navigation work offline.");
 await page.goto(origin+"/profile/edit");await page.getByLabel("Default rest · seconds").fill("75");await page.getByRole("button",{name:"Save profile",exact:true}).click();await page.waitForURL("**/profile?saved=device&sync=unavailable");
 const saved=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open("ARCUS-local-data",4);request.onsuccess=()=>{const db=request.result;const read=db.transaction("users").objectStore("users").getAll();read.onsuccess=()=>{resolve(read.result[0]);db.close();};};}));
 assert.equal(saved.profile.preferences.defaultRestTimer,75);assert.equal(saved.syncStatus,"pending");assert.equal(errors.length,0,errors.join("\n"));
 console.log("PASS: Offline profile mutations persist locally and remain queued for sync.");
 await context.close();
}finally{await browser.close();}
