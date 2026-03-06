import React, { createContext, useMemo, useState } from 'react';

import { clearAuthToken, setAuthToken } from '../services/api';

export const AppContext = createContext({
  lastResult: null,
  setLastResult: () => {},
  authToken: '',
  user: null,
  activeSleepSessionId: '',
  signIn: () => {},
  signOut: () => {},
  setActiveSleepSessionId: () => {},
});

export function AppProvider({ children }) {
  const [lastResult, setLastResult] = useState(null);
  const [authTokenState, setAuthTokenState] = useState('');
  const [user, setUser] = useState(null);
  const [activeSleepSessionId, setActiveSleepSessionId] = useState('');

  const signIn = (token, userPayload) => {
    setAuthToken(token);
    setAuthTokenState(token);
    setUser(userPayload);
  };

  const signOut = () => {
    clearAuthToken();
    setAuthTokenState('');
    setUser(null);
    setActiveSleepSessionId('');
  };

  const value = useMemo(
    () => ({
      lastResult,
      setLastResult,
      authToken: authTokenState,
      user,
      activeSleepSessionId,
      signIn,
      signOut,
      setActiveSleepSessionId,
    }),
    [lastResult, authTokenState, user, activeSleepSessionId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
