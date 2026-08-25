import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [entitlements, setEntitlements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe()
        .then(data => {
          setUser(data.user);
          setEntitlements(Array.isArray(data.entitlements) ? data.entitlements : []);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    // Sprint 4: entitlements ride along on the login response (Sprint 3
    // retrofit) — stash them so the cross-product nav can read them without
    // a second network call. Empty array, never undefined, so ProductSwitcher
    // equivalents can render unconditionally.
    setEntitlements(Array.isArray(data.entitlements) ? data.entitlements : []);
    return data;
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setEntitlements([]);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, entitlements, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
