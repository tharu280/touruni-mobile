import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists the admin JWT across navigation and app reloads. Deliberately NOT
// modeled on AppSessionContext's cookie/refresh-token pattern — /admin/login
// issues a bare 12h JWT with no refresh endpoint to pair with (see
// admin_api.py), so there is nothing to auto-refresh. A 401/403 from
// adminClient.ts (AdminAuthError) means "log in again," full stop.
const ADMIN_TOKEN_KEY = 'admin_token_v1';

type AdminSessionContextValue = {
  adminToken: string | null;
  initializing: boolean;
  setAdminToken: (token: string | null) => Promise<void>;
  logoutAdmin: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(undefined);

export const AdminSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
        setAdminTokenState(stored);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const setAdminToken = useCallback(async (token: string | null) => {
    if (token) await AsyncStorage.setItem(ADMIN_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminTokenState(token);
  }, []);

  const logoutAdmin = useCallback(async () => {
    await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminTokenState(null);
  }, []);

  const value = useMemo(
    () => ({ adminToken, initializing, setAdminToken, logoutAdmin }),
    [adminToken, initializing, setAdminToken, logoutAdmin]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
};

export const useAdminSession = () => {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminSessionProvider.');
  return context;
};
