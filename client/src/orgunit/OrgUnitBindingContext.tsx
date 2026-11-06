import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as edgeApi from '../api/edgeApi';
import type { OrgUnitBinding } from '../api/edgeApi';

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
}

export function OrgUnitBindingProvider(
  { children, api = edgeApi }: OrgUnitBindingProviderProps,
): JSX.Element {
  const [state, setState] = useState<State>({ status: 'LOADING' });

  const load = useCallback(async () => {
    try {
      const binding = await api.getOrgUnitBinding();
      setState({ status: 'READY', binding });
    } catch (err) {
      setState({ status: 'ERROR',
        message: err instanceof Error ? err.message : String(err) });
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

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
