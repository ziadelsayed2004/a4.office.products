> قبل تنفيذ هذه الخطوة يجب قراءة `agent_pack/docs/PRD.md` و `agent_pack/docs/FEATURE_MATRIX.md` و `agent_pack/checklists/VERIFY_GATE.md`. حافظ على قواعد: فرع واحد، منتجات بدون صور، لا تتبع جهاز، صلاحيات كاشير محدودة، لا مخزون بالسالب، حجز ببيانات عميل وديبوزت، طباعة وسجل عمليات، وتوافقية عربي RTL مع مصطلحات إنجليزية سليمة.

# Step 021 — Receipt Core And Numbering

## Status

Defined in `agent_pack/status.json`.

## Goal

ترقيم الفواتير/الحجوزات، Receipt model، QR token، إعادة الطباعة بسجل audit.


## Required reading

- `agent_pack/docs/PRD.md`
- `agent_pack/docs/BUSINESS_RULES.md`
- `agent_pack/docs/RBAC_PERMISSION_MATRIX.md`
- `agent_pack/checklists/VERIFY_GATE.md`

## Permanent constraints

- Execute this step only.
- Do not execute later steps.
- Preserve no product images.
- Preserve single branch.
- Preserve account + shift tracking only.
- Preserve cashier restrictions.
- Preserve no negative stock.
- Preserve preorder QR pickup flow.


## Scope

- Inspect the current repository before editing.
- Implement only what is required for this step.
- Update or create tests/docs related to this step.
- Do not change unrelated modules.

## Verification

Run the best available verification commands discovered in the repo, for example:

```bash
npm test
npm run build
npm run lint
```

If a command is unavailable, document that clearly in the report.

## Report

Write `agent_pack/reports/021_receipt_core_and_numbering_REPORT.md` with all required report fields.
