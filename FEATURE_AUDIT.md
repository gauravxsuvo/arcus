# Arcus feature audit

This audit reflects the current repository after inspecting the App Router pages, feature modules, IndexedDB repositories, Supabase migrations, service worker, and tests. Features marked implemented are reused as-is unless a later batch finds a concrete defect.

| Feature | Status | Existing implementation | Required changes | Priority |
| --- | --- | --- | --- | --- |
| Mobile-first shell | implemented | Responsive CSS, safe areas, mobile bottom navigation, desktop rail | Test at the specified device widths and fix concrete defects only | High |
| Active workout logging | implemented | IndexedDB draft, exercise cards, set rows, notes, completion flow | Add warm-up/set modifier disclosure without slowing default logging | High |
| Previous performance | implemented | Previous completed sets shown on each exercise | Prefill and progression rules need broader coverage | High |
| Rest timer | implemented | Timestamp-based timer, refresh recovery, +/-15, skip | Add pause/resume, presets, sound/haptics preferences | High |
| RPE | partially implemented | Compact RPE set input and program RPE progression | Add user preference and optional RIR mode | High |
| RIR | missing | No RIR field or conversion guidance | Add optional field and explicit non-exact RPE/RIR guidance | High |
| Advanced set types | partially implemented | Set action menu has a working-set default | Add warmup, drop, failure, paused, AMRAP, top-set metadata | High |
| Warm-up generator | implemented | Percentage-based local generator and secondary Add warm-up action; warm-ups excluded from working totals | Add user-configurable percentages and warm-up defaults | High |
| Flexible prescriptions | partially implemented | Numeric rep min/max and program progression | Support AMRAP, timed, distance, and text prescriptions | High |
| Bodyweight/added/assisted load | partially implemented | Nullable weight supports bodyweight logging | Define load semantics and analytics rules | High |
| Unilateral logging | missing | No left/right or alternating set model | Add optional side metadata and symmetric entry | High |
| Exercise catalog/search | implemented | Bundled 34-movement catalog, aliases, recent use, custom exercises | Expand metadata and typo-tolerant relevance ranking | High |
| Exercise alternatives | partially implemented | New pattern/muscle/equipment scoring helper and alternatives on detail view | Add user equipment/preferences and current-session swap action | High |
| Exercise detail | implemented | `/exercises/[id]` shows metadata, history, best e1RM, recommendation, and alternatives | Expand catalog metadata and trend chart as data grows | High |
| Favorites/recent exercises | partially implemented | Favorites and recent-use IndexedDB records exist | Surface favorites/recent first in picker and add custom groups | High |
| Program builder | implemented | Templates, weeks, days, progression rules, launch into workout | Add duplication, optional exercises, supersets, snapshots, schedule | High |
| Workout duplication/repeat | partially implemented | Program day launch and transfer import exist | Add repeat-last and duplicate-history actions | High |
| Auto-fill next workout | partially implemented | Previous values and progression suggestions exist | Merge previous session, prescription, recommendation, and defaults | High |
| Analytics/1RM/PRs | implemented | Epley/Brzycki, PR list, volume, muscle distribution | Add dedicated PR center and timeline filters | High |
| Volume/frequency analytics | partially implemented | Weekly volume and muscle totals exist | Add rolling windows, frequency, and change detection | High |
| Readiness/plateau signals | implemented | Local readiness score and cautious plateau heuristic | Persist optional energy/soreness/sleep inputs and show methodology | Medium |
| Workout difficulty/mood | missing | No post-session subjective feedback | Add optional completion feedback without blocking finish | Medium |
| Physique tracking | implemented | Bodyweight and measurements with local persistence | Add private progress photos and comparison later | High |
| Calendar/scheduling | missing | Programs have week/day structure but no calendar | Add scheduled/rest/missed/rescheduled model and view | High |
| Streaks/adherence | missing | Dashboard shows weekly sessions only | Add healthy consistency and program adherence calculations | Medium |
| Goals/milestones | missing | No goal model or UI | Add small active-goal set and deterministic progress | High |
| Gym/equipment profiles | missing | Exercise equipment metadata only | Add local gym profile, equipment, bar, and plate inventory | High |
| Plate calculator | missing | No plate calculation domain module | Add inventory-aware per-side calculation | High |
| Cardio/time/distance | missing | Strength-centric weight/reps model | Extend set metrics without disrupting strength flow | Medium |
| History editing/comparison | partially implemented | Search/filter/detail and copy/import exist | Add safe editing, comparison, and historical recalculation | High |
| Data export/import/backup | partially implemented | Workout text/JSON transfer exists | Add validated full-account JSON/CSV backup and restore | High |
| Shareable summaries | missing | Completion summary is private in-app | Add explicit opt-in share card later | Medium |
| Settings/preferences | missing | Profile/onboarding contain some preferences | Add units, timer, RPE/RIR, density, motion, privacy controls | High |
| Sync/outbox | partially implemented | Supabase schema, sync adapters, throttled manager | Add authenticated route boundary, visible retry state, conflicts | High |
| Privacy/account deletion | missing | Local sign-out exists; no deletion/export controls | Add explicit local/cloud deletion workflows | High |
| PWA/offline | implemented | Manifest, service worker, local-first writes, network status | Add install QA and cache/version diagnostics | High |
| Accessibility | partially implemented | Labels, focus styles, touch targets, reduced motion | Audit keyboard/screen reader flows and non-color states | High |
| Tests | partially implemented | 9 domain tests pass | Add tests for warmups, plates, export, progression, sync, goals | High |
| Feature flags/monitoring | missing | No centralized flags or privacy-safe telemetry | Add only when a real experimental feature needs it | Low |
| AI/social | missing | Intentionally deferred | Do not start until sync, privacy, and deterministic data are reliable | Low |

## First implementation batch

The next batch should target the highest-value missing functionality while protecting the fast set flow:

1. Exercise detail and alternative recommendations.
2. Warm-up generation and advanced set metadata behind progressive disclosure.
3. Full-account export/backup with validation.
4. Units/timer/RPE preferences and a visible sync retry state.

Each batch must update domain logic first, add focused tests, then add the mobile UI and run typecheck, lint, tests, build, and device-width review.

## Pasted production-safe import/PWA specification audit (2026-10-08)

| Requested feature | Status before this batch | Existing files to reuse | Planned change | Database impact | Risk |
| --- | --- | --- | --- | --- | --- |
| HEVY/Strong CSV parsing | missing | `src/features/workouts/transfer.ts` has text/JSON transfer parsing | Add isolated CSV parsing and a HEVY adapter with header detection, unit/date validation, aliases, and warnings | none for dry-run; local metadata only for confirmed imports | medium |
| Import preview and dry-run | missing | local-first IndexedDB repositories | Add browser-only analyze → preview → confirm flow with no writes before confirmation | none | low |
| Idempotent import and undo metadata | missing | workout UUIDs and repository | Add additive local import metadata plus source fingerprint and batch fields | no production write; server migration deferred | medium |
| HEVY-compatible export | missing | `WorkoutRecord`, existing transfer helpers | Add documented Strong-compatible CSV adapter and avoid claiming official HEVY round-trip compatibility without a real sample | none | low |
| Generic CSV/JSON/full backup export | partial | local workout/program/physique repositories | Add RFC-safe CSV serialization and password/token-free JSON backup | none | low |
| Import history and error report | missing | existing profile surface | Add mobile-first Data & migration section with report download and batch list | local metadata only | low |
| PWA app shell | partial/implemented | manifest, service worker, registration component | Add install metadata, offline fallback, cache versioning, and documentation | none | low |
| Production DB safety | partial | Portways auth/workout API and additive schema | No destructive SQL; document read-only inspection, scoped writes, and deferred server import migration | none in this batch | low |

### Format evidence

No HEVY sample CSV exists in the repository. HEVY's help centre documents workout/measurement exports and says its CSV import accepts Strong exports, but does not publish a complete current workout-export header schema. The adapter therefore detects documented Strong-style headers plus common HEVY export aliases, reports unknown/missing columns, and does not claim official round-trip compatibility without a real sample. See the sources in `ARCHITECTURE.md`.

### First implementation slice

1. Add tested RFC-safe CSV parsing/serialization and the isolated HEVY adapter.
2. Add local-only analyze/preview/confirm import with file fingerprints and batch metadata.
3. Add profile → Data & migration actions for import, HEVY export, generic CSV, and JSON backup.
4. Harden the existing PWA shell without changing active workout interaction.
5. Keep server-side import persistence out of this batch until a verified backup and an additive migration are available.
