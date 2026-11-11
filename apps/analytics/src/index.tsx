import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useOrgUnitBinding, useOnlineStatus,
  ScreenCard, StatusPill } from '@der/app-sdk';

/**
 * DER Analytics — site-local offline-capable analytics UI
 * (docs/apps/analytics spec §10). Single bundle with every
 * navigation section routed below a persistent sidebar.
 *
 *   1. Overview        — KPIs, freshness
 *   2. Explore         — pivot + chart builder (stub)
 *   3. Metrics         — definition catalogue (live)
 *   4. Tracker Tally   — event/enrollment tally (stub)
 *   5. Reports         — generic reports catalogue (stub)
 *   6. Drilldowns      — authorised lineage → source rows (live)
 *   7. Saved           — saved views (stub)
 *   8. Quality         — quality + reconciliation (live)
 *   9. Admin           — definitions, publication, jobs (stub)
 *
 * Pages marked (live) call the DER edge-API; stubs show a
 * "coming soon" strip with a link to the backing endpoint so
 * operators know what's wired vs. pending without guessing.
 */

const API = '/edge-api/v1/analytics/v1';

type Section = 'overview' | 'explore' | 'metrics' | 'tally'
  | 'reports' | 'drilldowns' | 'saved' | 'quality' | 'admin';

interface NavEntry {
  readonly id: Section;
  readonly label: string;
  readonly live: boolean;
  readonly hint: string;
}

const NAV: readonly NavEntry[] = [
  { id: 'overview', label: 'Overview', live: true,
    hint: 'KPIs and data freshness' },
  { id: 'explore', label: 'Explore', live: false,
    hint: 'Pivot and chart builder' },
  { id: 'metrics', label: 'Program Indicators', live: true,
    hint: 'Definition catalogue + support state' },
  { id: 'tally', label: 'Tracker & Event Tally', live: false,
    hint: 'Event + enrollment throughput' },
  { id: 'reports', label: 'Reports', live: false,
    hint: 'Datasets, sections, calculated contributions' },
  { id: 'drilldowns', label: 'Drilldowns', live: true,
    hint: 'Authorised lineage to source records' },
  { id: 'saved', label: 'Saved Analytics', live: false,
    hint: 'Shared dashboards + snapshots' },
  { id: 'quality', label: 'Quality & Reconciliation', live: true,
    hint: 'Divergence classification + replay audit' },
  { id: 'admin', label: 'Administration', live: false,
    hint: 'Definitions, publication, rebuild jobs' },
];

export default function AnalyticsApp(): JSX.Element {
  const [section, setSection] = useState<Section>(initialSection());
  useEffect(() => {
    const onHash = () => setSection(initialSection());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((s: Section) => {
    window.location.hash = `#/analytics/${s}`;
    setSection(s);
  }, []);
  return (
    <>
      <style>{STYLES}</style>
      <ScreenCard title="Analytics" dataTest="der-analytics-app">
        <Header />
        <div className="an-layout">
          <Sidebar current={section} onSelect={go} />
          <main className="an-main">
            <Page section={section} />
          </main>
        </div>
      </ScreenCard>
    </>
  );
}

function initialSection(): Section {
  const m = /#\/analytics\/([a-z-]+)/.exec(window.location.hash);
  const raw = (m?.[1] ?? 'overview') as Section;
  return NAV.some((n) => n.id === raw) ? raw : 'overview';
}

function Header(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  return (
    <div className="an-header" data-test="an-header">
      <div className="an-context">
        <span className="an-ou">{ou?.orgUnitPath ?? '—'}</span>
        <span className="an-user">{auth?.displayName ?? '—'}</span>
      </div>
      <StatusPill tone={online?.isOnline ? 'success' : 'warning'}>
        {online?.isOnline ? 'Online' : 'Offline'}
      </StatusPill>
    </div>
  );
}

function Sidebar({ current, onSelect }: {
  current: Section;
  onSelect: (s: Section) => void;
}): JSX.Element {
  return (
    <nav className="an-side" aria-label="Analytics sections">
      {NAV.map((n) => (
        <button key={n.id}
          type="button"
          className={`an-nav-item ${n.id === current ? 'is-active' : ''}`}
          onClick={() => onSelect(n.id)}
          data-test={`an-nav-${n.id}`}>
          <span className="an-nav-label">{n.label}</span>
          {!n.live && (
            <span className="an-nav-tag" title={n.hint}>
              stub
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function Page({ section }: { section: Section }): JSX.Element {
  switch (section) {
    case 'overview': return <OverviewPage />;
    case 'metrics': return <MetricsPage />;
    case 'drilldowns': return <DrilldownPage />;
    case 'quality': return <QualityPage />;
    default: return <StubPage id={section} />;
  }
}

/* ─────────────── Overview ─────────────── */

interface MetricRow {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
  readonly supportState: string;
}

function OverviewPage(): JSX.Element {
  const [metrics, setMetrics] = useState<readonly MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/metrics`, { credentials: 'include' })
      .then(parseOrThrow)
      .then((r: { metrics?: readonly MetricRow[] }) => {
        setMetrics(r.metrics ?? []);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const readyCount = metrics.filter((m) => m.supportState === 'READY').length;
  const unsupported = metrics.filter(
    (m) => m.supportState === 'UNSUPPORTED').length;
  return (
    <section className="an-page" data-test="an-overview">
      <h1 className="an-h1">Overview</h1>
      <p className="an-sub">
        Site-local analytics snapshot. All numbers below are derived
        from DER&rsquo;s committed data — not central DHIS2.
      </p>
      {error && <ErrorStrip message={error} />}
      <div className="an-kpi-grid">
        <KpiCard label="Metrics in catalogue"
          value={loading ? '…' : String(metrics.length)} />
        <KpiCard label="Ready for evaluation"
          value={loading ? '…' : String(readyCount)}
          tone="success" />
        <KpiCard label="Unsupported"
          value={loading ? '…' : String(unsupported)}
          tone={unsupported > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="Data as of"
          value={new Date().toLocaleString()} />
      </div>
      <p className="an-note">
        Use the <strong>Program Indicators</strong> section to inspect
        each metric&rsquo;s formula and support state. Use
        <strong> Drilldowns</strong> to open authorised source rows
        behind a specific cell.
      </p>
    </section>
  );
}

/* ─────────────── Metrics ─────────────── */

function MetricsPage(): JSX.Element {
  const [rows, setRows] = useState<readonly MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/metrics`, { credentials: 'include' })
      .then(parseOrThrow)
      .then((r: { metrics?: readonly MetricRow[] }) => {
        setRows(r.metrics ?? []);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="an-page" data-test="an-metrics">
      <h1 className="an-h1">Program Indicators</h1>
      <p className="an-sub">
        Catalogue of DER-authored + imported DHIS2 program indicators.
        Support state follows AN-FR-003/004 — unsupported metrics
        never silently return zero.
      </p>
      {error && <ErrorStrip message={error} />}
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Display name</th>
              <th>Support</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="an-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="an-empty">
                  No metrics yet — import or author via Administration.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><code>{r.code}</code></td>
                <td>{r.displayName}</td>
                <td>
                  <StatusPill tone={supportTone(r.supportState)}>
                    {r.supportState}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function supportTone(s: string):
    'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'READY') return 'success';
  if (s === 'UNSUPPORTED') return 'warning';
  if (s === 'DEPRECATED') return 'danger';
  return 'neutral';
}

/* ─────────────── Drilldown ─────────────── */

interface DrilldownRow {
  readonly sourceKey: string;
  readonly sourceType: string;
  readonly occurredOn?: string | null;
  readonly status?: string | null;
  readonly orgUnitUid?: string | null;
  readonly stageUid?: string | null;
  readonly maskedSubjectId?: string | null;
}

interface DrilldownResponse {
  readonly auditId: string;
  readonly outcome: string;
  readonly suppressed: boolean;
  readonly rowCount: number;
  readonly rows: readonly DrilldownRow[];
  readonly reason?: string;
}

function DrilldownPage(): JSX.Element {
  const [metricId, setMetricId] = useState('');
  const [periodKey, setPeriodKey] = useState('');
  const [orgUnitUid, setOrgUnitUid] = useState('');
  const [dimensionKey, setDimensionKey] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DrilldownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = metricId.length > 0 && periodKey.length > 0
    && orgUnitUid.length > 0;
  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${API}/drilldown`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricId, periodKey, orgUnitUid, dimensionKey, purpose,
        }),
      });
      const body = (await resp.json()) as DrilldownResponse;
      if (!resp.ok) {
        setError(body.reason ?? `HTTP ${resp.status}`);
        setResult(null);
      } else {
        setResult(body);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(false);
    }
  }, [canSubmit, metricId, periodKey, orgUnitUid, dimensionKey, purpose]);
  return (
    <section className="an-page" data-test="an-drilldown">
      <h1 className="an-h1">Drilldowns</h1>
      <p className="an-sub">
        Lineage from a specific analytics cell back to its
        contributing source records. Server rechecks
        authorisation per call; small cells return a suppression
        notice instead of identities (spec §11).
      </p>
      <div className="an-form">
        <Field label="Metric ID"
          value={metricId} onChange={setMetricId}
          placeholder="UUID from the Program Indicators catalogue" />
        <Field label="Period key"
          value={periodKey} onChange={setPeriodKey}
          placeholder="e.g. 202611" />
        <Field label="Org unit UID"
          value={orgUnitUid} onChange={setOrgUnitUid} />
        <Field label="Dimension key (optional)"
          value={dimensionKey} onChange={setDimensionKey}
          placeholder="sex=F|ageGroup=15-19" />
        <Field label="Purpose (audit)"
          value={purpose} onChange={setPurpose}
          placeholder="Case review, outbreak investigation…" />
        <div className="an-actions">
          <button type="button" className="an-btn-primary"
            onClick={submit}
            disabled={!canSubmit || busy}
            data-test="an-drilldown-submit">
            {busy ? 'Opening…' : 'Open lineage'}
          </button>
        </div>
      </div>
      {error && <ErrorStrip message={error} />}
      {result && <DrilldownResult r={result} />}
    </section>
  );
}

function DrilldownResult({ r }: { r: DrilldownResponse }): JSX.Element {
  if (r.suppressed) {
    return (
      <div className="an-strip an-strip--warn">
        Cell suppressed by small-cell threshold. Audit entry
        <code> {r.auditId} </code> written.
      </div>
    );
  }
  return (
    <>
      <p className="an-sub">
        Audit <code>{r.auditId}</code> • {r.rowCount} row
        {r.rowCount === 1 ? '' : 's'}
      </p>
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Occurred</th>
              <th>Status</th>
              <th>Org unit</th>
              <th>Masked subject</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.sourceKey}>
                <td><code>{row.sourceKey}</code></td>
                <td>{row.sourceType}</td>
                <td>{row.occurredOn ?? '—'}</td>
                <td>{row.status ?? '—'}</td>
                <td>{row.orgUnitUid ?? '—'}</td>
                <td>{row.maskedSubjectId ?? '—'}</td>
              </tr>
            ))}
            {r.rows.length === 0 && (
              <tr><td colSpan={6} className="an-empty">
                No contributing rows for this cell.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─────────────── Quality & Reconciliation ─────────────── */

interface ReconciliationRow {
  readonly reconciliationId: string;
  readonly metricId: string;
  readonly periodKey: string;
  readonly orgUnitUid: string;
  readonly localValue?: string | null;
  readonly centralValue?: string | null;
  readonly classification: string;
  readonly explanation?: string | null;
}

function QualityPage(): JSX.Element {
  const [rows, setRows] = useState<readonly ReconciliationRow[]>([]);
  const [histogram, setHistogram] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/reconciliation`, { credentials: 'include' })
      .then(parseOrThrow)
      .then((r: {
        rows?: readonly ReconciliationRow[];
        byClassification?: Record<string, number>;
      }) => {
        setRows(r.rows ?? []);
        setHistogram(r.byClassification ?? {});
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const chips = useMemo(() =>
    Object.entries(histogram)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]),
    [histogram]);
  return (
    <section className="an-page" data-test="an-quality">
      <h1 className="an-h1">Quality &amp; Reconciliation</h1>
      <p className="an-sub">
        Classified divergence between DER&rsquo;s local cells and
        DHIS2 central (spec §12). A row&rsquo;s classification is the
        most-specific reason the two can legitimately differ.
      </p>
      {error && <ErrorStrip message={error} />}
      {chips.length > 0 && (
        <div className="an-chips">
          {chips.map(([k, n]) => (
            <span key={k} className="an-chip">
              <strong>{n}</strong> {k.toLowerCase().replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Period</th>
              <th>Org unit</th>
              <th>Local</th>
              <th>Central</th>
              <th>Classification</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="an-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="an-empty">
                No comparisons yet. POST authoritative central samples
                via <code>/admin/reconciliation/compare</code>.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.reconciliationId}
                  title={r.explanation ?? undefined}>
                <td><code>{r.metricId.slice(0, 8)}</code></td>
                <td>{r.periodKey}</td>
                <td>{r.orgUnitUid}</td>
                <td>{r.localValue ?? '—'}</td>
                <td>{r.centralValue ?? '—'}</td>
                <td>
                  <StatusPill tone={classificationTone(r.classification)}>
                    {r.classification}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function classificationTone(c: string):
    'success' | 'warning' | 'danger' | 'neutral' {
  if (c === 'IN_AGREEMENT') return 'success';
  if (c === 'REAL_MISMATCH') return 'danger';
  if (c === 'LOCAL_PENDING_SYNC'
      || c === 'CENTRAL_ANALYTICS_NOT_REFRESHED'
      || c === 'LATE_DATA') return 'warning';
  return 'neutral';
}

/* ─────────────── Stubs ─────────────── */

function StubPage({ id }: { id: Section }): JSX.Element {
  const entry = NAV.find((n) => n.id === id);
  return (
    <section className="an-page" data-test={`an-${id}`}>
      <h1 className="an-h1">{entry?.label ?? id}</h1>
      <p className="an-sub">{entry?.hint}</p>
      <div className="an-strip an-strip--info">
        This section ships in a later slice. The server endpoint
        for this view isn&rsquo;t fully wired yet — the shell has
        the nav in place so the muscle memory stays stable.
      </div>
    </section>
  );
}

/* ─────────────── UI primitives ─────────────── */

function KpiCard({ label, value, tone = 'neutral' }: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}): JSX.Element {
  return (
    <div className={`an-kpi an-kpi--${tone}`} data-test="an-kpi">
      <div className="an-kpi-value">{value}</div>
      <div className="an-kpi-label">{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <label className="an-field">
      <span className="an-field-label">{label}</span>
      <input className="an-input"
        type="text" value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ErrorStrip({ message }: { message: string }): JSX.Element {
  return (
    <div className="an-strip an-strip--err" role="alert">
      {message}
    </div>
  );
}

async function parseOrThrow(resp: Response): Promise<unknown> {
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json();
}

/* ─────────────── Styles ─────────────── */

const STYLES = `
.an-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--der-divider, #e5e7eb);
}
.an-context { display: flex; gap: 16px; align-items: baseline; }
.an-ou { font-weight: 500; }
.an-user { color: var(--der-ink-500, #6b7280); font-size: 13px; }

.an-layout { display: flex; min-height: 500px; }
.an-side {
  width: 220px; flex: 0 0 220px;
  border-right: 1px solid var(--der-divider, #e5e7eb);
  padding: 8px 0;
  background: var(--der-surface-subtle, #fafafa);
}
.an-nav-item {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%;
  padding: 8px 14px;
  font: inherit;
  text-align: left;
  background: transparent; border: 0;
  color: var(--der-ink-900, #111827);
  cursor: pointer;
}
.an-nav-item:hover { background: var(--der-divider, #e5e7eb); }
.an-nav-item.is-active {
  background: var(--der-accent-soft, #e0ecff);
  color: var(--der-accent, #1d4ed8);
  font-weight: 500;
}
.an-nav-tag {
  font-size: 10px; font-weight: 500; text-transform: uppercase;
  color: var(--der-ink-500, #6b7280);
  background: var(--der-divider, #e5e7eb);
  padding: 2px 6px; border-radius: 10px;
}

.an-main { flex: 1; padding: 20px 24px; }
.an-page { max-width: 1100px; }
.an-h1 {
  margin: 0 0 4px 0;
  font-size: 20px; font-weight: 500;
  color: var(--der-ink-900, #111827);
}
.an-sub { color: var(--der-ink-500, #6b7280); margin: 0 0 16px 0; }
.an-note { color: var(--der-ink-500, #6b7280); margin: 16px 0 0; }

.an-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.an-kpi {
  padding: 14px 16px;
  border: 1px solid var(--der-divider, #e5e7eb);
  border-radius: 6px;
  background: var(--der-surface, #ffffff);
}
.an-kpi-value {
  font-size: 22px; font-weight: 500;
  color: var(--der-ink-900, #111827);
}
.an-kpi-label {
  margin-top: 2px;
  font-size: 12px; color: var(--der-ink-500, #6b7280);
}
.an-kpi--success .an-kpi-value { color: #15803d; }
.an-kpi--warning .an-kpi-value { color: #b45309; }
.an-kpi--danger  .an-kpi-value { color: #b91c1c; }

.an-table-wrap {
  margin-top: 12px;
  border: 1px solid var(--der-divider, #e5e7eb);
  border-radius: 6px;
  overflow: auto;
}
.an-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.an-table th, .an-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--der-divider, #e5e7eb);
  vertical-align: top;
}
.an-table thead th {
  background: var(--der-surface-subtle, #fafafa);
  font-weight: 500;
  color: var(--der-ink-500, #6b7280);
}
.an-table tbody tr:last-child td { border-bottom: 0; }
.an-empty { color: var(--der-ink-500, #6b7280); font-style: italic; }

.an-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.an-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--der-surface-subtle, #fafafa);
  border: 1px solid var(--der-divider, #e5e7eb);
  font-size: 12px;
  color: var(--der-ink-500, #6b7280);
}

.an-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  margin: 12px 0;
}
.an-field { display: flex; flex-direction: column; gap: 4px; }
.an-field-label {
  font-size: 12px;
  color: var(--der-ink-500, #6b7280);
}
.an-input {
  font: inherit;
  padding: 7px 10px;
  border: 1px solid var(--der-divider, #d1d5db);
  border-radius: 4px;
  background: var(--der-surface, #ffffff);
}
.an-input:focus {
  outline: 2px solid var(--der-accent, #2563eb);
  outline-offset: -1px;
}

.an-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}
.an-btn-primary {
  font: inherit; font-weight: 500;
  padding: 8px 16px;
  border-radius: 4px;
  border: 0;
  background: var(--der-accent, #1d4ed8);
  color: #ffffff;
  cursor: pointer;
}
.an-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

.an-strip {
  margin: 12px 0;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
}
.an-strip--err {
  background: #fef2f2; color: #b91c1c;
  border: 1px solid #fecaca;
}
.an-strip--warn {
  background: #fffbeb; color: #92400e;
  border: 1px solid #fde68a;
}
.an-strip--info {
  background: #eff6ff; color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
`;
