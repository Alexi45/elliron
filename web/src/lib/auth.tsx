import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { User } from './types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ needsTwoFactor: true; challenge: string } | null>;
  finishTwoFactor: (challenge: string, code: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* Al abrir la web intentamos recuperar la sesión con la cookie de refresco */
  useEffect(() => {
    let alive = true;
    tokenStore.onLost(() => setUser(null));

    (async () => {
      const ok = await api.auth.refresh();
      if (!alive) return;
      if (ok) {
        try {
          const { user: me } = await api.auth.me();
          if (alive) setUser(me);
        } catch {
          if (alive) setUser(null);
        }
      }
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.auth.login({ email, password });
    if ('needsTwoFactor' in data) return data; // falta el código del móvil
    tokenStore.set(data.accessToken);
    setUser(data.user);
    return null;
  }, []);

  const finishTwoFactor = useCallback(async (challenge: string, code: string) => {
    const data = await api.auth.loginTwoFactor({ challenge, code });
    tokenStore.set(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: { name: string; email: string; password: string; phone?: string }) => {
    const data = await api.auth.register(payload);
    tokenStore.set(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      tokenStore.set(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await api.auth.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isStaff: user?.role === 'staff' || user?.role === 'admin',
      isAdmin: user?.role === 'admin',
      login,
      finishTwoFactor,
      register,
      logout,
      refreshUser,
      setUser
    }),
    [user, loading, login, finishTwoFactor, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth se usa dentro de <AuthProvider>');
  return ctx;
}

/** Misma cuenta de fuerza que hace el servidor, para el medidor del formulario */
export function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) score++;
  return Math.min(4, score);
}

export const SCORE_LABEL = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
