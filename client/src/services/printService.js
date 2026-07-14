import { api } from './apiClient.js';
import { PRINTER_SETTINGS_UNAVAILABLE_MESSAGE } from '../utils/browserPrintSettings.js';
import './printService.css';

export const PRINT_MESSAGE_SOURCE = 'a4-isolated-receipt-print';
export const PRINT_READY = 'A4_PRINT_READY';
export const PRINT_COMPLETE = 'A4_PRINT_COMPLETE';
export const PRINT_ERROR = 'A4_PRINT_ERROR';
export const LABEL_PRINT_MESSAGE_SOURCE = 'a4-isolated-label-print';

const READY_TIMEOUT_MS = 20_000;
const AFTER_PRINT_TIMEOUT_MS = 120_000;

function createRequestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `print-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function positiveCopies(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 20) : 1;
}

function receiptPrintUrl(receiptId, { copies, isReprint, requestKey }) {
  const query = new URLSearchParams({
    copies: String(positiveCopies(copies)),
    reprint: isReprint ? '1' : '0',
    requestKey,
  });
  return `/receipts/${encodeURIComponent(receiptId)}/print?${query}`;
}

function waitForIsolatedPrint({ receiptId, url }) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.className = 'a4-print-frame';
    iframe.title = 'مستند طباعة الإيصال';
    iframe.setAttribute('aria-hidden', 'true');

    let readyTimer;
    let afterPrintTimer;
    let printStarted = false;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(afterPrintTimer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
      if (event.data?.source !== PRINT_MESSAGE_SOURCE) return;
      if (String(event.data?.receiptId) !== String(receiptId)) return;

      if (event.data.type === PRINT_ERROR) {
        fail(new Error(event.data.message || 'تعذر تجهيز مستند الطباعة.'));
        return;
      }

      if (event.data.type === PRINT_COMPLETE) {
        finish({ printed: true });
        return;
      }

      if (event.data.type !== PRINT_READY || printStarted) return;
      printStarted = true;
      window.clearTimeout(readyTimer);

      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        afterPrintTimer = window.setTimeout(
          () => finish({ printed: true, afterPrintTimedOut: true }),
          AFTER_PRINT_TIMEOUT_MS
        );
      } catch (error) {
        fail(error);
      }
    };

    window.addEventListener('message', onMessage);
    readyTimer = window.setTimeout(
      () => fail(new Error('انتهت مهلة تجهيز مستند الطباعة.')),
      READY_TIMEOUT_MS
    );

    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

export async function printReceiptInFrame({
  receiptId,
  copies,
  reason = '',
  isReprint = false,
  requestKey = createRequestKey(),
} = {}) {
  if (receiptId === undefined || receiptId === null || receiptId === '') {
    throw new Error('رقم الإيصال مطلوب للطباعة.');
  }

  let safeSettings = {};
  if (copies === undefined || copies === null || copies === '') {
    try {
      const settingsResponse = await api.get('/api/printer-settings');
      safeSettings = settingsResponse?.data || settingsResponse || {};
    } catch (error) {
      throw new Error(`${PRINTER_SETTINGS_UNAVAILABLE_MESSAGE} ${error.message}`);
    }
  }
  const normalizedCopies = positiveCopies(copies ?? safeSettings.receipt_copies);
  const requestResponse = await api.post(
    `/api/pos/receipts/${encodeURIComponent(receiptId)}/print-request`,
    {
      requestKey,
      copies: normalizedCopies,
      reason: reason.trim() || null,
      isReprint: Boolean(isReprint),
    }
  );

  const printResult = await waitForIsolatedPrint({
    receiptId,
    url: receiptPrintUrl(receiptId, {
      copies: normalizedCopies,
      isReprint,
      requestKey,
    }),
  });

  return {
    ...printResult,
    requestKey,
    printRequest: requestResponse?.data || requestResponse || null,
  };
}

function productLabelUrl({ productId, barcode, quantity, size }) {
  const query = new URLSearchParams({
    productId: String(productId),
    barcode: String(barcode),
    quantity: String(quantity),
    size: String(size),
  });
  return `/labels/print?${query}`;
}

export function printProductLabelsInFrame({ productId, barcode, quantity = 1, size = 'medium' }) {
  if (!productId || !barcode) return Promise.reject(new Error('بيانات ملصق المنتج غير مكتملة.'));
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.className = 'a4-print-frame';
    iframe.title = 'مستند طباعة ملصقات المنتج';
    iframe.setAttribute('aria-hidden', 'true');
    let readyTimer;
    let completeTimer;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(completeTimer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
    };
    const finish = (value) => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(value);
      }
    };
    const fail = (error) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
      if (
        event.data?.source !== LABEL_PRINT_MESSAGE_SOURCE ||
        event.data?.labelId !== String(barcode)
      )
        return;
      if (event.data.type === PRINT_ERROR)
        return fail(new Error(event.data.message || 'تعذر تجهيز الملصقات.'));
      if (event.data.type === PRINT_COMPLETE) return finish({ printed: true });
      if (event.data.type !== PRINT_READY) return;
      window.clearTimeout(readyTimer);
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        completeTimer = window.setTimeout(
          () => finish({ printed: true, afterPrintTimedOut: true }),
          AFTER_PRINT_TIMEOUT_MS
        );
      } catch (error) {
        fail(error);
      }
    };

    window.addEventListener('message', onMessage);
    readyTimer = window.setTimeout(
      () => fail(new Error('انتهت مهلة تجهيز الملصقات.')),
      READY_TIMEOUT_MS
    );
    iframe.src = productLabelUrl({ productId, barcode, quantity, size });
    document.body.appendChild(iframe);
  });
}
