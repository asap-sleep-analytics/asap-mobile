import type { Context, Dispatch, ReactNode, SetStateAction } from 'react';
import type { UserProfile } from '../services/api';

export interface AppContextValue {
  lastResult: unknown;
  setLastResult: Dispatch<SetStateAction<unknown>>;
  authLoading: boolean;
  isAuthenticated: boolean;
  authToken: string;
  user: UserProfile | null;
  activeSleepSessionId: string;
  signIn: (token: string, userPayload: UserProfile, expiresInSeconds?: number) => Promise<void>;
  signOut: () => void;
  setActiveSleepSessionId: (id: string) => void;
}

export declare const AppContext: Context<AppContextValue>;

export declare function AppProvider(props: { children: ReactNode }): React.ReactNode;