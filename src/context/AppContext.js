import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { clearAuthToken, getProfile, setAuthToken } from '../services/api';

const TOKEN_KEY = 'asap.auth.token';
const USER_KEY = 'asap.auth.user';
const EXPIRES_AT_KEY = 'asap.auth.expiresAt';
const DEFAULT_SESSION_SECONDS = 60 * 60 * 24 * 30;

async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
    SecureStore.deleteItemAsync(EXPIRES_AT_KEY),
  ]);
}

export const AppContext = createContext({
  lastResult: null,
  setLastResult: () => {},
  authLoading: true,
  isAuthenticated: false,
  authToken: '',
  user: null,
  activeSleepSessionId: '',
  signIn: async () => {},
  signOut: () => {},
  setActiveSleepSessionId: () => {},
});

export function AppProvider({ children }) {
  const [lastResult, setLastResult] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTokenState, setAuthTokenState] = useState('');
  const [user, setUser] = useState(null);
  const [activeSleepSessionId, setActiveSleepSessionId] = useState('');

  const signIn = useCallback(async (token, userPayload, expiresInSeconds = DEFAULT_SESSION_SECONDS) => {
    const safeSeconds = Number.isFinite(Number(expiresInSeconds))
      ? Math.max(Number(expiresInSeconds), 1)
      : DEFAULT_SESSION_SECONDS;
    const expiresAt = Date.now() + safeSeconds * 1000;

    setAuthToken(token);
    setAuthTokenState(token);
    setUser(userPayload);

    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(userPayload || null)),
      SecureStore.setItemAsync(EXPIRES_AT_KEY, String(expiresAt)),
    ]);
  }, []);

  const signOut = useCallback(async () => {
    clearAuthToken();
    setAuthTokenState('');
    setUser(null);
    setActiveSleepSessionId('');
    await clearStoredSession();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        const [storedToken, storedUser, storedExpiresAt] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
          SecureStore.getItemAsync(EXPIRES_AT_KEY),
        ]);

        if (!storedToken || !storedExpiresAt) {
          await clearStoredSession();
          return;
        }

        const expiresAt = Number(storedExpiresAt);
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          await clearStoredSession();
          return;
        }

        setAuthToken(storedToken);
        if (isMounted) {
          setAuthTokenState(storedToken);
        }

        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            if (isMounted && parsedUser) {
              setUser(parsedUser);
            }
          } catch {
            // Si el JSON de usuario está corrupto, lo reemplazamos con perfil remoto.
          }
        }

        const profile = await getProfile();
        if (!isMounted) {
          return;
        }

        setUser(profile);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profile));
      } catch {
        clearAuthToken();
        if (isMounted) {
          setAuthTokenState('');
          setUser(null);
        }
        await clearStoredSession();
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const isAuthenticated = Boolean(authTokenState && user);

  const value = useMemo(
    () => ({
      lastResult,
      setLastResult,
      authLoading,
      isAuthenticated,
      authToken: authTokenState,
      user,
      activeSleepSessionId,
      signIn,
      signOut,
      setActiveSleepSessionId,
    }),
    [lastResult, authLoading, isAuthenticated, authTokenState, user, activeSleepSessionId, signIn, signOut],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
