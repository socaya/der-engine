import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import type { SignInResponse } from '../api/edgeApi';

/**
 * DER session context. The DER_SESSION cookie is HTTP-only, so the client
 * cannot read it directly — this context tracks whether the server-side
 * session is live by probing GET /edge-api/v1/auth/session.
 *
 * States:
 *   { status: 'INITIAL' }       — have not probed yet (very brief).
 *   { status: 'ANONYMOUS' }     — probed, no session.
 *   { status: 'AUTHENTICATED' } — probed, SignInResponse available.
 *   { status: 'EDGE_DOWN' }     — probe failed with EDGE_UNREACHABLE.
 */

export type AuthState =
  | { status: 'INITIAL' }
  | { status: 'ANONYMOUS' }
  | { status: 'AUTHENTICATED'; user: SignInResponse }
  | { status: 'EDGE_DOWN' };

interface AuthContextValue {
  state: AuthState;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: ReactNode;
  /** Only for tests — allows injecting a fake set of edgeApi fns. */
  readonly api?: Pick<typeof edgeApi, 'session' | 'signIn' | 'signOut'>;
}

export function AuthProvider({ children, api = edgeApi }: AuthProviderProps): JSX.Element {
  const [state, setState] = useState<AuthState>({ status: 'INITIAL' });

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const user = await api.session();
      setState({ status: 'AUTHENTICATED', user });
    } catch (err) {
      if (err instanceof edgeApi.EdgeApiError && err.code === 'EDGE_UNREACHABLE') {
        setState({ status: 'EDGE_DOWN' });
        return;
      }
      setState({ status: 'ANONYMOUS' });
    }
  }, [api]);

  const doSignIn = useCallback(
    async (username: string, password: string): Promise<void> => {
      const user = await api.signIn(username, password);
      setState({ status: 'AUTHENTICATED', user });
    },
    [api],
  );

  const doSignOut = useCallback(async (): Promise<void> => {
    try {
      await api.signOut();
    } finally {
      setState({ status: 'ANONYMOUS' });
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn: doSignIn, signOut: doSignOut, refresh }),
    [state, doSignIn, doSignOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be called inside <AuthProvider>');
  }
  return ctx;
}
