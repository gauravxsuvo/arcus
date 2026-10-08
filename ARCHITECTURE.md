# Arcus architecture

## Saved workout editing

`/history/[id]?edit=1` opens the saved-workout editor using the existing dynamic history shell, including offline fallback. `components/history/workout-editor.tsx` holds an isolated draft: Cancel discards changes, while Save validates with `features/workouts/edit.ts`, writes the same workout ID to IndexedDB and marks the new revision pending for the existing paced sync manager. Duration and date edits produce a consistent start/completion pair. Set types, groups, program references and import metadata remain intact.

The workout model adds optional gym/location, per-exercise notes, strength/cardio tracking, distance in km, duration in seconds, and up to three photo/video attachments. These fields remain backward compatible and are included in validated JSON backups and account-scoped PostgreSQL `arcus_workouts.payload` JSONB; no table migration is necessary. Photos resize in the browser. Videos are limited to 400 KB; combined media data URLs are limited to 600,000 characters and the complete saved record to 900,000 UTF-8 bytes, below the API request cap. Legacy Supabase sync keeps extended records pending instead of acknowledging fields it cannot store. Workouts remain private; public feed visibility requires a separate sharing implementation.

## Full feature expansion (October 2026)

Exercise and History presentation use page-scoped CSS modules and existing semantic theme tokens. The exercise library reuses the workout picker's search, primary/secondary muscle mapping and local Favorites/Recent preferences; custom movements still use the existing library outbox. History uses the pure `features/workouts/filter.ts` helper so date controls match local calendar days while timestamps remain UTC in storage. Mobile session links open the existing detail/editor routes directly. Pasted workouts check for an active draft before writing a new one. These improvements require no database migration or new persistence layer.

Existing feature folders remain the domain boundaries. `features/profile/model.ts` defines optional profile extensions; `features/training/logic.ts` holds pure unit/progression/group/streak/PR calculations. Page-specific components extend existing pages rather than replacing them. Shared profile and theme contexts supply cached account state and preferences; the workout context keeps the active draft available to the logger.

Native IndexedDB wrappers are retained to preserve installed users' data. `ARCUS-local-data` gains settings and recaps additively; existing user profiles gain optional body metrics/history, preferences, structured target goals and active enrollment. Existing string goals remain compatible. All load/tonnage values are stored in kg and height in cm. UI conversion happens at input/output boundaries. Workout sets gain optional RIR, exercises gain group IDs and sessions gain tags/program references. Existing records require no destructive migration.

PostgreSQL `arcus_accounts.profile_data` stores validated profile extensions; avatar bytes remain in `avatar_image`. An account-scoped `arcus_library` table batches program, measurement, custom exercise, exercise settings, favorite and recap payloads. Pending local status is the outbox. Retry after reconnect/focus, acknowledge only the exact saved revision, and preserve unsent changes during server restore. Both library and completed-workout endpoints support paginated restoration after sign-in. Server payload validation, request caps and revision guards protect the database. One process-wide pool with at most five connections survives development reloads. Batch sizes and pacing respect Portways limits. No credentials or password hashes belong in exported backups.

Routes retain their existing meanings. New `/programs/[id]`, `/history/[id]` and `/recaps` provide program schedules, detailed repeat/share views and persisted completed-week summaries. SVG charts and calculators require no chart dependency; sharing renders a canvas PNG. Production service worker v5 preloads static page HTML, route bundles/CSS, dynamic record shells and timer audio. Lazy analytics/calculator chunks warm after worker activation. Offline links use document navigation; dynamic record shells resolve the real ID from the address bar and IndexedDB. Native health integrations remain disabled, labeled placeholders. True scheduled push requires server-side subscriptions and a push provider; foreground recaps work offline.

Feature folders remain the source of truth: `features/profile` (extensions and profile outbox), `features/training` (pure calculations), `features/programs` (templates and enrollment schedule), `features/analytics` (PRs and recaps), `features/import-export` (CSV and validated JSON), and the existing repositories. Presentation is grouped under `components/profile`, `workout`, `progress`, `programs`, `history`, `exercises`, `dashboard` and `shared`. The backup format is ARCUS v3; v2 remains importable. Restoration merges missing IDs, preserves the current active draft and existing records, and applies profile data only to the same account.

Arcus is a mobile-first, local-first workout tracker. The active workout must remain usable in a gym with one hand, with or without a network connection. Desktop expands the same workflows with a sidebar and wider layouts.

## Repository assessment

The repository already contains a working Next.js 15 App Router application. Reusable foundation pieces are:

- `src/app/*`: flat App Router pages for dashboard, workout, history, exercises, programs, progress, profile, auth, and onboarding.
- `src/features/workouts/*`: typed workout model, IndexedDB repository, sync adapters, and transfer import/export.
- `src/features/local-data/repository.ts`: versioned IndexedDB stores for programs, measurements, custom exercises, users, and sessions.
- `src/features/exercises/catalog.ts`: bundled exercise catalog and deterministic search/aliases.
- `src/features/analytics/*`: volume, PR, estimated 1RM, progression, readiness, and plateau calculations.
- `src/components/shared/*`: responsive navigation, service worker registration, network status, and throttled sync manager.
- `src/app/globals.css` and `DESIGN_SYSTEM.md`: existing dark visual system, touch targets, safe areas, responsive layouts, and motion.
- `supabase/migrations/*`, `supabase/seed.sql`, and `supabase/setup.sql`: normalized PostgreSQL schema, RLS, usernames, timestamp triggers, and catalog seed.
- `tests/*.test.mjs`: domain tests for analytics, exercise search, and workout totals.

Do not replace these pieces with a new state or UI framework. Extend the existing feature boundaries and preserve the local-first behavior.

## Runtime boundaries

```text
Browser UI (client components)
  ├─ IndexedDB: active workouts, history, programs, physique, local accounts
  ├─ Service worker: app shell and static asset cache
  └─ Same-origin API calls: live account/session and workout sync

Next.js server boundary
  ├─ Portways PostgreSQL pool (`pg`, max five connections)
  ├─ `/api/auth/*`: central accounts, sessions, and profiles
  └─ `/api/sync/workout`: idempotent completed-workout storage

Portways PostgreSQL (through the local WebSocket bridge)
  ├─ `arcus_accounts`, `arcus_sessions`, and `arcus_workouts`
  ├─ Exercise/muscle catalog and future server-owned records
  └─ `supabase/portways.sql` creates the Arcus-owned tables

Supabase PostgreSQL (optional legacy sync boundary)
  ├─ Exercise/muscle catalog
  ├─ Workouts, exercises, sets
  ├─ Programs and physique entries
  └─ RLS scoped by auth.uid()
```

The sign-in flow is Portways-backed username/password auth with a local IndexedDB cache for offline use. The server stores only scrypt password hashes and hashed HTTP-only session tokens. Existing Supabase sync adapters remain available for older sessions, while new completed workouts use the Portways API.

## Folder structure

```text
src/
  app/
    dashboard/page.tsx
    exercises/page.tsx
    history/page.tsx
    login/page.tsx
    onboarding/page.tsx
    programs/page.tsx
    progress/page.tsx
    profile/page.tsx
    signup/page.tsx
    workout/page.tsx
    workout/complete/[id]/page.tsx
    layout.tsx
    globals.css
  components/shared/
    mobile-navigation.tsx
    network-status.tsx
    service-worker-registration.tsx
    sync-manager.tsx
  features/
    analytics/engine.ts
    analytics/intelligence.ts
    auth/auth-form.tsx
    exercises/catalog.ts
    local-data/repository.ts
    physique/model.ts
    programs/model.ts
    workouts/model.ts
    workouts/repository.ts
    workouts/sync.ts
    workouts/transfer.ts
  lib/auth/{password,server}.ts
  lib/db/pool.ts
  features/import-export/{csv,backup,importer}.ts
  features/import-export/hevy/{parser,mapper,normalizer,validator,exporter}.ts
  lib/supabase/{client,server}.ts
supabase/
  migrations/
  portways.sql
DATABASE_CHANGE_LOG.md
  seed.sql
  setup.sql
tests/
```

Future UI primitives should be added under `src/components/ui` only when a pattern is reused. Feature logic belongs in `src/features`, not inside page markup.

## Data model

### Local IndexedDB

- `ARCUS-training.workouts`: active and completed workout aggregates keyed by client UUID.
- `ARCUS-local-data.programs`: programs, days, progression rules, and sync status.
- `ARCUS-local-data.measurements`: bodyweight and body measurements.
- `ARCUS-local-data.customExercises`: user-created exercises.
- `ARCUS-local-data.exercisePreferences`: favorites and recent usage.
- `ARCUS-local-data.users`: local username, recovery email, password hash, and profile fields.
- `ARCUS-local-data.sessions`: the current local account reference.
- `ARCUS-local-data.imports`: local import batches, fingerprints, counts, warnings, and status.

All local writes happen before the UI acknowledges a mutation. Client-generated IDs make retries idempotent.

### Portways PostgreSQL

- `arcus_accounts` stores the central username, recovery email, scrypt password hash, and profile fields.
- Profile photos live in `arcus_accounts.avatar_image` as PostgreSQL `bytea`, with `avatar_mime_type` identifying JPEG, PNG, or WebP. Uploads are limited to 512 KiB and checked for a matching image signature; a database constraint enforces the size and metadata. The cropper outputs a 512×512 JPEG. The authenticated profile API accepts and returns a data URL for the browser, while PostgreSQL stores decoded bytes.
- Saving a profile online updates the account photo and the IndexedDB cache. Login and `/api/auth/me` restore the saved photo. Omitting a photo in an API update preserves it; `null` removes it. Offline saves remain on the device with an explicit sync-unavailable notice; profile changes do not use the workout sync queue.
- `arcus_sessions` stores hashed HTTP-only session tokens with a 30-day expiry.
- `arcus_workouts` stores the complete local workout payload per account and client ID, so retries are idempotent.
- The server connects through `scripts/portways-db-bridge.mjs` on `127.0.0.1`; `DATABASE_URL` never points directly to the hosted database.

### Local import metadata

- `ARCUS-local-data.imports` records a batch ID, source, file hash, filename, counts, warnings, and status.
- Imported workouts retain `importSource`, `importBatchId`, and a stable source fingerprint so repeated files can be detected and an explicit batch-only undo can be offered.
- Raw CSV files are never uploaded or stored by the browser importer.

### Supabase PostgreSQL (optional)

The migrations define `profiles`, `muscles`, `exercises`, `exercise_muscles`, `exercise_favorites`, `workouts`, `workout_exercises`, `sets`, `programs`, `program_days`, `program_day_exercises`, `bodyweight_entries`, and `body_measurements`. Private tables use `user_id` ownership and RLS. System exercise rows are readable but not editable by users.

## Routing

| Route | Primary purpose |
| --- | --- |
| `/` | Product entry point |
| `/login`, `/signup` | Portways-backed username account flow with local offline cache |
| `/onboarding` | Profile and training preferences |
| `/dashboard` | Resume, start, and review training |
| `/workout` | Active workout logging and rest timer |
| `/workout/complete/[id]` | Completion summary |
| `/history` | Search, filter, inspect, copy, and import sessions |
| `/exercises` | Search catalog and create custom exercises |
| `/programs` | Templates, program builder, weeks, days, progression |
| `/progress` | Volume, PRs, 1RM, physique, readiness, plateau signals |
| `/profile` | Local account and profile |
| `/profile/data` | Import/export, backup, import history, and local data controls |
| `/api/auth/signup` | Create a central account and HTTP-only session |
| `/api/auth/login` | Sign in and refresh the local account cache |
| `/api/auth/logout` | Revoke the current central session |
| `/api/auth/profile` | Update the central profile |
| `/api/sync/workout` | Upsert a completed workout to Portways PostgreSQL |

Add a new route only when it represents a distinct user goal. Settings, sync status, and privacy controls can be added as a focused route when those workflows become real.

## State management

- Page-local React state owns transient form, picker, timer, and filter state.
- IndexedDB repositories own durable local state; pages never manipulate object stores directly.
- Domain modules own calculations such as totals, 1RM, PRs, progression, readiness, and plateau signals.
- Portways database access is isolated in `src/lib/db/pool.ts` and `src/lib/auth/server.ts`; Supabase clients remain isolated in `src/lib/supabase`.
- CSV and HEVY assumptions are isolated under `src/features/import-export`; the UI consumes structured reports rather than parsing rows itself.
- No global store is needed until a state must span unrelated routes. If that happens, add a small scoped store rather than moving durable records into memory.

## Offline and sync strategy

1. Write the active workout locally before updating the UI.
2. Keep timestamps and stable client IDs on every local record.
3. Mark completed workouts, programs, physique entries, and custom exercises `pending`.
4. The sync manager runs on initial load, focus, and reconnect. Completed workouts use the Portways API when an Arcus session exists; the existing Supabase adapter remains a fallback for older sessions.
5. Sync is throttled to 30 seconds and processes bounded batches of ten records.
6. Failures leave local data intact and retry after a delay; a failed network request never blocks workout logging.
7. Server upserts are idempotent and every Portways query scopes records through the HTTP-only session account ID.
8. Later, add a visible retry queue and per-entity conflict resolution using `updated_at`/revision metadata.

Import flow is separate from sync: browser file → detect → validate → map → preview/dry-run → explicit confirmation → local IndexedDB transaction → normal analytics/history reads → optional background sync. A raw CSV is not sent to the server during analysis.

The service worker caches the app shell and static assets. It does not cache private workout records or credentials.

HEVY compatibility is intentionally conservative. HEVY's help centre documents exporting workout/measurement data and importing Strong CSV files, but does not publish a complete current workout-export schema. The adapter supports documented Strong-style columns and common HEVY aliases, surfaces unknown/missing columns, and does not claim official round-trip compatibility without a real HEVY sample. Sources: [Hevy export help](https://help.hevyapp.com/hc/en-us/articles/43708290987415-Exporting-Your-Data-from-Hevy) and [Hevy Strong CSV help](https://help.hevyapp.com/hc/en-us/articles/38001424401943/How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy).

## Mobile-first interaction rules

- Test first at 360, 375, 390, 412, and 430 px.
- Critical controls are at least 44 px; complete set, add set, timer, and finish are preferred at 48 px.
- Bottom navigation is used outside active workout mode; workout controls remain above the safe-area inset.
- Previous performance is visible inside each exercise card.
- Rest time is derived from timestamps so tab switches and refreshes remain accurate.
- Use progressive disclosure for RPE/RIR, set actions, and advanced analytics.
- Respect `prefers-reduced-motion`, keyboard focus, screen-reader labels, and non-color status cues.

## Verification gates

Run these after each feature batch:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Manual acceptance journeys remain: first-time signup, returning active-workout resume, offline workout completion, cloud reconnect, program day launch, and workout copy/paste import.

## Delivery phases

1. Foundation and local persistence — implemented.
2. Workout engine and history — implemented.
3. Analytics and PRs — implemented.
4. Programs and progression — implemented.
5. Physique tracking — implemented.
6. Readiness and plateau guidance — implemented as local heuristics.
7. Cloud sync hardening and multi-device reconciliation — in progress.
8. Optional AI/social features — deferred until core sync and privacy controls are reliable.
9. Accessibility, performance, PWA, and device QA — ongoing.
