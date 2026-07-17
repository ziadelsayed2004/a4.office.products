import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import JsBarcode from 'jsbarcode';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import {
  LABEL_PRINT_MESSAGE_SOURCE,
  PRINT_COMPLETE,
  PRINT_ERROR,
  PRINT_READY,
} from '../services/printService.js';
import { LoadingState } from '../components/LoadingState.jsx';
import { money } from '../utils/formatters.js';
import {
  applyProductLabelPageSize,
  normalizeProductLabelSize,
  PRODUCT_LABEL_SIZES,
} from '../utils/productLabelPrintSizing.js';
import '../styles/ProductLabelPrint.css';

function post(type, labelId, extra = {}) {
  if (window.parent === window) return;
  window.parent.postMessage(
    { source: LABEL_PRINT_MESSAGE_SOURCE, type, labelId, ...extra },
    window.location.origin
  );
}

function Barcode({ value, size }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: PRODUCT_LABEL_SIZES[size].barcodeHeight,
      width: size === 'small' ? 1 : 1.3,
    });
  }, [value, size]);
  return <svg ref={ref} className="product-label__barcode" aria-label={`Barcode ${value}`} />;
}

async function ready(container) {
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!container?.querySelector('svg.product-label__barcode rect'))
    throw new Error('تعذر إنشاء الباركود بالمقاس المحدد.');
}

export default function ProductLabelPrint() {
  const [params] = useSearchParams();
  const containerRef = useRef(null);
  const barcode = params.get('barcode') || '';
  const productId = params.get('productId') || '';
  const size = normalizeProductLabelSize(params.get('size'));
  const quantity = Math.min(500, Math.max(1, Number.parseInt(params.get('quantity'), 10) || 1));
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const labels = useMemo(() => Array.from({ length: quantity }, (_, index) => index), [quantity]);

  useEffect(() => {
    api
      .get(`/api/products/${encodeURIComponent(productId)}`)
      .then((response) => {
        const loaded = response.data;
        if (String(loaded.barcode || loaded.sku) !== barcode)
          throw new Error('الباركود لا يطابق المنتج.');
        setProduct(loaded);
      })
      .catch((loadError) => {
        setError(loadError.message);
        post(PRINT_ERROR, barcode, { message: loadError.message });
      });
  }, [productId, barcode]);

  useEffect(() => {
    if (!product) return undefined;
    let active = true;
    let cleanup = () => undefined;
    ready(containerRef.current)
      .then(() => {
        if (!active) return;
        const page = applyProductLabelPageSize(containerRef.current, size);
        cleanup = page.cleanup;
        post(PRINT_READY, barcode, { pageWidthMm: page.widthMm, pageHeightMm: page.heightMm });
        if (window.parent === window) window.print();
      })
      .catch((loadError) => post(PRINT_ERROR, barcode, { message: loadError.message }));
    const afterPrint = () => post(PRINT_COMPLETE, barcode);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      active = false;
      cleanup();
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [product, size, barcode]);

  const price = product?.base_sale_price;
  return (
    <main className={`product-label-print product-label-print--${size}`} ref={containerRef}>
      {!product && !error && <LoadingState label="جاري تجهيز الملصقات..." />}
      {error && <Alert severity="error">{error}</Alert>}
      {product &&
        labels.map((index) => (
          <article className="product-label" data-label-ready="true" key={index}>
            <header>
              <strong>A4 Office Products</strong>
              <span className="a4-ltr">{product.sku}</span>
            </header>
            <h1>{product.name}</h1>
            <div className="product-label__body">
              <div>
                <b>{price !== null && price !== undefined ? money(price) : ''}</b>
                <span className="a4-ltr">{barcode}</span>
              </div>
              <Barcode value={barcode} size={size} />
            </div>
          </article>
        ))}
    </main>
  );
}
