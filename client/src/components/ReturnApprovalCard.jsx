import { QRCodeSVG } from 'qrcode.react';
import logo from '../assets/a4-logo.png';
import { APP_CONFIG } from '../config/appConfig.js';
import './ReturnApprovalCard.css';

export function ReturnApprovalCard({ card }) {
  if (!card) return null;
  const cardNumber = card.cardNumber || card.card_number;
  const ownerName = card.ownerAdminName || card.owner_admin_name;
  const qrToken = card.qrToken || card.qr_token;
  return (
    <article
      className="return-approval-card"
      data-return-card-ready={qrToken ? 'true' : undefined}
      dir="rtl"
    >
      <div className="return-approval-card__brand">
        <img src={logo} alt={APP_CONFIG.logoAlt} />
        <div>
          <strong>{APP_CONFIG.brandName}</strong>
          <span>كارت اعتماد المرتجعات</span>
        </div>
      </div>
      <div className="return-approval-card__identity">
        <span>اسم الكارت</span>
        <strong>{card.label}</strong>
        <b className="a4-ltr">{cardNumber}</b>
      </div>
      <div className="return-approval-card__owner">
        <span>الأدمن المالك</span>
        <strong>{ownerName || 'إدارة A4'}</strong>
        <small>صالح حتى الإيقاف أو تغيير QR</small>
      </div>
      <div className="return-approval-card__qr">
        {qrToken ? (
          <QRCodeSVG
            value={qrToken}
            size={128}
            level="H"
            marginSize={1}
            title={`كارت اعتماد ${cardNumber}`}
          />
        ) : (
          <strong>QR غير متاح</strong>
        )}
      </div>
      <footer>
        <strong>للاستخدام الإداري فقط</strong>
        <span>لا يُسلّم للكاشير ولا يحتوي على بيانات عميل.</span>
      </footer>
    </article>
  );
}

export default ReturnApprovalCard;
