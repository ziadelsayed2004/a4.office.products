# A4 Office Products — Frontend Runtime Fix Report

**Date:** 2026-07-12  
**Scope:** React/Vite/MUI frontend stabilization, Arabic RTL form system, button alignment, and project cleanup.

## Fixed runtime failures

The frontend crash shown on the login route was traced to two compatibility problems:

1. Deprecated Material UI properties were reaching native DOM elements after the project moved to MUI 9:
   - `InputProps`
   - `InputLabelProps`
   - `inputProps`
   - `PaperProps`
   - direct `alignItems` system prop on a DOM-rendering component
2. The custom Emotion RTL cache and Stylis plugin chain caused the `<Insertion>` crash:
   - `TypeError: Cannot read properties of undefined (reading 'push')`

The custom cache/plugin layer was removed. The Arabic-only interface now uses the normal MUI Emotion cache with a fixed RTL theme and logical CSS properties.

## Form and notch system

- All MUI fields use MUI 9 `slotProps`.
- Labels animate from inside the field into a native outlined notch at the top-right.
- Native MUI notch width animation is preserved and is no longer overridden by global CSS.
- Arabic text, labels, helper text, menus, and validation messages are right-aligned.
- Select arrows are placed on the left while selected text remains on the right.
- Technical values can opt into local LTR direction without changing the surrounding page direction.
- Hover, focus, error, disabled, light, dark, mobile, and reduced-motion states are covered.

## Button system

- A consistent 8px gap is enforced between icon and text.
- MUI start/end icon margins are reset so RTL does not create duplicate or reversed spacing.
- Dialog, drawer, page-header, filter, and table actions use the same spacing rules.
- Mobile dialog actions wrap into usable full-width controls when necessary.

## Layout and interaction cleanup

- Arabic RTL is forced at HTML, document, body, theme, menu, dialog, and drawer levels.
- Sidebar state is persisted locally.
- Mobile navigation closes after route changes and on `Escape`.
- Accessibility state was added to navigation controls.
- The old step-runner/agent files and embedded template copy were removed.
- Stale build archives, backup lock files, and temporary database artifacts were removed.

## Verification completed

- `npm run lint --prefix client`: **passed — 0 errors, 0 warnings**.
- `npm run test:ui --prefix client`: **passed — 58 checks, 0 failures**.
- `npm run build --prefix client`: **passed**.
- Server source syntax (`node --check` for every `server/src/**/*.js`): **passed**.
- Authored frontend source scan:
  - no deprecated MUI prop assignment;
  - no custom Stylis RTL plugin/cache;
  - no leaked `alignItems` JSX prop;
  - no runtime language switch;
  - no old step-runner directory.

## Environment limitation

The complete live server test suite was not marked as passed in this environment because installing the native `sqlite3` binary required external network access that was unavailable. The production frontend build and static/runtime-regression checks are successful; live SQLite/API integration tests should be run after a normal local `npm install --prefix server`.
