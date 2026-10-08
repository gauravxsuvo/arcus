# Forge Training

Forge is a local-first training log in active development. It includes Supabase email/password auth and profile onboarding, exercise search, an IndexedDB-backed workout logger, rest timer, completion summaries, history, strength and volume analytics, training programs with progression settings, bodyweight and measurement tracking, custom exercises, and an installable offline shell. Completed workouts and queued program, physique, and custom exercise changes sync to Supabase when online and signed in; active drafts remain on the current device until completion. Multi-device conflict resolution and full browser-level offline verification remain outstanding.

## Local development

1. Install Node.js 22.6 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `PORTWAYS_DB_TOKEN`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` from Portways. These values are server-only; never prefix them with `NEXT_PUBLIC_`.
4. Apply the Portways schema once with `npm run db:init`.
5. Run `npm run dev` and open `http://localhost:3000`.

The runtime connects directly to Portways over an encrypted WebSocket, so local development and Vercel use the same four database variables and need no local bridge. The bridge script is still available for external PostgreSQL tools. Do not run destructive database checks against the shared production database.

For Vercel, add the four Portways variables in the project's server-side Environment Variables settings. Use the same values for Development and Production only if you intend both environments to share the same accounts and workout data. Vercel can create multiple function instances; each instance has a pool limit of three, so the combined number of active instances must stay within the connection limit on your Portways token.

## Project checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for routing, schema, offline strategy, and the implementation plan. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for interface conventions.

## Sharing previews

Set `SITE_URL` to the actual public website origin before a production build (for example, `https://thearcus.vercel.app` if that is your deployment). Open Graph and Twitter cards share the public ARCUS banner and never include profile or workout data. Vercel's production domain is detected automatically when `SITE_URL` is unset; local development uses `http://localhost:3000`.

The static banner is `public/og/arcus-share.png`. To change it, edit `public/og/arcus-share.svg` and run `node scripts/generate-share-image.mjs`; the script reuses the existing brand icon. The dedicated Apple touch icon is `public/icons/apple-touch-icon.png` (180 × 180).
