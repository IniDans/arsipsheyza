import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { call, onSessionExpired } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [info, setInfo] = useState({ app_name: 'ARSIPKU', company_name: '', version: '' });
  const [ready, setReady] = useState(false);

  const refreshInfo = useCallback(async () => {
    try {
      setInfo(await call('app:info'));
    } catch {
      // abaikan: info hanya untuk tampilan
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshInfo();
      try {
        setUser(await call('auth:me'));
      } finally {
        setReady(true);
      }
    })();
  }, [refreshInfo]);

  useEffect(() => onSessionExpired(() => setUser(null)), []);

  const login = useCallback(async (username, password) => {
    const u = await call('auth:login', { username, password });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await call('auth:logout');
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => setUser(await call('auth:me')), []);

  const value = useMemo(
    () => ({ user, info, ready, login, logout, refreshUser, refreshInfo, setUser, isAdmin: user?.role === 'admin' }),
    [user, info, ready, login, logout, refreshUser, refreshInfo]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
