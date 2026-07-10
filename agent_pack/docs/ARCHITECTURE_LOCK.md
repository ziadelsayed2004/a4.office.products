# Target Architecture and Scope Lock — A4

## Technical stack

| Layer | Technology | Locked decision |
|---|---|---|
| Frontend | React + Vite + Material UI | Arabic-first responsive SPA using the approved A4 template design system |
| Styling | MUI theme + shared semantic CSS tokens/scoped styles | No unrelated UI kit, no duplicate page theme systems |
| Backend | Node.js + Express | Modular API aligned with `API_TARGET_MAP.md` |
| Database | SQLite | Single embedded relational database with explicit migrations |
| Localization | Arabic default, optional English parity | Arabic RTL; English LTR; all visible text locale-driven |

## Database lock

- SQLite is the only persistence database.
- Do not introduce MongoDB, Mongoose, Firebase/Firestore persistence, or another database layer.
- Enable foreign keys.
- Use explicit reproducible migrations.
- Store money as integer minor units.

## Frontend lock

- Preserve the current compact Material dashboard template character.
- Use A4 blue/navy identity.
- Complete light/dark parity.
- Complete responsive behavior.
- Arabic is complete/default; translations use locale files and direction-safe switching.
- No product image UI.

## Business scope lock

- Single branch.
- Admin and Cashier roles.
- Account + active shift tracking only; no terminal/device model.
- No negative stock.
- Preorder deposit and QR pickup flow.
- Arabic thermal receipts and product QR labels.
- Required AuditLog for sensitive actions.
