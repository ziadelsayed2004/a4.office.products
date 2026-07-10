# Change Requests

## CR-2026-07-11 — Frontend Template Lock and Modernization Phase

Approved changes:

- Analyze and lock the current frontend template as the visual baseline.
- Use A4 blue/navy colors only; remove purple and unrelated legacy branding.
- Complete responsive behavior for mobile, tablet, laptop, and wide desktop.
- Complete light and dark modes.
- Make Arabic the complete default UI.
- Move visible text to locale files and support direction-safe translation architecture.
- Add comprehensive frontend design, component, responsive, page, theme, and QA documentation.
- Add Steps 061–090 as a new pending frontend modernization phase.
- Change runner policy from exactly one step to one or two steps, controlled by `RUN_STEP_COUNT`.
- Normalize the pack folder name to `agent_pack` so prompt paths match repository paths.
- Preserve all existing POS, preorder, stock, receipt, shift, reports, audit, and SQLite rules.

## Frontend visual source of truth

The authoritative reference template is `TEMPLETE-PROJECT/hamza.printing.press-main/client/`. The active target is `client/`. Copy the template's visual system and responsive interaction patterns only; replace all CodzHub/printing-press branding, wording, data, routes, permissions, and APIs with A4 requirements.
