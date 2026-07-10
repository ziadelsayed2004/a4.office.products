# Internationalization and Direction Rules

## Product language policy

- Arabic is the default and complete release language.
- English may be enabled as a secondary locale.
- No user-facing text may be hard-coded in React components.
- No screen may display a translation key or accidental English fallback.

## Locale files

Required structure:

```text
client/src/locales/
  ar.json
  en.json
```

Both files must use identical nested keys. Arabic text is the source-of-truth product wording. English must be a faithful translation, not a different feature definition.

## Direction

- `ar` -> `rtl`
- `en` -> `ltr`
- Update the HTML `lang` and `dir` attributes.
- Update MUI theme direction.
- Update the Emotion cache safely when direction changes.
- Use CSS logical properties.

## Technical values

The following values remain LTR even in Arabic:

- phone numbers,
- SKU,
- barcodes,
- QR tokens,
- invoice/order IDs,
- URLs,
- dates when displayed in numeric ISO form.

Use an isolated `TechnicalValue` component rather than globally forcing form controls to LTR.

## Arabic wording rules

- Use `رمز QR` instead of starting a sentence with `QR`.
- Use `رقم SKU` or `رمز الصنف`.
- Use `الوردية` consistently; do not mix with `الشيفت` in final UI unless the business explicitly selects the colloquial term.
- Use one translation for deposit: `العربون` or `الدفعة المقدمة`; the locale glossary must choose one and apply it everywhere.
- Use one translation for receipt: `الإيصال`.

## Formatting

- Currency: EGP with Arabic label `ج.م` in Arabic locale.
- Timezone: `Africa/Cairo`.
- Use locale-aware number and date formatting.
- Money is formatted from integer minor units; never from floating-point storage.

## Verification

Every frontend step must search for newly introduced visible hard-coded strings and confirm locale parity.
