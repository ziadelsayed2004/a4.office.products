import React from 'react';
import '../styles/ReceiptDetails.css';

export default function ReceiptDetails({ receipt }) {
  if (!receipt) return null;

  return (
    <div className="thermal-receipt-container">
      {/* Header */}
      <div className="receipt-header-title">مكتبة A4 للأدوات المكتبية</div>
      <div className="receipt-header-subtitle">فرع وسط البلد الرئيسي</div>
      <div className="receipt-type-banner">
        {receipt.reference_type === 'order_sale' ? 'إيصال مبيعات مسبقة الدفع' :
         receipt.reference_type === 'preorder_deposit' ? 'إيصال حجز مسبق وعربون' : 'إيصال استلام حجز نهائي'}
      </div>
      <div className="receipt-dashed-line" />

      {/* Metadata Details */}
      <div className="receipt-metadata">
        <div>رقم الإيصال: <strong>{receipt.receipt_number}</strong></div>
        <div>رقم المرجع: <strong>{receipt.invoice_number || receipt.preorder_number}</strong></div>
        <div>التاريخ والوقت: <strong>{new Date(receipt.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</strong></div>
        <div>الكاشير المسؤول: <strong>{receipt.printed_by_name}</strong></div>
        {receipt.customer_name && (
          <div className="receipt-dotted-line">
            العميل: <strong>{receipt.customer_name}</strong> ({receipt.customer_phone})
          </div>
        )}
      </div>

      <div className="receipt-dashed-line" />

      {/* Items Table */}
      <table className="receipt-items-table">
        <thead>
          <tr className="receipt-table-header">
            <th>الصنف</th>
            <th style={{ textAlign: 'center' }}>الكمية</th>
            <th style={{ textAlign: 'left' }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} className="receipt-table-row">
              <td className="receipt-item-pad">
                {item.product_name}
                {item.is_book === 1 && (
                  <span className="receipt-book-extra">
                    ({item.school_grade} / {item.subject} / {item.term === 'first' ? 'ترم أول' : 'ترم ثاني'})
                  </span>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ textAlign: 'left' }}>{(item.total_price / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-dashed-line" />

      {/* Pricing calculations */}
      <div className="receipt-pricing-block">
        <div className="receipt-pricing-row">
          <span>المجموع الفرعي:</span>
          <span>{(receipt.subtotal / 100).toFixed(2)} ج.م</span>
        </div>
        {receipt.discount > 0 && (
          <div className="receipt-pricing-row">
            <span>الخصم:</span>
            <span>-{(receipt.discount / 100).toFixed(2)} ج.م</span>
          </div>
        )}
        <div className="receipt-pricing-total">
          <span>إجمالي القيمة:</span>
          <span>{(receipt.total / 100).toFixed(2)} ج.م</span>
        </div>

        {/* Preorder Specific details */}
        {(receipt.reference_type === 'preorder_deposit' || receipt.reference_type === 'preorder_pickup') && (
          <div className="receipt-preorder-details">
            <div className="receipt-pricing-row">
              <span>العربون المدفوع:</span>
              <strong style={{ color: 'var(--success)' }}>{(receipt.deposit_paid / 100).toFixed(2)} ج.م</strong>
            </div>
            <div className="receipt-pricing-row">
              <span>المبلغ المتبقي للتحصيل:</span>
              <strong>{(receipt.remaining_amount / 100).toFixed(2)} ج.م</strong>
            </div>
            <div className="receipt-pricing-row">
              <span>طريقة التسليم:</span>
              <span>{receipt.pickup_method === 'walk_in' ? 'استلام من المعرض' : 'توصيل منزلي'}</span>
            </div>
            {receipt.reference_type === 'preorder_pickup' && (
              <div className="receipt-pricing-row" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                <span>حالة الاستلام:</span>
                <span>تم التسليم بنجاح</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="receipt-dashed-line" />

      {/* Payments detail */}
      <div className="receipt-metadata">
        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>تفاصيل الدفع:</div>
        {receipt.payments.map((p, idx) => (
          <div key={idx} className="receipt-pricing-row">
            <span>{p.payment_method === 'Cash' ? 'نقدي (Cash)' : p.payment_method === 'Card' ? 'بطاقة (Card)' : p.payment_method === 'InstaPay' ? 'إنستا باي (InstaPay)' : p.payment_method === 'Wallet' ? 'محفظة إلكترونية' : p.payment_method}</span>
            <span>{(p.amount / 100).toFixed(2)} ج.م</span>
          </div>
        ))}
      </div>

      {/* QR Code */}
      {receipt.qr_token && (
        <div className="receipt-qr-block">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${receipt.qr_token}`}
            alt="Receipt QR Lookup"
            className="receipt-qr-image"
          />
          <span className="receipt-qr-caption">
            {receipt.reference_type === 'preorder_deposit' ? 'رمز تسليم الحجز (QR)' : 'رمز التحقق من الفاتورة'}
          </span>
        </div>
      )}

      <div className="receipt-dashed-line" />
      <div className="receipt-footer-thanks">شكراً لتعاملكم معنا! مكتبة A4 تتمنى لكم يوماً سعيداً.</div>
      
      {receipt.print_count > 1 && (
        <div className="receipt-copy-indicator">
          نسخة مكررة رقم {receipt.print_count}
        </div>
      )}
    </div>
  );
}
