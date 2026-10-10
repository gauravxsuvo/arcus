# Arcus architecture

## Mobile interaction polish

The current routes and providers remain intact. Shared presentation primitives under `components/shared` supply numeric text fields, accessible save toasts, route/workout titles and the current-year footer. Workout CSS reflows set controls on mobile so weight/reps and their increment buttons stay comfortably tappable without horizontal scrolling. Page-specific structure and semantic dark/light theme tokens remain the visual foundation.

`features/workouts/draft-backup.ts` owns a validated, single active-workout localStorage snapshot. IndexedDB remains the authoritative workout/history store and the existing sync outbox. The logger writes its newest revision synchronously before queuing IndexedDB writes, so an older queued write cannot overwrite the emergency snapshot. Recovery checks completion/deletion and revision order before restoring a draft. This backup contains workout data only; it does not contain credentials, profiles or sessions. Finishing/deleting removes only the matching active snapshot. Production offline code/static asset caching and paced PostgreSQL sync retain their existing boundaries.

Install icons are generated from the supplied ARCUS logo and served from `public/icons`. The manifest, Apple touch icon and theme-color metadata use the same product identity. Unknown routes show the 404 recovery screen. See `MOBILE_UX_ASSESSMENT.md` for the 20-item audit and verification scope.

## Product and social-media boundaries

Promotional films are standalone Instagram/social-media assets, outside the website's routes, layouts, providers and product interactions. There is no `/promo` route. Exported media and archived creative sources remain in the ignored `artifacts/promo/` directory and are not served by Next.js. The application uses its normal profile, theme, workout, offline and sync providers without a film-specific runtime or preview account context.

The website follows the typography-led, minimal editorial direction in `DESIGN_SYSTEM.md`: readable training data, deliberate spacing, clear hierarchy and restrained motion that helps people use the app. Film playback, soundtrack, chapter navigation and animated storytelling belong exclusively to social exports.

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
- The server uses `@neondatabase/serverless` to open PostgreSQL over Portways' secure WebSocket gateway, with the database token sent as the `portways-token.<token>` WebSocket subprotocol. `PORTWAYS_DB_TOKEN`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` are server-only environment variables shared by local development and Vercel. The app keeps one module-level pool per runtime with a maximum of three connections, a five-minute idle timeout, and a one-hour connection lifetime. The local bridge remains available for external database tools; runtime app requests do not depend on it.

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

The service worker caches the app shell and static assets. It does not cache private workout records or credentials. Next.js code and CSS use the network first, with cached production assets available offline; responses marked `no-store` never remain in the shell cache. Production registration bypasses the browser's script cache when checking worker updates.

Development server HTML runs `features/offline/development-worker-reset.ts` before the app mounts. It removes only ARCUS/legacy Forge shell caches and the same-origin `/sw.js` registration, then reloads once if that worker controlled the page. IndexedDB, account data, workouts and localStorage preferences are untouched. This prevents an earlier production worker from serving obsolete development bundles at stable chunk URLs. The weekly overview uses identical placeholders until its own client mount and data load, then formats dates in the browser's locale and timezone.

HEVY compatibility is intentionally conservative. HEVY's help centre documents exporting workout/measurement data and importing Strong CSV files, but does not publish a complete current workout-export schema. The adapter supports documented Strong-style columns and common HEVY aliases, surfaces unknown/missing columns, and does not claim official round-trip compatibility without a real HEVY sample. Sources: [Hevy export help](https://help.hevyapp.com/hc/en-us/articles/43708290987415-Exporting-Your-Data-from-Hevy) and [Hevy Strong CSV help](https://help.hevyapp.com/hc/en-us/articles/38001424401943/How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy).

## Mobile-first interaction rules

Active workout sets use Framer Motion (`framer-motion`) for height/opacity presence animation, constrained horizontal drag, and shared button press feedback. Swipes start only on non-interactive row areas, preserve vertical scrolling with `touch-action: pan-y`, and delete only after at least 75 px of actual left displacement. Drag momentum and rightward elasticity are disabled. Short swipes spring to zero; reduced-motion users get an immediate reset. Deletions retain the last-set guard, normal menu alternative and serialized local saves. A temporary Undo action reinserts only the removed set into the latest active draft, preserving intervening edits, added sets, effort and completion metadata. Exiting rows are inert and restore focus to Add set. The shared sheet uses the same Framer Motion package, avoiding duplicate animation dependencies.

The dashboard's existing module header is sticky and reserves its own height in normal flow; the shared `.mobile-navigation` remains fixed. Both use `--glass-background` and `--glass-border` theme tokens, prefixed/unprefixed backdrop blur with saturation, a static compositor transform, and z-index 50. Dashboard gutters extend the glass to the page edges while preserving safe-area insets. Mobile feed padding and scroll padding leave the last item above the nav. Supported browsers use overflow clipping rather than a separate body overflow container so the header can stick to the viewport. The global light-theme surface rule excludes the nav to avoid replacing its translucent background.

Workout assistance lives in `features/workouts/set-assistance.ts`, keeping copying and historical matching independent of UI and persistence. Auto-fill changes only the immediately following blank, unfinished working set; planned/edited values, warm-ups, drop sets and effort retain their meaning. Historical values match by exercise ID and ordinal within set type. `components/workout/previous-set.tsx` exposes those measurements and an explicit Use action. Every resulting change goes through the existing draft backup and serialized IndexedDB save queue. Newly started sessions refresh local completed history first.

`components/workout/use-session-comfort.ts` owns validated, device-local preferences in `arcus-session-comfort-v1`; they do not change the account profile or server data model. The screen wake lock is opt-in and scoped to a visible active workout. `features/device/screen-wake-lock.ts` manages one lock, releases it when hidden/finished/unmounted, handles in-flight cleanup, and reacquires on returning to the page. Denied requests never cause a retry loop. Supported browsers provide brief vibration for set completion and rest completion. The existing plate engine is reused in an exercise-scoped sheet; all stored loads remain kg. Production offline preparation also warms the route-loaded progress chart bundle alongside existing analytics and plate tools.

Progress charts are derived locally from completed workout records. `features/analytics/chart-data.ts` prepares a chronological, bounded exercise series using the existing 1RM engine; weekly volume uses the existing calendar-week aggregation. `components/progress` holds route-loaded Recharts views, themed tooltips and accessible data tables. Persisted weights stay in kg; the view converts both charts and tooltips to the user's units.

`components/shared/route-transition.tsx` animates bottom-tab content entry without replacing route state or providers. Shared motion primitives use Motion's animation-only feature bundle for set-row presence and a native dialog sheet. The exercise picker reuses its filters inside that sheet. Data mutations/save queues remain independent of animation, and exiting rows become inert. Native dialogs own keyboard trapping; focus and body scroll are restored on close. All motion follows reduced-motion preferences; promotional media remains separate.

Root metadata provides the constrained, safe-area-aware viewport, a dedicated 180 px Apple touch icon and Open Graph/Twitter cards. The sharing image is a static 1200 × 630 PNG derived from the existing logo and an editable SVG; no rendering service or external font is needed. Set server-side `SITE_URL` to the actual public deployment origin for absolute sharing URLs. Vercel's production URL is the next fallback, followed by its preview URL and localhost for development. A temporary tunnel or untrusted request Host header is never used as the canonical sharing origin.

The saved theme is applied before React mounts. An inline bootstrap creates and owns one mutable `theme-color` tag; the static Next viewport intentionally omits that field, so React does not duplicate a tag whose content changed before hydration. A raw `noscript` fallback supplies the default dark color without hoisting another active tag when JavaScript is enabled. The existing profile preference provider owns subsequent theme changes, using the same canvas colors. Numeric text inputs use the decimal keypad and a fractional pattern for loads; whole-number reps/sets use the numeric keypad and integer pattern.

- Test first at 360, 375, 390, 412, and 430 px.
- Critical controls are at least 44 px; complete set, add set, timer, and finish are preferred at 48 px.
- Bottom navigation is used outside active workout mode; workout controls remain above the safe-area inset.
- Previous performance is visible inside each exercise card.
- Rest time is derived from timestamps so tab switches and refreshes remain accurate.
- Use progressive disclosure for RPE/RIR, set actions, and advanced analytics.
- Respect `prefers-reduced-motion`, keyboard focus, screen-reader labels, and non-color status cues.

## Owner administration

The `(admin)/admin` route group serves `/admin`, `/admin/users`, `/admin/exercises` and `/admin/settings` with a separate desktop sidebar and scoped Tailwind/CSS design. `ApplicationShell` excludes the consumer profile/workout providers, sync managers and bottom navigation on these routes. `AdminLink` and table transitions provide immediate indeterminate loading feedback; `loading.tsx` covers streamed route content.

`lib/auth/admin.ts` validates the existing HTTP-only PostgreSQL session against the server-only `ARCUS_ADMIN_EMAIL` **and** `ARCUS_ADMIN_ACCOUNT_ID`. Both must match; missing configuration denies access. The ID pin is necessary because account signup does not verify email ownership. Run `npm run admin:configure -- owner@example.com` only after creating and confirming the owner account. It reads that existing account's ID, writes only those keys to ignored `.env.local`, and never grants a role or changes database records. Set both keys in the hosting environment too. Owner access cannot be granted through client profiles, public environment variables or signup metadata.

The server layout checks access, and every page/data repository checks it again before reading global records because App Router layouts can persist across client navigation. React `cache` deduplicates the session lookup within a render only; it does not cache authorization across users. No Edge middleware or Supabase session is involved. The portal uses Node.js and the existing bounded Portways pool.

Overview uses one aggregate query after authentication. Users and exercises use server-side search/filtering and 25-row pagination with bounded parameters and deterministic ordering. Exercise inventory distinguishes the shipped static catalog from synced account-owned custom definitions. Reporting uses UTC dates and Monday weeks; the workout metric counts completed synced sessions because active device-local drafts are not stored on the server. Admin views never return password hashes, session tokens, avatar blobs or full workout payloads.

Admin routes are dynamic, private/no-store and excluded from indexing. The service worker bypasses admin documents, RSC requests and future admin APIs entirely. Management dropdowns provide real read-only details; edit/ban/delete actions are visibly disabled until an audited mutation backend, validation, CSRF protection and lifecycle rules are implemented. This batch needs no database migration.

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
