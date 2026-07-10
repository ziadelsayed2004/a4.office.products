import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/AuthContext';
import { ThemeConfig } from './theme/ThemeConfig';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { AuditLogs } from './pages/AuditLogs';
import { Profile } from './pages/Profile';
import { Authors } from './pages/Authors';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Outlets } from './pages/Outlets';
import { OutletTypes } from './pages/OutletTypes';
import { Invoices } from './pages/Invoices';
import { Payments } from './pages/Payments';
import { Inventory } from './pages/Inventory';
import { Shipments } from './pages/Shipments';
import { Reports } from './pages/Reports';
import { Exports } from './pages/Exports';
import { Finance } from './pages/Finance';
import { Returns } from './pages/Returns';
import { Notifications } from './pages/Notifications';
import { Backups } from './pages/Backups';
import { Box, Typography, Paper } from '@mui/material';
import { LoadingState } from './components/LoadingState';
import './styles/App.css';

// Guard for routes that require authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box className="route-loading">
        <LoadingState type="skeleton" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Guard for guest-only pages (e.g. Login)
const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box className="route-loading">
        <LoadingState type="spinner" />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Simple placeholder page for routes implemented in future steps
const PlaceholderPage = ({ title }) => (
  <Paper sx={{ p: 4, textAlign: 'center' }}>
    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
      {title}
    </Typography>
    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
      هذه الصفحة قيد التطوير وسيتم تفعيلها في خطوة العمل القادمة.
    </Typography>
  </Paper>
);

export function App() {
  return (
    <ErrorBoundary>
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
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="users" element={<Users />} />
                <Route path="outlet-types" element={<OutletTypes />} />
                <Route path="outlets" element={<Outlets />} />
                <Route path="authors" element={<Authors />} />
                <Route path="products" element={<Products />} />
                <Route path="categories" element={<Categories />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="returns" element={<Returns />} />
                <Route path="payments" element={<Payments />} />
                <Route path="finance" element={<Finance />} />
                <Route path="shipments" element={<Shipments />} />
                <Route path="reports" element={<Reports />} />
                <Route path="exports" element={<Exports />} />
                <Route path="backups" element={<Backups />} />
                <Route path="audit" element={<AuditLogs />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeConfig>
    </ErrorBoundary>
  );
}

export default App;
