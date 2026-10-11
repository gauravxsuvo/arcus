# Production social feed

`/home` reads the latest 20 public completed workouts through the existing pooled PostgreSQL client. The relational SQL joins users and aggregates counts in one bounded query. It does not introduce a second ORM or return raw JSON workout records. Dates are rendered after client mount.

The public identity DTO contains `id`, `name`, `handle`, and `avatarUrl`; the viewer's `following` state is added independently. Account email, password, billing data, private notes, location and workout media are omitted. Public profile photos resolve through a validated, active-account-only endpoint backed by S3 or legacy image bytes.

Server Actions validate Zod schemas, use parameterized SQL and reauthenticate every mutation. Likes/follows are idempotent desired-state writes. Comments are plain text, trimmed, limited to 500 characters, and owner-deletable. Only workout owners can change visibility. Reads exclude nonpublic workouts and restricted accounts. HTML is rejected on incoming API JSON text. React renders text without HTML interpretation.

The application has custom cookie sessions, not NextAuth. `getCurrentAccount` is the authoritative `auth()` equivalent, and rejects expired sessions and banned/suspended accounts. Existing admin mutations keep their stricter OWNER/MODERATOR checks. Workout/library sync scopes every upsert to the authenticated account; no client account ID chooses the write owner. Password login, signup and WebAuthn authentication must remain public to create sessions; WebAuthn registration/management and all account-changing routes require sessions. Middleware checks browser mutation origins; Next.js checks Server Action origins.

Feed HTML/RSC and social image responses bypass offline caching and use private/no-store responses. Follow controls share a pending lock across duplicate instances, dates do not render until mount, and failed optimistic writes revert with a toast. Searches debounce for 300 ms, escape SQL wildcard characters and ignore obsolete responses.

## Migration and verification

Run `npm run db:migrate:social-production` after migration 0010 on a fresh deployment. This adds plain-text comment constraints and feed indexes. Existing historical comments are preserved; the NOT VALID constraint enforces the rule for all new writes.

`npm test` includes authorization, ownership, privacy, validation and DTO tests. `node scripts/check-social-production.mjs` checks real PostgreSQL operations inside a transaction and rolls back all test writes. It supplies a test session only within its isolated verification runtime; application authentication is separately exercised in browser QA. It never grants new admin access or persists credentials.

This pass verifies these security boundaries; it is not a claim of a complete external penetration test or payment-system certification.
