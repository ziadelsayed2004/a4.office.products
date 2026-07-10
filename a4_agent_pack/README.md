# A4 Office Products Agent Pack

This agent pack is the execution graph for the A4 Office Products POS Platform.

Main baseline:

- Product docs: `agent_pack/docs/PRD.md`
- Runner: `agent_pack/prompts/ONE_PROMPT_RUNNER.md`
- Prompt to copy: `agent_pack/prompts/COPY_THIS_PROMPT_AR.md`
- Tracking: `agent_pack/status.json`

Core decisions:

- Frontend: React + Vite.
- Backend: Node.js + Express.
- Database: SQLite.
- App UI: Arabic RTL from start to finish.
- Branches: single branch only.
- Roles: Admin and Cashier.
- Execution: exactly one open/pending step per run.
