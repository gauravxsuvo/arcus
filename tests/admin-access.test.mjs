import test from "node:test";
import assert from "node:assert/strict";
import { canAccessAdmin, canManageUser, isAdminConfigured, matchesDelegatedAdmin } from "../src/features/admin/access.ts";
import { parseAdminQuery } from "../src/features/admin/query.ts";

const account = { id: "e5d21316-12f9-45d3-a091-9f7e980cf03e", email: "owner@example.com" };
const config = { accountId: account.id, email: account.email };

test("admin access denies anonymous accounts and incomplete owner configuration", () => {
  assert.equal(canAccessAdmin(null, config), false);
  for (const incomplete of [{}, { email: account.email }, { accountId: account.id }, { ...config, accountId: "not-a-uuid" }, { ...config, email: " " }]) {
    assert.equal(isAdminConfigured(incomplete), false);
    assert.equal(canAccessAdmin(account, incomplete), false);
  }
});

test("claiming the owner's email or a client-side role cannot grant owner access", () => {
  assert.equal(canAccessAdmin({ ...account, id: "c3ea5f86-bb87-4c7a-b5de-6e5d69ad11e9", isAdmin: true }, config), false);
  assert.equal(canAccessAdmin({ ...account, email: "other@example.com", isAdmin: true }, config), false);
  assert.equal(canAccessAdmin({ ...account, email: "owner@example.com.attacker.invalid" }, config), false);
  assert.equal(canAccessAdmin({ ...account, email: "owner+alias@example.com" }, config), false);
});

test("only the pinned server account and exact normalized email have access", () => {
  assert.equal(canAccessAdmin(account, config), true);
  assert.equal(canAccessAdmin({ ...account, email: " Owner@Example.COM " }, { accountId: account.id.toUpperCase(), email: "OWNER@EXAMPLE.COM" }), true);
});

test("delegated admin grants require both the approved immutable account ID and current email", () => {
  const grant = { accountId: "c3ea5f86-bb87-4c7a-b5de-6e5d69ad11e9", email: "coach@example.com" };
  assert.equal(matchesDelegatedAdmin({ id: grant.accountId, email: grant.email }, grant), true);
  assert.equal(matchesDelegatedAdmin({ id: grant.accountId, email: "changed@example.com" }, grant), false);
  assert.equal(matchesDelegatedAdmin({ id: account.id, email: grant.email }, grant), false);
  assert.equal(matchesDelegatedAdmin(null, grant), false);
});

test("RBAC protects the root owner and moderators from moderator actions", () => {
  const ownerId = account.id;
  assert.equal(canManageUser("OWNER", "USER", "e5d21316-12f9-45d3-a091-9f7e980cf03e", ownerId), false);
  assert.equal(canManageUser("OWNER", "MODERATOR", "c3ea5f86-bb87-4c7a-b5de-6e5d69ad11e9", ownerId), true);
  assert.equal(canManageUser("MODERATOR", "USER", "c3ea5f86-bb87-4c7a-b5de-6e5d69ad11e9", ownerId), true);
  assert.equal(canManageUser("MODERATOR", "MODERATOR", "c3ea5f86-bb87-4c7a-b5de-6e5d69ad11e9", ownerId), false);
  assert.equal(canManageUser("MODERATOR", "OWNER", ownerId, ownerId), false);
});

test("admin route parameters are bounded, deterministic, and retain literal search text", () => {
  assert.deepEqual(parseAdminQuery({ q: "  O'Hara %_  ", page: "3", muscle: " Biceps " }), { page: 3, query: "O'Hara %_", muscle: " Biceps ", pageSize: 25 });
  for (const page of ["", "-10", "1.5", "NaN", "1e8", "Infinity"]) assert.equal(parseAdminQuery({ page }).page, 1);
  assert.equal(parseAdminQuery({ page: "0" }).page, 1);
  assert.equal(parseAdminQuery({ page: "99999999999999999999999999" }).page, 10_000);
  assert.equal(parseAdminQuery({ q: "x".repeat(200), muscle: "m".repeat(200) }).query.length, 100);
  assert.equal(parseAdminQuery({ muscle: "m".repeat(200) }).muscle.length, 100);
  assert.equal(parseAdminQuery({ page: ["2", "500"], q: ["first", "ignored"] }).page, 2);
});

test("muscle filters preserve exact labels accepted by synced exercises", () => {
  for (const muscle of [" Chest ", " ", "m".repeat(61), "m".repeat(100)]) {
    assert.equal(parseAdminQuery({ muscle }).muscle, muscle);
  }
  assert.equal(parseAdminQuery({ muscle: [" Chest ", "Biceps"] }).muscle, " Chest ");
});
