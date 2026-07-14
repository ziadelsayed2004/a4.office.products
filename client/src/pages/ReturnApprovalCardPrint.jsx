import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/apiClient.js';
import { LoadingState } from '../components/LoadingState.jsx';
import '../styles/ReturnAuthorizationPrint.css';
export default function ReturnApprovalCardPrint() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  useEffect(() => {
    api
      .get(`/api/admin/return-approval-cards/${cardId}`)
      .then((response) => setCard(response.data));
  }, [cardId]);
  useEffect(() => {
    if (card?.qrToken) setTimeout(() => window.print(), 100);
  }, [card]);
  if (!card) return <LoadingState />;
  return (
    <main className="return-authorization-print">
      <section>
        <h1>A4 Office</h1>
        <h2>بطاقة اعتماد المرتجع</h2>
        <QRCodeSVG value={card.qrToken} size={220} level="H" />
        <strong>{card.cardNumber}</strong>
        <p>{card.label}</p>
        <p>صالحة حتى الإيقاف — لا تُسلّم للكاشير</p>
      </section>
    </main>
  );
}
