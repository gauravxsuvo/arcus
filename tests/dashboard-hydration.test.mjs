import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import * as icons from "lucide-react";
import * as training from "../src/features/training/logic.ts";
import { DEFAULT_PREFERENCES } from "../src/features/profile/model.ts";

const source = await readFile(new URL("../src/components/dashboard/today-overview.tsx", import.meta.url), "utf8");
const compiled = transpileModule(source, {
  compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const jsx = await import("react/jsx-runtime");

test("weekly overview first render is stable even when parent data is already ready", () => {
  const exported = { exports: {} };
  const modules = {
    react: React,
    "react/jsx-runtime": jsx,
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "lucide-react": icons,
    "@/components/shared/user-profile-provider": { useProfile: () => ({ user: null, preferences: DEFAULT_PREFERENCES, ready: true }) },
    "@/features/exercises/catalog": { exerciseCatalog: [] },
    "@/features/local-data/repository": { listPrograms: async () => [] },
    "@/features/programs/schedule": { programSchedule: () => null },
    "@/features/training/logic": training,
    "./overview.module.css": { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) },
  };
  runInNewContext(compiled, {
    Date, module: exported, exports: exported.exports,
    require: name => { assert.ok(name in modules, `Unexpected component dependency: ${name}`); return modules[name]; },
  });
  const formatDate = Date.prototype.toLocaleDateString;
  try {
    // Server and browser locales/timezones may differ. Initial markup must not
    // depend on either, including when a reused parent context is already ready.
    Date.prototype.toLocaleDateString = () => assert.fail("Dates must wait for the calendar's client mount");
    const html = renderToStaticMarkup(React.createElement(exported.exports.TodayOverview, { workouts: [], active: false, ready: true }));
    assert.equal((html.match(/aria-label="Training day \d: loading"/g) ?? []).length, 7);
    assert.ok(html.includes("Loading your activity…"));
    assert.ok(html.includes('aria-busy="true"'));
  } finally {
    Date.prototype.toLocaleDateString = formatDate;
  }
});
