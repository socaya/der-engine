import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenCard, useAuth, useOnlineStatus, useOrgUnitBinding } from '@der/app-sdk';

const API = '/edge-api/v1/analytics/v1';
type Section = 'explore' | 'catalogue' | 'quality';
type ResultView = 'table' | 'line' | 'bar';
type PeriodType = 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly' | 'Daily';
type ExploreSource = 'metrics' | 'aggregate';

interface MetricRow {
  readonly id: string; readonly code: string; readonly displayName: string;
  readonly analyticsType?: string | null; readonly aggregationType?: string | null;
  readonly dateAnchor?: string | null; readonly orgUnitAnchor?: string | null;
  readonly supportState: string; readonly unsupportedReason?: string | null;
}
interface PeriodRow { readonly id: string; readonly startDate: string; readonly endDate: string; }
interface Cell {
  readonly metricId: string; readonly definitionVersion?: number;
  readonly periodKey: string; readonly orgUnitUid: string; readonly dimensionKey: string;
  readonly dimensions?: Readonly<Record<string, string>>;
  readonly dimensionLabels?: Readonly<Record<string, string>>;
  readonly value?: string | null; readonly countValue?: number | null;
  readonly sumValue?: string | null; readonly freshnessAt?: string | null;
  readonly qualityState?: string | null;
}
interface QueryResult {
  readonly count: number; readonly suppressedCount: number;
  readonly freshnessAt?: string | null; readonly cells: readonly Cell[];
}
interface ExecutedQuery {
  readonly result: QueryResult; readonly metric: MetricRow;
  readonly periods: readonly PeriodRow[]; readonly periodType: PeriodType;
  readonly year: number; readonly orgUnitUid: string; readonly orgUnitLabel: string;
}
interface DrilldownRow {
  readonly sourceKey: string; readonly sourceType: string;
  readonly occurredOn?: string | null; readonly status?: string | null;
  readonly maskedSubjectId?: string | null;
}
interface DrilldownResponse {
  readonly auditId: string; readonly suppressed: boolean; readonly rowCount: number;
  readonly rows: readonly DrilldownRow[]; readonly reason?: string | null;
}
interface QualityResponse {
  readonly qualityCounts?: Readonly<Record<string, number>>;
  readonly contributionsTotal?: number; readonly sourceCursors?: Readonly<Record<string, number>>;
  readonly freshnessAt?: string | null; readonly reportedAt?: string | null;
}
interface ReconciliationRow {
  readonly reconciliationId: string; readonly metricId: string;
  readonly periodKey: string; readonly orgUnitUid: string;
  readonly localValue?: string | null; readonly centralValue?: string | null;
  readonly classification: string; readonly explanation?: string | null;
}
interface PreaggProposal {
  readonly proposalId: string; readonly shapeKey: string;
  readonly observations: number; readonly avgElapsedMillis: number;
  readonly score: number; readonly estimatedBytes: number;
  readonly firstObservedAt: string; readonly lastObservedAt: string;
  readonly rationale: string; readonly state: string;
  readonly decisionReason?: string | null;
}
interface DataSetRow { readonly id: string; readonly displayName?: string; readonly name?: string; readonly periodType?: string; }
interface AggregateField {
  readonly fieldRef: string; readonly dataElementUid: string;
  readonly dataElementDisplayName: string; readonly categoryOptionComboDisplayName?: string | null;
}
interface AggregateForm {
  readonly displayName: string;
  readonly sections: readonly { readonly fields: readonly AggregateField[] }[];
}
interface AggregateRow {
  readonly fieldRef: string; readonly dataElementUid: string;
  readonly dataElementDisplayName: string; readonly categoryOptionComboDisplayName?: string | null;
  readonly orgUnitUid: string; readonly periodIso: string; readonly valueText?: string | null;
  readonly lastUpdatedAt?: string | null;
}
interface AggregateExecution {
  readonly rows: readonly AggregateRow[]; readonly periods: readonly PeriodRow[];
  readonly dataSetId: string; readonly dataSetLabel: string; readonly orgUnitLabel: string;
  readonly loadedAt: string;
}

const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'catalogue', label: 'Data catalogue' },
  { id: 'quality', label: 'Data quality' },
];

export default function AnalyticsApp(): JSX.Element {
  const [section, setSection] = useState<Section>(initialSection());
  const [selectedMetricId, setSelectedMetricId] = useState('');
  useEffect(() => {
    const onHash = () => setSection(initialSection());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((next: Section) => {
    window.location.hash = `#/analytics/${next}`;
    setSection(next);
  }, []);
  const exploreMetric = useCallback((metricId: string) => {
    setSelectedMetricId(metricId);
    go('explore');
  }, [go]);
  return (
    <>
      <style>{STYLES}</style>
      <ScreenCard dataTest="der-analytics-app">
        <div className="an-shell">
          <AppHeader />
          <nav className="an-tabs" aria-label="Analytics sections">
            {SECTIONS.map((item) => (
              <button key={item.id} type="button"
                className={`an-tab ${section === item.id ? 'is-active' : ''}`}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={() => go(item.id)} data-test={`an-nav-${item.id}`}>
                {item.label}
              </button>
            ))}
          </nav>
          <main className="an-main">
            {section === 'explore' && <ExplorePage selectedMetricId={selectedMetricId} onMetricChange={setSelectedMetricId} />}
            {section === 'catalogue' && <CataloguePage onExplore={exploreMetric} />}
            {section === 'quality' && <QualityPage />}
          </main>
        </div>
      </ScreenCard>
    </>
  );
}

function initialSection(): Section {
  const match = /#\/analytics\/(explore|catalogue|quality)/.exec(window.location.hash);
  return (match?.[1] as Section | undefined) ?? 'explore';
}

function AppHeader(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  return (
    <header className="an-appbar" data-test="an-header">
      <div className="an-brand">
        <span className="an-brand-mark" aria-hidden="true">A</span>
        <div><div className="an-brand-title">Analytics</div></div>
      </div>
      <div className="an-app-context">
        <span className="an-context-item"><span className="an-context-label">Organisation unit</span><strong title={ou?.orgUnitPath}>{orgUnitDisplay(ou)}</strong></span>
        <span className="an-context-item an-context-user"><span className="an-context-label">Signed in as</span><span>{auth?.displayName ?? '—'}</span></span>
        <span className={`an-connection ${online?.isOnline ? 'is-online' : ''}`}><span className="an-status-dot" aria-hidden="true" />{online?.isOnline ? 'Online' : 'Offline'}</span>
      </div>
    </header>
  );
}

function ExplorePage({ selectedMetricId, onMetricChange }: {
  selectedMetricId: string; onMetricChange: (metricId: string) => void;
}): JSX.Element {
  const [source, setSource] = useState<ExploreSource>('metrics');
  return <section className="an-page" data-test="an-explore">
    <PageHeading title="Explore" />
    <div className="an-source-tabs" role="tablist" aria-label="Data source">
      <button type="button" role="tab" aria-selected={source === 'metrics'}
        className={source === 'metrics' ? 'is-active' : ''} onClick={() => setSource('metrics')}>Indicator metrics</button>
      <button type="button" role="tab" aria-selected={source === 'aggregate'}
        className={source === 'aggregate' ? 'is-active' : ''} onClick={() => setSource('aggregate')}>Aggregate data</button>
    </div>
    {source === 'metrics'
      ? <MetricExplore selectedMetricId={selectedMetricId} onMetricChange={onMetricChange} />
      : <AggregateExplore />}
  </section>;
}

function MetricExplore({ selectedMetricId, onMetricChange }: {
  selectedMetricId: string; onMetricChange: (metricId: string) => void;
}): JSX.Element {
  const ou = useOrgUnitBinding();
  const now = new Date();
  const [metrics, setMetrics] = useState<readonly MetricRow[]>([]);
  const [periodType, setPeriodType] = useState<PeriodType>('Monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [periods, setPeriods] = useState<readonly PeriodRow[]>([]);
  const [fromPeriod, setFromPeriod] = useState('');
  const [toPeriod, setToPeriod] = useState('');
  const [execution, setExecution] = useState<ExecutedQuery | null>(null);
  const [view, setView] = useState<ResultView>('table');
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingMeta(true);
    fetch(`${API}/metrics?limit=500`, { credentials: 'include' })
      .then(parseOrThrow).then((body: unknown) => {
        const data = body as { metrics?: readonly MetricRow[] };
        setMetrics(data.metrics ?? []);
        if (!selectedMetricId && data.metrics?.length) onMetricChange(data.metrics[0].id);
      }).catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoadingMeta(false));
  }, [onMetricChange, selectedMetricId]);

  useEffect(() => {
    setLoadingMeta(true); setError(null);
    fetch(`${API}/periods?type=${periodType}&year=${year}`, { credentials: 'include' })
      .then(parseOrThrow).then((body: unknown) => {
        const next = (body as { periods?: readonly PeriodRow[] }).periods ?? [];
        setPeriods(next);
        const end = Math.max(0, next.length - 1);
        const start = Math.max(0, end - Math.min(11, end));
        setFromPeriod(next[start]?.id ?? ''); setToPeriod(next[end]?.id ?? '');
      }).catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoadingMeta(false));
  }, [periodType, year]);

  const chosenPeriods = useMemo(() => {
    const first = periods.findIndex((p) => p.id === fromPeriod);
    const last = periods.findIndex((p) => p.id === toPeriod);
    if (first < 0 || last < 0) return [];
    return periods.slice(Math.min(first, last), Math.max(first, last) + 1);
  }, [periods, fromPeriod, toPeriod]);
  const canRun = Boolean(selectedMetricId && ou?.orgUnitUid && chosenPeriods.length && !busy);

  const runQuery = useCallback(async () => {
    if (!canRun) return;
    setBusy(true); setError(null); setSelectedCell(null);
    try {
      const response = await fetch(`${API}/timeseries`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: [selectedMetricId],
          periods: chosenPeriods.map((p) => ({ type: periodType, id: p.id })),
          orgUnits: [ou.orgUnitUid], dimensions: {}, page: { limit: 2000, offset: 0 } }),
      });
      const body = await parseOrThrow(response) as QueryResult;
      const queryResult = { count: body.count ?? body.cells?.length ?? 0,
        suppressedCount: body.suppressedCount ?? 0, freshnessAt: body.freshnessAt,
        cells: body.cells ?? [] };
      const metric = metrics.find((item) => item.id === selectedMetricId) ?? {
        id: selectedMetricId, code: selectedMetricId, displayName: 'Selected metric',
        supportState: 'UNKNOWN',
      };
      setExecution({ result: queryResult, metric, periods: [...chosenPeriods],
        periodType, year, orgUnitUid: ou.orgUnitUid, orgUnitLabel: orgUnitDisplay(ou) });
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }, [canRun, chosenPeriods, metrics, ou, periodType, selectedMetricId, year]);

  const exportCsv = useCallback(() => {
    if (!execution?.result.cells.length) return;
    const records = execution.result.cells.map((c) => [c.periodKey, execution.orgUnitLabel, dimensionText(c), displayValue(c), c.qualityState ?? '']);
    const csv = [['Period', 'Organisation unit', 'Dimensions', 'Value', 'Quality'], ...records]
      .map((row) => row.map(csvValue).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `der-analytics-${execution.metric.code}-${execution.year}.csv`; link.click(); URL.revokeObjectURL(url);
  }, [execution]);
  const selectedMetric = metrics.find((m) => m.id === selectedMetricId);
  const result = execution?.result ?? null;
  const controlsChanged = Boolean(execution && (
    execution.metric.id !== selectedMetricId
    || execution.periodType !== periodType || execution.year !== year
    || execution.orgUnitUid !== ou.orgUnitUid
    || execution.periods.map((period) => period.id).join('|')
      !== chosenPeriods.map((period) => period.id).join('|')));

  return (
    <div className="an-explore-source" data-test="an-metric-explore">
      <div className="an-querybar" aria-label="Query configuration">
        <label className="an-control an-control--metric"><span>Metric</span>
          <select value={selectedMetricId} onChange={(e) => onMetricChange(e.target.value)} disabled={loadingMeta} data-test="an-query-metric">
            {!metrics.length && <option value="">No metrics available</option>}
            {metrics.map((m) => <option key={m.id} value={m.id} disabled={m.supportState === 'UNSUPPORTED'}>{m.displayName} ({m.code})</option>)}
          </select>
        </label>
        <label className="an-control"><span>Period type</span>
          <select value={periodType} onChange={(e) => setPeriodType(e.target.value as PeriodType)}>
            {(['Monthly', 'Weekly', 'Quarterly', 'Yearly', 'Daily'] as const).map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="an-control an-control--year"><span>Year</span><input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label className="an-control"><span>From</span><select value={fromPeriod} onChange={(e) => setFromPeriod(e.target.value)}>{periods.map((p) => <option key={p.id} value={p.id} title={`${p.startDate} – ${p.endDate}`}>{periodLabel(p)}</option>)}</select></label>
        <label className="an-control"><span>To</span><select value={toPeriod} onChange={(e) => setToPeriod(e.target.value)}>{periods.map((p) => <option key={p.id} value={p.id} title={`${p.startDate} – ${p.endDate}`}>{periodLabel(p)}</option>)}</select></label>
        <div className="an-control an-control--ou"><span>Organisation unit</span><strong title={ou?.orgUnitPath}>{orgUnitDisplay(ou)}</strong></div>
        <button type="button" className="an-primary-button" onClick={runQuery} disabled={!canRun} data-test="an-query-run">{busy ? 'Running…' : 'Run query'}</button>
      </div>
      {error && <Message kind="error">{error}</Message>}
      <div className="an-workspace">
        <aside className="an-query-summary" aria-label="Current query">
          <SectionHeading title="Current query" />
          <dl><div><dt>Metric</dt><dd>{selectedMetric?.displayName ?? 'Select a metric'}</dd></div>
            <div><dt>Aggregation</dt><dd>{humanize(selectedMetric?.aggregationType) || '—'}</dd></div>
            <div><dt>Period range</dt><dd>{chosenPeriods.length ? `${periodLabel(chosenPeriods[0])} – ${periodLabel(chosenPeriods.at(-1))}` : 'Select a period range'}</dd></div>
            <div><dt>Periods</dt><dd>{chosenPeriods.length}</dd></div>
            <div><dt>Organisation unit</dt><dd>{orgUnitDisplay(ou)}</dd></div></dl>
        </aside>
        <div className="an-results">
          {!result && !busy && <EmptyState title="Run a query to view results">Choose a metric and period range, then run the query. Results can be viewed as a table, line chart, or bar chart.</EmptyState>}
          {busy && <LoadingState text="Running analytics query…" />}
          {result && !busy && <>
            {controlsChanged && <div className="an-stale-notice">Query controls changed. These results remain from <strong>{execution?.metric.displayName}</strong>. Run the query to update them.</div>}
            <div className="an-result-head"><div><h2>Results · {execution?.metric.displayName}</h2><p>{result.count} {result.count === 1 ? 'cell' : 'cells'} · {result.suppressedCount} suppressed · {execution?.periods.length} periods · Data as of {formatDateTime(latestFreshness(result))}</p></div>
              <button type="button" className="an-secondary-button" onClick={exportCsv} disabled={!result.cells.length}>Export CSV</button></div>
            <div className="an-view-tabs" role="tablist" aria-label="Result view">
              {(['table', 'line', 'bar'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? 'is-active' : ''} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
            </div>
            {!result.cells.length ? <EmptyState title="No data for this query">Try another metric or period range.</EmptyState> : <>
              {view === 'table' && <ResultsTable cells={result.cells} selected={selectedCell} onSelect={setSelectedCell} />}
              {view !== 'table' && <ResultChart kind={view} cells={result.cells} selected={selectedCell} onSelect={setSelectedCell} />}
            </>}
          </>}
        </div>
      </div>
      {selectedCell && execution && <CellDetail cell={selectedCell} metricName={execution.metric.displayName} onClose={() => setSelectedCell(null)} />}
    </div>
  );
}

function AggregateExplore(): JSX.Element {
  const ou = useOrgUnitBinding();
  const currentYear = new Date().getFullYear();
  const [dataSets, setDataSets] = useState<readonly DataSetRow[]>([]);
  const [dataSetId, setDataSetId] = useState('');
  const [form, setForm] = useState<AggregateForm | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>('Monthly');
  const [year, setYear] = useState(currentYear);
  const [periods, setPeriods] = useState<readonly PeriodRow[]>([]);
  const [fromPeriod, setFromPeriod] = useState('');
  const [toPeriod, setToPeriod] = useState('');
  const [execution, setExecution] = useState<AggregateExecution | null>(null);
  const [view, setView] = useState<ResultView>('table');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ fields: 'id,displayName,name,periodType', paging: 'false' });
    if (ou?.orgUnitUid) params.set('orgUnit', ou.orgUnitUid);
    fetch(`/api/dataSets?${params}`, { credentials: 'include' })
      .then(parseOrThrow).then((body: unknown) => {
        const rows = (body as { dataSets?: readonly DataSetRow[] }).dataSets ?? [];
        setDataSets(rows);
        if (rows.length && !dataSetId) setDataSetId(rows[0].id);
      }).catch((cause: unknown) => setError(errorMessage(cause)));
  }, [dataSetId, ou?.orgUnitUid]);

  useEffect(() => {
    if (!dataSetId) { setForm(null); return; }
    fetch(`/edge-api/v1/capture/datasets/${encodeURIComponent(dataSetId)}/form`,
      { credentials: 'include' })
      .then(parseOrThrow).then((body: unknown) => setForm(body as AggregateForm))
      .catch((cause: unknown) => { setForm(null); setError(errorMessage(cause)); });
  }, [dataSetId]);

  useEffect(() => {
    const selected = dataSets.find((item) => item.id === dataSetId);
    const nextType = normalizePeriodType(selected?.periodType);
    if (nextType !== periodType) setPeriodType(nextType);
  }, [dataSetId, dataSets, periodType]);

  useEffect(() => {
    fetch(`${API}/periods?type=${periodType}&year=${year}`, { credentials: 'include' })
      .then(parseOrThrow).then((body: unknown) => {
        const next = (body as { periods?: readonly PeriodRow[] }).periods ?? [];
        setPeriods(next);
        const end = Math.max(0, next.length - 1);
        const start = Math.max(0, end - Math.min(11, end));
        setFromPeriod(next[start]?.id ?? ''); setToPeriod(next[end]?.id ?? '');
      }).catch((cause: unknown) => setError(errorMessage(cause)));
  }, [periodType, year]);

  const chosenPeriods = useMemo(() => {
    const first = periods.findIndex((period) => period.id === fromPeriod);
    const last = periods.findIndex((period) => period.id === toPeriod);
    if (first < 0 || last < 0) return [];
    return periods.slice(Math.min(first, last), Math.max(first, last) + 1);
  }, [periods, fromPeriod, toPeriod]);
  const selectedDataSet = dataSets.find((item) => item.id === dataSetId);
  const canRun = Boolean(ou?.orgUnitUid && dataSetId && form && chosenPeriods.length && !busy);

  const runQuery = useCallback(async () => {
    if (!canRun) return;
    setBusy(true); setError(null);
    try {
      const fields = new Map((form?.sections ?? []).flatMap((section) => section.fields)
        .map((field) => [field.fieldRef, field]));
      const responses = await Promise.all(chosenPeriods.map(async (period) => {
        const params = new URLSearchParams({ orgUnit: ou.orgUnitUid, period: period.id,
        });
        const body = await parseOrThrow(await fetch(
          `/edge-api/v1/capture/datasets/${encodeURIComponent(dataSetId)}/data?${params}`,
          { credentials: 'include' })) as { cells?: Readonly<Record<string, string>>; lastUpdatedAt?: string | null };
        return Object.entries(body.cells ?? {}).flatMap(([fieldRef, valueText]) => {
          const field = fields.get(fieldRef);
          if (!field) return [];
          return [{ fieldRef, dataElementUid: field.dataElementUid,
            dataElementDisplayName: field.dataElementDisplayName,
            categoryOptionComboDisplayName: field.categoryOptionComboDisplayName,
            orgUnitUid: ou.orgUnitUid, periodIso: period.id, valueText,
            lastUpdatedAt: body.lastUpdatedAt } satisfies AggregateRow];
        });
      }));
      const rows = responses.flat();
      setExecution({ rows, periods: [...chosenPeriods], dataSetId,
        dataSetLabel: form?.displayName ?? selectedDataSet?.displayName ?? selectedDataSet?.name ?? dataSetId,
        orgUnitLabel: orgUnitDisplay(ou), loadedAt: new Date().toISOString() });
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }, [canRun, chosenPeriods, dataSetId, form, ou, selectedDataSet]);

  const changed = Boolean(execution && (execution.dataSetId !== dataSetId
    || execution.periods.map((period) => period.id).join('|')
      !== chosenPeriods.map((period) => period.id).join('|')));

  const exportCsv = useCallback(() => {
    if (!execution?.rows.length) return;
    const records = execution.rows.map((row) => [execution.dataSetLabel,
      row.dataElementDisplayName, row.dataElementUid, row.periodIso,
      row.valueText ?? '', row.lastUpdatedAt ?? '']);
    const csv = [['Data set', 'Data element', 'Data element UID', 'Period', 'Value', 'Last updated'], ...records]
      .map((row) => row.map(csvValue).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `der-aggregate-${execution.dataSetId}-${year}.csv`; link.click(); URL.revokeObjectURL(url);
  }, [execution, year]);

  return <div className="an-explore-source" data-test="an-aggregate-explore">
    <div className="an-querybar an-querybar--aggregate" aria-label="Aggregate query configuration">
      <label className="an-control an-control--metric"><span>Data set</span><select value={dataSetId} onChange={(event) => setDataSetId(event.target.value)}>
        {!dataSets.length && <option value="">No data sets available</option>}
        {dataSets.map((item) => <option key={item.id} value={item.id}>{item.displayName ?? item.name ?? item.id}</option>)}
      </select></label>
      <label className="an-control an-control--year"><span>Year</span><input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
      <label className="an-control"><span>From</span><select value={fromPeriod} onChange={(event) => setFromPeriod(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{periodLabel(period)}</option>)}</select></label>
      <label className="an-control"><span>To</span><select value={toPeriod} onChange={(event) => setToPeriod(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{periodLabel(period)}</option>)}</select></label>
      <div className="an-control an-control--ou"><span>Organisation unit</span><strong title={ou?.orgUnitPath}>{orgUnitDisplay(ou)}</strong></div>
      <button type="button" className="an-primary-button" onClick={runQuery} disabled={!canRun}>{busy ? 'Running…' : 'Run query'}</button>
    </div>
    <p className="an-helper">Calculated indicators are available under Indicator metrics.</p>
    {error && <Message kind="error">{error}</Message>}
    <div className="an-results an-results--standalone">
      {!execution && !busy && <EmptyState title="Run a query to browse aggregate data">Select a data set and period range.</EmptyState>}
      {busy && <LoadingState text="Loading aggregate data…" />}
      {execution && !busy && <>
        {changed && <div className="an-stale-notice">Query controls changed. These results remain from <strong>{execution.dataSetLabel}</strong>. Run the query to update them.</div>}
        <div className="an-result-head"><div><h2>{execution.dataSetLabel}</h2><p>{execution.rows.length} values · {execution.periods.length} periods · Loaded {formatDateTime(execution.loadedAt)}</p></div>
          <button type="button" className="an-secondary-button" onClick={exportCsv} disabled={!execution.rows.length}>Export CSV</button></div>
        <div className="an-view-tabs" role="tablist" aria-label="Aggregate result view">
          {(['table', 'line', 'bar'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? 'is-active' : ''} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
        {!execution.rows.length ? <EmptyState title="No aggregate values found">No captured values match this data set and period range.</EmptyState>
          : view === 'table' ? <AggregateTable execution={execution} /> : <AggregateChart kind={view} rows={execution.rows} />}
      </>}
    </div>
  </div>;
}

function AggregateTable({ execution }: { execution: AggregateExecution }): JSX.Element {
  const labels = new Map(execution.periods.map((period) => [period.id, periodLabel(period)]));
  return <div className="an-table-wrap"><table className="an-table an-aggregate-table">
    <thead><tr><th>Data element</th><th>Period</th><th className="an-numeric">Value</th><th>Sync state</th></tr></thead>
    <tbody>{execution.rows.map((row) => <tr key={row.valueId}><td><code>{row.dataElementUid}</code></td>
      <td>{labels.get(row.periodIso) ?? row.periodIso}</td><td className="an-numeric an-value">{row.valueText ?? '—'}</td>
      <td><QualityText state={row.syncState} /></td></tr>)}</tbody>
  </table></div>;
}

function AggregateChart({ kind, rows }: { kind: 'line' | 'bar'; rows: readonly AggregateRow[] }): JSX.Element {
  const cells = rows.map((row): Cell => ({ metricId: row.dataElementUid, periodKey: row.periodIso,
    orgUnitUid: row.orgUnitUid, dimensionKey: '', value: row.valueText ?? null }));
  const points = aggregateByPeriod(cells); const width = 760; const height = 300;
  const left = 54; const top = 22; const right = 18; const bottom = 54;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const max = Math.max(1, ...points.map((point) => point.value));
  const x = (index: number) => points.length <= 1 ? left + plotWidth / 2 : left + index / (points.length - 1) * plotWidth;
  const y = (value: number) => top + plotHeight - value / max * plotHeight;
  const barSpace = plotWidth / Math.max(1, points.length); const barWidth = Math.min(42, barSpace * .62);
  return <div className="an-chart-wrap"><svg className="an-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${kind} chart of aggregate values by period`}>
    {[0, .25, .5, .75, 1].map((ratio) => { const gridY = top + plotHeight - ratio * plotHeight;
      return <g key={ratio}><line x1={left} x2={width - right} y1={gridY} y2={gridY} className="an-chart-grid" /><text x={left - 8} y={gridY + 4} textAnchor="end" className="an-chart-axis">{formatNumber(max * ratio)}</text></g>; })}
    {kind === 'line' && points.length > 1 && <polyline points={points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')} className="an-chart-line" />}
    {points.map((point, index) => { const centre = kind === 'bar' ? left + barSpace * index + barSpace / 2 : x(index);
      return <g key={point.period} className="an-chart-mark an-chart-mark--static">
        {kind === 'bar' ? <rect x={centre - barWidth / 2} y={y(point.value)} width={barWidth} height={Math.max(1, top + plotHeight - y(point.value))} />
          : <circle cx={centre} cy={y(point.value)} r={4} />}
        <text x={centre} y={height - 24} textAnchor="middle" className="an-chart-label">{shortPeriod(point.period)}</text>
        <title>{point.period}: {formatNumber(point.value)}</title></g>; })}
  </svg><p className="an-chart-help">Numeric aggregate values are summed by period; non-numeric values remain available in the table.</p></div>;
}

function ResultsTable({ cells, selected, onSelect }: {
  cells: readonly Cell[]; selected: Cell | null; onSelect: (cell: Cell) => void;
}): JSX.Element {
  return <div className="an-table-wrap"><table className="an-table">
    <thead><tr><th>Period</th><th>Dimensions</th><th className="an-numeric">Value</th><th>Quality</th><th><span className="an-visually-hidden">Details</span></th></tr></thead>
    <tbody>{cells.map((cell, index) => <tr key={cellKey(cell, index)} className={selected === cell ? 'is-selected' : undefined}>
      <td>{cell.periodKey}</td><td>{dimensionText(cell) || 'All data'}</td>
      <td className="an-numeric an-value">{displayValue(cell)}</td><td><QualityText state={cell.qualityState} /></td>
      <td className="an-row-action"><button type="button" onClick={() => onSelect(cell)} aria-label={`Inspect ${cell.periodKey} result`}>Inspect</button></td>
    </tr>)}</tbody>
  </table></div>;
}

function ResultChart({ kind, cells, selected, onSelect }: {
  kind: 'line' | 'bar'; cells: readonly Cell[]; selected: Cell | null;
  onSelect: (cell: Cell) => void;
}): JSX.Element {
  const points = useMemo(() => aggregateByPeriod(cells), [cells]);
  const width = 760; const height = 300; const left = 54; const top = 22;
  const right = 18; const bottom = 54; const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(1, ...points.map((point) => point.value));
  const x = (index: number) => points.length <= 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const barSpace = plotWidth / Math.max(1, points.length);
  const barWidth = Math.min(42, barSpace * .62);
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  return <div className="an-chart-wrap">
    <svg className="an-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${kind} chart of query values by period`}>
      {[0, .25, .5, .75, 1].map((ratio) => {
        const gridY = top + plotHeight - ratio * plotHeight;
        return <g key={ratio}><line x1={left} x2={width - right} y1={gridY} y2={gridY} className="an-chart-grid" />
          <text x={left - 8} y={gridY + 4} textAnchor="end" className="an-chart-axis">{formatNumber(max * ratio)}</text></g>;
      })}
      {kind === 'line' && points.length > 1 && <polyline points={line} className="an-chart-line" />}
      {points.map((point, index) => {
        const isSelected = point.cells.includes(selected as Cell);
        const centre = kind === 'bar' ? left + barSpace * index + barSpace / 2 : x(index);
        const choose = () => onSelect(point.cells[0]);
        return <g key={point.period} className="an-chart-mark" role="button" tabIndex={0}
          aria-label={`${point.period}: ${formatNumber(point.value)}`} onClick={choose}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }}>
          {kind === 'bar'
            ? <rect x={centre - barWidth / 2} y={y(point.value)} width={barWidth}
                height={Math.max(1, top + plotHeight - y(point.value))} className={isSelected ? 'is-selected' : undefined} />
            : <circle cx={centre} cy={y(point.value)} r={isSelected ? 6 : 4} className={isSelected ? 'is-selected' : undefined} />}
          <text x={centre} y={height - 24} textAnchor="middle" className="an-chart-label">{shortPeriod(point.period)}</text>
          <title>{point.period}: {formatNumber(point.value)}</title>
        </g>;
      })}
    </svg><p className="an-chart-help">Select a point or bar to inspect its analytics cell.</p>
  </div>;
}

function CellDetail({ cell, metricName, onClose }: {
  cell: Cell; metricName: string; onClose: () => void;
}): JSX.Element {
  const [purpose, setPurpose] = useState('Analytics result review');
  const [result, setResult] = useState<DrilldownResponse | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { setResult(null); setError(null); }, [cell]);
  const openLineage = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${API}/drilldown`, { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          metricId: cell.metricId, periodKey: cell.periodKey, orgUnitUid: cell.orgUnitUid,
          dimensionKey: cell.dimensionKey, purpose, limit: 100,
        }) });
      const body = await response.json() as DrilldownResponse;
      if (!response.ok) throw new Error(body.reason ?? `HTTP ${response.status}`);
      setResult(body);
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }, [cell, purpose]);
  return <section className="an-detail" aria-label="Result details">
    <div className="an-section-head"><div><h2>Result details</h2><p>{metricName} · {cell.periodKey}</p></div><button type="button" className="an-text-button" onClick={onClose}>Close</button></div>
    <dl className="an-detail-grid"><div><dt>Value</dt><dd>{displayValue(cell)}</dd></div>
      <div><dt>Dimensions</dt><dd>{dimensionText(cell) || 'All data'}</dd></div>
      <div><dt>Quality</dt><dd><QualityText state={cell.qualityState} /></dd></div>
      <div><dt>Freshness</dt><dd>{formatDateTime(cell.freshnessAt)}</dd></div></dl>
    {!result && <div className="an-lineage-controls"><label className="an-control"><span>Reason for opening source records</span>
      <input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
      <button type="button" className="an-secondary-button" onClick={openLineage} disabled={!purpose.trim() || busy}>{busy ? 'Opening…' : 'Open contributing records'}</button></div>}
    {error && <Message kind="error">{error}</Message>}
    {result?.suppressed && <Message kind="warning">Source records are hidden because this cell is below the privacy threshold.</Message>}
    {result && !result.suppressed && <div className="an-table-wrap an-lineage-table"><table className="an-table">
      <thead><tr><th>Source</th><th>Type</th><th>Occurred</th><th>Status</th><th>Subject</th></tr></thead>
      <tbody>{result.rows.map((row) => <tr key={row.sourceKey}><td><code>{row.sourceKey}</code></td><td>{humanize(row.sourceType)}</td><td>{row.occurredOn ?? '—'}</td><td>{humanize(row.status)}</td><td>{row.maskedSubjectId ?? '—'}</td></tr>)}
      {!result.rows.length && <tr><td colSpan={5} className="an-empty-cell">No contributing records.</td></tr>}</tbody>
    </table></div>}
  </section>;
}

function CataloguePage({ onExplore }: { onExplore: (metricId: string) => void }): JSX.Element {
  const [metrics, setMetrics] = useState<readonly MetricRow[]>([]);
  const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch(`${API}/metrics?limit=500`, { credentials: 'include' })
    .then(parseOrThrow).then((body: unknown) => setMetrics((body as { metrics?: readonly MetricRow[] }).metrics ?? []))
    .catch((cause: unknown) => setError(errorMessage(cause))).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase(); if (!term) return metrics;
    return metrics.filter((metric) => [metric.displayName, metric.code, metric.analyticsType, metric.aggregationType]
      .some((value) => value?.toLowerCase().includes(term)));
  }, [metrics, search]);
  return <section className="an-page" data-test="an-catalogue">
    <div className="an-page-heading an-page-heading--with-tool"><div><h1>Data catalogue</h1><p>Browse the metrics available for local analysis.</p></div>
      <label className="an-search"><span className="an-visually-hidden">Search data catalogue</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code" /></label></div>
    {error && <Message kind="error">{error}</Message>}
    {loading ? <LoadingState text="Loading data catalogue…" /> : <div className="an-table-wrap"><table className="an-table an-catalogue-table">
      <thead><tr><th>Metric</th><th>Type</th><th>Aggregation</th><th>Availability</th><th /></tr></thead>
      <tbody>{filtered.map((metric) => <tr key={metric.id}>
        <td><strong>{metric.displayName}</strong><span className="an-cell-meta">{metric.code}</span></td>
        <td>{humanize(metric.analyticsType) || '—'}</td><td>{humanize(metric.aggregationType) || '—'}</td>
        <td><AvailabilityText metric={metric} /></td><td className="an-row-action"><button type="button" onClick={() => onExplore(metric.id)} disabled={metric.supportState === 'UNSUPPORTED'}>Use in Explore</button></td>
      </tr>)}
      {!filtered.length && <tr><td colSpan={5} className="an-empty-cell">{metrics.length ? 'No metrics match your search.' : 'No analytics metrics are available.'}</td></tr>}</tbody>
    </table></div>}
  </section>;
}

function QualityPage(): JSX.Element {
  const auth = useAuth();
  const isAdmin = Boolean(auth?.roles?.includes('ADMIN'));
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [rows, setRows] = useState<readonly ReconciliationRow[]>([]);
  const [classifications, setClassifications] = useState<Readonly<Record<string, number>>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { Promise.all([
    fetch(`${API}/quality`, { credentials: 'include' }).then(parseOrThrow),
    fetch(`${API}/reconciliation?limit=200`, { credentials: 'include' }).then(parseOrThrow),
  ]).then(([q, r]) => { const rec = r as { rows?: readonly ReconciliationRow[]; byClassification?: Readonly<Record<string, number>> };
    setQuality(q as QualityResponse); setRows(rec.rows ?? []); setClassifications(rec.byClassification ?? {});
  }).catch((cause: unknown) => setError(errorMessage(cause))).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState text="Loading data quality…" />;
  return <section className="an-page" data-test="an-quality">
    <PageHeading title="Data quality" subtitle="Read-only freshness and comparison information for local analytics." />
    {error && <Message kind="error">{error}</Message>}
    <section className="an-quality-summary" aria-labelledby="quality-summary-title"><SectionHeading title="Local analytics status" id="quality-summary-title" />
      <dl><div><dt>Data as of</dt><dd>{formatDateTime(quality?.freshnessAt)}</dd></div>
        <div><dt>Contributions</dt><dd>{(quality?.contributionsTotal ?? 0).toLocaleString()}</dd></div>
        <div><dt>Quality states</dt><dd>{sumValues(quality?.qualityCounts).toLocaleString()}</dd></div>
        <div><dt>Source streams</dt><dd>{Object.keys(quality?.sourceCursors ?? {}).length}</dd></div></dl></section>
    <section className="an-quality-section" aria-labelledby="quality-states-title"><SectionHeading title="Quality states" id="quality-states-title" />
      <div className="an-inline-stats">{Object.entries(quality?.qualityCounts ?? {}).map(([state, count]) => <span key={state}><QualityText state={state} /> <strong>{count}</strong></span>)}
        {!Object.keys(quality?.qualityCounts ?? {}).length && <span>No quality states reported.</span>}</div></section>
    <section className="an-quality-section" aria-labelledby="reconciliation-title">
      <div className="an-section-head"><div><h2 id="reconciliation-title">Central comparison</h2><p>{rows.length} comparison {rows.length === 1 ? 'record' : 'records'}</p></div>
        <div className="an-inline-stats an-inline-stats--compact">{Object.entries(classifications).filter(([, n]) => n > 0).map(([state, n]) => <span key={state}><QualityText state={state} /> <strong>{n}</strong></span>)}</div></div>
      <div className="an-table-wrap"><table className="an-table"><thead><tr><th>Metric</th><th>Period</th><th>Local</th><th>Central</th><th>Classification</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.reconciliationId} title={row.explanation ?? undefined}><td><code>{row.metricId.slice(0, 8)}</code></td><td>{row.periodKey}</td><td className="an-numeric">{row.localValue ?? '—'}</td><td className="an-numeric">{row.centralValue ?? '—'}</td><td><QualityText state={row.classification} /></td></tr>)}
        {!rows.length && <tr><td colSpan={5} className="an-empty-cell">No comparison records are available.</td></tr>}</tbody></table></div>
    </section>
    {isAdmin && <PreaggProposalsSection />}
  </section>;
}

function PreaggProposalsSection(): JSX.Element {
  const [proposals, setProposals] = useState<readonly PreaggProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/admin/preagg/proposals?limit=50`, { credentials: 'include' })
      .then(parseOrThrow)
      .then((r) => setProposals(((r as { proposals?: readonly PreaggProposal[] }).proposals) ?? []))
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const trigger = useCallback(async (path: string, init?: RequestInit) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(path, { credentials: 'include', ...init });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      load();
    } catch (cause: unknown) { setError(errorMessage(cause)); setBusy(false); }
  }, [load]);
  const propose = () => trigger(`${API}/admin/preagg/propose`, { method: 'POST' });
  const decide = (id: string, action: 'approve' | 'reject') =>
    trigger(`${API}/admin/preagg/proposals/${id}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
  return <section className="an-quality-section" aria-labelledby="preagg-title" data-test="an-preagg">
    <div className="an-section-head">
      <div><h2 id="preagg-title">Preaggregation proposals</h2><p>{proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'}</p></div>
      <button type="button" className="an-text-button" onClick={propose} disabled={busy} data-test="an-preagg-propose">Run proposer</button>
    </div>
    {error && <Message kind="error">{error}</Message>}
    {loading ? <div className="an-inline-stats"><span>Loading…</span></div> : (
      <div className="an-table-wrap"><table className="an-table"><thead><tr><th>Shape</th><th>Observations</th><th>Avg ms</th><th>Score</th><th>State</th><th aria-label="Actions" /></tr></thead>
        <tbody>{proposals.map((p) => <tr key={p.proposalId}>
          <td title={p.rationale}><code>{p.shapeKey.slice(0, 10)}</code></td>
          <td className="an-numeric">{p.observations.toLocaleString()}</td>
          <td className="an-numeric">{p.avgElapsedMillis.toFixed(1)}</td>
          <td className="an-numeric">{p.score.toFixed(0)}</td>
          <td>{p.state}</td>
          <td>{p.state === 'PROPOSED'
            ? <><button type="button" className="an-text-button" onClick={() => decide(p.proposalId, 'approve')} disabled={busy}>Approve</button>
              <button type="button" className="an-text-button" onClick={() => decide(p.proposalId, 'reject')} disabled={busy}>Reject</button></>
            : <span>—</span>}</td>
        </tr>)}
        {!proposals.length && <tr><td colSpan={6} className="an-empty-cell">No proposals yet.</td></tr>}</tbody></table></div>
    )}
  </section>;
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return <div className="an-page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}
function SectionHeading({ title, id }: { title: string; id?: string }): JSX.Element {
  return <div className="an-section-head"><h2 id={id}>{title}</h2></div>;
}
function EmptyState({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return <div className="an-empty-state"><strong>{title}</strong><p>{children}</p></div>;
}
function LoadingState({ text }: { text: string }): JSX.Element {
  return <div className="an-loading" role="status"><span />{text}</div>;
}
function Message({ kind, children }: { kind: 'error' | 'warning'; children: React.ReactNode }): JSX.Element {
  return <div className={`an-message an-message--${kind}`} role="alert">{children}</div>;
}
function QualityText({ state }: { state?: string | null }): JSX.Element {
  const normalized = state || 'UNKNOWN'; const tone = qualityTone(normalized);
  return <span className={`an-status-text an-status-text--${tone}`}><span className="an-status-dot" aria-hidden="true" />{humanize(normalized)}</span>;
}
function AvailabilityText({ metric }: { metric: MetricRow }): JSX.Element {
  const unavailable = metric.supportState === 'UNSUPPORTED';
  return <span className={`an-status-text ${unavailable ? 'an-status-text--danger' : 'an-status-text--success'}`} title={metric.unsupportedReason ?? undefined}>
    <span className="an-status-dot" aria-hidden="true" />{unavailable ? (metric.unsupportedReason || 'Not available') : 'Available locally'}
  </span>;
}

function aggregateByPeriod(cells: readonly Cell[]): Array<{ period: string; value: number; cells: Cell[] }> {
  const map = new Map<string, { value: number; cells: Cell[] }>();
  for (const cell of cells) {
    const current = map.get(cell.periodKey) ?? { value: 0, cells: [] };
    const value = numericValue(cell); current.value += Number.isFinite(value) ? value : 0;
    current.cells.push(cell); map.set(cell.periodKey, current);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, ...value }));
}
function numericValue(cell: Cell): number {
  const value = cell.value ?? cell.countValue ?? cell.sumValue;
  return value == null ? 0 : Number(value);
}
function displayValue(cell: Cell): string {
  if (cell.qualityState === 'SUPPRESSED') return 'Suppressed';
  const value = cell.value ?? cell.countValue ?? cell.sumValue;
  if (value == null) return '—'; const numeric = Number(value);
  return Number.isFinite(numeric) ? formatNumber(numeric) : String(value);
}
function dimensionText(cell: Cell): string {
  const values = cell.dimensionLabels ?? cell.dimensions;
  if (values && Object.keys(values).length) return Object.entries(values).map(([k, v]) => `${humanize(k)}: ${v}`).join(' · ');
  return cell.dimensionKey || '';
}
function latestFreshness(result: QueryResult): string | null | undefined {
  const values = result.cells.map((cell) => cell.freshnessAt).filter((value): value is string => Boolean(value)).sort();
  return values.at(-1) ?? result.freshnessAt;
}
function qualityTone(state: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (['READY', 'OK', 'IN_AGREEMENT', 'PUBLISHED'].includes(state)) return 'success';
  if (['REAL_MISMATCH', 'FAILED', 'ERROR', 'REJECTED'].includes(state)) return 'danger';
  if (['SUPPRESSED', 'LATE_DATA', 'LOCAL_PENDING_SYNC', 'CENTRAL_ANALYTICS_NOT_REFRESHED'].includes(state)) return 'warning';
  return 'neutral';
}
function periodLabel(period?: PeriodRow): string {
  if (!period) return '—'; if (period.startDate === period.endDate) return period.startDate;
  return `${period.id} (${period.startDate} – ${period.endDate})`;
}
function shortPeriod(period: string): string { return period.length > 8 ? period.slice(-8) : period; }
function formatNumber(value: number): string { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value); }
function formatDateTime(value?: string | null): string {
  if (!value) return 'No data yet'; const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function humanize(value?: string | null): string {
  if (!value) return ''; return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function sumValues(values?: Readonly<Record<string, number>>): number {
  return Object.values(values ?? {}).reduce((total, value) => total + value, 0);
}
function cellKey(cell: Cell, index: number): string {
  return `${cell.metricId}-${cell.periodKey}-${cell.orgUnitUid}-${cell.dimensionKey}-${index}`;
}
function csvValue(value: string | number): string {
  const text = String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}
async function parseOrThrow(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null) as { message?: string; code?: string } | null;
  if (!response.ok) throw new Error(body?.message ?? body?.code ?? `HTTP ${response.status}`);
  return body;
}

const STYLES = `
.an-shell{min-height:620px;color:var(--der-ink-900);background:var(--der-surface);font-family:var(--der-font-base);font-size:var(--fs-md)}
.an-appbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:var(--sp-5);min-height:62px;padding:var(--sp-2) var(--sp-5);background:var(--der-surface);border-bottom:1px solid var(--der-border);box-shadow:var(--el-1)}
.an-brand{display:flex;align-items:center;gap:var(--sp-3);min-width:0}.an-brand-mark{display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border-radius:var(--r-sm);background:var(--der-primary-500);color:var(--der-surface);font-size:var(--fs-xl);font-weight:700}.an-brand-title{font-size:var(--fs-lg);font-weight:650;line-height:var(--lh-tight)}.an-brand-subtitle{color:var(--der-ink-500);font-size:var(--fs-xs);margin-top:1px}
.an-app-context{display:flex;align-items:center;justify-content:flex-end;gap:var(--sp-5);min-width:0}.an-context-item{display:flex;flex-direction:column;min-width:0;font-size:var(--fs-sm)}.an-context-item strong{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.an-context-label{color:var(--der-ink-500);font-size:var(--fs-xs)}
.an-connection,.an-status-text{display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-sm)}.an-status-dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--der-neutral)}.an-connection.is-online .an-status-dot,.an-status-text--success .an-status-dot{background:var(--der-success)}.an-status-text--warning .an-status-dot{background:var(--der-warning)}.an-status-text--danger .an-status-dot{background:var(--der-danger)}
.an-tabs{display:flex;gap:var(--sp-5);padding:0 var(--sp-5);background:var(--der-surface);border-bottom:1px solid var(--der-border)}.an-tab,.an-view-tabs button{appearance:none;margin:0;padding:11px 1px 9px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--der-ink-500);font:inherit;font-weight:550;cursor:pointer}.an-tab:hover,.an-view-tabs button:hover{color:var(--der-primary-700)}.an-tab:focus-visible,.an-view-tabs button:focus-visible,.an-text-button:focus-visible,.an-row-action button:focus-visible{outline:none;box-shadow:var(--el-focus)}.an-tab.is-active,.an-view-tabs button.is-active{border-bottom-color:var(--der-primary-500);color:var(--der-primary-700)}
.an-main{padding:var(--sp-5)}.an-page{max-width:1440px;margin:0 auto}.an-page-heading{display:flex;justify-content:space-between;align-items:end;gap:var(--sp-5);margin-bottom:var(--sp-4)}.an-page-heading h1{margin:0;color:var(--der-ink-900);font-size:var(--fs-3xl);font-weight:650;line-height:var(--lh-tight)}.an-page-heading p,.an-section-head p{margin:var(--sp-1) 0 0;color:var(--der-ink-500)}.an-page-heading--with-tool{align-items:center}
.an-querybar{position:sticky;top:62px;z-index:4;display:grid;grid-template-columns:minmax(220px,1.7fr) 130px 88px minmax(145px,1fr) minmax(145px,1fr) minmax(180px,1.2fr) auto;align-items:end;gap:var(--sp-2);padding:var(--sp-3);border:1px solid var(--der-border);background:var(--der-surface-raised);box-shadow:var(--el-1)}
.an-control{display:flex;min-width:0;flex-direction:column;gap:var(--sp-1)}.an-control>span{color:var(--der-ink-500);font-size:var(--fs-xs);font-weight:550}.an-control select,.an-control input,.an-search input{width:100%;min-height:36px;box-sizing:border-box;padding:6px 9px;border:1px solid var(--der-border-strong);border-radius:var(--r-sm);background:var(--der-surface);color:var(--der-ink-900);font:inherit;font-size:var(--fs-input)}.an-control select:focus,.an-control input:focus,.an-search input:focus{outline:none;border-color:var(--der-primary-500);box-shadow:inset 0 0 0 1px var(--der-primary-500)}.an-control--ou strong{display:block;min-height:36px;box-sizing:border-box;padding:8px 9px;overflow:hidden;border:1px solid var(--der-border);border-radius:var(--r-sm);background:var(--der-surface-muted);text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-sm)}
.an-primary-button,.an-secondary-button{min-height:36px;padding:7px 14px;border-radius:var(--r-sm);font:inherit;font-weight:600;cursor:pointer}.an-primary-button{border:1px solid var(--der-primary-600);background:var(--der-primary-500);color:var(--der-surface)}.an-primary-button:hover{background:var(--der-primary-600)}.an-secondary-button{border:1px solid var(--der-border-strong);background:var(--der-surface);color:var(--der-primary-700)}.an-secondary-button:hover{border-color:var(--der-primary-500);background:var(--der-primary-50)}.an-primary-button:focus-visible,.an-secondary-button:focus-visible{outline:none;box-shadow:var(--el-focus)}.an-primary-button:disabled,.an-secondary-button:disabled,.an-row-action button:disabled{opacity:.5;cursor:not-allowed}
.an-workspace{display:grid;grid-template-columns:minmax(210px,260px) minmax(0,1fr);gap:var(--sp-4);margin-top:var(--sp-4)}.an-query-summary{align-self:start;border:1px solid var(--der-border);background:var(--der-surface)}.an-section-head{display:flex;justify-content:space-between;align-items:center;gap:var(--sp-4);min-height:42px;padding:0 var(--sp-3);border-bottom:1px solid var(--der-border)}.an-section-head h2,.an-result-head h2{margin:0;font-size:var(--fs-lg);font-weight:650}.an-query-summary dl{margin:0;padding:var(--sp-3)}.an-query-summary dt{margin-top:var(--sp-3);color:var(--der-ink-500);font-size:var(--fs-xs)}.an-query-summary dt:first-child{margin-top:0}.an-query-summary dd{margin:2px 0 0;overflow-wrap:anywhere}.an-summary-note{margin:0;padding:var(--sp-3);border-top:1px solid var(--der-border);color:var(--der-ink-500);font-size:var(--fs-xs)}
.an-results{min-width:0;border:1px solid var(--der-border);background:var(--der-surface)}.an-result-head{display:flex;justify-content:space-between;align-items:center;gap:var(--sp-4);min-height:58px;padding:var(--sp-2) var(--sp-3)}.an-result-head p{margin:var(--sp-1) 0 0;color:var(--der-ink-500);font-size:var(--fs-sm)}.an-view-tabs{display:flex;gap:var(--sp-5);padding:0 var(--sp-3);border-top:1px solid var(--der-border);border-bottom:1px solid var(--der-border)}
.an-empty-state{margin:var(--sp-4);padding:var(--sp-7) var(--sp-5);border:1px dashed var(--der-border-strong);text-align:center;color:var(--der-ink-500)}.an-empty-state strong{color:var(--der-ink-800);font-size:var(--fs-lg)}.an-empty-state p{max-width:520px;margin:var(--sp-2) auto 0}.an-loading{display:flex;align-items:center;justify-content:center;gap:var(--sp-2);min-height:180px;color:var(--der-ink-500)}.an-loading span{width:16px;height:16px;border:2px solid var(--der-border);border-top-color:var(--der-primary-500);border-radius:50%;animation:an-spin .8s linear infinite}@keyframes an-spin{to{transform:rotate(360deg)}}
.an-table-wrap{overflow:auto;border:1px solid var(--der-border)}.an-results>.an-table-wrap,.an-lineage-table{border-width:0}.an-table{width:100%;border-collapse:collapse;font-size:var(--fs-md)}.an-table th,.an-table td{padding:9px var(--sp-3);border-bottom:1px solid var(--der-border-subtle);text-align:left;vertical-align:middle}.an-table th{position:sticky;top:0;z-index:1;background:var(--der-surface-tinted);color:var(--der-ink-500);font-size:var(--fs-sm);font-weight:650}.an-table tbody tr:hover,.an-table tbody tr.is-selected{background:var(--der-primary-50)}.an-table tbody tr:last-child td{border-bottom:0}.an-table code{font-family:var(--der-font-mono);font-size:var(--fs-xs)}.an-numeric{text-align:right!important;font-variant-numeric:tabular-nums}.an-value{color:var(--der-ink-900);font-weight:650}.an-row-action{width:1%;text-align:right!important;white-space:nowrap}.an-row-action button,.an-text-button{padding:4px 2px;border:0;background:transparent;color:var(--der-primary-700);font:inherit;font-size:var(--fs-sm);font-weight:600;cursor:pointer}.an-empty-cell{padding:var(--sp-7)!important;text-align:center!important;color:var(--der-ink-500)}
.an-chart-wrap{padding:var(--sp-4)}.an-chart{display:block;width:100%;min-height:250px;max-height:390px}.an-chart-grid{stroke:var(--der-border);stroke-width:1}.an-chart-axis,.an-chart-label{fill:var(--der-ink-500);font-family:var(--der-font-base);font-size:11px}.an-chart-line{fill:none;stroke:var(--der-primary-500);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}.an-chart-mark{cursor:pointer;outline:none}.an-chart-mark rect{fill:var(--der-primary-500)}.an-chart-mark circle{fill:var(--der-surface);stroke:var(--der-primary-500);stroke-width:2.5}.an-chart-mark rect:hover,.an-chart-mark rect.is-selected{fill:var(--der-primary-700)}.an-chart-mark circle:hover,.an-chart-mark circle.is-selected{fill:var(--der-primary-100);stroke:var(--der-primary-700)}.an-chart-mark:focus rect,.an-chart-mark:focus circle{filter:drop-shadow(0 0 2px var(--der-primary-500))}.an-chart-help{margin:var(--sp-2) 0 0;text-align:center;color:var(--der-ink-500);font-size:var(--fs-xs)}
.an-detail{margin-top:var(--sp-4);border:1px solid var(--der-border);background:var(--der-surface)}.an-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);margin:0;padding:var(--sp-3)}.an-detail-grid>div{padding:0 var(--sp-3);border-left:1px solid var(--der-border)}.an-detail-grid>div:first-child{padding-left:0;border-left:0}.an-detail-grid dt{color:var(--der-ink-500);font-size:var(--fs-xs)}.an-detail-grid dd{margin:var(--sp-1) 0 0}.an-lineage-controls{display:grid;grid-template-columns:minmax(220px,1fr) auto;align-items:end;gap:var(--sp-3);padding:var(--sp-3);border-top:1px solid var(--der-border)}
.an-search{width:min(340px,100%)}.an-catalogue-table strong{display:block;font-weight:600}.an-cell-meta{display:block;margin-top:2px;color:var(--der-ink-500);font-family:var(--der-font-mono);font-size:var(--fs-xs)}.an-quality-summary,.an-quality-section{margin-top:var(--sp-4);border:1px solid var(--der-border)}.an-quality-summary dl{display:grid;grid-template-columns:repeat(4,1fr);margin:0}.an-quality-summary dl>div{padding:var(--sp-3);border-left:1px solid var(--der-border)}.an-quality-summary dl>div:first-child{border-left:0}.an-quality-summary dt{color:var(--der-ink-500);font-size:var(--fs-xs)}.an-quality-summary dd{margin:var(--sp-1) 0 0;font-size:var(--fs-xl);font-weight:650}.an-inline-stats{display:flex;flex-wrap:wrap;gap:var(--sp-4);padding:var(--sp-3);color:var(--der-ink-500)}.an-inline-stats>span{display:inline-flex;align-items:center;gap:var(--sp-2)}.an-inline-stats--compact{padding:0;font-size:var(--fs-sm)}
.an-message{margin:var(--sp-3) 0;padding:10px var(--sp-3);border:1px solid;border-radius:var(--r-sm)}.an-message--error{border-color:var(--der-danger);background:var(--der-danger-soft);color:var(--der-danger-ink)}.an-message--warning{border-color:var(--der-warning);background:var(--der-warning-soft);color:var(--der-warning-ink)}.an-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:1280px){.an-querybar{grid-template-columns:minmax(220px,2fr) 130px 88px 1fr 1fr auto}.an-control--ou{grid-column:1/-2}}
@media(max-width:1024px){.an-app-context{gap:var(--sp-3)}.an-context-user{display:none}.an-querybar{position:static;grid-template-columns:repeat(3,minmax(0,1fr))}.an-control--metric{grid-column:span 2}.an-control--ou{grid-column:span 2}.an-workspace{grid-template-columns:1fr}.an-query-summary dl{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-3)}.an-query-summary dt{margin-top:0}.an-detail-grid,.an-quality-summary dl{grid-template-columns:repeat(2,1fr)}.an-detail-grid>div:nth-child(3),.an-quality-summary dl>div:nth-child(3){border-left:0}}
@media(max-width:768px){.an-appbar{align-items:flex-start;padding:var(--sp-2) var(--sp-3)}.an-app-context{flex-direction:column;align-items:flex-end;gap:2px}.an-context-item strong{max-width:180px}.an-connection{display:none}.an-tabs,.an-main{padding-left:var(--sp-3);padding-right:var(--sp-3)}.an-tabs{gap:var(--sp-4);overflow-x:auto}.an-page-heading,.an-page-heading--with-tool{align-items:stretch;flex-direction:column}.an-search{width:100%}.an-querybar{grid-template-columns:repeat(2,minmax(0,1fr))}.an-control--metric,.an-control--ou{grid-column:1/-1}.an-primary-button{width:100%}.an-result-head{align-items:flex-start}.an-chart-wrap{padding:var(--sp-2);overflow-x:auto}.an-chart{min-width:580px}.an-detail-grid,.an-quality-summary dl{grid-template-columns:1fr}.an-detail-grid>div,.an-quality-summary dl>div{padding:var(--sp-2) 0;border-left:0;border-top:1px solid var(--der-border)}.an-detail-grid>div:first-child,.an-quality-summary dl>div:first-child{border-top:0}.an-lineage-controls{grid-template-columns:1fr}.an-inline-stats--compact{display:none}}
@media(max-width:480px){.an-brand-subtitle,.an-context-label{display:none}.an-querybar{grid-template-columns:1fr}.an-control--metric,.an-control--ou{grid-column:auto}.an-page-heading h1{font-size:var(--fs-2xl)}.an-result-head{flex-direction:column}}
@media(prefers-reduced-motion:reduce){.an-loading span{animation:none}}
`;
