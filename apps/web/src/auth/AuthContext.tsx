import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, bindAuthTokenHandlers, type AuthUser } from '../lib/api';
import {
  hasPermission,
  isStaffRole,
  isSuperAdminRole,
  permissionsFor,
  type Permission,
} from '../lib/permissions';

const REFRESH_KEY = 'solar.admin.refresh';

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  can: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

function readRefresh(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(token: string | null) {
  try {
    if (!token) sessionStorage.removeItem(REFRESH_KEY);
    else sessionStorage.setItem(REFRESH_KEY, token);
  } catch {
    /* private mode */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(readRefresh());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback(() => {
    accessRef.current = null;
    refreshRef.current = null;
    writeRefresh(null);
    setUser(null);
  }, []);

  const applySession = useCallback((accessToken: string, refreshToken: string, nextUser: AuthUser) => {
    accessRef.current = accessToken;
    refreshRef.current = refreshToken;
    writeRefresh(refreshToken);
    setUser({
      ...nextUser,
      permissions: nextUser.permissions ?? permissionsFor(nextUser.role),
    });
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const token = refreshRef.current;
    if (!token) {
      clearSession();
      return null;
    }
    refreshInFlight.current = api
      .refresh(token)
      .then((data) => {
        if (!isStaffRole(data.user.role) || data.user.active === false) {
          clearSession();
          return null;
        }
        applySession(data.accessToken, data.refreshToken, data.user);
        return data.accessToken;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshInFlight.current = null;
      });
    return refreshInFlight.current;
  }, [applySession, clearSession]);

  useEffect(() => {
    bindAuthTokenHandlers(
      () => accessRef.current,
      () => doRefresh(),
    );
  }, [doRefresh]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!refreshRef.current) {
        if (alive) setReady(true);
        return;
      }
      await doRefresh();
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [doRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.login(email.trim().toLowerCase(), password);
      if (!isStaffRole(data.user.role) || data.user.active === false) {
        await api.logout(data.refreshToken);
        throw new Error('Accès réservé au personnel administrateur');
      }
      applySession(data.accessToken, data.refreshToken, data.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const refresh = refreshRef.current;
    if (refresh) await api.logout(refresh);
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login,
      logout,
      isAdmin: !!user && isStaffRole(user.role),
      isSuperAdmin: !!user && isSuperAdminRole(user.role),
      can: (permission: Permission) => hasPermission(user?.role, permission),
    }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
