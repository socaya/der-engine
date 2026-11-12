import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useOrgUnitBinding, useOnlineStatus,
  ScreenCard, StatusPill } from '@der/app-sdk';

/**
 * DER Analytics — site-local offline-capable analytics UI
 * (docs/apps/analytics spec §10). Single bundle with every
 * navigation section routed below a persistent sidebar.
 *
 *   1. Overview        — KPIs, freshness
 *   2. Explore         — pivot query builder → /query
 *   3. Metrics         — definition catalogue → /metrics
 *   4. Tracker Tally   — built-in counts over last 6 months
 *   5. Reports         — publication mappings + proposal state
 *   6. Drilldowns      — authorised lineage → /drilldown
 *   7. Saved           — shareable hash URL for current filters
 *   8. Quality         — reconciliation → /reconciliation
 *   9. Admin           — capabilities + DLQ + action triggers
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
  { id: 'explore', label: 'Explore', live: true,
    hint: 'Pivot query builder' },
  { id: 'metrics', label: 'Program Indicators', live: true,
    hint: 'Definition catalogue + support state' },
  { id: 'tally', label: 'Tracker & Event Tally', live: true,
    hint: 'Event + enrollment throughput by month' },
  { id: 'reports', label: 'Reports', live: true,
    hint: 'Publication mappings + proposal review' },
  { id: 'drilldowns', label: 'Drilldowns', live: true,
    hint: 'Authorised lineage to source records' },
  { id: 'saved', label: 'Saved Analytics', live: false,
    hint: 'Shareable URL for current filters' },
  { id: 'quality', label: 'Quality & Reconciliation', live: true,
    hint: 'Divergence classification + replay audit' },
  { id: 'admin', label: 'Administration', live: true,
    hint: 'Capabilities + DLQ + action triggers' },
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
    case 'explore': return <ExplorePage />;
    case 'metrics': return <MetricsPage />;
    case 'tally': return <TallyPage />;
    case 'reports': return <ReportsPage />;
    case 'drilldowns': return <DrilldownPage />;
    case 'saved': return <SavedPage />;
    case 'quality': return <QualityPage />;
    case 'admin': return <AdminPage />;
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
  const [freshness, setFreshness] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/metrics`, { credentials: 'include' }).then(parseOrThrow),
      fetch(`${API}/quality`, { credentials: 'include' }).then(parseOrThrow),
    ])
      .then(([metricBody, qualityBody]) => {
        const r = metricBody as { metrics?: readonly MetricRow[] };
        const q = qualityBody as { freshnessAt?: string | null };
        setMetrics(r.metrics ?? []);
        setFreshness(q.freshnessAt ?? null);
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
          value={freshness ? new Date(freshness).toLocaleString() : 'No cells'} />
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
  if (s === 'READY' || s === 'REQUIRED_IMPLEMENTATION'
      || s === 'DER_EXTENDED') return 'success';
  if (s === 'UNSUPPORTED' || s === 'VERSION_VERIFICATION_REQUIRED') return 'warning';
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

/* ─────────────── Explore ─────────────── */

interface Cell {
  readonly metricId: string;
  readonly periodKey: string;
  readonly orgUnitUid: string;
  readonly dimensionKey: string;
  readonly value?: string | null;
  readonly countValue?: number | null;
  readonly qualityState?: string | null;
}

function ExplorePage(): JSX.Element {
  const [metrics, setMetrics] = useState<readonly MetricRow[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey());
  const [orgUnitUid, setOrgUnitUid] = useState('');
  const [rows, setRows] = useState<readonly Cell[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppressed, setSuppressed] = useState(0);
  useEffect(() => {
    fetch(`${API}/metrics`, { credentials: 'include' })
      .then(parseOrThrow)
      .then((r: { metrics?: readonly MetricRow[] }) =>
        setMetrics(r.metrics ?? []))
      .catch((e: Error) => setError(e.message));
  }, []);
  const submit = useCallback(async () => {
    if (!selectedMetric) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${API}/query`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: [selectedMetric],
          period: periodKey ? { id: periodKey } : null,
          orgUnits: orgUnitUid ? [orgUnitUid] : [],
          page: { limit: 200 },
        }),
      });
      const body = await parseOrThrow(resp) as {
        count?: number;
        suppressedCount?: number;
        cells?: readonly Cell[];
      };
      setRows(body.cells ?? []);
      setSuppressed(body.suppressedCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [selectedMetric, periodKey, orgUnitUid]);
  return (
    <section className="an-page" data-test="an-explore">
      <h1 className="an-h1">Explore</h1>
      <p className="an-sub">
        Build a quick cell query — pick a metric, period and org unit
        to see the matrix. Small cells are returned as
        <code> SUPPRESSED</code> per the privacy threshold (§11).
      </p>
      <div className="an-form">
        <label className="an-field">
          <span className="an-field-label">Metric</span>
          <select className="an-input"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            data-test="an-explore-metric">
            <option value="">— choose —</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
        </label>
        <Field label="Period key"
          value={periodKey} onChange={setPeriodKey}
          placeholder="e.g. 202611" />
        <Field label="Org unit UID (optional)"
          value={orgUnitUid} onChange={setOrgUnitUid} />
        <div className="an-actions">
          <button type="button" className="an-btn-primary"
            onClick={submit}
            disabled={!selectedMetric || busy}
            data-test="an-explore-run">
            {busy ? 'Running…' : 'Run query'}
          </button>
        </div>
      </div>
      {error && <ErrorStrip message={error} />}
      {rows.length > 0 && (
        <p className="an-sub">
          {rows.length} cell{rows.length === 1 ? '' : 's'}
          {suppressed > 0 && (
            <> • {suppressed} suppressed by small-cell threshold</>
          )}
        </p>
      )}
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Org unit</th>
              <th>Dimension</th>
              <th>Value</th>
              <th>Count</th>
              <th>Quality</th>
            </tr>
          </thead>
          <tbody>
            {!busy && rows.length === 0 && (
              <tr><td colSpan={6} className="an-empty">
                No results yet. Pick a metric and run.
              </td></tr>
            )}
            {rows.map((c) => (
              <tr key={`${c.metricId}-${c.periodKey}-${c.orgUnitUid}-${c.dimensionKey}`}>
                <td>{c.periodKey}</td>
                <td>{c.orgUnitUid}</td>
                <td>{c.dimensionKey || '—'}</td>
                <td>{c.value ?? '—'}</td>
                <td>{c.countValue ?? '—'}</td>
                <td>
                  <StatusPill tone={qualityTone(c.qualityState)}>
                    {c.qualityState ?? '—'}
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

function qualityTone(s: string | null | undefined):
    'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'VERIFIED') return 'success';
  if (s === 'PROVISIONAL') return 'warning';
  if (s === 'SUPPRESSED') return 'neutral';
  return 'neutral';
}

function defaultPeriodKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/* ─────────────── Tracker & Event Tally ─────────────── */

interface TallyMetric {
  readonly code: string;
  readonly label: string;
  readonly cells: readonly Cell[];
}

function TallyPage(): JSX.Element {
  const [metrics, setMetrics] = useState<readonly TallyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const periods = useMemo(() => lastNMonths(6), []);
  useEffect(() => {
    const builtins = [
      { code: 'DER_EVENT_COUNT', label: 'Events' },
      { code: 'DER_ENROLLMENT_COUNT', label: 'Enrollments' },
    ];
    Promise.all(builtins.map(async (b) => {
      const defsResp = await fetch(`${API}/metrics?code=${b.code}`,
        { credentials: 'include' });
      const defs = (await parseOrThrow(defsResp)) as {
        metrics?: readonly MetricRow[];
      };
      const metric = (defs.metrics ?? []).find(
        (m) => m.code === b.code);
      if (!metric) return { ...b, cells: [] as Cell[] };
      const resp = await fetch(`${API}/query`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: [metric.id],
          periods: periods.map((p) => ({ id: p })),
          page: { limit: 500 },
        }),
      });
      const body = (await parseOrThrow(resp)) as {
        cells?: readonly Cell[];
      };
      return { ...b, cells: body.cells ?? [] };
    }))
      .then(setMetrics)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [periods]);
  return (
    <section className="an-page" data-test="an-tally">
      <h1 className="an-h1">Tracker &amp; Event Tally</h1>
      <p className="an-sub">
        Built-in event and enrollment counts over the last six
        months. Each column is a reporting period; values are sums
        across every org unit in scope.
      </p>
      {error && <ErrorStrip message={error} />}
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Metric</th>
              {periods.map((p) => (
                <th key={p}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={periods.length + 1} className="an-empty">
                Loading…
              </td></tr>
            )}
            {!loading && metrics.map((m) => (
              <tr key={m.code}>
                <td><strong>{m.label}</strong></td>
                {periods.map((p) => {
                  const total = m.cells
                    .filter((c) => c.periodKey === p)
                    .reduce((a, c) => a + (c.countValue ?? 0), 0);
                  return <td key={p}>{total.toLocaleString()}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${y}${m}`);
  }
  return out;
}

/* ─────────────── Reports ─────────────── */

interface PublicationMapping {
  readonly mappingId: string;
  readonly metricId: string;
  readonly datasetUid: string;
  readonly dataElementUid: string;
  readonly publicationMode: string;
}

interface ProposalStateCounts {
  readonly PROPOSED: number;
  readonly APPROVED: number;
  readonly REJECTED: number;
  readonly PUBLISHED: number;
  readonly RECONCILED: number;
  readonly DIVERGED: number;
}

function ReportsPage(): JSX.Element {
  const [mappings, setMappings] = useState<readonly PublicationMapping[]>([]);
  const [states, setStates] = useState<Partial<ProposalStateCounts>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      fetch(`${API}/publication/mappings`, { credentials: 'include' })
        .then(parseOrThrow)
        .then((r: { mappings?: readonly PublicationMapping[] }) =>
          setMappings(r.mappings ?? [])),
      fetch(`${API}/publication/proposals`, { credentials: 'include' })
        .then(parseOrThrow)
        .then((r: { stateCounts?: ProposalStateCounts }) =>
          setStates(r.stateCounts ?? {})),
    ])
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const byDataset = useMemo(() => {
    const groups = new Map<string, PublicationMapping[]>();
    for (const m of mappings) {
      const g = groups.get(m.datasetUid) ?? [];
      g.push(m);
      groups.set(m.datasetUid, g);
    }
    return Array.from(groups.entries());
  }, [mappings]);
  return (
    <section className="an-page" data-test="an-reports">
      <h1 className="an-h1">Reports</h1>
      <p className="an-sub">
        Publication mappings — one row per DER metric cell that will
        flow into a DHIS2 dataset element. Proposals are reviewed
        here before they reach <code>/api/dataValueSets</code>.
      </p>
      {error && <ErrorStrip message={error} />}
      <div className="an-chips">
        {(Object.keys(states) as Array<keyof ProposalStateCounts>).map((k) => {
          const n = states[k] ?? 0;
          if (n === 0) return null;
          return (
            <span key={k} className="an-chip">
              <strong>{n}</strong> {k.toLowerCase()}
            </span>
          );
        })}
      </div>
      {loading && <p className="an-sub">Loading…</p>}
      {!loading && byDataset.length === 0 && (
        <div className="an-strip an-strip--info">
          No publication mappings yet. Admins create mappings under
          <strong> Administration → Publication</strong>; each mapping
          generates proposals via <code>/admin/publication/proposals</code>.
        </div>
      )}
      {byDataset.map(([ds, rows]) => (
        <div key={ds} className="an-report-group">
          <h2 className="an-h2">Dataset <code>{ds}</code></h2>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Data element</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.mappingId}>
                    <td><code>{m.metricId.slice(0, 8)}</code></td>
                    <td><code>{m.dataElementUid}</code></td>
                    <td>{m.publicationMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ─────────────── Saved (shareable URL) ─────────────── */

function SavedPage(): JSX.Element {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fall-through — operator can still select + copy manually.
    }
  }, [url]);
  return (
    <section className="an-page" data-test="an-saved">
      <h1 className="an-h1">Saved Analytics</h1>
      <p className="an-sub">
        Persisted saved views ship in a later slice. For now, the
        URL below encodes the current section — paste it into a
        chat or a ticket to share the exact view.
      </p>
      <div className="an-form">
        <label className="an-field" style={{ gridColumn: '1 / -1' }}>
          <span className="an-field-label">Current view URL</span>
          <input className="an-input" readOnly value={url}
            onFocus={(e) => e.currentTarget.select()}
            data-test="an-saved-url" />
        </label>
        <div className="an-actions">
          <button type="button" className="an-btn-primary"
            onClick={copy}
            data-test="an-saved-copy">
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
      <div className="an-strip an-strip--info">
        Later slice: persistent named views via a new
        <code> /saved-views </code> endpoint, shareable with other
        operators subject to org-unit scope.
      </div>
    </section>
  );
}

/* ─────────────── Administration ─────────────── */

interface Capability {
  readonly feature: string;
  readonly status: string;
  readonly target?: string;
}

interface DlqStatus {
  readonly totalCount: number;
  readonly gaveUpCount: number;
  readonly worker?: {
    readonly retried: number;
    readonly recovered: number;
    readonly gaveUp: number;
  };
}

interface ColumnarLifecycleStatus {
  readonly state: string;
  readonly generation: number;
  readonly rowsWritten: number;
  readonly rowsVerified: number;
  readonly rowsDrifted: number;
  readonly completedAt?: string | null;
  readonly error?: string | null;
}

function AdminPage(): JSX.Element {
  const [caps, setCaps] = useState<readonly Capability[]>([]);
  const [dlq, setDlq] = useState<DlqStatus | null>(null);
  const [columnar, setColumnar] = useState<ColumnarLifecycleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const loadStatus = useCallback(() => {
    Promise.all([
      fetch(`${API}/capabilities`, { credentials: 'include' })
        .then(parseOrThrow)
        .then((r: { capabilities?: readonly Capability[] }) =>
          setCaps(r.capabilities ?? [])),
      fetch(`${API}/admin/live-dlq?limit=1`, { credentials: 'include' })
        .then(parseOrThrow)
        .then((r: DlqStatus) => setDlq(r))
        .catch(() => { /* non-admin */ }),
      fetch(`${API}/admin/segments/lifecycle`, { credentials: 'include' })
        .then(parseOrThrow)
        .then((r: ColumnarLifecycleStatus) => setColumnar(r))
        .catch(() => { /* non-admin */ }),
    ]).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(loadStatus, [loadStatus]);
  const runAction = useCallback(async (
      label: string, url: string, method: 'POST' | 'GET') => {
    setActionBusy(label);
    setActionResult(null);
    setError(null);
    try {
      const resp = await fetch(`${API}${url}`, {
        method, credentials: 'include',
      });
      const body = await resp.json() as Record<string, unknown>;
      if (!resp.ok) {
        setError(`${label}: HTTP ${resp.status}`);
      } else {
        setActionResult(`${label}: ${JSON.stringify(body)}`);
      }
      loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActionBusy(null);
    }
  }, [loadStatus]);
  return (
    <section className="an-page" data-test="an-admin">
      <h1 className="an-h1">Administration</h1>
      <p className="an-sub">
        Operator-only controls — compatibility matrix, retry queue
        status, and manual-run triggers for the scheduled workers.
      </p>
      {error && <ErrorStrip message={error} />}
      <h2 className="an-h2">Actions</h2>
      <div className="an-admin-actions">
        <AdminButton label="Replay-verify"
          hint="Re-aggregate every cell from the ledger"
          busy={actionBusy === 'Replay-verify'}
          onClick={() => runAction('Replay-verify',
            '/admin/replay-verify', 'POST')} />
        <AdminButton label="Drain publications"
          hint="Push APPROVED proposals to central"
          busy={actionBusy === 'Drain publications'}
          onClick={() => runAction('Drain publications',
            '/admin/publication/drain', 'POST')} />
        <AdminButton label="Build columnar generation"
          hint="Shadow build, verify parity, publish and compact"
          busy={actionBusy === 'Build columnar generation'}
          onClick={() => runAction('Build columnar generation',
            '/admin/segments/run', 'POST')} />
        <AdminButton label="Fetch central samples"
          hint="Poll /api/analytics for PUBLISHED cells"
          busy={actionBusy === 'Fetch central samples'}
          onClick={() => runAction('Fetch central samples',
            '/admin/reconciliation/fetch', 'POST')} />
      </div>
      {actionResult && (
        <pre className="an-pre" data-test="an-admin-result">{actionResult}</pre>
      )}
      <h2 className="an-h2">Columnar lifecycle</h2>
      {columnar && (
        <div className="an-kpi-grid">
          <KpiCard label="State" value={columnar.state}
            tone={columnar.rowsDrifted > 0 || columnar.error
              ? 'danger' : columnar.state === 'PUBLISHED'
                ? 'success' : 'neutral'} />
          <KpiCard label="Generation" value={columnar.generation < 0
            ? '—' : String(columnar.generation)} />
          <KpiCard label="Rows verified"
            value={String(columnar.rowsVerified)} tone="success" />
          <KpiCard label="Rows drifted"
            value={String(columnar.rowsDrifted)}
            tone={columnar.rowsDrifted > 0 ? 'danger' : 'success'} />
        </div>
      )}
      <h2 className="an-h2">Live ingester DLQ</h2>
      {dlq ? (
        <div className="an-kpi-grid">
          <KpiCard label="Entries queued"
            value={String(dlq.totalCount)}
            tone={dlq.totalCount > 0 ? 'warning' : 'success'} />
          <KpiCard label="Gave up"
            value={String(dlq.gaveUpCount)}
            tone={dlq.gaveUpCount > 0 ? 'danger' : 'success'} />
          <KpiCard label="Retried"
            value={String(dlq.worker?.retried ?? 0)} />
          <KpiCard label="Recovered"
            value={String(dlq.worker?.recovered ?? 0)}
            tone="success" />
        </div>
      ) : (
        <p className="an-sub">
          DLQ status requires ADMIN — sign in as an operator with the
          ADMIN role to view queued failures.
        </p>
      )}
      <h2 className="an-h2">Capabilities</h2>
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Support</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {caps.length === 0 && (
              <tr><td colSpan={3} className="an-empty">Loading…</td></tr>
            )}
            {caps.map((c) => (
              <tr key={c.feature}>
                <td>{c.feature}</td>
                <td>
                  <StatusPill tone={supportTone(c.status)}>
                    {c.status}
                  </StatusPill>
                </td>
                <td>{c.target ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminButton({ label, hint, busy, onClick }: {
  label: string;
  hint: string;
  busy: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button type="button" className="an-admin-btn"
      onClick={onClick} disabled={busy}
      data-test={`an-admin-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className="an-admin-btn-label">
        {busy ? 'Running…' : label}
      </span>
      <span className="an-admin-btn-hint">{hint}</span>
    </button>
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

.an-h2 {
  margin: 20px 0 8px 0;
  font-size: 15px; font-weight: 500;
  color: var(--der-ink-900, #111827);
}
.an-report-group { margin-top: 16px; }

.an-admin-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin: 12px 0;
}
.an-admin-btn {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid var(--der-divider, #e5e7eb);
  border-radius: 6px;
  background: var(--der-surface, #ffffff);
  cursor: pointer;
  font: inherit;
}
.an-admin-btn:hover { border-color: var(--der-accent, #1d4ed8); }
.an-admin-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.an-admin-btn-label {
  display: block;
  font-weight: 500;
  color: var(--der-ink-900, #111827);
}
.an-admin-btn-hint {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--der-ink-500, #6b7280);
}
.an-pre {
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--der-surface-subtle, #fafafa);
  border: 1px solid var(--der-divider, #e5e7eb);
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  white-space: pre-wrap;
}
`;
