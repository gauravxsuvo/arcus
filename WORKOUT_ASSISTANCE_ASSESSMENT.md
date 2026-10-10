# Workout assistance — implementation assessment

The existing app already provides timestamp-based automatic rest timers, Epley/Brzycki 1RM estimates, RPE/RIR, warm-up generation, a plate calculator, IndexedDB workout/exercise storage, deferred account sync, CSV export and canvas-based sharing cards. These systems are reused; this batch adds no dependencies, database tables, account requirement or alternate persistence engine.

Changes focus on logging: copy completed measurements into the immediately following blank working set, preserve edited/planned values and effort, match historical sets by exercise and set type, and expose the plate calculator beside barbell exercises. Starting another workout refreshes local completed history so the session just finished is immediately available. New sets can inherit the last completed working measurements; warm-up generation respects the user's weight increments and prevents duplicates or loads above the working weight.

Device-local preferences control auto-fill, haptics and an opt-in screen wake lock. A separate controller handles visibility changes, delayed requests, system release, denied requests and cleanup. Browser support and battery policies determine availability. Unsupported feedback never interrupts logging.

Verification: type checking, linting, production build and 101 unit tests. Browser acceptance uses synthetic guest data on an isolated loopback origin: completing sets, preserving edited fields/RPE, automatic rest, refresh recovery, preference persistence, warm-up duplicate protection, plate calculations, subsequent-session history, and mobile/desktop layout. Physical phone haptics and battery-policy behavior still require device testing.
