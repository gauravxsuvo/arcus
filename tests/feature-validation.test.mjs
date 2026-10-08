import test from "node:test";
import assert from "node:assert/strict";
import {libraryEntrySchema,exerciseSettingsSchema,workoutSchema} from "../src/features/import-export/restore-schema.ts";
import {profileDetailsSchema} from "../src/features/profile/schema.ts";
import {createTemplateProgram} from "../src/features/programs/templates.ts";
import {buildWeeklyVolume} from "../src/features/analytics/engine.ts";
const now="2026-10-08T10:00:00Z";
test("library validation accepts complete plans and rejects malformed or mismatched records",()=>{
 const program=createTemplateProgram("starting-strength"),entry={kind:"program",id:program.id,payload:program,updatedAt:now};
 assert.equal(libraryEntrySchema.safeParse(entry).success,true);
 assert.equal(libraryEntrySchema.safeParse({...entry,id:"different"}).success,false);
 assert.equal(libraryEntrySchema.safeParse({...entry,payload:{id:program.id}}).success,false);
});
test("progression validation rejects inverted ranges and out-of-bounds deloads",()=>{
 const setting={id:"bench",updatedAt:now,progression:{type:"double",increment:2.5,repMin:8,repMax:12,deloadPercent:10,deloadAfterFails:3}};
 assert.equal(exerciseSettingsSchema.safeParse(setting).success,true);
 assert.equal(exerciseSettingsSchema.safeParse({...setting,progression:{...setting.progression,repMax:6}}).success,false);
 assert.equal(exerciseSettingsSchema.safeParse({...setting,progression:{...setting.progression,deloadPercent:100}}).success,false);
});
test("profile validation rejects impossible dates, body fat and missing lift selection",()=>{
 assert.equal(profileDetailsSchema.safeParse({dateOfBirth:"2000-02-30"}).success,false);
 assert.equal(profileDetailsSchema.safeParse({bodyMetrics:{weight:80,bodyFat:80}}).success,false);
 assert.equal(profileDetailsSchema.safeParse({targetGoals:[{id:"goal",type:"lift",targetValue:100,targetDate:"2026-12-01",createdAt:now}]}).success,false);
});
test("workout validation preserves RIR and groups and rejects impossible loads",()=>{
 const workout={id:"test",name:"Workout",startedAt:now,completedAt:now,status:"completed",notes:"",restUntil:null,updatedAt:now,tags:["Great Session"],exercises:[{id:"item",exerciseId:"bench",name:"Bench",muscle:"Chest",equipment:"Barbell",restSeconds:90,groupId:"superset",sets:[{id:"set",index:0,weight:80,reps:8,rpe:null,rir:2,completed:true,completedAt:now}]}]};
 assert.equal(workoutSchema.parse(workout).exercises[0].groupId,"superset");
 assert.equal(workoutSchema.parse(workout).exercises[0].sets[0].rir,2);
 assert.equal(workoutSchema.safeParse({...workout,exercises:[{...workout.exercises[0],sets:[{...workout.exercises[0].sets[0],weight:-1}]}]}).success,false);
});
test("weekly tonnage moves Sunday sessions according to the configured week start",()=>{
 const workout={completedAt:"2026-10-04T12:00:00",exercises:[{sets:[{completed:true,weight:100,reps:5}]}]};
 assert.equal(buildWeeklyVolume([workout],1,new Date("2026-10-08T12:00:00"),"monday")[0].sessions,0);
 assert.equal(buildWeeklyVolume([workout],1,new Date("2026-10-08T12:00:00"),"sunday")[0].volume,500);
});
