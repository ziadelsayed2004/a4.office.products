import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('a4_access_token');
    localStorage.removeItem('a4_refresh_token');
    setUser(null);
    setCurrentShift(null);
  }, []);

  const loadShift = useCallback(async () => {
    if (!localStorage.getItem('a4_access_token')) return null;
    try {
      const response = await api.get('/api/shifts/current');
      const shift = response?.data || null;
      setCurrentShift(shift);
      return shift;
    } catch {
      setCurrentShift(null);
      return null;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem('a4_access_token');
    if (!token) { setLoading(false); return; }
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
      await loadShift();
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession, loadShift]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = useCallback(async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    const auth = response.data;
    localStorage.setItem('a4_access_token', auth.accessToken);
    if (auth.refreshToken) localStorage.setItem('a4_refresh_token', auth.refreshToken);
    setUser(auth.user);
    await loadShift();
    return auth.user;
  }, [loadShift]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('a4_refresh_token');
    try { if (refreshToken) await api.post('/api/auth/logout', { refreshToken }); } catch { /* local logout remains valid */ }
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'Admin',
    currentShift,
    setCurrentShift,
    loadShift,
    login,
    logout,
  }), [user, loading, currentShift, loadShift, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
