import { useEffect, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { KpiTile, Panel, fmtDate, fmtAgo } from './shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

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
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">DHIS2</div>
          <h1 className="ea-dash-hero-title">Compatibility</h1>
          <p className="ea-dash-hero-sub">
            Live DHIS2 version probe, supported-version matrix, and the full
            snapshot history for ADR-0006 compatibility decisions.
          </p>
          <div className="ea-dash-hero-meta">
            <span className={'ea-chip ea-chip--' + (snap.probeReachable ? 'success' : 'danger')}>
              {snap.probeReachable ? 'Central reachable' : 'Central unreachable'}
            </span>
            <span className="ea-dash-hero-meta-item">{history.length} snapshots</span>
            <span className="ea-dash-hero-meta-item">captured {fmtAgo(snap.capturedAt)}</span>
          </div>
        </div>
        <div>
          <button type="button" className="ea-btn ea-btn--primary"
                  disabled={refreshing}
                  onClick={() => { refresh().catch(() => undefined); }}>
            {refreshing ? 'Probing…' : 'Probe now'}
          </button>
        </div>
      </section>

      <div className="ea-kpi-grid">
        <KpiTile tone={snap.probeReachable ? 'success' : 'danger'}
                 label="Probe status"
                 value={snap.probeReachable ? 'reachable' : 'unreachable'}
                 caption={snap.message ?? snap.status} />
        <KpiTile tone="info" label="Central version"
                 value={snap.centralVersion ?? '—'}
                 caption={`compiled profile ${snap.profileName ?? '—'}`} />
        <KpiTile tone="info" label="Compat profile"
                 value={snap.profileName ?? '—'}
                 caption={`engine v${snap.engineVersion ?? '—'}`} />
        <KpiTile tone="info" label="Probe RTT"
                 value={snap.probeDurationMs != null ? `${snap.probeDurationMs} ms` : '—'}
                 caption={`${reliability}% probe reliability (last ${history.length})`} />
      </div>

      <Panel title="Supported DHIS2 version matrix">
        <p className="ea-text-muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Compat profiles shipped with this DER build. Each profile encodes
          the endpoints, period types, program types and capture surfaces
          verified against that DHIS2 minor; the current probe resolves to
          the matching profile.
        </p>
        <div className="ea-matrix">
          {VERSION_MATRIX.map((row) => (
            <div key={row.minor}
                 className={'ea-matrix-card'
                     + (row.profileKey === activeProfile ? ' ea-matrix-card--active' : '')
                     + ' ea-matrix-card--' + row.tone}>
              <div className="ea-matrix-head">
                <div className="ea-matrix-version">
                  DHIS2 {row.minor}
                  {row.profileKey === activeProfile && (
                    <span className="ea-chip ea-chip--success" style={{ marginLeft: 8 }}>live</span>
                  )}
                </div>
                <div className="ea-matrix-sub">
                  Profile {row.profileKey} · {row.supportLevel}
                </div>
              </div>
              <ul className="ea-matrix-list">
                {row.highlights.map((h) => (
                  <li key={h.text}>
                    <span className={'ea-matrix-dot ea-matrix-dot--' + h.tone} />
                    {h.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
              <thead><tr><th>Capability</th><th>Value</th></tr></thead>
              <tbody>
                {Object.entries(snap.capabilities).map(([k, v]) => (
                  <tr key={k}>
                    <td className="ea-mono">{k}</td>
                    <td>
                      {Array.isArray(v)
                        ? (v as unknown[]).map((x) => (<span key={String(x)} className="ea-chip ea-chip--info" style={{ marginRight: 4 }}>{String(x)}</span>))
                        : typeof v === 'boolean'
                          ? <span className={'ea-chip ea-chip--' + (v ? 'success' : 'muted')}>{v ? 'yes' : 'no'}</span>
                          : <span className="ea-mono">{String(v)}</span>}
                    </td>
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
  supportLevel: string;     // short caption shown under the version header
  tone: 'legacy' | 'stable' | 'current' | 'preview';
  highlights: ReadonlyArray<{ text: string; tone: 'ok' | 'warn' | 'danger' | 'info' }>;
}

const VERSION_MATRIX: readonly MatrixRow[] = [
  {
    minor: '2.41',
    profileKey: 'V2_41',
    supportLevel: 'Minimum supported',
    tone: 'legacy',
    highlights: [
      { text: 'Legacy tracker endpoints (/api/trackedEntityInstances, /api/events, /api/enrollments) are primary.', tone: 'info' },
      { text: '/api/tracker/* available but secondary.', tone: 'info' },
      { text: 'Legacy audit API /api/audits/* is the only audit surface.', tone: 'info' },
      { text: 'WITH_REGISTRATION + WITHOUT_REGISTRATION programs supported.', tone: 'ok' },
      { text: 'Period types: YEARLY, QUARTERLY, MONTHLY, WEEKLY, DAILY.', tone: 'ok' },
    ],
  },
  {
    minor: '2.42',
    profileKey: 'V2_42',
    supportLevel: 'Supported',
    tone: 'stable',
    highlights: [
      { text: 'Both legacy and modern tracker endpoints active.', tone: 'info' },
      { text: 'Audit surface still rooted at /api/audits/*.', tone: 'info' },
      { text: 'Program rules bulk endpoint stabilised.', tone: 'ok' },
      { text: 'Period types + program types unchanged.', tone: 'ok' },
    ],
  },
  {
    minor: '2.43',
    profileKey: 'V2_43',
    supportLevel: 'Supported',
    tone: 'stable',
    highlights: [
      { text: 'Modern /api/tracker/* becomes primary; legacy tracker starts deprecation.', tone: 'warn' },
      { text: 'Tracker changeLogs API appears alongside /api/audits.', tone: 'info' },
      { text: 'Metadata bulk endpoint shape evolves (DHIS2_2_43 variant).', tone: 'info' },
      { text: 'Period types + program types unchanged.', tone: 'ok' },
    ],
  },
  {
    minor: '2.44',
    profileKey: 'V2_44',
    supportLevel: 'Maximum tested — current',
    tone: 'current',
    highlights: [
      { text: 'Legacy tracker endpoints REMOVED. /api/tracker/* is the only write path.', tone: 'danger' },
      { text: 'Legacy audit /api/audits/* REMOVED. Per-entity changeLogs only.', tone: 'danger' },
      { text: 'WebMessage shape evolves to the 2.44 variant used by stock clients.', tone: 'warn' },
      { text: 'Metadata bulk endpoint shape evolves (DHIS2_2_44 variant).', tone: 'info' },
      { text: 'Full program-rules endpoint + categoryOptionCombos endpoint.', tone: 'ok' },
    ],
  },
];
