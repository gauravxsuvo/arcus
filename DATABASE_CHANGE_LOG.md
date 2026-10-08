# Database change log

## 2026-10-08 — Full feature expansion

- Applied the repeatable `supabase/portways.sql` setup to the live Portways database. Added `arcus_accounts.profile_data jsonb` with an empty-object default and account-scoped `arcus_library` rows for programs, measurements, custom exercises, settings, recaps and favorites. Existing account, avatar and workout data were retained.
- The API authenticates the owner from the session, validates payloads, limits requests and paginates retrieval. Older revisions cannot overwrite newer server records. The process-wide PostgreSQL pool remains capped at five connections.
- Live checks verified preferences, dated metrics, goals, new-login retrieval, programs/favorites, completed workouts with RIR/tags/groups, malformed payload rejection, stale revision rejection and account isolation. The avatar bytea regression check also passed.
- Checks used disposable accounts only. All test accounts and their dependent records were removed, including two accounts left by a development connection-limit interruption.
- Rollback: revert the feature client/API changes first. The additive column and table may remain; dropping either would remove saved feature data and is unnecessary for application rollback.

## 2026-10-08 — PostgreSQL profile photos

- **Migration:** applied the repeatable `supabase/portways.sql` setup to the live Portways database.
- **Table affected:** `public.arcus_accounts`.
- **Added:** nullable `avatar_image bytea`, nullable `avatar_mime_type text`, and `arcus_accounts_avatar_check` enforcing paired metadata, JPEG/PNG/WebP formats, and a 512 KiB maximum. Existing accounts keep null photos until an online profile save uploads their device-local image.
- **Ownership:** authenticated profile updates use the session's account ID. No client-supplied owner ID is used.
- **Storage:** actual decoded image bytes are stored in PostgreSQL. Data URLs are only used for API transport and the IndexedDB/browser cache.
- **Verification:** live upload, direct binary-column inspection, session retrieval, fresh login, omission, removal, and invalid/oversized/unauthenticated uploads are covered by `scripts/check-profile-avatar.mjs`. The script creates and cleans up its own disposable account; existing users are untouched.
- **Rollback:** first revert the profile-photo API/client change. The nullable columns can safely remain; dropping them would discard stored photos and is unnecessary for application rollback.

## 2026-10-08 — Import/export and PWA audit

- **Migration:** none applied.
- **Tables affected:** none.
- **Columns/indexes/RLS:** unchanged.
- **Production writes:** none. The importer is local-first and performs dry-run and confirmed writes in browser IndexedDB only.
- **Backward compatibility:** unchanged for the existing Portways auth/session/workout API and Supabase migrations.
- **Rollback:** no database rollback is required. Local import batches are identified by batch ID for scoped undo.
- **Risk:** low. Any future server-side import migration must be additive, account-scoped, and preceded by a verified backup/snapshot.

## Existing Portways schema reference

The current additive tables are defined in `supabase/portways.sql`:

- `arcus_accounts`
- `arcus_sessions`
- `arcus_workouts`

They are used by the server-side auth/profile/workout routes. This batch does not alter them or run a destructive seed against the shared database.

## Production safety rules for future import persistence

Before adding server-side import tables or migrations:

1. Inspect live table definitions, constraints, indexes, row counts, and ownership paths with read-only queries.
2. Verify a current backup/snapshot with the database operator; do not assume one exists.
3. Add nullable/additive columns or new tables only, with an account foreign key and an idempotency key.
4. Use a transaction and an authenticated account ID from the HTTP-only session; never accept a client-supplied owner ID.
5. Test with fixtures and a dedicated test account, then verify affected-row counts before any cleanup.
