# Forge Training

Forge is a local-first training log in active development. It includes Supabase email/password auth and profile onboarding, exercise search, an IndexedDB-backed workout logger, rest timer, completion summaries, history, strength and volume analytics, training programs with progression settings, bodyweight and measurement tracking, custom exercises, and an installable offline shell. Completed workouts and queued program, physique, and custom exercise changes sync to Supabase when online and signed in; active drafts remain on the current device until completion. Multi-device conflict resolution and full browser-level offline verification remain outstanding.

## Local development

1. Install Node.js 22.6 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and anon key.
4. Apply migrations in `supabase/migrations` to a local or hosted Supabase project.
5. Run `npm run dev` and open `http://localhost:3000`.

The service role key is server-only and must never be prefixed with `NEXT_PUBLIC_` or used in a browser module. It is not needed for the current app shell.

## Project checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for routing, schema, offline strategy, and the implementation plan. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for interface conventions.
