# ARCUS feature expansion

## Available workflows

| Area | Implemented behavior |
|---|---|
| Profile | Square photo crop with keyboard controls; PostgreSQL binary avatar; initials fallback; kg/lb, cm/feet/inches, body fat, DOB/age, dated history; unit, theme, rest, effort and week-start preferences; training-level selection; bodyweight and lift targets |
| Workout | Persisted editable rest countdown with chime/vibration; supersets, tri-sets and circuits with round-aware rest; RPE/RIR select and number picks; notes/tags; exercise-specific rest and progression/deload rules; plate diagram |
| Exercises | 106 built-in movements; category, equipment and primary/secondary muscle filters; alphabetical/use/recent sorting; favorites; custom movements with notes and multiple muscles; form text and load chart |
| Progress | Actual single, estimated 1RM and session-volume records; live PR banner; timeline; weekly tonnage/working sets; daily/weekly streaks and six-month heatmap; dated weight/body-fat chart; three-formula 1RM calculator |
| Programs | Seven editable templates, level filter, enrollment/start date, dashboard schedule, workload blocks and configurable deloads; existing custom builder with target RPE |
| History | Existing search/date filters; detailed sets, notes, tags and record badges; grouped exercises; repeat as a new draft; comparison of matching exercises |
| Dashboard | Scheduled day, resume/quick start, weekly ring and streak; three goals, five recent records and three recent sessions |
| Sharing/recaps | Downloadable canvas PNG and file sharing where supported; stored completed-week recaps; permission-based local recap alerts when the app opens |
| Data | Existing HEVY CSV import/export preserved; complete JSON backup including the catalog, preferences and active draft; validated merge restore; workouts, exercises and body-metrics CSV exports |
| Persistence | Additive IndexedDB v4; queued account/library/workout sync; paginated account restore; production PWA cache including dynamic offline record shells and lazy feature bundles |

## Explicit placeholders

Exercise demo videos show a local poster until actual media is supplied. Apple Health and Google Fit toggles are disabled stubs. Recap alerts run when the app opens after a week ends; scheduled push delivery while the app is closed needs a push service and subscription management.

## Validation commands

- `npm run typecheck`, `npm run lint`, `npm test`
- `node scripts/check-feature-ui.mjs`: isolated Chrome context at 375px and desktop; mocked API; profile crop/save, imperial/RIR logging, reload, grouped rest, PNG sharing, layout, backup restore, enrollment and theme
- `node --experimental-strip-types scripts/check-feature-backend.mjs`: live Portways checks with disposable accounts and cleanup
- `node scripts/check-profile-avatar.mjs`: live avatar storage/validation regression check
- `$env:ARCUS_DIST_DIR='.next-verify'; npm run build`: separate production build
- `node scripts/preview-feature-build.mjs`: localhost-only production verification on port 3001 using the already running bridge
- `$env:ARCUS_TEST_URL='http://127.0.0.1:3001'; node --experimental-strip-types scripts/check-feature-offline.mjs`: unopened pages, dynamic IDs, charts, rest recovery, lazy plates, offline links and queued profile saving

Screenshots and generated test downloads are saved under ignored `artifacts/feature-check`. Browser checks use isolated fixture data. Backups include the user's training and profile data, and omit password hashes, credentials and authentication sessions.
