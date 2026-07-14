export const PRODUCT_LABEL_SIZES = Object.freeze({
  small: Object.freeze({ widthMm: 38, heightMm: 25, barcodeHeight: 24 }),
  medium: Object.freeze({ widthMm: 50, heightMm: 25, barcodeHeight: 28 }),
  large: Object.freeze({ widthMm: 80, heightMm: 50, barcodeHeight: 52 }),
});

export const PRODUCT_LABEL_LAYOUT_BUDGETS = Object.freeze({
  small: Object.freeze({ paddingMm: 1.2, gapMm: 0.6, headerMm: 2.2, titleMm: 5.2 }),
  medium: Object.freeze({ paddingMm: 1.2, gapMm: 0.6, headerMm: 2.2, titleMm: 5.2 }),
  large: Object.freeze({ paddingMm: 3, gapMm: 1, headerMm: 3, titleMm: 8 }),
});

const CSS_PIXELS_PER_MM = 96 / 25.4;

export function normalizeProductLabelSize(value) {
  const size = String(value || 'medium').toLowerCase();
  return Object.hasOwn(PRODUCT_LABEL_SIZES, size) ? size : 'medium';
}

export function productLabelSizeFromDimensions(width, height) {
  const widthMm = Number.parseInt(String(width), 10);
  const heightMm = Number.parseInt(String(height), 10);
  const match = Object.entries(PRODUCT_LABEL_SIZES).find(
    ([, dimensions]) => dimensions.widthMm === widthMm && dimensions.heightMm === heightMm
  );
  return match?.[0] || 'medium';
}

export function productLabelVerticalBudget(value) {
  const size = normalizeProductLabelSize(value);
  const dimensions = PRODUCT_LABEL_SIZES[size];
  const layout = PRODUCT_LABEL_LAYOUT_BUDGETS[size];
  const bodyHeightMm =
    dimensions.heightMm -
    layout.paddingMm * 2 -
    layout.gapMm * 2 -
    layout.headerMm -
    layout.titleMm;
  const barcodeHeightMm = dimensions.barcodeHeight / CSS_PIXELS_PER_MM;

  return {
    size,
    bodyHeightMm,
    barcodeHeightMm,
    spareHeightMm: bodyHeightMm - barcodeHeightMm,
    fits: barcodeHeightMm <= bodyHeightMm,
  };
}

export function buildProductLabelPageCss(value) {
  const size = normalizeProductLabelSize(value);
  const { widthMm, heightMm } = PRODUCT_LABEL_SIZES[size];

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
  .product-label-print {
    box-sizing: border-box !important;
    width: ${widthMm}mm !important;
    min-width: 0 !important;
    max-width: ${widthMm}mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  .theme-root,
  .product-label-print {
    display: block !important;
  }

  .product-label {
    width: ${widthMm}mm !important;
    min-width: ${widthMm}mm !important;
    max-width: ${widthMm}mm !important;
    height: ${heightMm}mm !important;
    min-height: ${heightMm}mm !important;
    max-height: ${heightMm}mm !important;
  }
}
`;
}

export function applyProductLabelPageSize(
  container,
  value,
  documentRef = container?.ownerDocument
) {
  if (!container || !documentRef?.head) throw new Error('مستند طباعة الملصقات غير متاح.');
  if (!container.querySelector('.product-label')) throw new Error('لا توجد ملصقات جاهزة للطباعة.');

  const size = normalizeProductLabelSize(value);
  const dimensions = PRODUCT_LABEL_SIZES[size];
  documentRef.head.querySelector('style[data-a4-product-label-page-size]')?.remove();

  const style = documentRef.createElement('style');
  style.dataset.a4ProductLabelPageSize = 'true';
  style.textContent = buildProductLabelPageCss(size);
  documentRef.head.appendChild(style);

  container.dataset.labelSize = size;
  container.dataset.printWidthMm = String(dimensions.widthMm);
  container.dataset.printHeightMm = String(dimensions.heightMm);

  return {
    size,
    ...dimensions,
    cleanup() {
      style.remove();
      delete container.dataset.labelSize;
      delete container.dataset.printWidthMm;
      delete container.dataset.printHeightMm;
    },
  };
}
