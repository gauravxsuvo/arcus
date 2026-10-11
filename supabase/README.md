# Arcus backend

The `migrations/`, `seed.sql`, and `setup.sql` files are retained as historical schema sources. ARCUS runtime connections use Portways PostgreSQL only.

The app connects directly to Portways with `@neondatabase/serverless` over secure WebSockets. Set `PORTWAYS_DB_TOKEN`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` in the server environment. The local bridge and `DATABASE_URL` format are only needed by external PostgreSQL tools; never pass the token as a command-line argument.

`npm run dev` and `npm start` launch the bridge on `127.0.0.1` before starting Next.js, then stop both processes together. If port 5432 is occupied, the launcher uses 55432 for that app process. In production, run `npm start` under a process supervisor/container configured to restart on failure; keep the bridge and app in the same host or container network namespace. Do not bind the bridge to `0.0.0.0`.

Run `npm run db:check` with the bridge running to verify that `select current_user` returns `pw_remote`. Run `npm run db:init` once to create the Portways-specific tables. The numbered migrations are applied to Portways using the matching `db:migrate:*` script; `portways.sql` is the compatible, repeatable base schema setup.

The application pool is capped at five connections, query execution at 30 seconds, and idle transactions at 60 seconds. Workout writes are batched as a single request per workout; avoid one query per exercise or set.

The app remains local-first for workout entry: IndexedDB is written first, then completed workouts and library records are synced to Portways when online and signed in. Authenticator secrets require a stable `ARCUS_TOTP_ENCRYPTION_KEY`. Password reset requires `RESEND_API_KEY` and a verified `AUTH_EMAIL_FROM` sender.

Profile photos are stored directly in Portways PostgreSQL: `arcus_accounts.avatar_image` (`bytea`) and `avatar_mime_type`. Run `npm run db:init` again when upgrading an existing database to add these columns and their constraint without replacing account data. The profile editor uploads the cropped photo when you press **Save profile** while online; logging in retrieves it on another device. Older photos that only exist in IndexedDB need one online profile save. Offline profile saves remain queued in IndexedDB and retry when the signed-in app reconnects or opens again.

The feature expansion adds `arcus_accounts.profile_data` for validated preferences, metrics, goals and enrollment, plus the account-scoped `arcus_library` table for programs, measurements, custom exercises, exercise settings, weekly recaps and favorites. Apply `npm run db:init` for the additive schema upgrade. Library uploads batch records; downloads use pagination. Updates include revision timestamps so an older offline copy cannot replace a newer server revision. See `../FEATURE_EXPANSION.md` for workflows and verification commands.

Sleep check-ins are stored in the private, account-scoped `arcus_sleep_logs` table. Apply `npm run db:migrate:sleep` to an existing Portways database; the command is safe to rerun. The sleep API authenticates every read and write, derives duration and readiness on the server, and never returns data from another account.

Morning weigh-ins are stored in the private, account-scoped `arcus_weight_logs` table. Apply `npm run db:migrate:weight` to an existing Portways database; the command is safe to rerun. The recovery map reads only the signed-in account's synced completed workouts and returns aggregated muscle counts and timestamps. Weight history reads and writes require the signed-in account and are unique per local calendar date.
