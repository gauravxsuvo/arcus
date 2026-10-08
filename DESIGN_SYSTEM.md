# Design system

## Typography

Use a clear sans-serif interface with tabular numerals for weights, reps, timers, and analytics. Establish hierarchy through size and weight: page title, section heading, body, then muted metadata. Avoid oversized marketing-style headings inside the workout flow.

## Spacing and shape

Use a consistent 4 px spacing scale. Cards use restrained rounding, thin borders, and minimal shadow. Keep active workout content compact enough to reduce scrolling while preserving comfortable touch targets.

## Color and theme

Use semantic CSS tokens for background, surface, foreground, muted text, border, primary action, success, warning, and destructive states. Dark mode must preserve contrast and distinguish completed, current, and upcoming sets without relying on color alone.

## Interaction patterns

Home has one primary Start/Resume action, a compact weekly summary and activity strip, a four-item training tools grid and recent sessions. Empty target and record panels stay hidden; populated secondary detail is expandable. Mobile navigation exposes Home, Workout, History and Profile directly. The active workout keeps Finish in the top bar, places advanced tools after the exercise log, and reports local save failures with a retry action. Page-level CSS modules reuse the existing semantic theme tokens.

Use shared button, input, dialog, sheet, badge, tabs, toast, and skeleton primitives. Prefer inline editing and one-handed controls during workouts. Confirm only destructive actions. Provide keyboard operation on desktop and visible focus states everywhere.

Exercise browsing prioritizes readable movement names, accessible muscle/equipment filters and All/Favorites/Recent collections. Secondary filters can collapse, and empty searches provide a reset action. History opens full sessions directly on mobile, keeps filters near the results, and distinguishes a failed storage read from an empty log.

## Responsive behavior

Use bottom navigation on mobile and a persistent sidebar on desktop. Active workout controls remain reachable on small screens; dialogs become sheets where that improves touch use. Do not simply shrink desktop dashboard cards into a mobile grid.

## Forms and feedback

Label inputs, show field-level validation, preserve entered values on errors, and announce status changes accessibly. Empty, loading, offline, and failure states include a clear next action.
