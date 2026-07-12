import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/apiClient.js';
import { APP_CONFIG } from '../config/appConfig.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(APP_CONFIG.storageKeys.accessToken);
    localStorage.removeItem(APP_CONFIG.storageKeys.refreshToken);
    setUser(null);
    setCurrentShift(null);
  }, []);

  const loadShift = useCallback(async () => {
    if (!localStorage.getItem(APP_CONFIG.storageKeys.accessToken)) return null;
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
    const token = localStorage.getItem(APP_CONFIG.storageKeys.accessToken);
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
    localStorage.setItem(APP_CONFIG.storageKeys.accessToken, auth.accessToken);
    if (auth.refreshToken) localStorage.setItem(APP_CONFIG.storageKeys.refreshToken, auth.refreshToken);
    setUser(auth.user);
    await loadShift();
    return auth.user;
  }, [loadShift]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(APP_CONFIG.storageKeys.refreshToken);
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
