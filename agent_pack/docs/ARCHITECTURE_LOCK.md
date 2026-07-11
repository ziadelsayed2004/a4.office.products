# A4 Architecture Lock

| Area | Locked decision |
|---|---|
| Frontend | React + Vite + Material UI |
| Backend | Node.js + Express |
| Database | SQLite only |
| Product runtime language | Arabic only, fixed RTL |
| Future translations | `en.json` storage only; not runtime-loaded |
| Display modes | Light and dark only |
| Branch model | One branch |
| Roles | Admin and Cashier |
| Product images | Excluded |
| POS device model | Excluded; account + active shift only |
| Currency / timezone | EGP / Africa/Cairo |

## Frontend lock

- `client/` is the active implementation.
- `TEMPLETE-PROJECT/hamza.printing.press-main/client/` is a visual morphology reference only.
- Fixed Arabic RTL shell, right sidebar/drawer, A4 brand, animated RTL-safe outlined labels and top-right notches, responsive POS, and printer-safe outputs are mandatory.
- No language switch, locale selector, English route, automatic locale detection, or mirrored LTR shell may be introduced.

## Data and business lock

- The server is the source of truth for price, stock, payments, shifts, tokens, and financial state.
- Inventory never becomes negative.
- Direct sales decrement stock immediately.
- Preorders increase open counters only until pickup.
- Pickup validates token/shift/stock/payment and atomically decrements stock and counters.
- Sensitive operations write AuditLog.
