import { useEffect, useRef } from 'react';
import { useAlert } from './AlertStack';
import * as edgeApi from '../api/edgeApi';

/**
 * C3: polls /edge-api/v1/sync/jobs every 10 s; when a job that was
 * running on the last tick now has a terminal outcome (SUCCESS /
 * FAILED), fires a toast via useAlert().
 *
 * This is a lightweight alternative to SSE — one GET per 10 s is
 * cheap, works offline-first, and avoids keeping a stream open.
 * SSE can land in alpha.6 if the pattern turns out to be too chatty.
 */
export function ActiveJobsWatcher(): JSX.Element {
  const alert = useAlert();
  const seen = useRef<Map<string, edgeApi.JobRun['outcome']>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function tick(): Promise<void> {
      try {
        const rows = await edgeApi.listJobs(20);
        if (cancelled) return;
        const latest = new Map<string, edgeApi.JobRun>();
        for (const r of rows) {
          const prev = latest.get(r.jobName);
          if (!prev || r.startedAt > prev.startedAt) {
            latest.set(r.jobName, r);
          }
        }
        latest.forEach((r, name) => {
          const prev = seen.current.get(name);
          if (prev !== r.outcome && r.outcome !== 'RUNNING') {
            // seed on first tick without raising — only alert on transitions
            if (prev !== undefined) {
              alert.show({
                kind: r.outcome === 'SUCCESS' ? 'success' : 'critical',
                title: `${name} ${r.outcome.toLowerCase()}`,
                message: r.durationMs
                  ? `Finished in ${Math.round(r.durationMs / 1000)}s`
                  : 'Job finished.',
              });
            }
          }
          seen.current.set(name, r.outcome);
        });
      } catch {
        // silently swallow — a flaky probe shouldn't spam toasts
      }
    }

    void tick();
    const h = setInterval(() => void tick(), 10_000);
    return () => { cancelled = true; clearInterval(h); };
  }, [alert]);

  return <></>;
}
