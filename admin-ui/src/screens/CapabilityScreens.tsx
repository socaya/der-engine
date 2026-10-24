import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { HeroHeader } from '../components/HeroHeader';
import { ErrorBlock, LoadingBlock, EmptyBlock } from '../components/ScreenStates';

/**
 * CapabilityScreens — the 29 nav items that previously showed the
 * "capability not available" placeholder.
 *
 * Each screen is a functional admin console view backed by whatever
 * existing /edge-api/v1 surface we have. Where the backing data is
 * genuinely absent we show a concise, honest hint rather than fake
 * numbers; where it IS available we present it in the same quiet
 * card / stat-strip language used by M0–M5.
 */

// ────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────

function Stat({ label, value, tone = 'info' }: {
  label: string; value: ReactNode; tone?: 'info' | 'success' | 'danger' | 'muted';
}): JSX.Element {
  return (
    <div className={`ea-stat ea-stat--${tone}`}>
      <div className="ea-stat-value">{value}</div>
      <div className="ea-stat-label">{label}</div>
    </div>
  );
}

function DefinitionCard({ title, rows }: {
  title: string;
  rows: ReadonlyArray<readonly [string, ReactNode]>;
}): JSX.Element {
  return (
    <section className="ea-card ea-form-card">
      <div className="ea-form-section">
        <div className="ea-form-section-head">
          <h2>{title}</h2>
        </div>
        <dl className="ea-def-list">
          {rows.map(([k, v]) => (
            <div key={k} className="ea-def-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function LinkTile({ to, title, desc, icon }: {
  to: string; title: string; desc: string; icon?: ReactNode;
}): JSX.Element {
  return (
    <Link to={to} className="ea-link-tile">
      <div className="ea-link-tile-icon" aria-hidden="true">{icon ?? '→'}</div>
      <div className="ea-link-tile-body">
        <div className="ea-link-tile-title">{title}</div>
        <div className="ea-link-tile-desc">{desc}</div>
      </div>
    </Link>
  );
}

function ExternalTile({ href, title, desc, icon }: {
  href: string; title: string; desc: string; icon?: ReactNode;
}): JSX.Element {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="ea-link-tile">
      <div className="ea-link-tile-icon" aria-hidden="true">{icon ?? '↗'}</div>
      <div className="ea-link-tile-body">
        <div className="ea-link-tile-title">{title}</div>
        <div className="ea-link-tile-desc">{desc}</div>
      </div>
    </a>
  );
}

function pct(usable: number, total: number): string {
  if (!total) return '—';
  return `${Math.round(100 - (100 * usable) / total)}%`;
}
function fmtBytes(n?: number): string {
  if (n == null) return '—';
  const u = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${u[i]}`;
}
function fmtDur(ms?: number): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ────────────────────────────────────────────────────────────────────
// WORKSPACE
// ────────────────────────────────────────────────────────────────────

export function CapDashboard(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.compat(),
      edgeApi.workerHealth(), edgeApi.listJobs(10),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setC(r[1].value);
      if (r[2].status === 'fulfilled') setW(r[2].value);
      if (r[3].status === 'fulfilled') setJobs(r[3].value);
      setT(new Date());
      const first = r.find((x) => x.status === 'rejected');
      if (first && first.status === 'rejected') {
        setErr(first.reason instanceof Error ? first.reason.message : String(first.reason));
      }
    });
  }, []);
  const backlog = w ? Object.values(w.backlog).reduce((a, b) => a + b, 0) : 0;
  const failedJobs = jobs?.filter((j) => j.outcome === 'FAILED').length ?? 0;
  return (
    <div className="ea-screen" data-test="cap-dashboard">
      <HeroHeader
        title="Dashboard"
        subtitle="At-a-glance picture of this edge: integration, sync, and recent activity."
        lastFetched={t}
      />
      {err && <ErrorBlock title="Partial dashboard load" testId="err-partial-dashboard-load">{err}</ErrorBlock>}
      <div className="ea-stat-strip">
        <Stat label="DER status" value={h?.status === 'UP' ? 'UP' : h?.status ?? '—'}
              tone={h?.status === 'UP' ? 'success' : 'muted'} />
        <Stat label="DHIS2 reachable"
              value={c?.probeReachable == null ? '—' : c.probeReachable ? 'yes' : 'no'}
              tone={c?.probeReachable ? 'success' : 'danger'} />
        <Stat label="Journal backlog" value={backlog}
              tone={backlog === 0 ? 'success' : backlog < 100 ? 'info' : 'danger'} />
        <Stat label="Recent failed jobs" value={failedJobs}
              tone={failedJobs === 0 ? 'success' : 'danger'} />
      </div>
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Quick navigation</h2>
            <p>Jump into the modules operators use most often.</p>
          </div>
          <div className="ea-tile-grid">
            <LinkTile to="/" title="System overview" desc="Live edge status and components." />
            <LinkTile to="/sync/jobs" title="Sync jobs" desc="Scheduler runs and triggers." />
            <LinkTile to="/journal/conflicts" title="Conflicts" desc="Journal operations awaiting a decision." />
            <LinkTile to="/provisioning/users" title="Users" desc="Operators and administrators on this edge." />
          </div>
        </div>
      </section>
    </div>
  );
}

export function CapSystemInformation(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.systemInfo().then(setSi)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="System info failed" testId="err-system-info-failed">{err}</ErrorBlock>;
  if (!si) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-sysinfo">
      <HeroHeader
        title="System information"
        subtitle="Build identity, runtime, storage and probe status for this edge."
      />
      <DefinitionCard title="Build" rows={[
        ['Service', si.service],
        ['Version', <span key="v" className="ea-mono">{si.build.version}</span>],
        ['Commit', <span key="c" className="ea-mono">{si.build.commit}</span>],
        ['Branch', si.build.branch],
        ['Built', si.build.buildTime],
        ['Working tree dirty', si.build.dirty ? 'yes' : 'no'],
      ]} />
      <DefinitionCard title="Runtime" rows={[
        ['Java', `${si.runtime.javaVendor ?? ''} ${si.runtime.javaVersion ?? ''}`.trim() || '—'],
        ['OS', `${si.runtime.osName ?? '—'} (${si.runtime.osArch ?? '—'})`],
        ['Hostname', si.runtime.hostname ?? '—'],
        ['Processors', String(si.runtime.availableProcessors ?? '—')],
        ['Uptime', fmtDur(si.runtime.uptimeMillis)],
        ['Heap used', `${fmtBytes(si.runtime.heapUsedBytes)} / ${fmtBytes(si.runtime.heapMaxBytes)}`],
      ]} />
      <DefinitionCard title="Database" rows={[
        ['Product', si.database.product ?? '—'],
        ['Flyway', si.database.flywayVersion ?? '—'],
        ['Migrations', String(si.database.migrationCount ?? '—')],
        ['Users', String(si.database.userCount ?? '—')],
        ['Sessions', String(si.database.sessionCount ?? '—')],
      ]} />
      <DefinitionCard title="Scheduler" rows={[
        ['Name', si.scheduler.name ?? '—'],
        ['Started', si.scheduler.started ? 'yes' : 'no'],
        ['Standby', si.scheduler.standbyMode ? 'yes' : 'no'],
        ['Executing', String(si.scheduler.executingJobs ?? '—')],
        ['Total jobs', String(si.scheduler.totalJobs ?? '—')],
      ]} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// DHIS2 INTEGRATION
// ────────────────────────────────────────────────────────────────────

export function CapCentralConnection(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function reload(): Promise<void> {
    const [a, b] = await Promise.allSettled([edgeApi.systemInfo(), edgeApi.compat()]);
    if (a.status === 'fulfilled') setSi(a.value);
    if (b.status === 'fulfilled') setC(b.value);
    if (a.status === 'rejected') setErr(a.reason instanceof Error ? a.reason.message : String(a.reason));
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function refresh(): Promise<void> {
    setRefreshing(true);
    try { setC(await edgeApi.refreshCompat()); } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setRefreshing(false); }
  }
  if (err && !si) return <ErrorBlock title="Connection probe failed" testId="err-connection-probe-failed">{err}</ErrorBlock>;
  if (!si || !c) return <LoadingBlock testId="loading" />;
  const reach = c.probeReachable;
  return (
    <div className="ea-screen" data-test="cap-connection">
      <HeroHeader
        title="Central connection"
        subtitle="Upstream DHIS2 instance and reachability from this edge."
        actions={
          <button type="button" className="ea-btn ea-btn--primary"
                  disabled={refreshing}
                  onClick={() => { refresh().catch(() => undefined); }}>
            {refreshing ? 'Probing…' : 'Probe now'}
          </button>
        }
      />
      <div className="ea-stat-strip">
        <Stat label="Reachable" value={reach ? 'yes' : 'no'}
              tone={reach ? 'success' : 'danger'} />
        <Stat label="Central version" value={c.centralVersion ?? '—'} />
        <Stat label="Profile" value={c.profileName ?? '—'} />
        <Stat label="Probe RTT"
              value={si.dhis2.probeDurationMs != null ? `${si.dhis2.probeDurationMs} ms` : '—'} />
      </div>
      <DefinitionCard title="Connection" rows={[
        ['Base URL', <span key="u" className="ea-mono">{si.dhis2.centralBaseUrl ?? '—'}</span>],
        ['Pinned version', si.dhis2.pinnedVersion ?? '—'],
        ['Allow mismatch', si.dhis2.allowMismatch ? 'yes' : 'no'],
        ['Captured at', si.dhis2.capturedAt ?? '—'],
        ['Reason', si.dhis2.reason ?? '—'],
      ]} />
    </div>
  );
}

export function CapOrgUnitBinding(): JSX.Element {
  const [b, setB] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [ous, setOus] = useState<edgeApi.OrgUnitRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState('');
  const [confirmRebind, setConfirmRebind] = useState(false);
  const [saving, setSaving] = useState(false);
  async function reload(): Promise<void> {
    try {
      const br = await edgeApi.getOrgUnitBinding();
      setB(br);
      const r = await edgeApi.listOrgUnits();
      setOus(r.organisationUnits);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function doBind(): Promise<void> {
    if (!sel) return;
    setSaving(true);
    try { await edgeApi.bindOrgUnit(sel, confirmRebind); await reload(); setSel(''); setConfirmRebind(false); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  if (!b) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-ou">
      <HeroHeader
        title="Organisation unit"
        subtitle="This edge serves a single DHIS2 organisation unit. Change only when relocating the device."
        orgUnitBound={b.bound}
        orgUnitLabel={b.orgUnitDisplayName ?? undefined}
      />
      {err && <ErrorBlock title="Binding failed" testId="err-binding-failed">{err}</ErrorBlock>}
      {b.bound ? (
        <DefinitionCard title="Current binding" rows={[
          ['Org unit', b.orgUnitDisplayName ?? '—'],
          ['Org unit ID', <span key="id" className="ea-mono">{b.orgUnitId ?? '—'}</span>],
          ['Path', <span key="p" className="ea-mono">{b.orgUnitPath ?? '—'}</span>],
          ['Bound at', b.boundAt ?? '—'],
          ['Bound by', b.boundBy ?? '—'],
        ]} />
      ) : (
        <EmptyBlock title="Not bound yet" testId="empty-not-bound-yet">
          Pick an organisation unit from DHIS2 to bind this edge.
        </EmptyBlock>
      )}
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>{b.bound ? 'Rebind' : 'Bind now'}</h2>
            <p>{b.bound
              ? 'Rebinding clears mirrored metadata and journal state. Confirm before applying.'
              : 'Select the facility this device should capture data against.'}</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Organisation unit</span>
              <select className="ea-input" value={sel} onChange={(e) => setSel(e.target.value)}>
                <option value="">— Select —</option>
                {ous.map((o) => (
                  <option key={o.id} value={o.id}>{o.displayName}</option>
                ))}
              </select>
            </label>
            {b.bound && (
              <label className="ea-field">
                <span className="ea-field-label">Confirm rebind</span>
                <label className="ea-flag-row">
                  <input type="checkbox" className="ea-switch"
                         checked={confirmRebind}
                         onChange={(e) => setConfirmRebind(e.target.checked)} />
                  <span className="ea-flag-name">I understand this clears mirrored state</span>
                </label>
              </label>
            )}
          </div>
        </div>
        <div className="ea-form-actions">
          <button type="button" className="ea-btn ea-btn--primary"
                  disabled={!sel || saving || (b.bound && !confirmRebind)}
                  onClick={() => { doBind().catch(() => undefined); }}>
            {saving ? 'Applying…' : b.bound ? 'Rebind' : 'Bind'}
          </button>
        </div>
      </section>
    </div>
  );
}

export function CapProgramRules(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.MetadataListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.metadataList('programRules')
      .then((r) => {
        const items = (r.programRules ?? []) as edgeApi.MetadataListItem[];
        setRows(items);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  return (
    <div className="ea-screen" data-test="cap-rules">
      <HeroHeader
        title="Program rules"
        subtitle="DHIS2 program rules mirrored from the central instance."
      />
      {err && <ErrorBlock title="Could not load program rules" testId="err-could-not-load-program-r">{err}</ErrorBlock>}
      {!rows && !err && <LoadingBlock testId="loading" />}
      {rows && rows.length === 0 && (
        <EmptyBlock title="No program rules mirrored" testId="empty-no-program-rules-mirrore">
          Run a metadata sync to pull rules from the central DHIS2.
        </EmptyBlock>
      )}
      {rows && rows.length > 0 && (
        <section className="ea-card">
          <div className="ea-card-toolbar">
            <span className="ea-card-count">{rows.length} rules</span>
          </div>
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Name</th><th>ID</th>
            </tr></thead><tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.displayName ?? '—'}</td>
                  <td className="ea-mono">{r.id}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// SYNCHRONISATION
// ────────────────────────────────────────────────────────────────────

export function CapSyncOverview(): JSX.Element {
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [d, setD] = useState<edgeApi.DriftResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.allSettled([edgeApi.listJobs(50), edgeApi.workerHealth(), edgeApi.drift()])
      .then((r) => {
        if (r[0].status === 'fulfilled') setJobs(r[0].value);
        if (r[1].status === 'fulfilled') setW(r[1].value);
        if (r[2].status === 'fulfilled') setD(r[2].value);
        const first = r.find((x) => x.status === 'rejected');
        if (first && first.status === 'rejected') {
          setErr(first.reason instanceof Error ? first.reason.message : String(first.reason));
        }
      });
  }, []);
  const succeeded = jobs?.filter((j) => j.outcome === 'SUCCEEDED').length ?? 0;
  const failed = jobs?.filter((j) => j.outcome === 'FAILED').length ?? 0;
  const backlog = w ? Object.values(w.backlog).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="ea-screen" data-test="cap-sync-overview">
      <HeroHeader title="Sync overview" subtitle="Live state of integration workers across this edge." />
      {err && <ErrorBlock title="Partial load" testId="err-partial-load">{err}</ErrorBlock>}
      <div className="ea-stat-strip">
        <Stat label="Runs (last 50)" value={jobs?.length ?? 0} />
        <Stat label="Succeeded" value={succeeded} tone="success" />
        <Stat label="Failed" value={failed} tone={failed ? 'danger' : 'muted'} />
        <Stat label="Journal backlog" value={backlog}
              tone={backlog === 0 ? 'success' : backlog < 100 ? 'info' : 'danger'} />
      </div>
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Jump to</h2>
            <p>Deep-dive into the specific sync surfaces.</p>
          </div>
          <div className="ea-tile-grid">
            <LinkTile to="/sync/jobs" title="Jobs & history" desc="Last scheduled runs and their outcomes." />
            <LinkTile to="/sync/drift" title="Metadata drift" desc="Compare mirrored metadata against central." />
            <LinkTile to="/journal/conflicts" title="Conflicts" desc="Operations awaiting a reviewer decision." />
            <LinkTile to="/journal/worker" title="Worker health" desc="Backlog by state and pause / resume." />
          </div>
        </div>
      </section>
      {d && (
        <DefinitionCard title="Drift at a glance" rows={[
          ['Status', d.status ?? '—'],
          ['Mirror fingerprint', <span key="f" className="ea-mono">{d.fingerprintFrom ?? '—'}</span>],
          ['Central fingerprint', <span key="t" className="ea-mono">{d.fingerprintTo ?? '—'}</span>],
        ]} />
      )}
    </div>
  );
}

export function CapSyncHistory(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.JobRun[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'SUCCEEDED' | 'FAILED'>('ALL');
  useEffect(() => {
    edgeApi.listJobs(100).then(setRows)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="History load failed" testId="err-history-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.outcome === filter);
  return (
    <div className="ea-screen" data-test="cap-sync-history">
      <HeroHeader title="Sync history" subtitle="All recorded scheduler runs on this edge." />
      <div className="ea-filter-chips" role="group" aria-label="Outcome filter">
        {(['ALL', 'SUCCEEDED', 'FAILED'] as const).map((f) => (
          <button key={f} type="button"
                  className={'ea-filter-chip' + (filter === f ? ' ea-filter-chip--active' : '')}
                  onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyBlock title="No runs match" testId="empty-no-runs-match">Change the filter to see other runs.</EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Started</th><th>Job</th><th>Outcome</th><th>Duration</th><th>Triggered by</th>
            </tr></thead><tbody>
              {filtered.map((r) => (
                <tr key={r.runId}>
                  <td className="ea-mono">{r.startedAt}</td>
                  <td>{r.jobName}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.outcome === 'SUCCEEDED' ? 'success'
                        : r.outcome === 'FAILED' ? 'danger' : 'info')}>{r.outcome}</span></td>
                  <td>{r.durationMs != null ? fmtDur(r.durationMs) : '—'}</td>
                  <td>{r.triggeredBy}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapDataQueues(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.workerHealth().then(setW)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Worker probe failed" testId="err-worker-probe-failed">{err}</ErrorBlock>;
  if (!w) return <LoadingBlock testId="loading" />;
  const entries = Object.entries(w.backlog);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="ea-screen" data-test="cap-queues">
      <HeroHeader title="Data queues" subtitle="Journal backlog by state." />
      <div className="ea-stat-strip">
        <Stat label="Worker" value={w.enabled ? 'RUNNING' : 'PAUSED'}
              tone={w.enabled ? 'success' : 'muted'} />
        <Stat label="Total backlog" value={total}
              tone={total === 0 ? 'success' : total < 100 ? 'info' : 'danger'} />
        <Stat label="Last tick" value={w.lastTick ?? '—'} />
        <Stat label="Last batch" value={w.lastBatchSize} />
      </div>
      {entries.length === 0 ? (
        <EmptyBlock title="Journal empty" testId="empty-journal-empty">Nothing pending in any state.</EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>State</th><th>Operations</th>
            </tr></thead><tbody>
              {entries.map(([k, v]) => (
                <tr key={k}>
                  <td><span className={'ea-chip ea-chip--' +
                      (k === 'PENDING' ? 'info' : k === 'FAILED' ? 'danger' : 'success')}>{k}</span></td>
                  <td className="ea-mono">{v}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

function TriggerPanel({ jobName, title, subtitle }: {
  jobName: string; title: string; subtitle: string;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<edgeApi.JobRun[] | null>(null);
  async function reload(): Promise<void> {
    try {
      const j = await edgeApi.listJobs(50);
      setHistory(j.filter((x) => x.jobName === jobName).slice(0, 10));
    } catch { /* ignore */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, [jobName]);
  async function run(): Promise<void> {
    setState('running'); setMsg(null);
    try {
      const r = await edgeApi.triggerJob(jobName);
      if (r.error) { setState('error'); setMsg(r.error); return; }
      setState('done'); setMsg(r.triggered ?? 'Job queued.');
      await reload();
    } catch (e) {
      setState('error'); setMsg(e instanceof Error ? e.message : String(e));
    }
  }
  const last = history?.[0];
  return (
    <div className="ea-screen">
      <HeroHeader title={title} subtitle={subtitle}
        actions={
          <button type="button" className="ea-btn ea-btn--primary"
                  disabled={state === 'running'}
                  onClick={() => { run().catch(() => undefined); }}>
            {state === 'running' ? 'Triggering…' : 'Trigger now'}
          </button>
        }
      />
      <div className="ea-stat-strip">
        <Stat label="Job" value={<span className="ea-mono">{jobName}</span>} />
        <Stat label="Last outcome"
              value={last?.outcome ?? '—'}
              tone={last?.outcome === 'SUCCEEDED' ? 'success'
                : last?.outcome === 'FAILED' ? 'danger' : 'muted'} />
        <Stat label="Last run" value={last?.startedAt ?? '—'} />
      </div>
      {state === 'done' && msg && <p className="ea-saved">{msg}</p>}
      {state === 'error' && msg && <ErrorBlock title="Trigger failed" testId="err-trigger-failed">{msg}</ErrorBlock>}
      <section className="ea-card">
        <div className="ea-card-toolbar"><span className="ea-card-count">Recent runs</span></div>
        {!history || history.length === 0 ? (
          <EmptyBlock title="No history" testId="empty-no-history">Never run on this edge.</EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Started</th><th>Outcome</th><th>Duration</th>
            </tr></thead><tbody>
              {history.map((h) => (
                <tr key={h.runId}>
                  <td className="ea-mono">{h.startedAt}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (h.outcome === 'SUCCEEDED' ? 'success'
                        : h.outcome === 'FAILED' ? 'danger' : 'info')}>{h.outcome}</span></td>
                  <td>{h.durationMs != null ? fmtDur(h.durationMs) : '—'}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </section>
    </div>
  );
}

export function CapMetadataSync(): JSX.Element {
  return <TriggerPanel jobName="METADATA_SYNC_FULL"
    title="Metadata sync" subtitle="Pull fresh metadata from the central DHIS2." />;
}

export function CapDataExchange(): JSX.Element {
  return <TriggerPanel jobName="AGGREGATE_DATA_PUSH"
    title="Data exchange" subtitle="Push captured aggregate values back to the central DHIS2." />;
}

export function CapSyncSchedule(): JSX.Element {
  const [s, setS] = useState<edgeApi.SettingsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => {
    edgeApi.readSettings().then(setS)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  async function save(): Promise<void> {
    if (!s) return;
    setStatus('saving');
    try { await edgeApi.saveSettings(s); setStatus('saved'); }
    catch (e) { setStatus('error'); setErr(e instanceof Error ? e.message : String(e)); }
  }
  if (err && !s) return <ErrorBlock title="Settings load failed" testId="err-settings-load-failed">{err}</ErrorBlock>;
  if (!s) return <LoadingBlock testId="loading" />;
  const cron = Object.entries(s.cron ?? {});
  return (
    <div className="ea-screen" data-test="cap-schedule">
      <HeroHeader title="Sync schedule"
        subtitle="Cron overrides for background sync workers."
        actions={
          <button type="button" className="ea-btn ea-btn--primary"
                  disabled={status === 'saving'}
                  onClick={() => { save().catch(() => undefined); }}>
            {status === 'saving' ? 'Saving…' : 'Save schedule'}
          </button>
        }
      />
      {status === 'saved' && <p className="ea-saved">Schedule saved.</p>}
      {status === 'error' && err && <ErrorBlock title="Save failed" testId="err-save-failed">{err}</ErrorBlock>}
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Cron overrides</h2>
            <p>Standard Quartz cron syntax. Leave empty to use the compiled default.</p>
          </div>
          <div className="ea-form-grid">
            {cron.length === 0 && (
              <div className="ea-field-hint">No cron overrides defined on this build.</div>
            )}
            {cron.map(([k, v]) => (
              <label key={k} className="ea-field">
                <span className="ea-field-label">{k}</span>
                <input className="ea-input ea-mono" value={v}
                       onChange={(e) => setS({ ...s, cron: { ...s.cron, [k]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// WORKFLOWS & APPROVALS
// ────────────────────────────────────────────────────────────────────

export function CapWorkflowRuns(): JSX.Element {
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [runs, setRuns] = useState<Array<edgeApi.CaptureWorkflowRun & { workflowName: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const w = await edgeApi.listWorkflows();
        setWfs(w.workflows);
        const all: Array<edgeApi.CaptureWorkflowRun & { workflowName: string }> = [];
        for (const wf of w.workflows) {
          try {
            const r = await edgeApi.listWorkflowRuns(wf.workflowId);
            r.runs.forEach((x) => all.push({ ...x, workflowName: wf.displayName }));
          } catch { /* skip */ }
        }
        setRuns(all);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);
  if (err && !wfs) return <ErrorBlock title="Runs load failed" testId="err-runs-load-failed">{err}</ErrorBlock>;
  if (!wfs) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-wf-runs">
      <HeroHeader title="Runs & execution"
        subtitle="Workflow runs across every workflow definition on this edge." />
      <div className="ea-stat-strip">
        <Stat label="Workflows" value={wfs.length} />
        <Stat label="Runs" value={runs.length} />
      </div>
      {runs.length === 0 ? (
        <EmptyBlock title="No runs recorded" testId="empty-no-runs-recorded">
          Operators have not started any workflow yet, or no workflow is enabled.
        </EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Workflow</th><th>State</th><th>Business key</th><th>Created</th>
            </tr></thead><tbody>
              {runs.map((r) => (
                <tr key={r.runId}>
                  <td>{r.workflowName}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.state === 'COMPLETED' ? 'success'
                        : r.state === 'REJECTED' ? 'danger'
                          : 'info')}>{r.state}</span></td>
                  <td className="ea-mono">{r.businessKey}</td>
                  <td className="ea-mono">{r.createdAt}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapStepAssignments(): JSX.Element {
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.listWorkflows().then((r) => setWfs(r.workflows))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Workflow load failed" testId="err-workflow-load-failed">{err}</ErrorBlock>;
  if (!wfs) return <LoadingBlock testId="loading" />;
  const totalSteps = wfs.reduce((a, w) => a + (w.steps?.length ?? 0), 0);
  return (
    <div className="ea-screen" data-test="cap-assignments">
      <HeroHeader title="Step assignments"
        subtitle="Which role is responsible for each workflow step." />
      <div className="ea-stat-strip">
        <Stat label="Workflows" value={wfs.length} />
        <Stat label="Steps" value={totalSteps} />
      </div>
      {wfs.length === 0 ? (
        <EmptyBlock title="No workflows defined" testId="empty-no-workflows-defined">
          Define a workflow first to see step assignments.
        </EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Workflow</th><th>Step #</th><th>Step</th><th>Owner role</th><th>Kind</th>
            </tr></thead><tbody>
              {wfs.flatMap((w) => (w.steps ?? []).map((s) => (
                <tr key={w.workflowId + '-' + s.ordinal}>
                  <td>{w.displayName}</td>
                  <td className="ea-mono">{s.ordinal}</td>
                  <td>{s.displayName}</td>
                  <td><span className="ea-chip ea-chip--info">{s.ownerRole}</span></td>
                  <td><span className="ea-chip ea-chip--neutral">{s.stepKind}</span></td>
                </tr>
              )))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapReferralHistory(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.ReferralInboxRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.listReferralInbox(100).then((r) => setRows(r.entries))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Referral load failed" testId="err-referral-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-ref-history">
      <HeroHeader title="Referral history" subtitle="Every referral this edge has received." />
      <div className="ea-stat-strip">
        <Stat label="Total" value={rows.length} />
        <Stat label="Accepted" value={rows.filter((r) => r.status === 'ACCEPTED').length} tone="success" />
        <Stat label="Dismissed" value={rows.filter((r) => r.status === 'DISMISSED').length} tone="muted" />
        <Stat label="Pending" value={rows.filter((r) => r.status === 'PENDING').length} tone="info" />
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="No referrals yet" testId="empty-no-referrals-yet">Nothing has been referred to this edge.</EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Discovered</th><th>Kind</th><th>Source ref</th><th>Status</th>
            </tr></thead><tbody>
              {rows.map((r) => (
                <tr key={r.inboxId}>
                  <td className="ea-mono">{r.discoveredAt}</td>
                  <td><span className="ea-chip ea-chip--info">{r.kind}</span></td>
                  <td className="ea-mono">{r.sourceRef}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.status === 'ACCEPTED' ? 'success'
                        : r.status === 'DISMISSED' ? 'muted' : 'info')}>{r.status}</span></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// LOCAL DATA
// ────────────────────────────────────────────────────────────────────

export function CapDataOverview(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  useEffect(() => {
    edgeApi.systemInfo().then(setSi).catch(() => undefined);
    edgeApi.listDrafts().then((r) => setDrafts(r.drafts.length)).catch(() => setDrafts(0));
  }, []);
  const journal = si ? Object.values(si.journal ?? {}).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="ea-screen" data-test="cap-data-overview">
      <HeroHeader title="Local data"
        subtitle="Data captured, drafted, or awaiting push on this edge." />
      <div className="ea-stat-strip">
        <Stat label="Journal entries" value={journal} />
        <Stat label="Drafts" value={drafts ?? '—'} />
      </div>
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Capture surfaces</h2>
            <p>Open DHIS2 Core apps that write back through this edge.</p>
          </div>
          <div className="ea-tile-grid">
            <ExternalTile href="/dhis-web-dataentry/index.html"
              title="Aggregate" desc="Dataset-based data entry." />
            <ExternalTile href="/dhis-web-event-capture/index.html"
              title="Events" desc="Event-only program capture." />
            <ExternalTile href="/dhis-web-tracker-capture/index.html"
              title="Tracker" desc="Tracked-entity capture and dashboards." />
            <LinkTile to="/data/drafts" title="Drafts & pending"
              desc="Entries saved locally but not yet submitted." />
          </div>
        </div>
      </section>
    </div>
  );
}

function DhisAppTile({ href, title, desc }: {
  href: string; title: string; desc: string;
}): JSX.Element {
  return (
    <div className="ea-screen" data-test={'cap-' + title.toLowerCase()}>
      <HeroHeader title={title} subtitle={desc}
        actions={
          <a className="ea-btn ea-btn--primary" href={href} target="_blank" rel="noreferrer">
            Open in new tab ↗
          </a>
        }
      />
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>About</h2>
            <p>
              This surface delegates to the DHIS2 Core app bundled with the
              edge. All writes flow back through the DER journal, so sync,
              drift, and conflict review on this console continue to apply.
            </p>
          </div>
          <ul className="ea-def-list">
            <li className="ea-def-row"><dt>DHIS2 app</dt><dd className="ea-mono">{href}</dd></li>
            <li className="ea-def-row"><dt>Mode</dt><dd>Deep-link (new tab)</dd></li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export function CapAggregate(): JSX.Element {
  return <DhisAppTile href="/dhis-web-dataentry/index.html"
    title="Aggregate" desc="Dataset-based aggregate data entry." />;
}
export function CapEvents(): JSX.Element {
  return <DhisAppTile href="/dhis-web-event-capture/index.html"
    title="Events" desc="Event-only program capture." />;
}
export function CapTracker(): JSX.Element {
  return <DhisAppTile href="/dhis-web-tracker-capture/index.html"
    title="Tracker" desc="Tracked-entity capture and dashboards." />;
}

export function CapDrafts(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.DraftRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function reload(): Promise<void> {
    try { const r = await edgeApi.listDrafts(); setRows(r.drafts); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function remove(id: string): Promise<void> {
    try { await edgeApi.deleteDraft(id); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  if (err && !rows) return <ErrorBlock title="Drafts load failed" testId="err-drafts-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-drafts">
      <HeroHeader title="Drafts & pending" subtitle="Captures saved locally but not yet submitted." />
      <div className="ea-stat-strip">
        <Stat label="Total drafts" value={rows.length} />
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="No drafts" testId="empty-no-drafts">All captured data has been submitted.</EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Updated</th><th>Kind</th><th>Title</th><th aria-label="Actions" />
            </tr></thead><tbody>
              {rows.map((d) => (
                <tr key={d.draftId}>
                  <td className="ea-mono">{d.updatedAt}</td>
                  <td>{d.kind}</td>
                  <td>{d.title ?? '—'}</td>
                  <td className="ea-table-actions">
                    <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                            onClick={() => { remove(d.draftId).catch(() => undefined); }}>
                      Discard
                    </button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapMaintenance(): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(label); setErr(null); setMsg(null);
    try { await fn(); setMsg(`${label}: queued.`); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }
  return (
    <div className="ea-screen" data-test="cap-maint">
      <HeroHeader title="Maintenance"
        subtitle="One-off operator actions. These rebuild or re-emit local state."
      />
      {msg && <p className="ea-saved">{msg}</p>}
      {err && <ErrorBlock title="Action failed" testId="err-action-failed">{err}</ErrorBlock>}
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Jobs</h2>
            <p>Trigger scheduler jobs directly. Prefer the dedicated screens for routine operations.</p>
          </div>
          <div className="ea-tile-grid">
            {['METADATA_SYNC_FULL', 'AGGREGATE_DATA_PUSH', 'JOURNAL_DRAIN'].map((name) => (
              <button key={name} type="button" className="ea-link-tile ea-link-tile--btn"
                      disabled={busy === name}
                      onClick={() => { run(name, () => edgeApi.triggerJob(name)).catch(() => undefined); }}>
                <div className="ea-link-tile-icon" aria-hidden="true">▶</div>
                <div className="ea-link-tile-body">
                  <div className="ea-link-tile-title">{name}</div>
                  <div className="ea-link-tile-desc">
                    {busy === name ? 'Running…' : 'Trigger this scheduler job now.'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Backups</h2>
            <p>Create a snapshot of the audit log or the full edge state.</p>
          </div>
          <div className="ea-tile-grid">
            <button type="button" className="ea-link-tile ea-link-tile--btn"
                    disabled={busy === 'AUDIT'}
                    onClick={() => { run('AUDIT backup', () => edgeApi.requestBackup('AUDIT')).catch(() => undefined); }}>
              <div className="ea-link-tile-icon" aria-hidden="true">⬇</div>
              <div className="ea-link-tile-body">
                <div className="ea-link-tile-title">Audit backup</div>
                <div className="ea-link-tile-desc">Hash-chained audit log only.</div>
              </div>
            </button>
            <button type="button" className="ea-link-tile ea-link-tile--btn"
                    disabled={busy === 'FULL'}
                    onClick={() => { run('FULL backup', () => edgeApi.requestBackup('FULL')).catch(() => undefined); }}>
              <div className="ea-link-tile-icon" aria-hidden="true">⬇</div>
              <div className="ea-link-tile-body">
                <div className="ea-link-tile-title">Full backup</div>
                <div className="ea-link-tile-desc">Database + mirror + apps.</div>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// USERS & ACCESS
// ────────────────────────────────────────────────────────────────────

export function CapUserMappings(): JSX.Element {
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.listUsers().then((r) => setUsers(r.users))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Users load failed" testId="err-users-load-failed">{err}</ErrorBlock>;
  if (!users) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-mappings">
      <HeroHeader title="DHIS2 user mapping"
        subtitle="Edge accounts and their mapping to DHIS2 central users."
      />
      <div className="ea-stat-strip">
        <Stat label="Edge users" value={users.length} />
        <Stat label="Admins" value={users.filter((u) => u.roles.includes('ADMIN')).length}
              tone="success" />
      </div>
      <section className="ea-card">
        <div className="ea-table-wrap">
          <table className="ea-table"><thead><tr>
            <th>Edge user</th><th>Roles</th><th>DHIS2 mapping</th>
          </tr></thead><tbody>
            {users.map((u) => (
              <tr key={u.userId}>
                <td>{u.displayName} <span className="ea-mono ea-text-muted">({u.username})</span></td>
                <td>{u.roles.map((r) => (<span key={r} className="ea-chip ea-chip--info">{r}</span>))}</td>
                <td><span className="ea-chip ea-chip--neutral">unmapped</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </section>
      <p className="ea-field-hint" style={{ padding: '12px 16px' }}>
        Direct DHIS2 user mapping is applied by sync; it is not yet editable from this console.
      </p>
    </div>
  );
}

export function CapRoles(): JSX.Element {
  const ROLES = [
    { id: 'ADMIN', label: 'ADMIN', desc: 'Full control: provisioning, sync, apps, settings, recovery.' },
    { id: 'OPERATOR', label: 'OPERATOR', desc: 'Captures data on the device; reads own drafts and recent runs.' },
    { id: 'REVIEWER', label: 'REVIEWER', desc: 'Reviews pending approvals and conflicts; cannot change settings.' },
  ];
  return (
    <div className="ea-screen" data-test="cap-roles">
      <HeroHeader title="Roles & permissions"
        subtitle="Fixed role set shipped with this DER build."
      />
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Roles</h2>
            <p>The three roles recognised by DER today. Role editing is intentionally fixed.</p>
          </div>
          <div className="ea-tile-grid">
            {ROLES.map((r) => (
              <div key={r.id} className="ea-link-tile" style={{ cursor: 'default' }}>
                <div className="ea-link-tile-icon" aria-hidden="true">⚙</div>
                <div className="ea-link-tile-body">
                  <div className="ea-link-tile-title">
                    <span className="ea-chip ea-chip--primary">{r.label}</span>
                  </div>
                  <div className="ea-link-tile-desc">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CapSessions(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.allSettled([edgeApi.systemInfo(), edgeApi.listUsers()]).then((r) => {
      if (r[0].status === 'fulfilled') setSi(r[0].value);
      if (r[1].status === 'fulfilled') setUsers(r[1].value.users);
      if (r[0].status === 'rejected') {
        setErr(r[0].reason instanceof Error ? r[0].reason.message : String(r[0].reason));
      }
    });
  }, []);
  if (err) return <ErrorBlock title="Sessions load failed" testId="err-sessions-load-failed">{err}</ErrorBlock>;
  if (!si || !users) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-sessions">
      <HeroHeader title="User sessions"
        subtitle="Live sign-in sessions on this edge. Sessions auto-expire with the DER_SESSION cookie."
      />
      <div className="ea-stat-strip">
        <Stat label="Active sessions" value={si.database.sessionCount ?? '—'} tone="success" />
        <Stat label="Known users" value={users.length} />
      </div>
      <p className="ea-field-hint" style={{ padding: '12px 16px' }}>
        Per-session details (device, IP, last seen) are not yet exposed on this edge.
        Rotate the DER_SESSION secret via Settings to invalidate every session at once.
      </p>
    </div>
  );
}

export function CapCredentials(): JSX.Element {
  return (
    <div className="ea-screen" data-test="cap-creds">
      <HeroHeader title="MFA & credentials"
        subtitle="How users prove who they are on this edge."
      />
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Credential policy</h2>
          </div>
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Password minimum</dt><dd>12 characters, mixed upper, lower, digits</dd></div>
            <div className="ea-def-row"><dt>Session storage</dt><dd className="ea-mono">DER_SESSION cookie (HttpOnly, SameSite)</dd></div>
            <div className="ea-def-row"><dt>Multi-factor</dt><dd><span className="ea-chip ea-chip--neutral">not configured</span></dd></div>
            <div className="ea-def-row"><dt>External SSO</dt><dd><span className="ea-chip ea-chip--neutral">not configured</span></dd></div>
          </dl>
        </div>
      </section>
      <p className="ea-field-hint" style={{ padding: '12px 16px' }}>
        MFA and OIDC federation ship in a later DER release. Password resets today
        require an ADMIN reprovision.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// DEVICES & CLIENTS
// ────────────────────────────────────────────────────────────────────

function useDevices(): [edgeApi.EdgeDeviceRow[] | null, string | null, () => Promise<void>] {
  const [rows, setRows] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function reload(): Promise<void> {
    try { const r = await edgeApi.listDevices(); setRows(r.devices); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  return [rows, err, reload];
}

export function CapDeviceEnrolment(): JSX.Element {
  const [rows, err, reload] = useDevices();
  async function approve(id: string): Promise<void> {
    try { await edgeApi.approveDevice(id); await reload(); } catch { /* ignore */ }
  }
  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const pending = rows.filter((r) => r.status === 'PENDING');
  return (
    <div className="ea-screen" data-test="cap-enrolment">
      <HeroHeader title="Device enrolment"
        subtitle="Devices that have requested access and are awaiting approval."
      />
      <div className="ea-stat-strip">
        <Stat label="Pending" value={pending.length}
              tone={pending.length ? 'info' : 'success'} />
        <Stat label="All devices" value={rows.length} />
      </div>
      {pending.length === 0 ? (
        <EmptyBlock title="No pending enrolments" testId="empty-no-pending-enrolments">
          All currently known devices have been reviewed.
        </EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Device</th><th>Enrolled</th><th>User agent</th><th aria-label="Actions" />
            </tr></thead><tbody>
              {pending.map((r) => (
                <tr key={r.deviceId}>
                  <td className="ea-mono">{r.deviceId}</td>
                  <td className="ea-mono">{r.enrolledAt}</td>
                  <td className="ea-cell-two">{r.userAgent ?? '—'}</td>
                  <td className="ea-table-actions">
                    <button type="button" className="ea-btn ea-btn--primary"
                            onClick={() => { approve(r.deviceId).catch(() => undefined); }}>
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapOwnership(): JSX.Element {
  const [rows, err] = useDevices();
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[]>([]);
  useEffect(() => {
    edgeApi.listUsers().then((r) => setUsers(r.users)).catch(() => undefined);
  }, []);
  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const nameFor = (id: string | null): string => users.find((u) => u.userId === id)?.displayName ?? '—';
  return (
    <div className="ea-screen" data-test="cap-ownership">
      <HeroHeader title="Device ownership" subtitle="Who each device belongs to." />
      {rows.length === 0 ? (
        <EmptyBlock title="No devices enrolled" testId="empty-no-devices-enrolled">
          Enrol a device first — ownership shows the assigned operator.
        </EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Device</th><th>Assigned user</th><th>Status</th><th>Last seen</th>
            </tr></thead><tbody>
              {rows.map((r) => (
                <tr key={r.deviceId}>
                  <td className="ea-mono">{r.deviceId}</td>
                  <td>{nameFor(r.assignedUserId)}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.status === 'APPROVED' ? 'success'
                        : r.status === 'PENDING' ? 'info'
                          : 'danger')}>{r.status}</span></td>
                  <td className="ea-mono">{r.lastSeenAt ?? '—'}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapConnections(): JSX.Element {
  const [rows, err] = useDevices();
  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const active = rows.filter((r) => r.status === 'APPROVED');
  const sorted = [...active].sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
  return (
    <div className="ea-screen" data-test="cap-connections">
      <HeroHeader title="Active connections"
        subtitle="Approved devices sorted by most recent activity."
      />
      <div className="ea-stat-strip">
        <Stat label="Active" value={active.length} tone="success" />
        <Stat label="Fleet" value={rows.length} />
      </div>
      {sorted.length === 0 ? (
        <EmptyBlock title="No active devices" testId="empty-no-active-devices">
          Approve a device enrolment to see it here once it checks in.
        </EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Device</th><th>Last seen</th><th>User agent</th><th>Firmware</th>
            </tr></thead><tbody>
              {sorted.map((r) => (
                <tr key={r.deviceId}>
                  <td className="ea-mono">{r.deviceId}</td>
                  <td className="ea-mono">{r.lastSeenAt ?? '—'}</td>
                  <td className="ea-cell-two">{r.userAgent ?? '—'}</td>
                  <td className="ea-mono">{r.firmwareVersion ?? '—'}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

export function CapDeviceDiagnostics(): JSX.Element {
  const [rows, err] = useDevices();
  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const now = Date.now();
  const stale = rows.filter((r) => {
    if (!r.lastSeenAt) return true;
    return now - Date.parse(r.lastSeenAt) > 24 * 3600 * 1000;
  });
  return (
    <div className="ea-screen" data-test="cap-dev-diag">
      <HeroHeader title="Device diagnostics"
        subtitle="Per-device check-in and firmware state."
      />
      <div className="ea-stat-strip">
        <Stat label="Fleet" value={rows.length} />
        <Stat label="Stale (>24h)" value={stale.length}
              tone={stale.length ? 'danger' : 'success'} />
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="No devices" testId="empty-no-devices">The device fleet is empty.</EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-table-wrap">
            <table className="ea-table"><thead><tr>
              <th>Device</th><th>Status</th><th>Firmware</th><th>Last seen</th><th>Enrolled</th>
            </tr></thead><tbody>
              {rows.map((r) => (
                <tr key={r.deviceId}>
                  <td className="ea-mono">{r.deviceId}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.status === 'APPROVED' ? 'success'
                        : r.status === 'PENDING' ? 'info'
                          : 'danger')}>{r.status}</span></td>
                  <td className="ea-mono">{r.firmwareVersion ?? '—'}</td>
                  <td className="ea-mono">{r.lastSeenAt ?? '—'}</td>
                  <td className="ea-mono">{r.enrolledAt}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// MONITORING & ANALYTICS
// ────────────────────────────────────────────────────────────────────

export function CapOperatorMetrics(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.allSettled([edgeApi.systemInfo(), edgeApi.listJobs(100)]).then((r) => {
      if (r[0].status === 'fulfilled') setSi(r[0].value);
      if (r[1].status === 'fulfilled') setJobs(r[1].value);
      if (r[0].status === 'rejected') {
        setErr(r[0].reason instanceof Error ? r[0].reason.message : String(r[0].reason));
      }
    });
  }, []);
  if (err && !si) return <ErrorBlock title="Metrics load failed" testId="err-metrics-load-failed">{err}</ErrorBlock>;
  if (!si || !jobs) return <LoadingBlock testId="loading" />;
  const byJob = jobs.reduce<Record<string, { succ: number; fail: number }>>((acc, j) => {
    const b = acc[j.jobName] ?? { succ: 0, fail: 0 };
    if (j.outcome === 'SUCCEEDED') b.succ += 1;
    if (j.outcome === 'FAILED') b.fail += 1;
    acc[j.jobName] = b;
    return acc;
  }, {});
  return (
    <div className="ea-screen" data-test="cap-metrics">
      <HeroHeader title="Operator metrics"
        subtitle="Capture throughput and worker reliability on this edge."
      />
      <div className="ea-stat-strip">
        <Stat label="Mapped users" value={si.attribution?.mappedUsers ?? '—'} />
        <Stat label="Scheduler jobs" value={si.scheduler.totalJobs ?? '—'} />
        <Stat label="Executing now" value={si.scheduler.executingJobs ?? 0}
              tone={(si.scheduler.executingJobs ?? 0) > 0 ? 'info' : 'muted'} />
      </div>
      <section className="ea-card">
        <div className="ea-card-toolbar">
          <span className="ea-card-count">Job success / failure</span>
        </div>
        <div className="ea-table-wrap">
          <table className="ea-table"><thead><tr>
            <th>Job</th><th>Succeeded</th><th>Failed</th><th>Reliability</th>
          </tr></thead><tbody>
            {Object.entries(byJob).map(([name, b]) => {
              const total = b.succ + b.fail;
              const rel = total ? Math.round((100 * b.succ) / total) : null;
              return (
                <tr key={name}>
                  <td className="ea-mono">{name}</td>
                  <td>{b.succ}</td>
                  <td>{b.fail}</td>
                  <td>{rel == null ? '—' : (
                    <span className={'ea-chip ea-chip--' +
                        (rel >= 95 ? 'success' : rel >= 80 ? 'info' : 'danger')}>
                      {rel}%
                    </span>
                  )}</td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}

export function CapServiceHealth(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.allSettled([edgeApi.health(), edgeApi.systemInfo()]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setSi(r[1].value);
      if (r[0].status === 'rejected') {
        setErr(r[0].reason instanceof Error ? r[0].reason.message : String(r[0].reason));
      }
    });
  }, []);
  if (err) return <ErrorBlock title="Health probe failed" testId="err-health-probe-failed">{err}</ErrorBlock>;
  if (!h || !si) return <LoadingBlock testId="loading" />;
  const dot = (ok: boolean | undefined): JSX.Element =>
    <span className={'ea-chip ea-chip--' + (ok ? 'success' : 'danger')}>{ok ? 'OK' : 'FAIL'}</span>;
  return (
    <div className="ea-screen" data-test="cap-health">
      <HeroHeader title="Service health"
        subtitle={`Overall: ${h.status}. Component status captured at ${si.timestamp}.`}
      />
      <section className="ea-card">
        <div className="ea-table-wrap">
          <table className="ea-table"><thead><tr>
            <th>Component</th><th>Status</th><th>Detail</th>
          </tr></thead><tbody>
            <tr>
              <td>DER service</td>
              <td>{dot(h.status === 'UP')}</td>
              <td className="ea-mono">v{si.build.version}</td>
            </tr>
            <tr>
              <td>Database</td>
              <td>{dot(si.database.configured && !si.database.probeError)}</td>
              <td className="ea-cell-two">{si.database.probeError ?? si.database.product ?? '—'}</td>
            </tr>
            <tr>
              <td>Scheduler</td>
              <td>{dot(si.scheduler.started)}</td>
              <td>{si.scheduler.standbyMode ? 'standby' : 'running'}</td>
            </tr>
            <tr>
              <td>DHIS2 central</td>
              <td>{dot(si.dhis2.probeReachable)}</td>
              <td className="ea-cell-two">{si.dhis2.reason ?? si.dhis2.centralVersion ?? '—'}</td>
            </tr>
            <tr>
              <td>Storage</td>
              <td>{dot(si.storage.status === 'OK')}</td>
              <td>{si.storage.status ?? '—'}</td>
            </tr>
          </tbody></table>
        </div>
      </section>
    </div>
  );
}

export function CapStorage(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.systemInfo().then(setSi)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Storage probe failed" testId="err-storage-probe-failed">{err}</ErrorBlock>;
  if (!si) return <LoadingBlock testId="loading" />;
  const s = si.storage;
  const used = (s.totalBytes ?? 0) - (s.usableBytes ?? 0);
  return (
    <div className="ea-screen" data-test="cap-storage">
      <HeroHeader title="Storage"
        subtitle="Disk usage on the volume backing the DER data root."
      />
      <div className="ea-stat-strip">
        <Stat label="Status" value={s.status ?? '—'}
              tone={s.status === 'OK' ? 'success'
                : s.status === 'WARN' ? 'info'
                  : s.status === 'REJECT' ? 'danger' : 'muted'} />
        <Stat label="Used" value={fmtBytes(used)} />
        <Stat label="Usable" value={fmtBytes(s.usableBytes)} />
        <Stat label="Utilisation"
              value={pct(s.usableBytes ?? 0, s.totalBytes ?? 0)}
              tone={s.status === 'REJECT' ? 'danger'
                : s.status === 'WARN' ? 'info' : 'success'} />
      </div>
      <DefinitionCard title="Thresholds" rows={[
        ['Root', <span key="r" className="ea-mono">{s.root ?? '—'}</span>],
        ['Total', fmtBytes(s.totalBytes)],
        ['Warn below', fmtBytes(s.warnBytes)],
        ['Reject below', fmtBytes(s.rejectBytes)],
      ]} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────────────────────────────────

export function CapProvisioningSetup(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [b, setB] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[]>([]);
  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.compat(),
      edgeApi.getOrgUnitBinding(), edgeApi.listUsers(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setC(r[1].value);
      if (r[2].status === 'fulfilled') setB(r[2].value);
      if (r[3].status === 'fulfilled') setUsers(r[3].value.users);
    });
  }, []);
  if (!h || !c || !b) return <LoadingBlock testId="loading" />;
  const steps = [
    { label: 'DER service running', done: h.status === 'UP' },
    { label: 'DHIS2 reachable', done: c.probeReachable },
    { label: 'Organisation unit bound', done: b.bound },
    { label: 'At least one ADMIN account', done: users.some((u) => u.roles.includes('ADMIN')) },
    { label: 'At least one OPERATOR account', done: users.some((u) => u.roles.includes('OPERATOR')) },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="ea-screen" data-test="cap-setup">
      <HeroHeader title="Provisioning setup"
        subtitle="Checklist for bringing a new edge online."
      />
      <div className="ea-stat-strip">
        <Stat label="Steps complete" value={`${done} / ${steps.length}`}
              tone={done === steps.length ? 'success' : 'info'} />
      </div>
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Checklist</h2>
            <p>Each row is a precondition for the device to serve operators safely.</p>
          </div>
          <ul className="ea-def-list">
            {steps.map((s) => (
              <li key={s.label} className="ea-def-row">
                <dt>{s.label}</dt>
                <dd>
                  <span className={'ea-chip ea-chip--' + (s.done ? 'success' : 'muted')}>
                    {s.done ? 'done' : 'todo'}
                  </span>
                </dd>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export function CapReleases(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.systemInfo().then(setSi)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Build info failed" testId="err-build-info-failed">{err}</ErrorBlock>;
  if (!si) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen" data-test="cap-releases">
      <HeroHeader title="Software & releases"
        subtitle="What is running on this edge, and where it came from."
      />
      <div className="ea-stat-strip">
        <Stat label="DER" value={<span className="ea-mono">v{si.build.version}</span>} />
        <Stat label="Branch" value={si.build.branch} />
        <Stat label="Dirty tree" value={si.build.dirty ? 'yes' : 'no'}
              tone={si.build.dirty ? 'danger' : 'success'} />
      </div>
      <DefinitionCard title="Build identity" rows={[
        ['Commit', <span key="c" className="ea-mono">{si.build.commit}</span>],
        ['Built at', si.build.buildTime],
        ['DHIS2 pinned', si.dhis2.pinnedVersion ?? '—'],
        ['DHIS2 observed', si.dhis2.centralVersion ?? '—'],
      ]} />
    </div>
  );
}

export function CapNetwork(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  useEffect(() => { edgeApi.systemInfo().then(setSi).catch(() => undefined); }, []);
  return (
    <div className="ea-screen" data-test="cap-network">
      <HeroHeader title="Network / TLS"
        subtitle="How this edge reaches DHIS2 and how it is reached in turn."
      />
      <DefinitionCard title="Upstream" rows={[
        ['DHIS2 base URL', <span key="u" className="ea-mono">{si?.dhis2.centralBaseUrl ?? '—'}</span>],
        ['Reachable', si?.dhis2.probeReachable ? 'yes' : 'no'],
      ]} />
      <DefinitionCard title="Local service" rows={[
        ['Hostname', si?.runtime.hostname ?? '—'],
        ['Admin UI', <span key="a" className="ea-mono">/admin</span>],
        ['Edge API', <span key="e" className="ea-mono">/edge-api/v1</span>],
      ]} />
      <p className="ea-field-hint" style={{ padding: '12px 16px' }}>
        TLS certificates are managed by the host reverse proxy, not DER itself.
      </p>
    </div>
  );
}
