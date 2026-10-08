import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkoutHistory } from '../src/features/workouts/filter.ts';

process.env.TZ = 'Asia/Kolkata';
const empty = {query:'',exerciseId:'',muscle:'',fromDate:'',toDate:''};
const workouts = [
  {id:'upper',name:'Upper strength',notes:'Controlled tempo',startedAt:'2026-10-07T17:00:00Z',completedAt:'2026-10-07T19:00:00Z',exercises:[{exerciseId:'bench',name:'Bench Press',muscle:'Chest'}]},
  {id:'lower',name:'Lower strength',notes:'Felt rested',startedAt:'2026-10-07T14:00:00Z',completedAt:'2026-10-07T15:00:00Z',exercises:[{exerciseId:'squat',name:'Squat',muscle:'Quads'}]},
];

test('history date filters use inclusive local calendar days across UTC midnight',()=>{
  assert.deepEqual(filterWorkoutHistory(workouts,{...empty,fromDate:'2026-10-08',toDate:'2026-10-08'}).map(row=>row.id),['upper']);
  assert.deepEqual(filterWorkoutHistory(workouts,{...empty,toDate:'2026-10-07'}).map(row=>row.id),['lower']);
});
test('history search matches names, exercise names and notes with trimmed case-insensitive input',()=>{
  for(const query of [' UPPER ','bench','TEMPO']) assert.deepEqual(filterWorkoutHistory(workouts,{...empty,query}).map(row=>row.id),['upper']);
  assert.deepEqual(filterWorkoutHistory(workouts,{...empty,query:'pulldown'}),[]);
});
test('history combines exercise, muscle, date and text filters without changing source order or records',()=>{
  const snapshot=JSON.stringify(workouts);
  assert.deepEqual(filterWorkoutHistory(workouts,{...empty,query:'strength',exerciseId:'bench',muscle:'Chest',fromDate:'2026-10-08'}).map(row=>row.id),['upper']);
  assert.deepEqual(filterWorkoutHistory(workouts,{...empty,exerciseId:'bench',muscle:'Quads'}),[]);
  assert.deepEqual(filterWorkoutHistory(workouts,empty).map(row=>row.id),['upper','lower']);
  assert.equal(JSON.stringify(workouts),snapshot);
});
test('history falls back to start date for old records and excludes invalid dates when dates are filtered',()=>{
  const old={...workouts[0],completedAt:null,startedAt:'2026-10-07T19:00:00Z'};
  const invalid={...old,id:'invalid',startedAt:'not-a-date'};
  assert.deepEqual(filterWorkoutHistory([old,invalid],{...empty,fromDate:'2026-10-08'}).map(row=>row.id),['upper']);
});
