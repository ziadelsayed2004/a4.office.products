const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const CSS_PIXELS_PER_MILLIMETER = CSS_PIXELS_PER_INCH / MILLIMETERS_PER_INCH;

// A fixed page width cannot be paired with an automatic height. Measure the
// receipt after fonts/QR/images settle, then provide Chromium two lengths.

export const RECEIPT_PAGE_WIDTHS_MM = Object.freeze([58, 80]);
export const RECEIPT_CUT_FEED_MM = 1.5;
export const MIN_RECEIPT_PAGE_HEIGHT_MM = 20;

export function normalizeReceiptPageWidth(value) {
  const width = Number.parseInt(String(value), 10);
  if (!RECEIPT_PAGE_WIDTHS_MM.includes(width)) {
    throw new Error('عرض الإيصال يجب أن يكون 58 أو 80 مم.');
  }
  return width;
}

export function receiptPageHeightFromPixels(pixelHeight, cutFeedMm = RECEIPT_CUT_FEED_MM) {
  const height = Number(pixelHeight);
  const feed = Number(cutFeedMm);
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error('تعذر قياس ارتفاع محتوى الإيصال.');
  }
  if (!Number.isFinite(feed) || feed < 0) {
    throw new Error('هامش قص الإيصال غير صالح.');
  }

  const contentMillimeters = height / CSS_PIXELS_PER_MILLIMETER;
  return Math.max(MIN_RECEIPT_PAGE_HEIGHT_MM, Math.ceil((contentMillimeters + feed) * 10) / 10);
}

function receiptPixelHeight(receipt) {
  const rectHeight = receipt.getBoundingClientRect?.().height || 0;
  return Math.max(rectHeight, receipt.scrollHeight || 0, receipt.offsetHeight || 0);
}

function receiptHeightMillimeters(receipt, widthMm) {
  const rect = receipt.getBoundingClientRect?.();
  const pixelBasedHeight = receiptPixelHeight(receipt) / CSS_PIXELS_PER_MILLIMETER;
  if (rect?.width > 0 && rect?.height > 0) {
    return Math.max((rect.height * widthMm) / rect.width, pixelBasedHeight);
  }
  return pixelBasedHeight;
}

export function measureReceiptPage(receipts) {
  const elements = Array.from(receipts || []);
  if (elements.length === 0) throw new Error('لا يوجد إيصال جاهز لقياس صفحة الطباعة.');

  const widths = new Set(
    elements.map((receipt) =>
      normalizeReceiptPageWidth(
        receipt.dataset?.receiptWidthMm ||
          (receipt.classList?.contains('thermal-receipt--58') ? 58 : 80)
      )
    )
  );
  if (widths.size !== 1) throw new Error('لا يمكن طباعة مقاسات إيصال مختلفة في مستند واحد.');

  const widthMm = [...widths][0];
  const pixelHeight = Math.max(...elements.map(receiptPixelHeight));
  const contentHeightMm = Math.max(
    ...elements.map((receipt) => receiptHeightMillimeters(receipt, widthMm))
  );
  return {
    widthMm,
    heightMm: Math.max(
      MIN_RECEIPT_PAGE_HEIGHT_MM,
      Math.ceil((contentHeightMm + RECEIPT_CUT_FEED_MM) * 10) / 10
    ),
    pixelHeight,
    contentHeightMm,
  };
}

export function buildReceiptPageCss({ widthMm, heightMm }) {
  const width = normalizeReceiptPageWidth(widthMm);
  const height = Number(heightMm);
  if (!Number.isFinite(height) || height < MIN_RECEIPT_PAGE_HEIGHT_MM) {
    throw new Error('ارتفاع صفحة الإيصال غير صالح.');
  }

  return `
@page {
  size: ${width}mm ${height}mm;
  margin: 0;
}

@media print {
  html,
  body,
  #root,
  .theme-root {
    box-sizing: border-box !important;
    width: ${width}mm !important;
    min-width: 0 !important;
    max-width: ${width}mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .receipt-print-page,
  .thermal-receipt {
    box-sizing: border-box !important;
    width: ${width}mm !important;
    min-width: 0 !important;
    max-width: ${width}mm !important;
  }

  .theme-root,
  .receipt-print-page {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
  }
}
`;
}

export function applyReceiptPageSize(container, documentRef = container?.ownerDocument) {
  if (!container || !documentRef?.head) throw new Error('مستند طباعة الإيصال غير متاح.');

  const receipts = container.querySelectorAll('[data-receipt-ready="true"]');
  const pageSize = measureReceiptPage(receipts);
  documentRef.head.querySelector('style[data-a4-receipt-page-size]')?.remove();

  const style = documentRef.createElement('style');
  style.dataset.a4ReceiptPageSize = 'true';
  style.textContent = buildReceiptPageCss(pageSize);
  documentRef.head.appendChild(style);

  container.dataset.printWidthMm = String(pageSize.widthMm);
  container.dataset.printHeightMm = String(pageSize.heightMm);

  return {
    ...pageSize,
    cleanup() {
      style.remove();
      delete container.dataset.printWidthMm;
      delete container.dataset.printHeightMm;
    },
  };
}
