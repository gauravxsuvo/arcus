# Design system

## Typography

Use a clear sans-serif interface with tabular numerals for weights, reps, timers, and analytics. Establish hierarchy through size and weight: page title, section heading, body, then muted metadata. Avoid oversized marketing-style headings inside the workout flow.

## Spacing and shape

Use a consistent 4 px spacing scale. Cards use restrained rounding, thin borders, and minimal shadow. Keep active workout content compact enough to reduce scrolling while preserving comfortable touch targets.

## Color and theme

Use semantic CSS tokens for background, surface, foreground, muted text, border, primary action, success, warning, and destructive states. Dark mode must preserve contrast and distinguish completed, current, and upcoming sets without relying on color alone.

## Interaction patterns

Use shared button, input, dialog, sheet, badge, tabs, toast, and skeleton primitives. Prefer inline editing and one-handed controls during workouts. Confirm only destructive actions. Provide keyboard operation on desktop and visible focus states everywhere.

## Responsive behavior

Use bottom navigation on mobile and a persistent sidebar on desktop. Active workout controls remain reachable on small screens; dialogs become sheets where that improves touch use. Do not simply shrink desktop dashboard cards into a mobile grid.

## Forms and feedback

Label inputs, show field-level validation, preserve entered values on errors, and announce status changes accessibly. Empty, loading, offline, and failure states include a clear next action.
