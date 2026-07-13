import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyReceiptPageSize,
  buildReceiptPageCss,
  measureReceiptPage,
  normalizeReceiptPageWidth,
  receiptPageHeightFromPixels,
} from '../src/utils/receiptPrintSizing.js';
import {
  applyProductLabelPageSize,
  buildProductLabelPageCss,
  normalizeProductLabelSize,
  productLabelVerticalBudget,
  productLabelSizeFromDimensions,
  PRODUCT_LABEL_SIZES,
} from '../src/utils/productLabelPrintSizing.js';
import {
  FAIL_CLOSED_BROWSER_PRINT_SETTINGS,
  normalizeBrowserPrintSettings,
} from '../src/utils/browserPrintSettings.js';

assert.equal(normalizeReceiptPageWidth('58mm'), 58);
assert.equal(normalizeReceiptPageWidth(80), 80);
assert.throws(() => normalizeReceiptPageWidth('A4'));

assert.equal(receiptPageHeightFromPixels(96), 26.9);
assert.equal(receiptPageHeightFromPixels(1), 20);
assert.throws(() => receiptPageHeightFromPixels(0));

const receipt = (width, height) => ({
  dataset: { receiptWidthMm: String(width) },
  classList: { contains: () => width === 58 },
  scrollHeight: Math.floor(height),
  offsetHeight: Math.floor(height),
  getBoundingClientRect: () => ({ height, width: (width * 96) / 25.4 }),
});

const measured = measureReceiptPage([receipt(80, 512.25), receipt(80, 510)]);
assert.equal(measured.widthMm, 80);
assert.equal(measured.pixelHeight, 512.25);
assert.ok(measured.contentHeightMm > 135 && measured.contentHeightMm < 136);
assert.equal(measured.heightMm, 137.1);
const measured58 = measureReceiptPage([receipt(58, 420)]);
assert.equal(measured58.widthMm, 58);
assert.ok(measured58.heightMm > 112 && measured58.heightMm < 114);
assert.throws(() => measureReceiptPage([receipt(58, 300), receipt(80, 300)]));

const css = buildReceiptPageCss(measured);
assert.match(css, /size:\s*80mm 137\.1mm/);
assert.match(css, /min-width:\s*0 !important/);
assert.doesNotMatch(css, /size:[^;]*auto/);

const styleNode = {
  dataset: {},
  textContent: '',
  removed: false,
  remove() {
    this.removed = true;
  },
};
const fakeDocument = {
  head: {
    appended: null,
    querySelector: () => null,
    appendChild(node) {
      this.appended = node;
    },
  },
  createElement: () => styleNode,
};
const fakeContainer = {
  ownerDocument: fakeDocument,
  dataset: {},
  querySelectorAll: () => [receipt(80, 512.25)],
};
const applied = applyReceiptPageSize(fakeContainer);
assert.equal(fakeDocument.head.appended, styleNode);
assert.equal(fakeContainer.dataset.printWidthMm, '80');
assert.equal(fakeContainer.dataset.printHeightMm, '137.1');
assert.match(styleNode.textContent, /size:\s*80mm 137\.1mm/);
applied.cleanup();
assert.equal(styleNode.removed, true);
assert.equal(fakeContainer.dataset.printWidthMm, undefined);

const receiptStyles = await Promise.all([
  readFile(new URL('../src/components/ThermalReceipt.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/Receipts.css', import.meta.url), 'utf8'),
]);
assert.doesNotMatch(receiptStyles.join('\n'), /size:\s*(?:58|80)mm\s+auto/i);
assert.match(
  receiptStyles[0],
  /\.thermal-receipt__row\s*>\s*strong\s*\{[\s\S]*max-width:\s*65%[\s\S]*overflow-wrap:\s*anywhere/
);
assert.match(receiptStyles[0], /word-break:\s*break-word/);

assert.equal(normalizeProductLabelSize('small'), 'small');
assert.equal(normalizeProductLabelSize('missing'), 'medium');
assert.equal(productLabelSizeFromDimensions('38mm', '25mm'), 'small');
assert.equal(productLabelSizeFromDimensions(50, 25), 'medium');
assert.equal(productLabelSizeFromDimensions(80, 50), 'large');
assert.deepEqual(PRODUCT_LABEL_SIZES.large, { widthMm: 80, heightMm: 50, qrSize: 96 });

for (const [labelSize, dimensions] of Object.entries(PRODUCT_LABEL_SIZES)) {
  const labelCss = buildProductLabelPageCss(labelSize);
  assert.match(labelCss, new RegExp(`size:\\s*${dimensions.widthMm}mm ${dimensions.heightMm}mm`));
  assert.match(labelCss, /\.product-label\s*\{[\s\S]*height:/);
  assert.doesNotMatch(labelCss, /size:[^;]*auto/);
  const budget = productLabelVerticalBudget(labelSize);
  assert.equal(budget.fits, true, `${labelSize} QR code must fit its body row`);
  assert.ok(budget.spareHeightMm > 3, `${labelSize} keeps a deterministic overflow margin`);
}

const productLabelStyles = await readFile(
  new URL('../src/styles/ProductLabelPrint.css', import.meta.url),
  'utf8'
);
assert.match(productLabelStyles, /grid-template-rows:\s*var\(--label-header-height\)/);
assert.match(productLabelStyles, /\.product-label__body\s*>\s*svg\s*\{[\s\S]*max-height:\s*100%/);
assert.match(productLabelStyles, /-webkit-line-clamp:\s*2/);

assert.deepEqual(normalizeBrowserPrintSettings(null), FAIL_CLOSED_BROWSER_PRINT_SETTINGS);
const normalizedSettings = normalizeBrowserPrintSettings({
  receipt_printer_header: '',
  receipt_printer_footer: '',
  auto_print_sale: 'true',
  auto_print_preorder_deposit: 'invalid',
  print_show_customer: true,
  print_show_price_tier: 'yes',
  print_show_qr: 'true',
  qr_printer_width: '80',
  qr_printer_height: '50',
});
assert.equal(normalizedSettings.receipt_printer_header, '');
assert.equal(normalizedSettings.receipt_printer_footer, '');
assert.equal(normalizedSettings.auto_print_sale, 'true');
assert.equal(normalizedSettings.auto_print_preorder_deposit, 'false');
assert.equal(normalizedSettings.auto_print_preorder_pickup, 'false');
assert.equal(normalizedSettings.print_show_customer, 'true');
assert.equal(normalizedSettings.print_show_price_tier, 'false');
assert.equal(normalizedSettings.print_show_qr, 'true');
assert.equal(normalizedSettings.qr_printer_width, '80');
assert.equal(normalizedSettings.qr_printer_height, '50');

const labelStyleNode = {
  dataset: {},
  textContent: '',
  removed: false,
  remove() {
    this.removed = true;
  },
};
const labelDocument = {
  head: {
    appended: null,
    querySelector: () => null,
    appendChild(node) {
      this.appended = node;
    },
  },
  createElement: () => labelStyleNode,
};
const labelContainer = {
  ownerDocument: labelDocument,
  dataset: {},
  querySelector: () => ({ dataset: { labelReady: 'true' } }),
};
const appliedLabel = applyProductLabelPageSize(labelContainer, 'small');
assert.equal(labelDocument.head.appended, labelStyleNode);
assert.equal(labelContainer.dataset.printWidthMm, '38');
assert.equal(labelContainer.dataset.printHeightMm, '25');
assert.match(labelStyleNode.textContent, /size:\s*38mm 25mm/);
appliedLabel.cleanup();
assert.equal(labelStyleNode.removed, true);
assert.equal(labelContainer.dataset.labelSize, undefined);

console.log('Receipt and product-label print sizing tests passed.');
