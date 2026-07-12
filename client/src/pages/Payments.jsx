import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox } from '@mui/material';
import { PaymentsRounded, SaveRounded } from '@mui/icons-material';
import { api } from '../api/client.js';
import { PageHeader } from '../components/navigation/PageHeader.jsx';
import { LoadingState } from '../components/feedback/LoadingState.jsx';
import { AppSnackbar } from '../components/feedback/AppSnackbar.jsx';

export default function Payments() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [toast, setToast] = useState(null);
  const load = async () => { setLoading(true); try { setRows((await api.get('/api/payment-methods')).data || []); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const save = async () => { setSaving(true); try { await api.post('/api/payment-methods/admin', { active_ids: rows.filter(r => r.is_active).map(r => r.id) }); setToast({ message: 'تم تحديث طرق الدفع.' }); await load(); } catch (e) { setToast({ severity: 'error', message: e.message }); } finally { setSaving(false); } };
  return <div className="a4-page"><PageHeader title="طرق الدفع" description="حدد طرق الدفع التي ستظهر للكاشير أثناء البيع والحجز والتقفيل." actions={<Button variant="contained" startIcon={<SaveRounded/>} onClick={save} disabled={saving}>حفظ الإعدادات</Button>}/>{error && <Alert severity="error">{error}</Alert>}<section className="a4-page-section">{loading ? <LoadingState/> : <div className="a4-grid a4-grid--three">{rows.map((row, i) => <label className="metric-card" key={row.id}><div className="metric-card__icon"><PaymentsRounded/></div><div className="metric-card__copy metric-card__copy--fill"><strong>{row.name_ar || row.name || row.id}</strong><span className="metric-card__hint">متاحة داخل شاشة الدفع وتقارير الشيفت</span></div><Checkbox checked={Boolean(row.is_active)} onChange={e => setRows(list => list.map((x, idx) => idx === i ? { ...x, is_active: e.target.checked ? 1 : 0 } : x))}/></label>)}</div>}</section><AppSnackbar state={toast} onClose={() => setToast(null)}/></div>;
}
