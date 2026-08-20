import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  clearStoredSession,
  getProfile,
  getStoredSession,
  refreshSession,
  saveStoredSession,
  setAuthToken,
  subscribeTokenRefresh,
} from "../services/api";

const DEFAULT_SESSION_SECONDS = 60 * 60 * 24 * 7;
const PROACTIVE_REFRESH_BEFORE_MS = 2 * 60 * 1000;

export const AppContext = createContext({
  lastResult: null,
  setLastResult: () => {},
  authLoading: true,
  isAuthenticated: false,
  authToken: "",
  user: null,
  activeSleepSessionId: "",
  signIn: async () => {},
  signOut: () => {},
  setActiveSleepSessionId: () => {},
});

export function AppProvider({ children }) {
  const [lastResult, setLastResult] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTokenState, setAuthTokenState] = useState("");
  const [user, setUser] = useState(null);
  const [activeSleepSessionId, setActiveSleepSessionId] = useState("");
  const refreshTimer = useRef(null);

  const signOut = useCallback(async () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    setAuthToken("");
    setAuthTokenState("");
    setUser(null);
    setActiveSleepSessionId("");
    await clearStoredSession();
  }, []);

  const scheduleProactiveRefresh = useCallback(
    (expiresInSeconds) => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      const delayMs = Math.max(
        Number(expiresInSeconds) * 1000 - PROACTIVE_REFRESH_BEFORE_MS,
        1000,
      );
      refreshTimer.current = setTimeout(async () => {
        try {
          const result = await refreshSession();
          if (result?.token) {
            setAuthTokenState(result.token);
            if (result.user) {
              setUser(result.user);
            }
            scheduleProactiveRefresh(result.expiresIn);
          }
        } catch {
          signOut();
        }
      }, delayMs);
    },
    [refreshSession, signOut],
  );

  useEffect(() => {
    const unsubscribe = subscribeTokenRefresh((token) => {
      if (!token) {
        if (refreshTimer.current) {
          clearTimeout(refreshTimer.current);
          refreshTimer.current = null;
        }
        setAuthTokenState("");
        setUser(null);
        return;
      }

      getStoredSession().then((stored) => {
        if (stored.user) {
          setUser(stored.user);
        }
        const remainingMs = Math.max(stored.expiresAt - Date.now(), 0);
        scheduleProactiveRefresh(remainingMs / 1000);
      });
    });

    return unsubscribe;
  }, [scheduleProactiveRefresh]);

  const signIn = useCallback(
    async (token, userPayload, expiresInSeconds = DEFAULT_SESSION_SECONDS) => {
      const safeSeconds = Number.isFinite(Number(expiresInSeconds))
        ? Math.max(Number(expiresInSeconds), 1)
        : DEFAULT_SESSION_SECONDS;
      const expiresAt = Date.now() + safeSeconds * 1000;

      setAuthToken(token);
      setAuthTokenState(token);
      setUser(userPayload || null);

      await saveStoredSession({ token, user: userPayload || null, expiresAt });
      scheduleProactiveRefresh(safeSeconds);
    },
    [scheduleProactiveRefresh],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        const stored = await getStoredSession();

        if (
          !stored.token ||
          !stored.expiresAt ||
          stored.expiresAt <= Date.now()
        ) {
          await clearStoredSession();
          return;
        }

        setAuthToken(stored.token);
        if (isMounted) {
          setAuthTokenState(stored.token);
        }

        if (stored.user && isMounted) {
          setUser(stored.user);
        }

        const profile = await getProfile();
        if (!isMounted) {
          return;
        }

        setUser(profile);
        const expiresAt =
          stored.expiresAt > Date.now() ? stored.expiresAt : Date.now() + 1000;
        await saveStoredSession({
          token: stored.token,
          user: profile,
          expiresAt,
        });

        const remainingMs = Math.max(expiresAt - Date.now(), 0);
        scheduleProactiveRefresh(remainingMs / 1000);
      } catch {
        if (isMounted) {
          setAuthToken("");
          setAuthTokenState("");
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
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    [
      lastResult,
      authLoading,
      isAuthenticated,
      authTokenState,
      user,
      activeSleepSessionId,
      signIn,
      signOut,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
