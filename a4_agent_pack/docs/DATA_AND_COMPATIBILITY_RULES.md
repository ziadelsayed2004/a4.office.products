# Data and Compatibility Rules

- SQLite is the only database target.
- Enable SQLite foreign keys.
- Use migrations and indexed relational tables.
- Store money as integer minor units.
- Store/display dates consistently with Africa/Cairo.
- App UI must be Arabic RTL.
- Receipts and print templates must be Arabic RTL.
- API paths, table names, and code identifiers can remain English.
- Do not start Arabic headings or bullets with `QR`; write “رمز QR” or “رمز المنتج”.
- No product images in the base product model or UI.
- No POS device/terminal tracking.
