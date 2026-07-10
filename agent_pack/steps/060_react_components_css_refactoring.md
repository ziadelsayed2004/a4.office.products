# Step 060 — React Components and CSS Refactoring

## Status

Defined in `agent_pack/status.json`.

## Goal

Refactor the React monolithic client code to be highly structured, modular, and organized. Move all user-facing texts to localized JSON translation configs, split components into reusable files, and extract all styling into scoped CSS files (without inline styles) using standard design variables.

---

## Requirements

1. **Modular Components**:
   - Split `client/src/App.jsx` into smaller, focused React components (e.g., `Header`, `Sidebar`, `Cart`, `ProductList`, `ReceiptDetails`, `UserManagementModal`, `PaymentModal`, etc.).
   - Organize components into a logical directory structure (e.g., `/components`, `/views`, `/context`).

2. **CSS Extraction and Theme Variables**:
   - Remove all inline `style={{ ... }}` declarations.
   - Create a dedicated stylesheet for each component (e.g., `Component.css`).
   - Create a variables file (e.g., `variables.css` or `theme.css`) defining standard custom HSL variables (colors, fonts, borders, shadows, spacing, etc.) and inherit them across styles.

3. **Localized Text Configs**:
   - Move all user-facing Arabic strings, labels, warnings, button labels, and alert messages into a unified translation configuration file (e.g., `ar.json` or `translations.js`).
   - Reference texts programmatically inside components.

---

## Constraints

- Preserve all original functionalities and behavior of POS checkout, preorders, shift tracking, and receipts.
- Maintain RTL compatibility throughout the refactoring.
- Ensure Vite client compiles cleanly.
