import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as edgeApi from '../api/edgeApi';
import type { OrgUnitBinding } from '../api/edgeApi';
import { useAuth } from '../auth/AuthContext';

/**
 * ADR-0015 — device-client orgUnit binding.
 *
 * The DER server scopes each edge to a single bound organisation unit
 * (plus its descendants via `orgUnitPath`). The device client reads
 * this once after sign-in and makes it the default (and only
 * allowable) orgUnit for every capture flow. Operators do not get a
 * free-text orgUnit input — the bound OU is enforced at the server
 * side anyway, so the UI matches that constraint rather than letting
 * the operator produce certain-to-fail payloads.
 */

type State =
  | { status: 'LOADING' }
  | { status: 'READY'; binding: OrgUnitBinding }
  | { status: 'ERROR'; message: string };

export interface OrgUnitBindingContextValue {
  readonly state: State;
  readonly reload: () => Promise<void>;
}

const Ctx = createContext<OrgUnitBindingContextValue | null>(null);

export interface OrgUnitBindingProviderProps {
  readonly children: ReactNode;
  readonly api?: Pick<typeof edgeApi, 'getOrgUnitBinding'>;
  /** Test-only — seeds the provider with an already-resolved binding
   *  so screens can be rendered without round-tripping through
   *  AuthProvider + the binding fetch. Production code never passes
   *  this; its presence skips the auth-gated load entirely. */
  readonly initialBinding?: OrgUnitBinding;
}

export function OrgUnitBindingProvider(
  { children, api = edgeApi, initialBinding }: OrgUnitBindingProviderProps,
): JSX.Element {
  const [state, setState] = useState<State>(initialBinding
    ? { status: 'READY', binding: initialBinding }
    : { status: 'LOADING' });
  const auth = useAuth();

  const load = useCallback(async () => {
    try {
      const binding = await api.getOrgUnitBinding();
      setState({ status: 'READY', binding });
    } catch (err) {
      setState({ status: 'ERROR',
        message: err instanceof Error ? err.message : String(err) });
    }
  }, [api]);

  /** Refetch the binding every time the auth status flips to
   *  AUTHENTICATED. Fixes the first-login edge case where the
   *  provider mounted before sign-in, hit /me with no session,
   *  stored ERROR state, and never retried — operators used to
   *  see "Not bound to an OU" until they refreshed the page.
   *  We also guard against re-fetching during a single
   *  authenticated session via the ref so a re-render of the
   *  auth state doesn't trigger an extra network call. */
  const lastSessionRef = useRef<string | null>(null);
  useEffect(() => {
    // When the test harness seeded a binding, skip the auth-gated
    // load — the state is already READY and reflects what the test
    // wants to render.
    if (initialBinding) return;
    if (auth.state.status !== 'AUTHENTICATED') {
      // Clear the guard so a sign-out → sign-in cycle refetches.
      lastSessionRef.current = null;
      // While unauthenticated, hold LOADING so the capture + other
      // apps don't flash their "not bound" fallback.
      setState({ status: 'LOADING' });
      return;
    }
    const sessionKey = auth.state.user.username ?? 'anon';
    if (lastSessionRef.current === sessionKey) return;
    lastSessionRef.current = sessionKey;
    void load();
  }, [auth.state, load, initialBinding]);

  return (
    <Ctx.Provider value={{ state, reload: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrgUnitBinding(): OrgUnitBindingContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useOrgUnitBinding must be called inside <OrgUnitBindingProvider>');
  }
  return v;
}
