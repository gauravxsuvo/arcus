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

## Owner console

The protected owner portal is at `/admin`, with Overview, Users, Exercise Database and Settings. User profile edits, reversible bans, and edits/removals for synced custom exercises are saved to PostgreSQL and recorded in the management activity log. Built-in exercises remain bundled with the app and cannot be changed from this portal. Exercise removal is a soft delete, so workout history is preserved.

Create your owner account through the normal signup form and confirm you can sign in, then run:

```text
npm run admin:configure -- owner@example.com
```

The helper pins the existing account's email and immutable ID in ignored `.env.local`. Restart the app afterwards. Configure the same `ARCUS_ADMIN_EMAIL` and `ARCUS_ADMIN_ACCOUNT_ID` server environment variables on Vercel. Both are required; the console denies access when either is missing, and a public signup claiming the owner email is never sufficient. No new account or database role is created by this command.

Before using account bans or management activity, apply `supabase/migrations/0005_admin_management.sql` to Portways with `npm run db:migrate:admin`. This adds the account ban flag and the management audit log. Apply it once per production database before deploying the admin routes.

## Passkeys and Apple Health imports

Online accounts can register a device passkey from Profile → Account security and sign in with it from the login page. Apply `supabase/migrations/0006_passkeys.sql` to each database with `npm run db:migrate:passkeys` before enabling passkey sign-in. Production must use HTTPS. Set `WEBAUTHN_ORIGIN` to the exact public origin and `WEBAUTHN_RP_ID` to its hostname when the deployed origin cannot be inferred from `SITE_URL` or Vercel's production URL. Keep both values server-only.

Profile → Data can import Apple Health's `export.xml` locally. The importer supports workout session summaries and bodyweight records, with duplicate detection and per-import undo; it does not import Apple Health workout sets or access HealthKit directly from a browser.

Admin pages require a fresh authenticated server response and are not available offline. Dashboard workout counts include completed synced workouts; active local drafts are not centrally tracked. The exercise table includes the built-in catalog and synced custom definitions, while the database stat counts only persisted custom definitions.
