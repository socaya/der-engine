/** Client-side preference store for the Internet simulator.
 *
 *  §2.3.74 — the Simulate control moved out of the topology card
 *  into Settings. This tiny pub/sub keeps the dashboard + the
 *  settings page in sync without a React context: EASettings
 *  writes the mode, TopologyCanvas subscribes via
 *  useSyncExternalStore.
 *
 *  Mode semantics:
 *   - 'auto' (default) — simulate iff `wan.centralIsLocal` is true.
 *     DHIS2 Central on loopback / der.local / *.local triggers sim;
 *     real pilot URLs do not.
 *   - 'on'  — always simulate (useful for walkthrough on real
 *     hardware when the uplink is actually healthy).
 *   - 'off' — never simulate; always show the live server probe.
 *
 *  Persisted to localStorage so the preference survives reload. */

export type SimulateMode = 'auto' | 'on' | 'off';

const STORAGE_KEY = 'der.demo.internetSimulate';
const DEFAULT_MODE: SimulateMode = 'auto';

function readStoredMode(): SimulateMode {
  if (typeof window === 'undefined') {
    return DEFAULT_MODE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'auto' || raw === 'on' || raw === 'off') {
      return raw;
    }
  } catch {
    // localStorage disabled (private mode) — fall through.
  }
  return DEFAULT_MODE;
}

let current: SimulateMode = readStoredMode();
const subscribers = new Set<() => void>();

export function getSimulateMode(): SimulateMode {
  return current;
}

export function setSimulateMode(mode: SimulateMode): void {
  if (mode === current) {
    return;
  }
  current = mode;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore — in-memory update is enough for session use.
    }
  }
  subscribers.forEach((cb) => cb());
}

export function subscribeSimulateMode(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

/** Resolve the effective simulate flag given current mode + the WAN
 *  probe signal `centralIsLocal`. Used by TopologyCanvas. */
export function resolveSimulate(mode: SimulateMode,
                                   centralIsLocal: boolean): boolean {
  switch (mode) {
    case 'on':  return true;
    case 'off': return false;
    case 'auto':
    default:    return centralIsLocal;
  }
}
