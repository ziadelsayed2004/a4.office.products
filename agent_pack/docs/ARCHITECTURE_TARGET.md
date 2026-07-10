# Architecture Target

## Stack

- Frontend: React + Vite.
- Backend: Node.js + Express.
- Database: SQLite.
- App language: Arabic RTL for all user-facing screens and receipts.

## Main structure

- `client/` for the React/Vite frontend.
- `server/` for the Node/Express backend.
- `server/src/db/` for SQLite connection and migration utilities.
- `server/src/migrations/` for reproducible SQLite schema changes.
- `agent_pack/` for execution docs, steps, status, and reports.

## Database rules

- SQLite is the only persistence target.
- Enable foreign keys.
- Use explicit migrations.
- Store money as integer minor units.
- Do not introduce MongoDB, Mongoose, Firebase/Firestore persistence, or document-database assumptions.
