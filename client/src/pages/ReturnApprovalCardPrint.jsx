import { useEffect, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import {
  PRINT_COMPLETE,
  PRINT_ERROR,
  PRINT_READY,
  RETURN_CARD_PRINT_MESSAGE_SOURCE,
} from '../services/printService.js';
import { ReturnApprovalCard } from '../components/ReturnApprovalCard.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import {
  applyReturnApprovalCardPageSize,
  normalizeReturnApprovalCardPrintMode,
} from '../utils/returnApprovalCardPrintSizing.js';
import '../styles/ReturnAuthorizationPrint.css';

function post(type, cardId, extra = {}) {
  if (window.parent === window) return;
  window.parent.postMessage(
    { source: RETURN_CARD_PRINT_MESSAGE_SOURCE, type, cardId, ...extra },
    window.location.origin
  );
}

async function waitForAssets(container) {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = Array.from(container?.querySelectorAll('img') || []);
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve, reject) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', () => reject(new Error('تعذر تحميل شعار الكارت.')), {
            once: true,
          });
        });
      }
      if (typeof image.decode === 'function') await image.decode().catch(() => undefined);
    })
  );
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!container?.querySelector('.return-approval-card__qr svg')) {
    throw new Error('تعذر إنشاء QR الخاص بكارت الاعتماد.');
  }
}

export default function ReturnApprovalCardPrint() {
  const { cardId } = useParams();
  const [params] = useSearchParams();
  const containerRef = useRef(null);
  const mode = normalizeReturnApprovalCardPrintMode(params.get('mode'));
  const copies = Math.min(20, Math.max(1, Number.parseInt(params.get('copies'), 10) || 1));
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/api/admin/return-approval-cards/${encodeURIComponent(cardId)}`)
      .then((response) => {
        const loadedCard = response.data || response;
        if (loadedCard.status !== 'ACTIVE') {
          throw new Error('كارت الاعتماد متوقف ولا يمكن طباعته.');
        }
        if (loadedCard.ownerAdminActive === false) {
          throw new Error('مالك كارت الاعتماد لم يعد حساب Admin نشطاً.');
        }
        setCard(loadedCard);
      })
      .catch((loadError) => {
        setError(loadError.message);
        post(PRINT_ERROR, cardId, { message: loadError.message });
      });
  }, [cardId]);

  useEffect(() => {
    if (!card) return undefined;
    let active = true;
    let cleanup = () => undefined;
    waitForAssets(containerRef.current)
      .then(() => {
        if (!active) return;
        const page = applyReturnApprovalCardPageSize(containerRef.current, mode);
        cleanup = page.cleanup;
        post(PRINT_READY, cardId, {
          mode: page.mode,
          pageWidthMm: page.widthMm,
          pageHeightMm: page.heightMm,
        });
        if (window.parent === window) window.print();
      })
      .catch((loadError) => {
        setError(loadError.message);
        post(PRINT_ERROR, cardId, { message: loadError.message });
      });
    const afterPrint = () => post(PRINT_COMPLETE, cardId);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      active = false;
      cleanup();
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [card, cardId, mode]);

  if (!card && !error) return <LoadingState label="جاري تجهيز كارت الاعتماد..." />;
  return (
    <main
      ref={containerRef}
      className={`return-card-print-page return-card-print-page--${mode}`}
      data-print-mode={mode}
    >
      {error && <Alert severity="error">{error}</Alert>}
      {card &&
        Array.from({ length: copies }, (_, index) => (
          <div className="return-approval-card-cut" key={index}>
            <ReturnApprovalCard card={card} />
          </div>
        ))}
    </main>
  );
}
