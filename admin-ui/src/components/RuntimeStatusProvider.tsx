import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as edgeApi from '../api/edgeApi';
import { useAuth } from '../auth/AuthContext';

/**
 * Shared DER runtime-status provider.
 *
 * Before this landed, `useRuntimeMode` was called twice in AdminShell
 * (sidebar footer + top-bar operating-mode pill). Each call mounted
 * its own setInterval, so the admin shell was polling
 * /edge-api/v1/system/health and /edge-api/v1/dhis2/ping twice every
 * 15 s on every authenticated page. This provider collapses the two
 * consumers onto a single polling loop and a single piece of state —
 * the sidebar footer and the top-bar pill now read the same cache.
 *
 * Polling is gated on auth: unauthenticated users (including the
 * sign-in screen) do not fetch, so we do not leak /system/health
 * requests from anon sessions.
 */

export type RuntimeMode =
  | 'operational'
  | 'degraded'
  | 'offline-first'
  | 'recovering'
  | 'starting'
  | 'unknown';

export interface RuntimeStatus {
  readonly mode: RuntimeMode;
  readonly label: string;
  readonly sub: string;
  readonly detail: string;
  readonly health: edgeApi.HealthResponse | null;
  readonly ping: edgeApi.PingSnapshot | null;
  readonly lastCheckedAt: Date | null;
  readonly probing: boolean;
}

const UNKNOWN: RuntimeStatus = {
  mode: 'unknown',
  label: 'DER Runtime · Checking',
  sub: '',
  detail: 'Checking status…',
  health: null,
  ping: null,
  lastCheckedAt: null,
  probing: true,
};

const Ctx = createContext<RuntimeStatus | null>(null);

function derive(
  h: edgeApi.HealthResponse | null,
  p: edgeApi.PingSnapshot | null,
  probing: boolean,
): { mode: RuntimeMode; label: string; sub: string; detail: string } {
  if (!h) {
    return {
      mode: 'unknown',
      label: 'DER Runtime · Checking',
      sub: '',
      detail: 'Checking status…',
    };
  }
  const derUp = h.status === 'UP' || h.status === 'ready';
  const starting = h.status === 'starter-ready' || h.status === 'starting';
  const centralReachable = p?.reachable === true;
  const centralUnreachable = p != null && p.reachable === false;
  if (!derUp && !starting) {
    return {
      mode: 'degraded',
      label: 'DER Runtime · Degraded',
      sub: h.status ?? 'unavailable',
      detail: 'DER runtime is not operational.',
    };
  }
  if (starting) {
    return {
      mode: 'starting',
      label: 'DER Runtime · Starting',
      sub: '',
      detail: 'DER is initialising.',
    };
  }
  if (centralReachable) {
    return {
      mode: 'operational',
      label: 'DER Connected',
      sub: 'Central reachable',
      detail:
        'DER is connected to Central DHIS2. Local operations are available and eligible changes are being synchronised.',
    };
  }
  if (centralUnreachable) {
    return {
      mode: 'offline-first',
      label: 'DER Offline-First',
      sub: 'Central unavailable',
      detail:
        p?.message ??
        'Central DHIS2 is unavailable. DER remains operational on the local network. Locally accepted changes are being stored safely and queued for synchronisation.',
    };
  }
  if (probing) {
    return {
      mode: 'unknown',
      label: 'DER Runtime · Checking',
      sub: '',
      detail: 'Checking central reachability…',
    };
  }
  return {
    mode: 'operational',
    label: 'DER Connected',
    sub: '',
    detail: 'DER is operational.',
  };
}

interface RuntimeStatusProviderProps {
  readonly children: ReactNode;
  /** When false (e.g. sign-in page), the provider does not poll
   *  /system/health or /dhis2/ping and simply yields the UNKNOWN
   *  snapshot. */
  readonly enabled?: boolean;
  /** Poll interval in ms. Default 15 000. Tests can pass 0 to suppress
   *  the interval and rely on the initial fetch only. */
  readonly intervalMs?: number;
}

export function RuntimeStatusProvider({
  children,
  enabled = true,
  intervalMs = 15_000,
}: RuntimeStatusProviderProps): JSX.Element {
  const { state } = useAuth();
  const authed = state.status === 'AUTHENTICATED';
  const active = enabled && authed;

  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [p, setP] = useState<edgeApi.PingSnapshot | null>(null);
  const [probing, setProbing] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!active) {
      setH(null);
      setP(null);
      setProbing(true);
      setLastCheckedAt(null);
      return () => undefined;
    }
    let cancel = false;
    async function tick(): Promise<void> {
      try {
        const [hr, pr] = await Promise.allSettled([
          edgeApi.health(),
          edgeApi.dhis2Ping(),
        ]);
        if (cancel) return;
        if (hr.status === 'fulfilled') setH(hr.value);
        if (pr.status === 'fulfilled') setP(pr.value);
        setLastCheckedAt(new Date());
        setProbing(false);
      } catch {
        if (!cancel) setProbing(false);
      }
    }
    tick().catch(() => undefined);
    if (intervalMs <= 0) return () => { cancel = true; };
    const id = window.setInterval(() => {
      tick().catch(() => undefined);
    }, intervalMs);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [active, intervalMs]);

  const value: RuntimeStatus = {
    ...derive(h, p, probing),
    health: h,
    ping: p,
    lastCheckedAt,
    probing,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the shared runtime status. Returns a safe UNKNOWN snapshot
 *  when called outside a RuntimeStatusProvider (e.g. tests that
 *  render a leaf component in isolation). */
export function useRuntimeStatus(): RuntimeStatus {
  const v = useContext(Ctx);
  return v ?? UNKNOWN;
}
