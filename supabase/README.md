# Arcus backend

For Supabase, run the migrations in `migrations/` in filename order in the Supabase SQL editor or with the Supabase CLI. Run `seed.sql` after the migrations to load the exercise catalog.

For the live Portways database, keep `PORTWAYS_DB_TOKEN` and `DATABASE_URL` in the ignored `.env.portways.local` file or provide them through the process environment. `DATABASE_URL` must use the `remote_3` account, `127.0.0.1`, and `?sslmode=disable`. Never pass the token as a command-line argument.

`npm run dev` and `npm start` launch the bridge on `127.0.0.1` before starting Next.js, then stop both processes together. If port 5432 is occupied, the launcher uses 55432 for that app process. In production, run `npm start` under a process supervisor/container configured to restart on failure; keep the bridge and app in the same host or container network namespace. Do not bind the bridge to `0.0.0.0`.

Run `npm run db:check` with the bridge running to verify that `select current_user` returns `pw_remote`. Run `npm run db:init` once to create the Portways-specific tables. The files in `migrations/` target Supabase's `auth` schema and Supabase roles; they are not the migration set for the Portways database. `portways.sql` is the compatible, repeatable schema setup for this bridge.

The application pool is capped at five connections, query execution at 30 seconds, and idle transactions at 60 seconds. Workout writes are batched as a single request per workout; avoid one query per exercise or set.

The app remains local-first for workout entry: IndexedDB is written first, then completed workouts are synced to Portways when the user is online and signed in. The Supabase anon key belongs in `.env.local` only; never place a service-role key in the browser bundle.

Profile photos are stored directly in Portways PostgreSQL: `arcus_accounts.avatar_image` (`bytea`) and `avatar_mime_type`. Run `npm run db:init` again when upgrading an existing database to add these columns and their constraint without replacing account data. The profile editor uploads the cropped photo when you press **Save profile** while online; logging in retrieves it on another device. Older photos that only exist in IndexedDB need one online profile save. Offline profile saves remain queued in IndexedDB and retry when the signed-in app reconnects or opens again.

The feature expansion adds `arcus_accounts.profile_data` for validated preferences, metrics, goals and enrollment, plus the account-scoped `arcus_library` table for programs, measurements, custom exercises, exercise settings, weekly recaps and favorites. Apply `npm run db:init` for the additive schema upgrade. Library uploads batch records; downloads use pagination. Updates include revision timestamps so an older offline copy cannot replace a newer server revision. See `../FEATURE_EXPANSION.md` for workflows and verification commands.
