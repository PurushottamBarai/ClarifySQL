/* eslint-disable no-empty */
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.getMe();
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const logout = async () => {
    try {
      await api.logout();
    } catch {} finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
