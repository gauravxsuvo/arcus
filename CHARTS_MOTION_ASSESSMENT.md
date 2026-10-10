# Progress charts and native interactions

Reuse the App Router, existing completed-workout repository, weekly-volume/1RM engines, kg storage with display-unit conversion, theme variables, workout save queue, numeric fields, toast feedback and exercise picker. Existing SVG plots remain useful for compact summaries; the main progress graphs and shared detail line chart need explicit tap/keyboard interaction.

Implement incrementally:

1. Add bounded, tested exercise-series preparation. Reuse `buildWeeklyVolume` for four calendar weeks, honoring the user's week start.
2. Add route-loaded Recharts plots, exact-date/value tooltips, accessible data tables, useful empty states and responsive themed cards. Put volume and selectable exercise strength near the top of Progress; reuse the shared line chart in exercise/bodyweight detail.
3. Add short bottom-tab entry transitions without remounting providers. Use Motion's small animation feature bundle for row entry/removal and a reusable native dialog sheet. Reuse exercise picker filtering within the sheet, preserving durable saves and focus. Use CSS for pressed/completion/menu feedback.
4. Check data aggregation, formula changes, invalid/cardio/warm-up exclusions and bounded series. Run type checking, lint, tests and production build; verify mobile tooltips, drawer close/focus, add/complete/delete and navigation in an isolated guest browser preview.

Packages: `recharts` and `motion`. No schema, database access, sync or media-promo change is required.
