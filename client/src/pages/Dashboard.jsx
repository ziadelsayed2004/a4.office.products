import { useEffect, useState } from 'react';
import { Alert, Button, List, ListItem, ListItemText } from '@mui/material';
import { AttachMoneyRounded, BadgeRounded, InventoryRounded, PointOfSaleRounded, RefreshRounded, SwapHorizRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { money, number } from '../utils/formatters.js';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); setError(''); try { setData((await api.get('/api/admin/kpis')).data); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <div className="a4-page"><PageHeader title="لوحة التحكم" description="نظرة سريعة على أداء المكتبة وحالة التشغيل الحالية." actions={<Button variant="outlined" startIcon={<RefreshRounded/>} onClick={load}>تحديث البيانات</Button>}/>{error && <Alert severity="error">{error}</Alert>}{loading ? <LoadingState/> : data && <>
    <div className="a4-grid a4-grid--metrics">
      <MetricCard icon={<AttachMoneyRounded/>} label="إجمالي المبيعات" value={money(data.totalSales)} hint={`${number(data.salesCount)} فاتورة`}/>
      <MetricCard icon={<BadgeRounded/>} label="إجمالي العربون" value={money(data.totalDeposits)} hint={`${number(data.activePreordersCount)} حجز مفتوح`}/>
      <MetricCard icon={<InventoryRounded/>} label="تنبيهات المخزون" value={number(data.lowStockCount)} hint="منتجات تحتاج متابعة"/>
      <MetricCard icon={<SwapHorizRounded/>} label="شيفتات للمراجعة" value={number(data.pendingShiftsCount)} hint="طلبات تقفيل معلقة"/>
    </div>
    <section className="a4-page-section"><div className="a4-toolbar"><div><h2 className="a4-section-title">الأكثر مبيعاً</h2><p className="a4-section-subtitle">أفضل المنتجات حسب الكمية المباعة.</p></div></div>
      <List disablePadding>{(data.topProducts || []).length ? data.topProducts.map((item, i) => <ListItem divider key={item.id} className="dashboard-top-product"><div className="metric-card__icon metric-card__icon--small"><PointOfSaleRounded fontSize="small"/></div><ListItemText primary={`${i + 1}. ${item.name}`} secondary={`SKU: ${item.sku}`}/><strong>{number(item.total_qty)} قطعة</strong></ListItem>) : <Alert severity="info">لا توجد مبيعات مسجلة حتى الآن.</Alert>}</List>
    </section>
  </>}</div>;
}
