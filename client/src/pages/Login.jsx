import { useState } from 'react';
import { Alert, Button, IconButton, InputAdornment, TextField } from '@mui/material';
import { LockRounded, PersonRounded, VisibilityOffRounded, VisibilityRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { Field } from '../components/forms/Field.jsx';
import logo from '../assets/a4-logo.png';
import '../styles/login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => { e.preventDefault(); setError(''); setLoading(true); try { const user = await login(form.username.trim(), form.password); navigate(user.role === 'Admin' ? '/' : '/pos', { replace: true }); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <main className="login-page"><section className="login-panel">
    <div className="login-brand"><img src={logo} alt="A4 Office Products"/><div><strong>A4 Office Products</strong><span>منصة إدارة المكتبة ونقطة البيع</span></div></div>
    <div className="login-copy"><span className="login-eyebrow">تسجيل الدخول</span><h1>مرحباً بعودتك</h1><p>استخدم حساب الأدمن أو الكاشير للدخول إلى مساحة العمل المخصصة لك.</p></div>
    {error && <Alert severity="error">{error}</Alert>}
    <form className="login-form" onSubmit={submit}>
      <Field label="اسم المستخدم" required><TextField value={form.username} onChange={(e) => setForm(v => ({ ...v, username: e.target.value }))} autoComplete="username" placeholder="أدخل اسم المستخدم" InputProps={{ startAdornment: <InputAdornment position="start"><PersonRounded fontSize="small"/></InputAdornment> }}/></Field>
      <Field label="كلمة المرور" required><TextField type={show ? 'text' : 'password'} value={form.password} onChange={(e) => setForm(v => ({ ...v, password: e.target.value }))} autoComplete="current-password" placeholder="أدخل كلمة المرور" InputProps={{ startAdornment: <InputAdornment position="start"><LockRounded fontSize="small"/></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShow(v => !v)}>{show ? <VisibilityOffRounded/> : <VisibilityRounded/>}</IconButton></InputAdornment> }}/></Field>
      <Button type="submit" variant="contained" size="large" disabled={loading || !form.username || !form.password}>{loading ? 'جاري تسجيل الدخول...' : 'دخول إلى المنصة'}</Button>
    </form>
    <div className="login-demo"><span>حساب تجريبي للإدارة</span><code>admin / admin123</code></div>
  </section><aside className="login-visual"><div className="login-visual__content"><span>نظام واحد متكامل</span><h2>بيع أسرع، مخزون أدق، وحجوزات منظمة</h2><p>واجهة عربية مصممة للعمل اليومي على الكمبيوتر والتابلت والموبايل.</p><div className="login-features"><span>نقطة بيع سريعة</span><span>حجوزات بعربون</span><span>تقفيل شيفتات</span><span>تقارير فورية</span></div></div></aside></main>;
}
