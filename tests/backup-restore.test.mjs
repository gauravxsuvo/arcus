import test from 'node:test';import assert from 'node:assert/strict';import {parseBackup} from '../src/features/import-export/restore-schema.ts';
const backup={arcus:3,workouts:[],programs:[],physique:[],customExercises:[]};
test('backup validation rejects malformed input before any mutation',()=>{assert.throws(()=>parseBackup('nope'));assert.throws(()=>parseBackup(JSON.stringify({...backup,arcus:1})));assert.throws(()=>parseBackup(JSON.stringify({...backup,workouts:[{id:'x'}]})));});
test('empty backup and valid legacy version 2 remain compatible',()=>{assert.equal(parseBackup(JSON.stringify(backup)).workouts.length,0);assert.equal(parseBackup(JSON.stringify({...backup,arcus:2})).arcus,2);});
