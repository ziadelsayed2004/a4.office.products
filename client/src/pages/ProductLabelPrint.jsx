import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import {
  LABEL_PRINT_MESSAGE_SOURCE, PRINT_COMPLETE, PRINT_ERROR, PRINT_READY
} from '../services/printService.js';
import { LoadingState } from '../components/LoadingState.jsx';
import { money } from '../utils/formatters.js';
import '../styles/ProductLabelPrint.css';

function post(type, labelId, extra = {}) {
  if (window.parent === window) return;
  window.parent.postMessage({ source: LABEL_PRINT_MESSAGE_SOURCE, type, labelId, ...extra }, window.location.origin);
}

async function ready(container) {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = [...(container?.querySelectorAll('img') || [])];
  await Promise.all(images.map((image) => image.decode?.().catch(() => undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export default function ProductLabelPrint() {
  const [params] = useSearchParams();
  const containerRef = useRef(null);
  const token = params.get('token') || '';
  const productId = params.get('productId') || '';
  const size = ['small', 'medium', 'large'].includes(params.get('size')) ? params.get('size') : 'medium';
  const quantity = Math.min(500, Math.max(1, Number.parseInt(params.get('quantity'), 10) || 1));
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const labels = useMemo(() => Array.from({ length: quantity }, (_, index) => index), [quantity]);

  useEffect(() => {
    Promise.all([
      api.get(`/api/products/${encodeURIComponent(productId)}`),
      api.post('/api/pos/scan/resolve', { code: token }),
    ]).then(([productResponse, tokenResponse]) => {
      const resolved = tokenResponse.data || {};
      if (resolved.type !== 'product' || Number(resolved.data?.id) !== Number(productId)) {
        throw new Error('رمز المنتج لا يطابق المنتج المطلوب.');
      }
      setProduct(productResponse.data);
    }).catch((loadError) => {
      setError(loadError.message);
      post(PRINT_ERROR, token, { message: loadError.message });
    });
  }, [productId, token]);

  useEffect(() => {
    if (!product) return undefined;
    let active = true;
    ready(containerRef.current).then(() => {
      if (!active) return;
      post(PRINT_READY, token);
      if (window.parent === window) window.print();
    }).catch((loadError) => post(PRINT_ERROR, token, { message: loadError.message }));
    const afterPrint = () => post(PRINT_COMPLETE, token);
    window.addEventListener('afterprint', afterPrint);
    return () => { active = false; window.removeEventListener('afterprint', afterPrint); };
  }, [product, token]);

  const price = product?.prices?.find((row) => row.is_active === 1 && row.price !== null)
    || product?.prices?.find((row) => row.price !== null);

  return (
    <main className={`product-label-print product-label-print--${size}`} ref={containerRef}>
      {!product && !error && <LoadingState label="جاري تجهيز الملصقات..." />}
      {error && <Alert severity="error">{error}</Alert>}
      {product && labels.map((index) => (
        <article className="product-label" key={index}>
          <header><strong>A4 Office Products</strong><span className="a4-ltr">{product.sku}</span></header>
          <h1>{product.name}</h1>
          <div className="product-label__body">
            <div><b>{price ? money(price.price) : ''}</b><span className="a4-ltr">{product.barcode || product.sku}</span></div>
            <QRCodeSVG value={token} size={size === 'large' ? 112 : size === 'small' ? 54 : 64} level="M" />
          </div>
        </article>
      ))}
    </main>
  );
}
