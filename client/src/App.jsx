import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/AuthContext.jsx';
import { ThemeConfig } from './theme/ThemeConfig.jsx';
import { MainLayout } from './layouts/MainLayout.jsx';
import { LoadingState } from './components/LoadingState.jsx';
import './styles/App.css';

const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const POS = lazy(() => import('./pages/POS.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const PriceTiers = lazy(() => import('./pages/PriceTiers.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const Preorders = lazy(() => import('./pages/Preorders.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const Payments = lazy(() => import('./pages/Payments.jsx'));
const ShiftSummary = lazy(() => import('./pages/ShiftSummary.jsx'));
const Shifts = lazy(() => import('./pages/Shifts.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Receipts = lazy(() => import('./pages/Receipts.jsx'));
const AuditLogs = lazy(() => import('./pages/AuditLogs.jsx'));
const PrinterSettings = lazy(() => import('./pages/PrinterSettings.jsx'));

function Protected({ children }) {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingState label="جاري تجهيز المنصة..." />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  if (loading) return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return isAdmin ? children : <Navigate to="/pos" replace />;
}

function GuestOnly({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  if (loading) return <LoadingState />;
  return isAuthenticated ? <Navigate to={isAdmin ? '/' : '/pos'} replace /> : children;
}

function Home() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Dashboard /> : <Navigate to="/pos" replace />;
}

export default function App() {
  return (
    <ThemeConfig>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingState label="جاري فتح الصفحة..." />}>
            <Routes>
              <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
              <Route path="/" element={<Protected><MainLayout /></Protected>}>
                <Route index element={<Home />} />
                <Route path="pos" element={<POS />} />
                <Route path="shift-summary" element={<ShiftSummary />} />
                <Route path="receipts" element={<Receipts />} />
                <Route path="products" element={<AdminOnly><Products /></AdminOnly>} />
                <Route path="categories" element={<AdminOnly><Categories /></AdminOnly>} />
                <Route path="price-tiers" element={<AdminOnly><PriceTiers /></AdminOnly>} />
                <Route path="inventory" element={<AdminOnly><Inventory /></AdminOnly>} />
                <Route path="preorders" element={<AdminOnly><Preorders /></AdminOnly>} />
                <Route path="customers" element={<AdminOnly><Customers /></AdminOnly>} />
                <Route path="payments" element={<AdminOnly><Payments /></AdminOnly>} />
                <Route path="shifts" element={<AdminOnly><Shifts /></AdminOnly>} />
                <Route path="users" element={<AdminOnly><Users /></AdminOnly>} />
                <Route path="reports" element={<AdminOnly><Reports /></AdminOnly>} />
                <Route path="logs" element={<AdminOnly><AuditLogs /></AdminOnly>} />
                <Route path="printer-settings" element={<AdminOnly><PrinterSettings /></AdminOnly>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeConfig>
  );
}
