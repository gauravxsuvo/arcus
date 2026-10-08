import test from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_DRAFT_KEY, readActiveDraft, writeActiveDraft, clearActiveDraft, selectActiveDraft } from "../src/features/workouts/draft-backup.ts";
import { createWorkout } from "../src/features/workouts/model.ts";

function storage() { const items = new Map(); return { getItem:key=>items.get(key)??null, setItem:(key,value)=>items.set(key,value), removeItem:key=>items.delete(key) }; }
function workout(id="draft-one",updatedAt="2026-10-08T05:15:00.000Z") { return {...createWorkout(),id,updatedAt,notes:"Latest edit",restUntil:"2026-10-08T05:17:00.000Z",exercises:[{id:"bench",exerciseId:"bench",name:"Bench",muscle:"Chest",equipment:"Barbell",restSeconds:90,sets:[{id:"s1",index:0,weight:72.5,reps:8,rpe:null,completed:false,completedAt:null}]}]}; }

test("active draft writes synchronously and preserves fractional sets and rest time", () => {
  const store=storage(),draft=workout();
  assert.equal(writeActiveDraft(draft,store),true);
  assert.deepEqual(readActiveDraft(store),draft);
  const latest={...draft,name:"Leg day",notes:"Changed immediately before refresh"};
  writeActiveDraft(latest,store);
  assert.deepEqual(readActiveDraft(store),latest);
});
test("malformed, unsupported, oversized and completed backups are ignored", () => {
  const store=storage();
  for(const text of ["bad JSON","null",JSON.stringify({version:2,workout:workout()}),JSON.stringify({version:1,workout:{...workout(),status:"completed"}}),JSON.stringify({version:1,workout:{...workout(),exercises:[{bad:true}]}}),"x".repeat(900200)]) {
    store.setItem(ACTIVE_DRAFT_KEY,text); assert.equal(readActiveDraft(store),null);
  }
  assert.equal(writeActiveDraft({...workout(),status:"completed"},store),false);
});
test("quota and denied-storage failures never prevent the primary IndexedDB save", () => {
  const store={getItem(){throw Error("Blocked");},setItem(){throw Error("Quota");},removeItem(){throw Error("Blocked");}};
  assert.equal(writeActiveDraft(workout(),store),false);
  assert.equal(readActiveDraft(store),null);
  assert.doesNotThrow(()=>clearActiveDraft("draft-one",store));
});
test("completion clears only its own backup and never another active session", () => {
  const store=storage();writeActiveDraft(workout("other-draft"),store);
  clearActiveDraft("draft-one",store);assert.equal(readActiveDraft(store).id,"other-draft");
  clearActiveDraft("other-draft",store);assert.equal(readActiveDraft(store),null);
});
test("recovery chooses newest draft and never resurrects a finished workout", () => {
  const old=workout(),latest={...old,updatedAt:"2026-10-08T05:16:00.000Z",notes:"Newest"};
  assert.equal(selectActiveDraft(old,latest,old),latest);
  assert.equal(selectActiveDraft(latest,old,latest),latest);
  assert.equal(selectActiveDraft(null,latest,null),latest);
  assert.equal(selectActiveDraft(null,old,{...latest,status:"completed"}),null);
  const other=workout("other-draft","2026-10-08T05:17:00.000Z");
  assert.equal(selectActiveDraft(other,old,old),other);
});
