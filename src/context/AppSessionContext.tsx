import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../types';
import {
  getLatestSession,
  login as loginRequest,
  logout as logoutRequest,
  refreshAuth,
  setAuthRefreshHandler,
  signup as signupRequest,
} from '../api/client';

type AppSessionContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  latestSessionId: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshLatestSession: () => Promise<string | null>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export const AppSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await refreshAuth();
      setAccessToken(response.access_token);
      setUser(response.user);
      return response.access_token;
    } catch {
      setAccessToken(null);
      setUser(null);
      setLatestSessionId(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setAuthRefreshHandler(refreshAccessToken);
    return () => setAuthRefreshHandler(null);
  }, [refreshAccessToken]);

  const loadLatest = useCallback(async (token: string): Promise<string | null> => {
    try {
      const latest = await getLatestSession(token);
      setLatestSessionId(latest.session_id || null);
      return latest.session_id || null;
    } catch {
      setLatestSessionId(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const response = await refreshAuth();
        if (!mounted) return;
        setAccessToken(response.access_token);
        setUser(response.user);
        await loadLatest(response.access_token);
      } catch {
        if (mounted) {
          setAccessToken(null);
          setUser(null);
          setLatestSessionId(null);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadLatest]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setAccessToken(response.access_token);
    setUser(response.user);
    await loadLatest(response.access_token);
  }, [loadLatest]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const response = await signupRequest(name, email, password);
    setAccessToken(response.access_token);
    setUser(response.user);
    await loadLatest(response.access_token);
  }, [loadLatest]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAccessToken(null);
      setUser(null);
      setLatestSessionId(null);
    }
  }, []);

  const refreshLatestSession = useCallback(async () => {
    if (!accessToken) return null;
    return loadLatest(accessToken);
  }, [accessToken, loadLatest]);

  const value = useMemo<AppSessionContextValue>(() => ({
    accessToken,
    user,
    latestSessionId,
    initializing,
    login,
    signup,
    logout,
    refreshLatestSession,
  }), [accessToken, user, latestSessionId, initializing, login, signup, logout, refreshLatestSession]);

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
};

export const useAppSession = () => {
  const context = useContext(AppSessionContext);
  if (!context) throw new Error('useAppSession must be used inside AppSessionProvider.');
  return context;
};
