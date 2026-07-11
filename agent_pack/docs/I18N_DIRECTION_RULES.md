# Arabic Runtime and Direction Rules

## Final product decision

The runtime application is Arabic only and fixed RTL.

- `index.html`: `lang="ar"`, `dir="rtl"`.
- Material UI theme direction: `rtl`.
- Runtime code forces the document direction to RTL.
- `ar.json` is the only locale loaded by the translator.
- `en.json` remains an unused future translation store only.
- No locale selector, language switch, LTR route, automatic browser-language detection, or mirrored English shell is allowed.
- Light/dark is the only display-mode switch.

## Arabic layout rules

- Navigation, breadcrumbs, page headers, filters, tables, drawers, dialogs, validation, notifications, reports, and receipts align right.
- The desktop sidebar and mobile drawer open from the right.
- Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`) where possible.
- Avoid hardcoded left/right values except when intentionally positioning a technical LTR element.
- Arabic headings do not begin with a raw technical token. Write `رمز QR`, `رمز SKU`, or an Arabic phrase first.

## Technical values

Apply `.a4-ltr` or equivalent isolation to:

- SKU and barcode values;
- phone numbers;
- receipt and token values;
- database/API IDs;
- URLs and file paths.

The surrounding component remains RTL.

## Form-label rule

- Every field label appears above the control through the shared `Field` component.
- Do not use `label` on MUI `TextField`, `Select`, or `OutlinedInput`.
- Keep Material UI outlined legends enabled and align animated notches to the RTL start edge (right).
- Placeholder text is supplementary and never replaces a visible label.
- Errors and hints appear below the control without changing its direction.

## Translation-file rule

Arabic visible strings should use `ar.json` when shared or repeated. Page-specific Arabic strings may be moved to the locale file during cleanup. English keys may be kept in sync for future use, but this does not enable English at runtime and is not a release blocker unless a step explicitly asks for key parity.
