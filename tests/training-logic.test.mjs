import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlates, consistency, fromDisplayWeight, toDisplayWeight, nextLoad, groupRoundComplete, detectRecords, oneRepMaxes, goalProgress } from '../src/features/training/logic.ts';
const exercise = (reps = 12, completed = true) => ({ id:'e', exerciseId:'bench', name:'Bench', sets:[{ id:'s', weight:80, reps, completed, setType:'working' }] });
const rule = { type:'double', repMin:8, repMax:12, increment:2.5, deloadPercent:10, deloadAfterFails:2 };
test('unit conversion round trips without changing stored kg', () => assert.ok(Math.abs(fromDisplayWeight(toDisplayWeight(80,'imperial'),'imperial') - 80) < 1e-10));
test('progression requires every planned working set; consecutive misses deload', () => {
 assert.equal(nextLoad([exercise()],rule).load,82.5);
 assert.equal(nextLoad([{...exercise(), sets:[...exercise().sets,{id:'x',completed:false}]}],rule).load,80);
 assert.equal(nextLoad([exercise(5),exercise(6)],rule).load,72);
});
test('superset rests only after the matching round completes', () => {
 const first = {...exercise(), groupId:'g'}; const second = {...exercise(8,false),id:'b',groupId:'g'};
 assert.equal(groupRoundComplete([first,second],'e','s'),false);
 second.sets[0].completed = true; assert.equal(groupRoundComplete([first,second],'e','s'),true);
});
test('PRs exclude warmups and track single, estimated and session volume separately', () => {
 const w = {id:'w',status:'completed',startedAt:'2026-10-01',completedAt:'2026-10-01',exercises:[{...exercise(1),sets:[...exercise(1).sets,{weight:200,reps:1,completed:true,setType:'warmup'}]}]};
 const records = detectRecords([w]); assert.equal(records.length,2); assert.ok(records.every(r => r.value === 80));
});
test('streak deduplicates same-day workouts and respects local day boundaries', () => {
 const workouts = ['2026-10-08T09:00:00','2026-10-08T10:00:00','2026-10-07T10:00:00'].map(completedAt => ({status:'completed',completedAt}));
 assert.equal(consistency(workouts,new Date('2026-10-08T12:00:00')).streak,2);
 assert.equal(consistency(workouts,new Date('2026-10-10T12:00:00')).streak,0);
});
test('plate calculator reports unachievable remainder', () => { assert.deepEqual(calculatePlates(100,20,'metric').plates,[25,15]); assert.equal(calculatePlates(101,20,'metric').remainder,1); });
test('calculators reject high-rep estimates and bodyweight goal handles losing weight', () => { assert.equal(oneRepMaxes(100,20),null); assert.equal(oneRepMaxes(100,1).average,100); assert.equal(goalProgress({type:'bodyweight',startValue:90,targetValue:80},{bodyMetrics:{weight:85}},[]).percent,50); });
