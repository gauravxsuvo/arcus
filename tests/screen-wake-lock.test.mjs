import test from "node:test";
import assert from "node:assert/strict";
import { createScreenWakeLock } from "../src/features/device/screen-wake-lock.ts";

function fakeLock() {
  let released = false; let listener;
  return { get released() { return released; }, async release() { released = true; listener?.(); }, addEventListener(type, callback) { listener = callback; } };
}

test("wake lock requests once, releases when hidden, and reacquires when visible", async () => {
  let visible = true; const locks = []; const statuses = [];
  const controller = createScreenWakeLock({ request: async () => { const lock = fakeLock(); locks.push(lock); return lock; }, visible: () => visible, onStatus: status => statuses.push(status) });
  await controller.refresh(); await controller.refresh(); assert.equal(locks.length, 1); assert.equal(statuses.at(-1), "active");
  visible = false; await controller.refresh(); assert.equal(locks[0].released, true); assert.equal(statuses.at(-1), "waiting");
  visible = true; await controller.refresh(); assert.equal(locks.length, 2);
  controller.dispose(); assert.equal(locks[1].released, true);
});

test("navigation away during an in-flight request releases the arriving lock and does not update state", async () => {
  let resolve; const statuses = []; const lock = fakeLock();
  const controller = createScreenWakeLock({ request: () => new Promise(done => { resolve = done; }), visible: () => true, onStatus: status => statuses.push(status) });
  const request = controller.refresh(); controller.dispose(); resolve(lock); await request;
  assert.equal(lock.released, true); assert.deepEqual(statuses, ["requesting"]);
});

test("concurrent refreshes share an in-flight request and hidden tabs never keep its result", async () => {
  let resolve; let count = 0; let visible = true; const lock = fakeLock();
  const controller = createScreenWakeLock({ request: () => { count++; return new Promise(done => { resolve = done; }); }, visible: () => visible, onStatus() {} });
  const pending = controller.refresh(); await controller.refresh(); assert.equal(count, 1);
  visible = false; await controller.refresh(); resolve(lock); await pending; assert.equal(lock.released, true);
  controller.dispose();
});

test("browser refusal is handled without retries in a loop", async () => {
  let requests = 0; const statuses = [];
  const controller = createScreenWakeLock({ request: async () => { requests++; throw new Error("Low battery"); }, visible: () => true, onStatus: status => statuses.push(status) });
  await controller.refresh(); assert.equal(requests, 1); assert.equal(statuses.at(-1), "unavailable");
  controller.dispose(); await controller.refresh(); assert.equal(requests, 1);
});
