'use client';
// Auth context: stores current user, provides role helpers, fetches /auth/me on mount.
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api-client';

export interface CrmUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar_data?: string | null;
  role: string;
  dealer_id: number | null;
  dealer_name?: string | null;
  department: string | null;
  departments?: string[];
  active?: boolean;
  email_verified?: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

interface AuthCtx {
  user: CrmUser | null;
  loading: boolean;
  refresh: () => Promise<CrmUser | null>;
  setUserDirect: (u: CrmUser) => void;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isOperator: () => boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
const CACHED_USER_KEY = 'crm-auth-user';

function readCachedUser(): CrmUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(CACHED_USER_KEY);
    return value ? JSON.parse(value) as CrmUser : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Render a previously validated user immediately, then verify its httpOnly
  // session cookie in the background. This removes the blank startup wait on
  // normal return visits without trusting stale data for authorization.
  const [user, setUser] = useState<CrmUser | null>(() => readCachedUser());
  const [loading, setLoading] = useState(() => !readCachedUser());
  const router = useRouter();

  const refresh = useCallback(async (): Promise<CrmUser | null> => {
    try {
      const data = await api.get<{ user: CrmUser }>('/auth/me');
      setUser(data.user);
      try { window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.user)); } catch {}
      return data.user;
    } catch {
      setUser(null);
      try { window.localStorage.removeItem(CACHED_USER_KEY); } catch {}
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Set user directly (used after verify-otp returns the user object)
  const setUserDirect = useCallback((u: CrmUser) => {
    setUser(u);
    setLoading(false);
    try { window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)); } catch {}
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    // Leave the authenticated UI immediately; audit logging can finish in the background.
    setUser(null);
    try { window.localStorage.removeItem(CACHED_USER_KEY); } catch {}
    router.replace('/');
    void api.post('/auth/logout', {}).catch(() => {});
  }, [router]);

  const value: AuthCtx = {
    user, loading, refresh, setUserDirect,
    isAdmin: () => !!user && ['super_admin', 'admin', 'admin_2'].includes(user.role),
    isSuperAdmin: () => user?.role === 'super_admin',
    isOperator: () => !!user && ['data_operator_1', 'data_operator_2'].includes(user.role),
    logout,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
