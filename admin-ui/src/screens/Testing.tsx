import { useEffect, useState } from 'react';
import { Panel, SyncStatusBar, Status, fmtAgo } from './shared';
import { UiIcon } from '../components/UiIcon';

interface RunRow {
  runId: string;
  kind: 'CHAOS' | 'LOAD' | 'SOAK' | 'GOLDEN';
  scenario: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: 'RUNNING' | 'PASS' | 'FAIL' | 'ABORTED';
  durationMs: number | null;
  requestsTotal: number | null;
  requestsFailed: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  throughputRps: number | null;
  triggeredBy: string | null;
}

interface Summary {
  totalRuns: number;
  last24hRuns: number;
  last24hPass: number;
  last24hFail: number;
}

interface IndexResponse { summary: Summary; runs: RunRow[]; }

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: 'include' });
  const t = await r.text();
  return (t ? JSON.parse(t) : undefined) as T;
}

async function post(path: string): Promise<void> {
  await fetch(path, { method: 'POST', credentials: 'include' });
}

export function Testing(): JSX.Element {
  const [data, setData] = useState<IndexResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try { setData(await fetchJson<IndexResponse>('/edge-api/v1/testing')); }
    catch { /* ignore */ }
  }
  useEffect(() => {
    reload().catch(() => undefined);
    const t = setInterval(() => reload().catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, []);

  async function trigger(kind: string, path: string): Promise<void> {
    setBusy(kind);
    try { await post(path); await reload(); } finally { setBusy(null); }
  }

  const s = data?.summary;
  const runs = data?.runs ?? [];
  const tone =
    s && s.last24hFail > 0 ? 'warning'
    : s && s.last24hPass > 0 ? 'success'
    : 'muted';

  return (
    <div className="ea-screen" data-test="testing">
      <SyncStatusBar
        tone={tone}
        title="Testing"
        statusLabel={
          s
            ? `${s.last24hPass}/${s.last24hRuns} PASS 24 h · ${s.totalRuns} total`
            : 'loading'
        }
        subtitle={
          <span>
            Operator-triggered chaos / load / soak / golden-deploy runs.
            Durable history in <code>der.testing_run</code>.
          </span>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  aria-label="Refresh testing history"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} /><span>Refresh</span>
          </button>
        }
      />

      <Panel title="Run a test">
        <div style={{ display: 'flex', gap: 8, padding: 10, flexWrap: 'wrap' }}>
          <button type="button" className="ea-btn ea-btn--sm" disabled={busy !== null}
                  data-test="btn-load"
                  onClick={() => { void trigger('LOAD',
                    '/edge-api/v1/testing/load?concurrency=8&durationSec=3'); }}>
            {busy === 'LOAD' ? 'Running…' : 'Load (8c · 3s)'}
          </button>
          <button type="button" className="ea-btn ea-btn--sm" disabled={busy !== null}
                  data-test="btn-chaos"
                  onClick={() => { void trigger('CHAOS',
                    '/edge-api/v1/testing/chaos?scenario=pool-saturation'); }}>
            {busy === 'CHAOS' ? 'Running…' : 'Chaos (pool-saturation)'}
          </button>
          <button type="button" className="ea-btn ea-btn--sm" disabled={busy !== null}
                  data-test="btn-soak"
                  onClick={() => { void trigger('SOAK',
                    '/edge-api/v1/testing/soak?concurrency=2&durationSec=5'); }}>
            {busy === 'SOAK' ? 'Running…' : 'Soak (2c · 5s)'}
          </button>
          <span className="ea-text-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
            Destructive scenarios (pg-restart, network-flap, golden-deploy) run via
            <code> scripts/evaluation/{'{chaos,golden_deploy}.sh'}</code>.
          </span>
        </div>
      </Panel>

      <Panel title={`Recent runs · ${runs.length}`}>
        {runs.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No testing runs yet. Click a button above to trigger one, or run
            <code> scripts/evaluation/golden_deploy.sh</code>.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" aria-label="Testing runs">
              <thead><tr>
                <th scope="col">Started</th>
                <th scope="col">Kind</th>
                <th scope="col">Scenario</th>
                <th scope="col">Outcome</th>
                <th scope="col">Duration</th>
                <th scope="col">Req total</th>
                <th scope="col">Req failed</th>
                <th scope="col">p50</th>
                <th scope="col">p95</th>
                <th scope="col">p99</th>
                <th scope="col">rps</th>
                <th scope="col">By</th>
              </tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.runId}>
                    <td className="ea-text-muted">{fmtAgo(r.startedAt)}</td>
                    <td className="ea-mono">{r.kind}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{r.scenario}</td>
                    <td>
                      <Status tone={r.outcome === 'PASS' ? 'success'
                                     : r.outcome === 'FAIL' ? 'danger'
                                     : r.outcome === 'RUNNING' ? 'warning' : 'muted'}>
                        {r.outcome}
                      </Status>
                    </td>
                    <td className="ea-mono">{r.durationMs != null ? r.durationMs + ' ms' : '—'}</td>
                    <td className="ea-mono">{r.requestsTotal ?? '—'}</td>
                    <td className="ea-mono">{r.requestsFailed ?? '—'}</td>
                    <td className="ea-mono">{r.latencyP50Ms ?? '—'}</td>
                    <td className="ea-mono">{r.latencyP95Ms ?? '—'}</td>
                    <td className="ea-mono">{r.latencyP99Ms ?? '—'}</td>
                    <td className="ea-mono">{r.throughputRps != null ? r.throughputRps.toFixed(1) : '—'}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{r.triggeredBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
