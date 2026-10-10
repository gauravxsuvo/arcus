import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/features/admin/repository.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function repository({ authorize, query }) {
  const compiledModule = { exports: {} };
  const dependencies = {
    "server-only": {}, "react": { cache: fn => fn },
    "@/lib/auth/admin": { requireAdmin: authorize },
    "@/lib/db/pool": { getDatabasePool: () => ({ query }) },
    "@/features/exercises/catalog": { exerciseCatalog: [{ id: "bench", name: "Bench", muscle: "Chest", equipment: "Barbell" }] },
  };
  runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, process: { env: {} }, require: name => {
    assert.ok(name in dependencies, `Unexpected runtime import: ${name}`);
    return dependencies[name];
  } });
  return compiledModule.exports;
}

test("every admin data loader reauthorizes before reading platform-wide records", async () => {
  const denied = new Error("denied");
  let queries = 0, checks = 0;
  const api = repository({ authorize: async () => { checks++; throw denied; }, query: async () => { queries++; assert.fail("Unauthorized database read"); } });
  const options = { query: "", muscle: "", page: 1, pageSize: 25 };
  for (const call of [() => api.getAdminOverview(), () => api.getAdminUsers(options), () => api.getAdminExercises(options)]) {
    await assert.rejects(call, error => error === denied);
  }
  assert.equal(checks, 3);
  assert.equal(queries, 0);
});

test("directory filters stay in parameter values rather than becoming SQL", async () => {
  const calls = [];
  const api = repository({ authorize: async () => {}, query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ total: 0, page: 1, rows: [], muscles: [] }] };
  } });
  const options = { query: "x'; DROP TABLE arcus_accounts; --", muscle: "Chest' OR true --", page: 2, pageSize: 25 };
  await api.getAdminUsers(options);
  await api.getAdminExercises(options);
  assert.equal(calls.length, 2);
  for (const { sql, values } of calls) {
    assert.ok(!sql.includes(options.query));
    assert.ok(!sql.includes(options.muscle));
    assert.ok(values.includes(options.query));
    assert.ok(values.includes(25));
  }
  assert.ok(calls[1].values.includes(options.muscle));
});
