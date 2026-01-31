import { createContext, useContext, useEffect, useState } from 'react';
import { saApi } from './api';

// Super Admin auth is intentionally separated from tenant/admin auth.
// SA tokens live under `localStorage.sa_token` and are sent to `/sa/*`
// endpoints so a Super Admin can be signed in concurrently with a regular admin.

const SaAuthContext = createContext(null);

export function SaAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sa_token');
    if (!token) {
      setLoading(false);
      return;
    }

    saApi.getMe()
      .then((data) => setUser(data.user))
      .catch(() => saApi.setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await saApi.login(email, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await saApi.logout();
    setUser(null);
  };

  return (
    <SaAuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </SaAuthContext.Provider>
  );
}

export function useSaAuth() {
  const context = useContext(SaAuthContext);
  if (!context) {
    throw new Error('useSaAuth must be used within SaAuthProvider');
  }
  return context;
}
