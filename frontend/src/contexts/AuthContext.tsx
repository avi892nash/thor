import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  PublicUser,
  fetchMe,
  getToken,
  login as svcLogin,
  logout as svcLogout,
} from '../services/authService';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      svcLogout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
    const onChange = () => {
      if (!getToken()) setUser(null);
    };
    window.addEventListener('thor:auth-change', onChange);
    return () => window.removeEventListener('thor:auth-change', onChange);
  }, [hydrate]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await svcLogin(username, password);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    svcLogout();
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      svcLogout();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
