import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel, fmtDate, fmtAgo, SyncStatusBar } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';

/**
 * MockupCompatMatrix — unified Compatibility surface.
 *
 * Replaces the earlier two-page split (`/compat` + `/compat/history`)
 * with one page covering:
 *   1. Welcome + 4 KPIs (status, central version, profile, probe RTT).
 *   2. Live probe card with refresh action.
 *   3. Supported DHIS2 version matrix — the 4 shipped profiles with
 *      their key compat differences highlighted.
 *   4. Snapshot history table.
 *
 * Serves at /dhis2/compat.
 */
export function MockupCompatMatrix(): JSX.Element {
  const [snap, setSnap] = useState<edgeApi.CompatSnapshot | null>(null);
  const [history, setHistory] = useState<edgeApi.CompatSnapshot[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function reload(): Promise<void> {
    const [a, b] = await Promise.allSettled([
      edgeApi.compat(), edgeApi.compatHistory(50),
    ]);
    if (a.status === 'fulfilled') setSnap(a.value);
    if (b.status === 'fulfilled') setHistory(b.value.snapshots);
    if (a.status === 'rejected') setErr(a.reason instanceof Error ? a.reason.message : String(a.reason));
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try { setSnap(await edgeApi.refreshCompat()); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setRefreshing(false); }
  }

  if (err && !snap) return <ErrorBlock title="Compat probe failed" testId="err-compat">{err}</ErrorBlock>;
  if (!snap || !history) return <LoadingBlock testId="loading" />;

  const activeProfile = snap.profileName;
  const succeeded = history.filter((s) => s.probeReachable).length;
  const reliability = history.length ? Math.round((100 * succeeded) / history.length) : 0;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={snap.probeReachable ? 'success' : 'danger'}
        title="Compatibility"
        statusLabel={snap.probeReachable ? 'Central reachable' : 'Central unreachable'}
        subtitle={
          <>
            <span>Central <strong style={{ color: 'var(--der-ink-900)' }}>{snap.centralVersion ?? '—'}</strong></span>
            <span>·</span>
            <span>Profile <strong style={{ color: 'var(--der-ink-900)' }}>{snap.profileName ?? '—'}</strong></span>
            <span>·</span>
            <span>Probe RTT <strong style={{ color: 'var(--der-ink-900)' }}>{snap.probeDurationMs != null ? `${snap.probeDurationMs} ms` : '—'}</strong></span>
            <span>·</span>
            <span>Captured <strong style={{ color: 'var(--der-ink-900)' }}>{fmtAgo(snap.capturedAt)}</strong></span>
            <span>·</span>
            <span>{reliability}% reliability over last {history.length} probe{history.length === 1 ? '' : 's'}</span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={refreshing}
                  onClick={() => { refresh().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Probing…' : 'Probe now'}</span>
          </button>
        }
      />

      <Panel title="Supported DHIS2 version matrix">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>DHIS2</th>
              <th>Profile</th>
              <th>Status</th>
              <th>Tracker API</th>
              <th>Audit surface</th>
              <th>Metadata bulk</th>
              <th>Program rules</th>
            </tr></thead>
            <tbody>
              {VERSION_MATRIX.map((row) => (
                <tr key={row.minor}
                    className={row.profileKey === activeProfile ? 'ea-row--active' : ''}
                    data-test={`matrix-row-${row.profileKey}`}>
                  <td className="ea-mono" style={{ fontWeight: 600 }}>
                    {row.minor}
                    {row.profileKey === activeProfile && (
                      <span className="ea-chip ea-chip--success" style={{ marginLeft: 6 }}>live</span>
                    )}
                  </td>
                  <td className="ea-mono">{row.profileKey}</td>
                  <td>
                    <span className={'ea-chip ea-chip--' + row.statusTone}>{row.supportLevel}</span>
                  </td>
                  <td>{row.tracker}</td>
                  <td>{row.audit}</td>
                  <td>{row.metadataBulk}</td>
                  <td>{row.programRules}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Live profile capabilities"
             action={<span className="ea-text-muted">from the latest probe</span>}>
        {!snap.capabilities ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            Probe hasn't returned a capabilities snapshot yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr><th style={{ width: '36%' }}>Capability</th><th>Value</th></tr></thead>
              <tbody>
                {Object.entries(snap.capabilities).map(([k, v]) => (
                  <tr key={k}>
                    <td>
                      <div>{humaniseKey(k)}</div>
                      <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>{k}</div>
                    </td>
                    <td>{renderCapability(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Snapshot history"
             action={<span className="ea-text-muted">{history.length} snapshots</span>}>
        {history.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No snapshots recorded.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Snapshot</th><th>Captured</th><th>Central version</th>
                <th>Profile</th><th>Reachable</th><th>RTT</th><th>Note</th>
              </tr></thead>
              <tbody>
                {history.slice(0, 25).map((s) => (
                  <tr key={s.snapshotId}>
                    <td className="ea-mono">#{s.snapshotId}</td>
                    <td className="ea-mono">{s.capturedAt ? fmtDate(s.capturedAt) : '—'}</td>
                    <td>{s.centralVersion ?? '—'}</td>
                    <td>{s.profileName ?? '—'}</td>
                    <td>
                      <span className={'ea-chip ea-chip--' + (s.probeReachable ? 'success' : 'danger')}>
                        {s.probeReachable ? 'yes' : 'no'}
                      </span>
                    </td>
                    <td className="ea-mono">{s.probeDurationMs != null ? `${s.probeDurationMs} ms` : '—'}</td>
                    <td className="ea-text-muted" style={{ fontSize: 11 }}>{s.message ?? s.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length > 25 && (
              <div className="ea-table-footer">
                <span className="ea-text-muted">Showing first 25 of {history.length} snapshots.</span>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Supported DHIS2 version matrix — static per DER build.
// Each row's `highlights` captures the key capture-/sync-surface
// differences DER cares about; the "live" badge binds to the current
// probe's resolved profile.
// ────────────────────────────────────────────────────────────────────

interface MatrixRow {
  minor: string;            // e.g. '2.41'
  profileKey: string;       // e.g. 'V2_41'
  supportLevel: string;     // short status label
  statusTone: 'info' | 'success' | 'warning' | 'danger';
  tracker: string;          // tracker-API posture for this version
  audit: string;            // audit surface for this version
  metadataBulk: string;     // metadata bulk-endpoint shape
  programRules: string;     // program-rules endpoint posture
}

const VERSION_MATRIX: readonly MatrixRow[] = [
  {
    minor: '2.41',
    profileKey: 'V2_41',
    supportLevel: 'Minimum supported',
    statusTone: 'warning',
    tracker: 'Legacy primary · modern secondary',
    audit: '/api/audits',
    metadataBulk: 'DHIS2_2_41',
    programRules: 'Supported',
  },
  {
    minor: '2.42',
    profileKey: 'V2_42',
    supportLevel: 'Supported',
    statusTone: 'info',
    tracker: 'Legacy + modern (both active)',
    audit: '/api/audits',
    metadataBulk: 'DHIS2_2_41',
    programRules: 'Bulk endpoint stabilised',
  },
  {
    minor: '2.43',
    profileKey: 'V2_43',
    supportLevel: 'Supported',
    statusTone: 'info',
    tracker: 'Modern primary · legacy deprecating',
    audit: '/api/audits + changeLogs',
    metadataBulk: 'DHIS2_2_43',
    programRules: 'Supported',
  },
  {
    minor: '2.44',
    profileKey: 'V2_44',
    supportLevel: 'Maximum tested',
    statusTone: 'success',
    tracker: 'Modern only — legacy REMOVED',
    audit: 'changeLog API only',
    metadataBulk: 'DHIS2_2_44',
    programRules: 'Full endpoint + categoryOptionCombos',
  },
];

// ────────────────────────────────────────────────────────────────────
// Capability value renderer. Arrays → wrap-chip row, objects → JSON
// code block, booleans → yes/no chip, scalars → monospace span.
// ────────────────────────────────────────────────────────────────────

function humaniseKey(k: string): string {
  const spaced = k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderCapability(v: unknown): JSX.Element {
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="ea-text-muted">(empty)</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(v as unknown[]).map((x, i) => (
          <span key={i} className="ea-chip ea-chip--info">{String(x)}</span>
        ))}
      </div>
    );
  }
  if (v === null || v === undefined) return <span className="ea-text-muted">—</span>;
  if (typeof v === 'boolean') {
    return (
      <span className={'ea-chip ea-chip--' + (v ? 'success' : 'muted')}>
        {v ? 'yes' : 'no'}
      </span>
    );
  }
  if (typeof v === 'object') {
    return (
      <pre style={{
        margin: 0, padding: '6px 8px', fontSize: 11, lineHeight: 1.4,
        background: 'var(--der-raised)', borderRadius: 4,
        maxHeight: 240, overflow: 'auto', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
      }}>
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  }
  return <span className="ea-mono">{String(v)}</span>;
}
