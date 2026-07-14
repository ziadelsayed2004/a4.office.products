import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import {
  PRINT_COMPLETE,
  PRINT_ERROR,
  PRINT_MESSAGE_SOURCE,
  PRINT_READY,
} from '../services/printService.js';
import { ThermalReceipt } from '../components/ThermalReceipt.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { applyReceiptPageSize } from '../utils/receiptPrintSizing.js';
import {
  normalizeBrowserPrintSettings,
  PRINTER_SETTINGS_UNAVAILABLE_MESSAGE,
} from '../utils/browserPrintSettings.js';
import '../styles/ReceiptPrint.css';

function normalizedCopies(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 20) : 1;
}

function postPrintMessage(type, receiptId, extra = {}) {
  if (window.parent === window) return;
  window.parent.postMessage(
    {
      source: PRINT_MESSAGE_SOURCE,
      type,
      receiptId: String(receiptId),
      ...extra,
    },
    window.location.origin
  );
}

async function waitForAssets(container) {
  if (document.fonts?.ready) await document.fonts.ready;

  const images = [...(container?.querySelectorAll('img') || [])];
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }
      if (image.decode) await image.decode().catch(() => undefined);
    })
  );

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export default function ReceiptPrint() {
  const { receiptId } = useParams();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copies = normalizedCopies(searchParams.get('copies'));
  const reprint = searchParams.get('reprint') === '1';
  const copyNumbers = useMemo(
    () => Array.from({ length: copies }, (_, index) => index + 1),
    [copies]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([
      api.get(`/api/receipts/${encodeURIComponent(receiptId)}`),
      api.get('/api/printer-settings').catch((settingsError) => {
        throw new Error(`${PRINTER_SETTINGS_UNAVAILABLE_MESSAGE} ${settingsError.message}`);
      }),
    ])
      .then(([response, settingsResponse]) => {
        if (!active) return;
        setReceipt(response.data || response || null);
        setSettings(normalizeBrowserPrintSettings(settingsResponse.data || settingsResponse));
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        postPrintMessage(PRINT_ERROR, receiptId, { message: err.message });
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [receiptId]);

  useEffect(() => {
    if (!receipt) return undefined;
    let active = true;
    let cleanupPageSize = () => undefined;
    document.title = `طباعة ${receipt.receipt_number || receiptId}`;

    waitForAssets(containerRef.current)
      .then(() => {
        if (!active) return;
        const pageSize = applyReceiptPageSize(containerRef.current);
        cleanupPageSize = pageSize.cleanup;
        postPrintMessage(PRINT_READY, receiptId, {
          pageWidthMm: pageSize.widthMm,
          pageHeightMm: pageSize.heightMm,
        });
      })
      .catch((err) => active && postPrintMessage(PRINT_ERROR, receiptId, { message: err.message }));

    const afterPrint = () => postPrintMessage(PRINT_COMPLETE, receiptId);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      active = false;
      cleanupPageSize();
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [copies, receipt, receiptId, settings]);

  return (
    <main className="receipt-print-page" ref={containerRef}>
      {loading && <LoadingState label="جاري تجهيز مستند الطباعة..." />}
      {error && <Alert severity="error">{error}</Alert>}
      {receipt &&
        copyNumbers.map((copyNumber) => (
          <ThermalReceipt
            key={copyNumber}
            receipt={receipt}
            settings={settings}
            reprint={reprint}
            copyNumber={copyNumber}
            copies={copies}
          />
        ))}
    </main>
  );
}
