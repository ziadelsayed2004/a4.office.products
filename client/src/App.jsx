import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/AuthContext.jsx';
import { ThemeConfig } from './theme/ThemeConfig.jsx';
import { MainLayout } from './layouts/MainLayout.jsx';
import { Box, CircularProgress } from '@mui/material';

// Modular Pages
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Categories from './pages/Categories.jsx';
import PriceTiers from './pages/PriceTiers.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Payments from './pages/Payments.jsx';
import Customers from './pages/Customers.jsx';
import PrinterSettings from './pages/PrinterSettings.jsx';
import Users from './pages/Users.jsx';
import Products from './pages/Products.jsx';
import Inventory from './pages/Inventory.jsx';
import Shifts from './pages/Shifts.jsx';
import Reports from './pages/Reports.jsx';
import ShiftSummary from './pages/ShiftSummary.jsx';
import Receipts from './pages/Receipts.jsx';
import Preorders from './pages/Preorders.jsx';
import POS from './pages/POS.jsx';

import './App.css';

// Guard for routes that require authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Guard for admin-only pages
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'Admin') {
    return <Navigate to="/pos" replace />;
  }

  return children;
};

// Guard for guest-only pages
const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export function App() {
  return (
    <ThemeConfig>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Guest Route */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
              <Route path="categories" element={<AdminRoute><Categories /></AdminRoute>} />
              <Route path="price-tiers" element={<AdminRoute><PriceTiers /></AdminRoute>} />
              <Route path="products" element={<AdminRoute><Products /></AdminRoute>} />
              <Route path="inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
              <Route path="payments" element={<AdminRoute><Payments /></AdminRoute>} />
              <Route path="customers" element={<AdminRoute><Customers /></AdminRoute>} />
              <Route path="pos" element={<POS />} />
              <Route path="receipts" element={<Receipts />} />
              <Route path="shifts" element={<AdminRoute><Shifts /></AdminRoute>} />
              <Route path="shift-summary" element={<ShiftSummary />} />
              <Route path="preorders" element={<AdminRoute><Preorders /></AdminRoute>} />
              <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
              <Route path="printer-settings" element={<AdminRoute><PrinterSettings /></AdminRoute>} />
              <Route path="logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeConfig>
  );
}

export default App;
