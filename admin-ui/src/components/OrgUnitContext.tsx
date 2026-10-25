import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as edgeApi from '../api/edgeApi';
import { useAuth } from '../auth/AuthContext';

/**
 * App-wide OU binding context. Any component in the shell can call
 * {@link useOrgUnit} to read the current binding + re-fetch it after
 * a bind/rebind on the Organisation unit page.
 *
 * One source of truth so the topbar OU chip, every mockup page that
 * uses the OU breadcrumb, and the Workspace hero all stay in sync.
 */
interface OrgUnitState {
  readonly binding: edgeApi.OrgUnitBinding | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

const OrgUnitCtx = createContext<OrgUnitState | null>(null);

export function OrgUnitProvider({ children }: { children: ReactNode }): JSX.Element {
  const { state } = useAuth();
  const authed = state.status === 'AUTHENTICATED';
  const [binding, setBinding] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setBinding(await edgeApi.getOrgUnitBinding());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch once the user is authenticated — avoids the 401 on
  // first paint and ensures the chip populates right after sign-in.
  useEffect(() => {
    if (authed) {
      refresh().catch(() => undefined);
    } else {
      setBinding(null);
    }
  }, [authed, refresh]);

  const value = useMemo<OrgUnitState>(
    () => ({ binding, loading, error, refresh }),
    [binding, loading, error, refresh],
  );
  return <OrgUnitCtx.Provider value={value}>{children}</OrgUnitCtx.Provider>;
}

export function useOrgUnit(): OrgUnitState {
  const v = useContext(OrgUnitCtx);
  if (!v) {
    // Fallback for routes rendered outside the provider — e.g. tests.
    return { binding: null, loading: false, error: null, refresh: async () => undefined };
  }
  return v;
}
