import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { ArrowBackRounded, PrintRounded } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import { LoadingState } from '../components/LoadingState.jsx';
import { ReturnAuthorizationCard } from '../components/ReturnAuthorizationCard.jsx';
import '../styles/ReturnAuthorizationPrint.css';

export default function ReturnAuthorizationPrint() {
  const { authorizationId } = useParams();
  const navigate = useNavigate();
  const [authorization, setAuthorization] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get(`/api/admin/return-authorizations/${authorizationId}`)
      .then((response) => {
        if (!active) return;
        setAuthorization(response.data);
        requestAnimationFrame(() => globalThis.print?.());
      })
      .catch((loadError) => active && setError(loadError.message));
    return () => {
      active = false;
    };
  }, [authorizationId]);

  if (!authorization && !error) return <LoadingState label="جاري تجهيز بطاقة المرتجع..." />;

  return (
    <main className="return-card-print-page">
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
