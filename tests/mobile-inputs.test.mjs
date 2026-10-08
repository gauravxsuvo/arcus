import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNumericDraft, numericInputError, reconcileNumericDraft } from "../src/features/training/numeric-input.ts";
import { setEntryError } from "../src/features/workouts/set-validation.ts";

const strength = { muscle:"Chest", trackingType:"strength" };
const set = { id:"set-1", index:0, weight:72.5, reps:8, rpe:null, completed:false, completedAt:null };

test("decimal keypad editing allows fractions and locale commas without exponent/NaN input", () => {
  for (const [input,expected] of [["72.5","72.5"],[" 72,5 ","72.5"],["72.","72."],[".5",".5"],[".","."],["",""]]) assert.equal(normalizeNumericDraft(input),expected);
  for (const input of ["-1","1e3","Infinity","NaN","1.2.3","eight"]) assert.equal(normalizeNumericDraft(input),null);
  assert.equal(numericInputError("."),"Enter a valid number.");
  assert.equal(numericInputError("72.5",{min:0,max:2000}),null);
  assert.ok(numericInputError("2001",{max:2000}));
  assert.ok(numericInputError("0",{min:1}));
});
test("rep and set counts accept whole numbers and enforce bounds", () => {
  assert.equal(normalizeNumericDraft("12",true),"12");
  for(const input of ["1.5","1,5","-1","."]) assert.equal(normalizeNumericDraft(input,true),null);
  assert.equal(numericInputError("",{integer:true,min:1}),null);
  assert.equal(numericInputError("10",{integer:true,min:1,max:20}),null);
  assert.ok(numericInputError("21",{integer:true,max:20}));
});
test("parent updates preserve a trailing decimal while editing and replace external step changes", () => {
  assert.equal(reconcileNumericDraft("72.","72",true),"72.");
  assert.equal(normalizeNumericDraft(`${reconcileNumericDraft("72.","72",true)}5`),"72.5");
  assert.equal(reconcileNumericDraft("72.5","75",true),null);
  assert.equal(reconcileNumericDraft("72.","72",false),null);
  assert.equal(reconcileNumericDraft("0","",true),null);
});
test("completed strength sets reject empty/fractional reps and invalid loads while allowing bodyweight", () => {
  assert.equal(setEntryError(set,strength),null);
  assert.equal(setEntryError({...set,weight:null},strength),null);
  for(const reps of [null,0,-1,1.5,NaN,Infinity,10001]) assert.ok(setEntryError({...set,reps},strength));
  for(const weight of [-1,NaN,Infinity,2001]) assert.ok(setEntryError({...set,weight},strength));
  assert.ok(setEntryError({...set,rpe:11},strength));
  assert.ok(setEntryError({...set,rir:6},strength));
});
test("cardio completion validates distance or time without requiring strength reps", () => {
  const cardio = { muscle:"Cardio" };
  assert.ok(setEntryError({...set,weight:null,reps:null},cardio));
  assert.equal(setEntryError({...set,weight:null,reps:null,distanceKm:2.5},cardio),null);
  assert.equal(setEntryError({...set,weight:null,reps:null,durationSeconds:120},cardio),null);
  for(const distanceKm of [-1,NaN,10001]) assert.ok(setEntryError({...set,distanceKm},cardio));
  for(const durationSeconds of [-1,1.5,Infinity,86401]) assert.ok(setEntryError({...set,durationSeconds},cardio));
});
