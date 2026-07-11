# Arabic RTL and Theme QA Checklist

- [ ] `html` is `lang="ar" dir="rtl"`.
- [ ] MUI and the runtime document are RTL.
- [ ] No language switch, locale selector, or English runtime mode exists.
- [ ] `ar.json` is the only locale loaded at runtime.
- [ ] `en.json` remains unused storage only.
- [ ] All visible menus, labels, validation, errors, reports, dialogs, and receipts are Arabic.
- [ ] SKU, barcode, phone, ID, and token values use local LTR isolation only.
- [ ] Field labels are external and no outlined notch appears.
- [ ] Light/dark mode persists without breaking any page or overlay.
- [ ] Print output remains controlled light output in both screen themes.
