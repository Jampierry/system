import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Permission } from '@cerebro/shared';
import { ApiError, createApi } from '../api/client';
import { tokenStorage } from './storage';

export type User = {
  id: string; email: string; name: string;
  profile: { id: string; name: string };
  permissions: Permission[];
  mustChangePassword: boolean;
};

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '' : 'http://localhost:8787');
let currentToken: string | null = null;
let onExpired: () => void = () => {};

export const api = createApi({ baseUrl, getToken: () => currentToken, onUnauthorized: () => onExpired() });

/** Baixa um recurso binário autenticado (ex.: exportação em zip). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(baseUrl + path, { headers: currentToken ? { authorization: `Bearer ${currentToken}` } : {} });
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { /* sem corpo */ }
    throw new ApiError(res.status, body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? 'Falha no download');
  }
  return res.blob();
}

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSessionToken: (token: string) => Promise<void>;
  can: (p: Permission) => boolean;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(async () => {
    currentToken = null;
    setUser(null);
    await tokenStorage.clear();
  }, []);
  onExpired = () => { void clear(); };

  const refresh = useCallback(async () => {
    try {
      setUser((await api<{ user: User }>('/api/auth/me')).user);
    } catch {
      /* 401 já limpa a sessão */
    }
  }, []);

  useEffect(() => {
    (async () => {
      currentToken = await tokenStorage.get();
      if (currentToken) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const setSessionToken = useCallback(async (token: string) => {
    currentToken = token;
    await tokenStorage.set(token);
    await refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: { email, password } });
    currentToken = r.token;
    await tokenStorage.set(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* sessão já inválida */ }
    await clear();
  }, [clear]);

  const value = useMemo<Ctx>(() => ({
    user, loading, login, logout, refresh, setSessionToken,
    can: (p: Permission) => !!user?.permissions.includes(p),
  }), [user, loading, login, logout, refresh, setSessionToken]);

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession fora do SessionProvider');
  return c;
}
