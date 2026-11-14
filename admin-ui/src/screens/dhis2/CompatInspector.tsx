import { useEffect, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, SyncStatusBar } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

export function CompatInspector(): JSX.Element {
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function reload(): Promise<void> {
    try { setC(await edgeApi.compat()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function refresh(): Promise<void> {
    setRefreshing(true);
    try { setC(await edgeApi.refreshCompat()); } finally { setRefreshing(false); }
  }
  if (err) return <ErrorBlock title="Compat probe failed" testId="err-compat">{err}</ErrorBlock>;
  if (!c) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={c.probeReachable ? 'success' : 'danger'}
        title="Compatibility"
        statusLabel={c.probeReachable ? 'Reachable' : 'Unreachable'}
        subtitle={
          <>
            <span>Profile <strong>{c.profileName ?? '—'}</strong></span>
            <span>·</span>
            <span>Central <strong>{c.centralVersion ?? '—'}</strong></span>
            <span>·</span>
            <span>Engine <strong>{c.engineVersion ?? '—'}</strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={refreshing}
                  onClick={() => { refresh().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh profile'}</span>
          </button>
        }
      />
      <Panel title="Snapshot">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Snapshot ID</dt><dd className="ea-mono">{c.snapshotId ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Captured at</dt><dd className="ea-mono">{c.capturedAt ? fmtDate(c.capturedAt) : '—'}</dd></div>
          <div className="ea-def-row"><dt>Probe duration</dt><dd>{c.probeDurationMs ? `${c.probeDurationMs} ms` : '—'}</dd></div>
          <div className="ea-def-row"><dt>Message</dt><dd>{c.message ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Status</dt><dd>{c.status}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

