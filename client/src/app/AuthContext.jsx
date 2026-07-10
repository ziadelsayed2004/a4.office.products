import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('a4_token');
    if (savedToken) {
      setToken(savedToken);
      fetchProfile(savedToken);
      loadCurrentShift(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchProfile(jwtToken) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (res.status === 200) {
        const payload = await res.json();
        setUser(payload.data);
        setIsAuthenticated(true);
      } else {
        logout();
      }
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentShift(jwtToken = token) {
    if (!jwtToken) return;
    try {
      const res = await fetch('/api/shifts/current', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (res.status === 200) {
        const payload = await res.json();
        setCurrentShift(payload.data);
        return payload.data;
      } else {
        setCurrentShift(null);
      }
    } catch (err) {
      console.error('Failed to load current shift:', err);
      setCurrentShift(null);
    }
  }

  function login(accessToken, userPayload) {
    localStorage.setItem('a4_token', accessToken);
    setToken(accessToken);
    setUser(userPayload);
    setIsAuthenticated(true);
    loadCurrentShift(accessToken);
  }

  function logout() {
    localStorage.removeItem('a4_token');
    setToken('');
    setUser(null);
    setIsAuthenticated(false);
    setCurrentShift(null);
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      token,
      user,
      loading,
      login,
      logout,
      fetchProfile,
      currentShift,
      setCurrentShift,
      loadCurrentShift
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
