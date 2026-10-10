# Mobile-first implementation assessment

Extend the existing Next.js App Router, semantic theme tokens, page CSS modules, IndexedDB repositories, profile/theme/workout providers and bottom navigation. Preserve the hydration/cache fixes, existing PostgreSQL sync and the minimal editorial product design. No database migration or additional UI/state dependency is needed.

| Request | Existing implementation and proposed change |
| --- | --- |
| 1. No horizontal page scroll | Add a shared overflow boundary and keep forms/grids shrinkable. Verify narrow viewport geometry. |
| 2. 44 px targets | Preserve bottom navigation; enforce comfortable controls and expandable summaries on mobile. |
| 3. Numeric keyboards | Reuse a text-based numeric field with decimal/integer keyboards, partial editing and finite/range validation. Decimal patterns must accept fractional weights. |
| 4. Bottom navigation | Reuse the existing safe-area-aware Home/Workout/History/Profile bar. |
| 5. Increment controls | Reveal large weight/rep steppers in a dedicated mobile set layout. |
| 6. Success feedback | Add a restrained accessible toast after a set/workout actually saves. |
| 7. Invalid/empty saves | Reuse existing workout/editor validation and strengthen set checks and inline errors. |
| 8. Empty states | Reuse Home's primary workout action, history graphic and import option. |
| 9. Saving feedback | Preserve save indicators, disabled finish controls and loaders; add visible spinner feedback. |
| 10. Tap feedback | Apply subtle pressed states and visible keyboard focus. |
| 11. Dark mode | Reuse saved theme preferences and expose the toggle on mobile Profile. |
| 12. Installation icons | Generate compact PNG icons from the supplied ARCUS logo and add Apple/manifest metadata. |
| 13. Refresh protection | Keep IndexedDB authoritative; synchronously mirror the latest active draft in localStorage, validate recovery, and clear only its snapshot after completion/deletion. |
| 14. Viewport | Configure the requested scale limits and use 16 px mobile form text to avoid input focus zoom. |
| 15. Status bar | Align manifest/viewport/theme toggle colors with the current canvas. |
| 16. Page titles | Add route titles and active/saved workout names in the document title. |
| 17. Images | Keep exercise SVG placeholders and existing photo resizing; serve smaller brand/install assets. |
| 18. Navigation | Keep Next.js links, explicit button types, validation and safe recovery paths. |
| 19. Copyright | Add a current-year footer that renders consistently before hydration. |
| 20. Missing pages | Add a clear 404 with direct dashboard/workout recovery links. |

Verify numeric parsing/ranges, set validation and draft backup lifecycle with regression tests. Run type checking, lint, unit tests and production build. Check mobile set entry, steppers, invalid completion, autosave/refresh, save feedback, theme, installation metadata, route titles and 404 recovery in the browser.

## Implemented and verified

- Shared text-based numeric inputs now cover 48 fields across the logger, history editor, programs, profile, onboarding and analytics. Fractional loads and locale decimal commas are supported; partial decimals survive parent state updates.
- Mobile set cards expose weight/reps or cardio distance/time controls, 44 px increment buttons, inline validation and completion feedback. IndexedDB remains the primary store; the latest active edit also receives a synchronous, validated localStorage snapshot.
- Profile exposes the existing persisted theme toggle. Route layouts provide server-rendered titles; named workouts, exercise details and editing update titles on the client. PNG manifest/Apple icons reuse the supplied logo; the small navigation logo is 2,229 bytes.
- Verification: 76 automated tests passed, along with `npm run typecheck`, `npm run lint`, production build and Git whitespace checks. Browser checks exercised decimal typing (`72.` followed by `5`), increment/decrement, empty set/workout errors, immediate-refresh recovery, strength/cardio completion, history editing, saved theme preferences, titles, install metadata and 404 recovery.
- Responsive checks covered 320 px and 393 px phones, 768 px tablet and 1440 px desktop. The main screens showed no horizontal page overflow; the identified Home links and analytics selector now meet 44 px. Checkboxes/radio buttons retain compact visuals inside larger clickable labels.
- Browser verification used temporary local previews. The regular development server remains at `http://127.0.0.1:3000`; no public deployment or database migration is part of this change.

## Native metadata follow-up

The live DOM already includes viewport scale limits and the dedicated Apple touch icon; numeric fields already use text inputs with integer/decimal keypads. Reuse those implementations. Add missing Open Graph/Twitter metadata and a static ARCUS banner, with a configurable public origin. Apply the saved browser theme color before React is ready, using one script-owned mutable tag so Next's static viewport metadata cannot create a duplicate during hydration. Verify URL resolution, startup timing, numeric field markup, the live head, and theme persistence.

Follow-up verification: all 82 tests, type checking, linting and the production build passed. Facebook/Twitter crawler requests received sharing tags in the server-rendered head; the 1200 × 630 PNG was served successfully at 35,981 bytes. At 393 px, production workout inputs used text fields, decimal/integer keypads and 16–22 px text without horizontal page overflow. Both development and production previews kept exactly one matching theme-color tag through light/dark toggles, refresh and navigation, with no captured browser warnings or errors. These browser checks do not replace testing on a physical iPhone.
