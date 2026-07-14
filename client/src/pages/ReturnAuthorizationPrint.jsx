import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import { LoadingState } from '../components/LoadingState.jsx';
import { ReturnAuthorizationCard } from '../components/ReturnAuthorizationCard.jsx';
import '../styles/ReturnAuthorizationPrint.css';

const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const CSS_PIXELS_PER_MILLIMETER = CSS_PIXELS_PER_INCH / MILLIMETERS_PER_INCH;

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

function applyReturnAuthorizationPrintPageSize(container, widthMm) {
  if (!container) return null;
  const card = container.querySelector('.return-card');
  if (!card) return null;

  card.style.width = `${widthMm}mm`;

  const rect = card.getBoundingClientRect();
  const contentHeightMm = rect.height / CSS_PIXELS_PER_MILLIMETER;
  const heightMm = Math.ceil(contentHeightMm + 2); // 2mm margin

  const documentRef = container.ownerDocument;
  documentRef.head.querySelector('style[data-return-auth-print-style]')?.remove();

  const style = documentRef.createElement('style');
  style.dataset.returnAuthPrintStyle = 'true';
  style.textContent = `
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
    }
    @media print {
      html, body, #root, .theme-root {
        box-sizing: border-box !important;
        width: ${widthMm}mm !important;
        max-width: ${widthMm}mm !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
      }
      .return-card-print-page {
        padding: 0 !important;
        background: #ffffff !important;
      }
      .return-card {
        width: ${widthMm}mm !important;
        min-height: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
  `;
  documentRef.head.appendChild(style);
  return {
    cleanup() {
      style.remove();
    }
  };
}

export default function ReturnAuthorizationPrint() {
  const { authorizationId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [authorization, setAuthorization] = useState(null);
  const [printerWidth, setPrinterWidth] = useState(80);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([
      api.get(`/api/admin/return-authorizations/${authorizationId}`),
      api.get('/api/printer-settings').catch(() => ({ data: { receipt_printer_width: '80mm' } })),
    ])
      .then(([authResponse, settingsResponse]) => {
        if (!active) return;
        setAuthorization(authResponse.data || authResponse);
        const settingsWidth = settingsResponse.data?.receipt_printer_width || '80mm';
        const width = String(settingsWidth).startsWith('58') ? 58 : 80;
        setPrinterWidth(width);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authorizationId]);

  useEffect(() => {
    if (!authorization) return undefined;
    let active = true;
    let cleanup = () => undefined;

    waitForAssets(containerRef.current)
      .then(() => {
        if (!active) return;
        const res = applyReturnAuthorizationPrintPageSize(containerRef.current, printerWidth);
        if (res) cleanup = res.cleanup;
        requestAnimationFrame(() => globalThis.print?.());
      });

    return () => {
      active = false;
      cleanup();
    };
  }, [authorization, printerWidth]);

  if (loading) return <LoadingState label="جاري تجهيز بطاقة المرتجع..." />;

  return (
    <main className="return-card-print-page" ref={containerRef}>
      <div className="return-card-print-page__actions">
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/return-authorizations')}>
          رجوع
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintRounded />}
          onClick={() => globalThis.print?.()}
        >
          طباعة
        </Button>
      </div>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <ReturnAuthorizationCard authorization={authorization} />
      )}
    </main>
  );
}
