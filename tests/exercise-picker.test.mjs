import test from "node:test";
import assert from "node:assert/strict";
import { exerciseCatalog } from "../src/features/exercises/catalog.ts";
import { filterPickerExercises } from "../src/features/exercises/picker.ts";
const empty = {query:"",muscle:"",equipment:"",collection:"all"};
test("picker combines muscle, equipment and search, including secondary targets", () => {
 const curls=filterPickerExercises(exerciseCatalog,[],{...empty,muscle:"Biceps",equipment:"Dumbbell",query:"curl"});
 assert.ok(curls.length>0);assert.ok(curls.every(e=>e.equipment==="Dumbbell"));
 assert.ok(filterPickerExercises(exerciseCatalog,[],{...empty,muscle:"Biceps"}).some(e=>e.id==="lat-pulldown"));
 assert.equal(filterPickerExercises(exerciseCatalog,[],{...empty,muscle:"Biceps"}).some(e=>e.id==="back-squat"),false);
});
test("picker collections respect favorites and the last thirty days", () => {
 const now=Date.parse("2026-10-08T12:00:00Z");
 const preferences=[{id:"barbell-curl",favorite:true,usedAt:null,useCount:0},{id:"back-squat",favorite:false,usedAt:"2026-10-07T12:00:00Z",useCount:2},{id:"barbell-bench-press",favorite:true,usedAt:"2025-10-07T12:00:00Z",useCount:10}];
 assert.deepEqual(filterPickerExercises(exerciseCatalog,preferences,{...empty,collection:"recent"},now).map(e=>e.id),["back-squat"]);
 assert.equal(filterPickerExercises(exerciseCatalog,preferences,{...empty,collection:"favorites"},now).length,2);
 assert.equal(filterPickerExercises(exerciseCatalog,preferences,{...empty,collection:"favorites",muscle:"Calves"},now).length,0);
});
