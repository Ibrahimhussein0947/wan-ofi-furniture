import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const queryClient = useQueryClient();

  const applySession = useCallback(async (session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    if (session.user.role === 'CUSTOMER') {
      const me = await authApi.me().catch(() => null);
      setCustomer(me?.customer || null);
    }
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setCustomer(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    refreshSession()
      .then(applySession)
      .catch(() => setStatus('anonymous'));
  }, [applySession, clearSession]);

  const login = useCallback(async (credentials) => {
    const session = await authApi.login(credentials);
    await applySession(session);
    return session.user;
  }, [applySession]);

  const register = useCallback(async (body) => {
    const session = await authApi.register(body);
    await applySession(session);
    return session.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    const me = await authApi.me();
    setUser(me.user);
    setCustomer(me.customer || null);
  }, []);

  const value = useMemo(() => {
    const perms = user?.effectivePermissions || [];
    return {
      user,
      customer,
      status,
      isAuthenticated: status === 'authenticated',
      isStaff: Boolean(user && user.role !== 'CUSTOMER'),
      can: (permission) => perms.includes('*') || perms.includes(permission),
      canAny: (...permissions) => perms.includes('*') || permissions.some((p) => perms.includes(p)),
      login,
      register,
      logout,
      applySession,
      refreshProfile,
      setUser,
    };
  }, [user, customer, status, login, register, logout, applySession, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const homePathFor = (user) => (user?.role === 'CUSTOMER' ? '/account' : '/app');
