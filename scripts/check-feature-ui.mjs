import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir,readFile } from "node:fs/promises";
const base=process.env.ARCUS_TEST_URL??"http://127.0.0.1:3000";
const browser=await chromium.launch({channel:"chrome",headless:true});
await mkdir("artifacts/feature-check",{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1,serviceWorkers:"block"});
 const errors=[];context.on("page",page=>page.on("pageerror",error=>errors.push(error.message)));
 let remoteUser={id:"00000000-0000-4000-8000-000000000001",username:"arcus_ui_check",name:"UI Check",email:"ui@example.invalid",profile:{experience:"beginner",goals:[],height_cm:180,bodyMetrics:{weight:80,bodyFat:18},preferences:{units:"metric",theme:"dark",defaultRestTimer:90,weekStart:"monday",effortSystem:"rpe"}}};
 await context.route("**/api/**",async route=>{
  const request=route.request(),url=new URL(request.url());let body={};try{body=request.postDataJSON()??{};}catch{}
  if(url.pathname==="/api/auth/profile"){remoteUser={...remoteUser,username:body.username??remoteUser.username,name:body.name??remoteUser.name,profile:{...remoteUser.profile,...body.profileData,...Object.fromEntries(["bio","height_cm","experience","goals","avatarUrl"].filter(k=>k in body).map(k=>[k,body[k]]))}};await route.fulfill({json:{user:remoteUser}});}
  else if(url.pathname==="/api/sync/library")await route.fulfill({json:request.method()==="POST"?{accepted:(body.entries??[]).map(e=>({kind:e.kind,id:e.id}))}:{entries:[],nextOffset:null}});
  else if(url.pathname==="/api/sync/workout")await route.fulfill({json:{ok:true}});
  else await route.fulfill({status:401,json:{error:"UI check uses an isolated local account."}});
 });
 const page=await context.newPage();await page.goto(base+"/dashboard");
 page.on("console",message=>{if(message.type()==="error")console.log("BROWSER:",message.text());});
 await page.evaluate(async user=>{
  const open=(name,version,stores)=>new Promise((resolve,reject)=>{const request=indexedDB.open(name,version);request.onupgradeneeded=()=>{for(const [name,index] of stores){if(!request.result.objectStoreNames.contains(name)){const store=request.result.createObjectStore(name,{keyPath:"id"});if(index)store.createIndex(index,index,{unique:name==="users"});}}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const db=await open("ARCUS-local-data",4,[["users","username"],["sessions"],["programs"],["measurements"],["exercisePreferences"],["customExercises"],["imports","fileHash"],["settings"],["recaps"]]);
  await new Promise((resolve,reject)=>{const tx=db.transaction(["users","sessions"],"readwrite");tx.objectStore("users").put({...user,passwordHash:"test-cache-only",createdAt:new Date().toISOString(),syncStatus:"synced"});tx.objectStore("sessions").put({id:"current",userId:user.id});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 },remoteUser);
 await page.goto(base+"/profile/edit");await page.getByRole("heading",{name:"Make it yours."}).waitFor();
 await page.getByLabel("Choose profile photo").locator('input[type="file"]').setInputFiles({name:"avatar.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=","base64")});
 await page.getByRole("button",{name:"Use photo"}).click();
 await page.getByLabel("Unit system").selectOption("imperial");await page.getByLabel("Current weight").fill("180");await page.getByLabel("Effort logging").selectOption("rir");await page.getByRole("button",{name:"Lift target",exact:true}).click();
 await page.screenshot({path:"artifacts/feature-check/profile-mobile.png",fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"Profile must fit 375px");
 await page.getByRole("button",{name:"Save profile",exact:true}).click();await page.waitForURL("**/profile?saved=account");
 assert.ok(remoteUser.profile.avatarUrl?.startsWith("data:image/jpeg;base64,"));assert.equal(remoteUser.profile.preferences.units,"imperial");assert.equal(remoteUser.profile.bodyMetricsHistory.length,1);
 console.log("PASS: Profile cropping, targets, unit preferences and measurement snapshot save on mobile.");
 await page.goto(base+"/workout");const start=page.getByRole("button",{name:/start.*workout/i}).first();await start.click();
 await page.getByRole("button",{name:"Add exercise",exact:true}).click();await page.getByPlaceholder("Search exercises or aliases").fill("Barbell Bench Press");await page.getByRole("button",{name:"Barbell Bench Press Chest · Barbell",exact:true}).click();
 await page.getByLabel("Set 1 weight",{exact:true}).fill("100");await page.getByLabel("Set 1 reps",{exact:true}).fill("8");await page.getByLabel("Set 1 RIR",{exact:true}).selectOption("2");await page.getByRole("button",{name:"Complete set 1",exact:true}).click();
 await page.getByLabel("Edit remaining rest time").waitFor();await page.getByRole("button",{name:"Skip rest timer"}).click();
 await page.screenshot({path:"artifacts/feature-check/workout-mobile.png",fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"Workout must fit 375px");
 await page.reload();
 await page.getByRole("button",{name:"Finish workout"}).waitFor();assert.equal(await page.getByLabel("Set 1 RIR",{exact:true}).inputValue(),"2");console.log("PASS: Imperial set input, RIR, rest controls and draft reload.");
 await page.getByRole("button",{name:"Add exercise",exact:true}).click();await page.getByPlaceholder("Search exercises or aliases").fill("Back Squat");await page.getByRole("button",{name:"Back Squat Quads · Barbell",exact:true}).click();
 await page.getByText("Group exercises · superset / circuit",{exact:true}).click();for(const checkbox of await page.locator(".group-options input").all())await checkbox.check();await page.getByRole("button",{name:"Create superset",exact:true}).click();
 const bench=page.locator("article.exercise-card").first(),squat=page.locator("article.exercise-card").nth(1);
 await bench.getByRole("button",{name:"Undo set 1",exact:true}).click();await bench.getByRole("button",{name:"Complete set 1",exact:true}).click();assert.equal(await page.getByLabel("Edit remaining rest time").count(),0);
 await squat.getByLabel("Set 1 weight",{exact:true}).fill("80");await squat.getByLabel("Set 1 reps",{exact:true}).fill("5");await squat.getByRole("button",{name:"Complete set 1",exact:true}).click();await page.getByLabel("Edit remaining rest time").waitFor();await page.getByRole("button",{name:"Skip rest timer"}).click();
 console.log("PASS: Superset groups rest only after both exercises complete the round.");
 await page.getByRole("button",{name:"Finish workout"}).click();await page.getByRole("button",{name:"Share workout"}).waitFor();
 const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Download PNG",exact:true}).click();await (await downloadPromise).saveAs("artifacts/feature-check/workout-share.png");console.log("PASS: Workout share card downloads as PNG.");
 for(const path of ["/dashboard","/progress","/exercises/barbell-bench-press","/programs","/history","/recaps","/profile/data"]){await page.goto(base+path);await page.waitForTimeout(800);await page.screenshot({path:`artifacts/feature-check/${path.replaceAll('/','-')}-mobile.png`,fullPage:true});const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,classes:e.className,right:e.getBoundingClientRect().right})));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${path} must fit 375px: ${JSON.stringify(overflow)}`);}
 const backupDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Export all data JSON",exact:true}).click();await (await backupDownload).saveAs("artifacts/feature-check/backup.json");const backup=JSON.parse(await readFile("artifacts/feature-check/backup.json","utf8"));assert.ok(!("passwordHash" in backup.profile));assert.ok(backup.exercises.length>=80);
 backup.workouts.push({...backup.workouts[0],id:"00000000-0000-4000-8000-000000000099",name:"Restored backup check"});
 await page.getByText("Choose JSON",{exact:true}).locator('input[type="file"]').setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))});await page.getByRole("button",{name:"Confirm restore",exact:true}).click();await page.getByText("Restored 1 workout records.",{exact:false}).waitFor();await page.goto(base+"/history");await page.getByRole("button",{name:/Restored backup check/}).waitFor();console.log("PASS: Complete JSON export excludes passwords; confirmed restore adds missing workouts without duplicating existing data.");
 await page.goto(base+"/programs");await page.getByRole("button",{name:"Add this program"}).first().click();await page.getByRole("link",{name:/Schedule & enrollment/}).first().click();await page.getByRole("button",{name:"Start program",exact:true}).click();await page.getByText("Program started.",{exact:false}).waitFor();
 await page.goto(base+"/dashboard");await page.getByText("ACTIVE PROGRAM",{exact:false}).waitFor();await page.screenshot({path:"artifacts/feature-check/dashboard-mobile.png",fullPage:true});
 console.log("PASS: Program enrollment and responsive analytics, exercises, history, recaps and data pages.");
 await page.setViewportSize({width:1440,height:1000});await page.getByRole("button",{name:"Switch color theme"}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==="light");await page.waitForFunction(()=>getComputedStyle(document.querySelector(".home-metric")).backgroundColor==="rgb(255, 255, 255)");await page.screenshot({path:"artifacts/feature-check/dashboard-desktop-light.png",fullPage:true});
 assert.equal(errors.length,0,errors.join("\n"));console.log("PASS: Desktop theme toggle; no browser runtime errors.");await context.close();
}finally{await browser.close();}
