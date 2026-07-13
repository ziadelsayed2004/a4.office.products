import { QRCodeSVG } from 'qrcode.react';
import logo from '../assets/a4-logo.png';
import { APP_CONFIG } from '../config/appConfig.js';
import { dateTime, money, number } from '../utils/formatters.js';
import './ReturnAuthorizationCard.css';

export function ReturnAuthorizationCard({ authorization }) {
  if (!authorization) return null;
  const itemCount = authorization.itemCount ?? authorization.items?.length ?? 0;
  return (
    <article className="return-card" dir="rtl">
      <header className="return-card__header">
        <div className="return-card__logo-surface">
          <img src={logo} alt={APP_CONFIG.logoAlt} />
        </div>
        <strong>{APP_CONFIG.brandName}</strong>
        <span>بطاقة تصريح مرتجع لمرة واحدة</span>
      </header>
      <div className="return-card__number a4-ltr">{authorization.authorizationNumber}</div>
      <dl className="return-card__details">
        <div>
          <dt>رقم الفاتورة</dt>
          <dd className="a4-ltr">{authorization.invoiceNumber}</dd>
        </div>
        <div>
          <dt>عدد البنود</dt>
          <dd>{number(itemCount)}</dd>
        </div>
        <div>
          <dt>إجمالي الرد</dt>
          <dd>{money(authorization.totalRefund)}</dd>
        </div>
        <div>
          <dt>صالحة حتى</dt>
          <dd>{dateTime(authorization.expiresAt)}</dd>
        </div>
      </dl>
      <div className="return-card__qr">
        {authorization.qrToken ? (
          <QRCodeSVG
            value={authorization.qrToken}
            size={164}
            level="M"
            marginSize={2}
            title={`بطاقة المرتجع ${authorization.authorizationNumber}`}
          />
        ) : (
          <strong>الرمز غير متاح لهذه البطاقة</strong>
        )}
      </div>
      <p>يمسح الكاشير هذا الرمز للمعاينة ثم يؤكد التنفيذ داخل شيفت مفتوح.</p>
      <footer>لا تحتوي البطاقة على اسم العميل أو أي بيانات شخصية.</footer>
    </article>
  );
}

export default ReturnAuthorizationCard;
