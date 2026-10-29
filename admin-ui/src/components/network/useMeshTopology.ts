import { useEffect, useRef, useState } from 'react';
import type { TopologyResponse } from './types';

interface State {
  topology: TopologyResponse | null;
  loading: boolean;
  error: string | null;
}

/** REST-polling hook for GET /network/mesh/topology.
 *
 *  Spec §15/§16 says WebSocket/SSE preferred, polling acceptable. We
 *  default to polling every 15 s so refresh stays steady without
 *  burning server cycles; operators can override via refreshMs. */
export function useMeshTopology(refreshMs = 15000): State & { reload(): Promise<void> } {
  const [state, setState] = useState<State>({ topology: null, loading: true, error: null });
  const mounted = useRef(true);

  async function reload(): Promise<void> {
    try {
      const r = await fetch('/edge-api/v1/network/mesh/topology', {
        credentials: 'include',
      });
      if (!r.ok) {
        if (mounted.current) {
          setState((s) => ({ ...s, loading: false, error: `HTTP ${r.status}` }));
        }
        return;
      }
      const body = (await r.json()) as TopologyResponse;
      if (mounted.current) {
        setState({ topology: body, loading: false, error: null });
      }
    } catch (ex) {
      if (mounted.current) {
        setState((s) => ({ ...s, loading: false, error: String(ex) }));
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    reload().catch(() => undefined);
    const t = setInterval(() => { reload().catch(() => undefined); }, refreshMs);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs]);

  return { ...state, reload };
}
