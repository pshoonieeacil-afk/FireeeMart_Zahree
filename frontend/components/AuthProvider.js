'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { can as canDo } from '@/lib/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (e.status === 401 || e.status === 403) {
          // Cookie ada tapi tidak valid/kedaluwarsa -> bersihkan lalu ke halaman login
          api('/auth/logout', { method: 'POST' }).finally(() => window.location.replace('/login'));
        } else {
          setError(e.message);
        }
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.replace('/login');
  }, []);

  const value = useMemo(
    () => ({ user, error, retry: load, logout, can: (perm) => canDo(user, perm) }),
    [user, error, load, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
