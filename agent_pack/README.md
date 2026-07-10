# A4 Office Products Agent Pack

This is the authoritative execution graph for the A4 Office Products POS Platform.

## Primary files

- Product baseline: `agent_pack/docs/PRD.md`
- Frontend template audit: `agent_pack/docs/FRONTEND_TEMPLATE_AUDIT.md`
- UI design system: `agent_pack/docs/UI_DESIGN_SYSTEM.md`
- Responsive matrix: `agent_pack/docs/RESPONSIVE_DESIGN_MATRIX.md`
- Page specifications: `agent_pack/docs/PAGE_UI_SPECIFICATIONS.md`
- Runner: `agent_pack/prompts/ONE_PROMPT_RUNNER.md`
- Prompt to copy: `agent_pack/prompts/COPY_THIS_PROMPT.md`
- Tracking: `agent_pack/status.json`

## Locked decisions

- React + Vite frontend.
- Node.js + Express backend.
- SQLite database only.
- Single branch.
- Admin and Cashier roles.
- A4 blue/navy visual identity based on the existing template.
- Arabic is the default and complete UI language.
- Translation architecture supports direction-safe locale switching.
- Complete responsive, light, and dark behavior.
- One or two steps per run only, controlled by `RUN_STEP_COUNT`.

## Frontend visual source of truth

The authoritative reference template is `TEMPLETE-PROJECT/hamza.printing.press-main/client/`. The active target is `client/`. Copy the template's visual system and responsive interaction patterns only; replace all CodzHub/printing-press branding, wording, data, routes, permissions, and APIs with A4 requirements.
