export const RETURN_APPROVAL_CARD_SIZE = Object.freeze({ widthMm: 85.6, heightMm: 54 });
export const RETURN_APPROVAL_CARD_PRINT_MODES = Object.freeze(['a4', 'direct']);

export function normalizeReturnApprovalCardPrintMode(value) {
  const mode = String(value || 'a4').toLowerCase();
  return RETURN_APPROVAL_CARD_PRINT_MODES.includes(mode) ? mode : 'a4';
}

export function buildReturnApprovalCardPageCss(value) {
  const mode = normalizeReturnApprovalCardPrintMode(value);
  const { widthMm, heightMm } = RETURN_APPROVAL_CARD_SIZE;
  if (mode === 'direct') {
    return `
@page {
  size: ${widthMm}mm ${heightMm}mm;
  margin: 0;
}

@media print {
  html,
  body,
  #root,
  .theme-root,
  .return-card-print-page {
    box-sizing: border-box !important;
    width: ${widthMm}mm !important;
    min-width: ${widthMm}mm !important;
    max-width: ${widthMm}mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  .return-card-print-page--direct {
    display: block !important;
  }

  .return-approval-card-cut {
    width: ${widthMm}mm !important;
    height: ${heightMm}mm !important;
    padding: 0 !important;
    break-after: page;
    page-break-after: always;
  }

  .return-approval-card-cut:last-child {
    break-after: auto;
    page-break-after: auto;
  }
}
`;
  }

  return `
@page {
  size: 210mm 297mm;
  margin: 10mm;
}

@media print {
  html,
  body,
  #root,
  .theme-root,
  .return-card-print-page {
    box-sizing: border-box !important;
    width: auto !important;
    min-width: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  .return-card-print-page--a4 {
    grid-template-columns: repeat(2, ${widthMm + 6}mm) !important;
    grid-auto-rows: ${heightMm + 6}mm !important;
    justify-content: center !important;
    gap: 3mm !important;
    display: grid !important;
  }

  .return-approval-card-cut {
    width: ${widthMm + 6}mm !important;
    height: ${heightMm + 6}mm !important;
    padding: 3mm !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;
}

export function applyReturnApprovalCardPageSize(
  container,
  value,
  documentRef = container?.ownerDocument
) {
  if (!container || !documentRef?.head) throw new Error('مستند طباعة كارت الاعتماد غير متاح.');
  const cards = container.querySelectorAll('[data-return-card-ready="true"]');
  if (!cards.length) throw new Error('لا يوجد كارت اعتماد جاهز للطباعة.');

  const mode = normalizeReturnApprovalCardPrintMode(value);
  documentRef.head.querySelector('style[data-a4-return-card-page-size]')?.remove();
  const style = documentRef.createElement('style');
  style.dataset.a4ReturnCardPageSize = 'true';
  style.textContent = buildReturnApprovalCardPageCss(mode);
  documentRef.head.appendChild(style);
  container.dataset.printMode = mode;
  container.dataset.printWidthMm = String(RETURN_APPROVAL_CARD_SIZE.widthMm);
  container.dataset.printHeightMm = String(RETURN_APPROVAL_CARD_SIZE.heightMm);

  return {
    mode,
    ...RETURN_APPROVAL_CARD_SIZE,
    cleanup() {
      style.remove();
      delete container.dataset.printMode;
      delete container.dataset.printWidthMm;
      delete container.dataset.printHeightMm;
    },
  };
}
