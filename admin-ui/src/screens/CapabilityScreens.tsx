import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { HeroHeader } from '../components/HeroHeader';
import { useOrgUnit } from '../components/OrgUnitContext';
import { ErrorBlock, LoadingBlock, EmptyBlock } from '../components/ScreenStates';
import { MetadataTabBar } from '../components/MetadataTabBar';
import { HealthTabBar } from '../components/HealthTabBar';
import { OrgUnitAssociations } from '../components/OrgUnitAssociations';
import { usePaged, TablePager, describeCron, Panel, humaniseState, humaniseTrigger, ScopedFilterChip, SyncStatusBar, Spinner, useTriggerAndWatch, RowMenu, confirmThenRun, Status, useCentralReachable, RelatedMenu, LocalVsCentralBadge } from './shared';
import { UiIcon } from '../components/UiIcon';

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

/** The DER /system/health endpoint reports `starter-ready` while the
 *  service is live (see SystemHealthResponse). `UP` is kept as a synonym
 *  for forwards compatibility with legacy actuator snapshots. */
function isDerUp(status: string | undefined | null): boolean {
  return status === 'UP' || status === 'starter-ready' || status === 'ready';
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
  const [cfg, setCfg] = useState<edgeApi.Dhis2ConnectionPayload | null>(null);
  const [draft, setDraft] = useState<Partial<edgeApi.Dhis2ConnectionPayload>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, d] = await Promise.allSettled([
      edgeApi.systemInfo(), edgeApi.compat(), edgeApi.readDhis2Connection(),
    ]);
    if (a.status === 'fulfilled') setSi(a.value);
    if (b.status === 'fulfilled') setC(b.value);
    if (d.status === 'fulfilled') { setCfg(d.value); setDraft(d.value); }
    if (a.status === 'rejected') setErr(a.reason instanceof Error ? a.reason.message : String(a.reason));
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try { setC(await edgeApi.refreshCompat()); } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setRefreshing(false); }
  }

  function set<K extends keyof edgeApi.Dhis2ConnectionPayload>(
      k: K, v: edgeApi.Dhis2ConnectionPayload[K] | string | boolean | number | null): void {
    setDraft((d) => ({ ...d, [k]: v as edgeApi.Dhis2ConnectionPayload[K] }));
  }

  async function save(): Promise<void> {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const payload: Partial<edgeApi.Dhis2ConnectionPayload> = { ...draft };
      // Don't send masked secret placeholders back
      if (payload.password === '***') delete (payload as Record<string, unknown>).password;
      if (payload.patToken === '***') delete (payload as Record<string, unknown>).patToken;
      const saved = await edgeApi.writeDhis2Connection(payload);
      setCfg(saved); setDraft(saved);
      setMsg('Connection settings saved. Changes take effect on next sync / probe.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  if (err && !si) return <ErrorBlock title="Connection probe failed" testId="err-connection-probe-failed">{err}</ErrorBlock>;
  if (!si || !c || !cfg) return <LoadingBlock testId="loading" />;
  const reach = c.probeReachable;

  const tone: 'success' | 'warning' | 'danger' | 'info' = refreshing
    ? 'info'
    : reach
      ? 'success'
      : (cfg.baseUrl ?? '').length === 0
        ? 'warning'
        : 'danger';
  const statusLabel = refreshing
    ? 'Probing…'
    : reach
      ? `Reachable · ${c.centralVersion ?? 'unknown version'}`
      : (cfg.baseUrl ?? '').length === 0
        ? 'Not configured'
        : 'Unreachable';

  return (
    <div className="ea-screen" data-test="cap-connection">
      <SyncStatusBar
        tone={tone}
        title="Central connection"
        statusLabel={statusLabel}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    data-test="cap-connection-probe"
                    disabled={refreshing}
                    onClick={() => { refresh().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>{refreshing ? 'Probing…' : 'Probe now'}</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="cap-connection-save"
                    disabled={saving}
                    onClick={() => { save().catch(() => undefined); }}>
              {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="refresh" size={14} />}
              <span>{saving ? 'Saving…' : 'Save connection'}</span>
            </button>
          </>
        }
      />

      <Panel title="At a glance">
        <div className="ea-stat-strip">
          <Stat label="Reachable" value={reach ? 'yes' : 'no'}
                tone={reach ? 'success' : 'danger'} />
          <Stat label="Central version" value={c.centralVersion ?? '—'} />
          <Stat label="Profile" value={c.profileName ?? '—'} />
          <Stat label="Probe RTT"
                value={si.dhis2.probeDurationMs != null ? `${si.dhis2.probeDurationMs} ms` : '—'} />
        </div>
      </Panel>

      {msg && (
        <div className="ea-callout ea-callout--success"
             data-test="cap-connection-msg" role="status">{msg}</div>
      )}
      {err && <ErrorBlock title="Save failed" testId="err-conn-save">{err}</ErrorBlock>}

      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Connection</h2>
            <p>Base URL + optional service-account authentication to the central DHIS2.</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Base URL</span>
              <input className="ea-input ea-mono" type="url"
                     placeholder="https://dhis.example.org/dhis"
                     value={draft.baseUrl ?? ''}
                     onChange={(e) => set('baseUrl', e.target.value)} />
              <span className="ea-field-hint">
                No trailing slash. Current compiled default: {si.dhis2.centralBaseUrl ?? '—'}
              </span>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Service account username</span>
              <input className="ea-input" type="text" autoComplete="off"
                     value={draft.username ?? ''}
                     onChange={(e) => set('username', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Service account password</span>
              <input className="ea-input" type="password" autoComplete="new-password"
                     placeholder={cfg.passwordSet ? 'leave blank to keep ***' : 'password'}
                     value={draft.password === '***' ? '' : (draft.password ?? '')}
                     onChange={(e) => set('password', e.target.value)} />
              <span className="ea-field-hint">
                {cfg.passwordSet
                  ? 'A password is already set. Leave blank to keep it unchanged.'
                  : 'Stored encrypted (AES-256-GCM via SecretEnvelope) when der.security.secret-key is configured.'}
              </span>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Personal access token (PAT)</span>
              <input className="ea-input ea-mono" type="password" autoComplete="new-password"
                     placeholder={cfg.patTokenSet ? 'leave blank to keep ***' : 'd2pat_xxx…'}
                     value={draft.patToken === '***' ? '' : (draft.patToken ?? '')}
                     onChange={(e) => set('patToken', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Connect timeout (ms)</span>
              <input className="ea-input ea-mono" type="number" min={1000} max={120000}
                     value={draft.connectTimeoutMillis ?? ''}
                     onChange={(e) => set('connectTimeoutMillis', e.target.value ? Number(e.target.value) : null)} />
            </label>
          </div>
        </div>

        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Compatibility</h2>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Minimum supported DHIS2 version</span>
              <input className="ea-input ea-mono" placeholder="2.41"
                     value={draft.minSupportedVersion ?? ''}
                     onChange={(e) => set('minSupportedVersion', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Maximum tested version</span>
              <input className="ea-input ea-mono" placeholder="2.44"
                     value={draft.maxTestedVersion ?? ''}
                     onChange={(e) => set('maxTestedVersion', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Pinned version (legacy)</span>
              <input className="ea-input ea-mono" placeholder="2.44"
                     value={draft.pinnedVersion ?? ''}
                     onChange={(e) => set('pinnedVersion', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Probe mode</span>
              <select className="ea-input" value={draft.compatMode ?? 'strict'}
                      onChange={(e) => set('compatMode', e.target.value)}>
                <option value="strict">strict — fail closed on probe exceptions</option>
                <option value="permissive">permissive — warn, keep running</option>
              </select>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Snapshot TTL (hours)</span>
              <input className="ea-input ea-mono" type="number" min={1} max={720}
                     value={draft.snapshotTtlHours ?? ''}
                     onChange={(e) => set('snapshotTtlHours', e.target.value ? Number(e.target.value) : null)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Allow version mismatch</span>
              <label className="ea-flag-row">
                <input type="checkbox" className="ea-switch"
                       checked={!!draft.allowMismatch}
                       onChange={(e) => set('allowMismatch', e.target.checked)} />
                <span className="ea-flag-name">
                  Boot even when the central version is outside min / max
                </span>
              </label>
            </label>
          </div>
        </div>

        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>DHIS2 /api/** proxy</h2>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Enabled</span>
              <label className="ea-flag-row">
                <input type="checkbox" className="ea-switch"
                       checked={!!draft.proxyEnabled}
                       onChange={(e) => set('proxyEnabled', e.target.checked)} />
                <span className="ea-flag-name">Pass /api/** through to central (read-side only by default)</span>
              </label>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Allow writes</span>
              <label className="ea-flag-row">
                <input type="checkbox" className="ea-switch"
                       checked={!!draft.proxyAllowWrites}
                       onChange={(e) => set('proxyAllowWrites', e.target.checked)} />
                <span className="ea-flag-name">Also pass POST / PUT / DELETE / PATCH through (bypasses the journal)</span>
              </label>
            </label>
            <label className="ea-field" style={{ gridColumn: '1 / -1' }}>
              <span className="ea-field-label">Allow-path prefixes (CSV, blank = defaults)</span>
              <input className="ea-input ea-mono"
                     placeholder="/api/analytics,/api/dataStore,…"
                     value={draft.proxyAllowPaths ?? ''}
                     onChange={(e) => set('proxyAllowPaths', e.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <DefinitionCard title="Probe details (read-only)" rows={[
        ['Compiled default URL', <span key="u" className="ea-mono">{si.dhis2.centralBaseUrl ?? '—'}</span>],
        ['Observed version', si.dhis2.centralVersion ?? '—'],
        ['Captured at', si.dhis2.capturedAt ?? '—'],
        ['Reason', si.dhis2.reason ?? '—'],
      ]} />
    </div>
  );
}

export function CapOrgUnitBinding(): JSX.Element {
  const { refresh: refreshGlobalOu } = useOrgUnit();
  const [b, setB] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [ous, setOus] = useState<edgeApi.OrgUnitRow[]>([]);
  const [groups, setGroups] = useState<edgeApi.OrgUnitGroupRow[]>([]);
  const [groupSets, setGroupSets] = useState<edgeApi.OrgUnitGroupSetRow[]>([]);
  const [ouLevels, setOuLevels] = useState<edgeApi.OrgUnitLevelRow[]>([]);
  const [pathNames, setPathNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState('');
  const [confirmRebind, setConfirmRebind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebindOpen, setRebindOpen] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<number | ''>('');
  const [filterGroupSet, setFilterGroupSet] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [loadingOus, setLoadingOus] = useState(false);

  async function loadBinding(): Promise<void> {
    try { setB(await edgeApi.getOrgUnitBinding()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function loadFilters(): Promise<void> {
    const [g, gs, lv] = await Promise.allSettled([
      edgeApi.listOrgUnitGroups(),
      edgeApi.listOrgUnitGroupSets(),
      edgeApi.listOrgUnitLevels(),
    ]);
    if (g.status === 'fulfilled') setGroups(g.value.organisationUnitGroups);
    if (gs.status === 'fulfilled') setGroupSets(gs.value.organisationUnitGroupSets);
    if (lv.status === 'fulfilled') setOuLevels(
      [...lv.value.organisationUnitLevels].sort((a, b) => a.level - b.level));
  }
  async function loadOus(): Promise<void> {
    setLoadingOus(true);
    try {
      const r = await edgeApi.listOrgUnits({
        level: typeof filterLevel === 'number' ? filterLevel : undefined,
        groupId: filterGroup || undefined,
        query: query || undefined,
        pageSize: 1000,
      });
      setOus(r.organisationUnits);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingOus(false);
    }
  }

  useEffect(() => { loadBinding().catch(() => undefined); loadFilters().catch(() => undefined); }, []);
  useEffect(() => {
    const h = setTimeout(() => { loadOus().catch(() => undefined); }, 250);
    return () => clearTimeout(h);
    // Why: loadOus closes over current filter state; re-running it on filter
    // change is the intent — we don't want to re-create the debounce when the
    // function identity flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterLevel, filterGroup, filterGroupSet]);

  // Resolve each UID in the binding path to a displayName so the breadcrumb
  // reads as "Country › District › Facility" instead of raw UIDs.
  useEffect(() => {
    const uids = (b?.orgUnitPath ?? '').split('/').filter(Boolean);
    if (uids.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(uids.map(async (uid) => {
        try {
          const ou = await edgeApi.getOrganisationUnit(uid);
          if (ou?.displayName) next[uid] = ou.displayName;
        } catch { /* ignore — fall back to UID */ }
      }));
      if (!cancelled) setPathNames((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [b?.orgUnitPath]);

  // Available groups narrowed to the selected group set
  const availableGroups: edgeApi.OrgUnitGroupRow[] = (() => {
    if (!filterGroupSet) return groups;
    const gs = groupSets.find((x) => x.id === filterGroupSet);
    return gs?.organisationUnitGroups ?? groups;
  })();

  async function doBind(): Promise<void> {
    if (!sel) return;
    setSaving(true);
    setErr(null); setMsg(null);
    try {
      const updated = await edgeApi.bindOrgUnit(sel, confirmRebind);
      setB(updated);
      setSel('');
      setConfirmRebind(false);
      setRebindOpen(false);
      setMsg(`Bound to ${updated.orgUnitDisplayName ?? updated.orgUnitId}.`);
      await refreshGlobalOu();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string | null | undefined, what: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${what} copied to clipboard`);
      setTimeout(() => setMsg((m) => m === `${what} copied to clipboard` ? null : m), 2000);
    } catch { /* ignore */ }
  }

  if (!b) return <LoadingBlock testId="loading" />;

  const levels: Array<{ level: number; label: string }> = ouLevels.length
    ? ouLevels.map((l) => ({ level: l.level, label: `Level ${l.level} · ${l.displayName}` }))
    : Array.from({ length: 7 }, (_, i) => ({ level: i + 1, label: `Level ${i + 1}` }));

  const pathParts = (b.orgUnitPath ?? '').split('/').filter(Boolean);
  const level = pathParts.length;
  // When not bound, auto-open the rebind form so the user can bind directly.
  const showRebindForm = rebindOpen || !b.bound;

  return (
    <div className="ea-screen" data-test="cap-ou">
      <SyncStatusBar
        tone={b.bound ? 'success' : 'muted'}
        title="Organisation unit"
        statusLabel={b.bound ? 'Bound' : 'Not bound'}
        subtitle={b.bound ? <span>Facility bound to this edge. All captured data is attributed here.</span> : <span>No facility bound yet — bind an OU to start capturing data.</span>}
        actions={b.bound && !rebindOpen ? (
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  data-test="ou-change"
                  onClick={() => setRebindOpen(true)}>
            <UiIcon icon="edit" size={14} />
            <span>Change organisation unit</span>
          </button>
        ) : undefined}
      />

      {err && <ErrorBlock title="Binding failed" testId="err-binding-failed">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="ou-msg">{msg}</p>}

      {b.bound && (
        <section className="ea-card" data-test="ou-binding-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
                        padding: '2px 0 8px', borderBottom: '1px solid var(--der-border-subtle)' }}>
            <div style={{ flex: '1 1 auto', minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {b.orgUnitDisplayName ?? '—'}
                </h2>
                <Status tone="success">bound</Status>
                {level > 0 && <Status tone="info">Level {level}</Status>}
              </div>
              {pathParts.length > 0 && (
                <nav aria-label="OU path"
                     data-test="ou-path"
                     style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                              marginTop: 6, fontSize: 12, color: 'var(--der-ink-500)' }}>
                  {pathParts.map((uid, i) => {
                    const name = pathNames[uid];
                    const isLeaf = i === pathParts.length - 1;
                    return (
                      <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span title={uid} style={{ color: isLeaf ? 'var(--der-ink-700)' : undefined,
                                                   fontWeight: isLeaf ? 500 : undefined }}>
                          {name ?? <span className="ea-mono">{uid}</span>}
                        </span>
                        {!isLeaf && <span style={{ opacity: 0.5 }}>›</span>}
                      </span>
                    );
                  })}
                </nav>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="ou-copy-uid"
                      onClick={() => { copy(b.orgUnitId, 'UID').catch(() => undefined); }}>
                Copy UID
              </button>
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="ou-copy-path"
                      onClick={() => { copy(b.orgUnitPath, 'Path').catch(() => undefined); }}>
                Copy path
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                        gap: 12, padding: '10px 0 0' }}>
            <div className="ea-stat ea-stat--info">
              <div className="ea-stat-value ea-mono" style={{ fontSize: 13 }}>{b.orgUnitId ?? '—'}</div>
              <div className="ea-stat-label">DHIS2 UID</div>
            </div>
            <div className="ea-stat ea-stat--info">
              <div className="ea-stat-value" style={{ fontSize: 13 }}>Level {level || '—'}</div>
              <div className="ea-stat-label">Hierarchy depth</div>
            </div>
            <div className="ea-stat ea-stat--muted">
              <div className="ea-stat-value" style={{ fontSize: 13 }}>{b.boundAt ? fmtBindAt(b.boundAt) : '—'}</div>
              <div className="ea-stat-label">Bound at</div>
            </div>
            <div className="ea-stat ea-stat--muted">
              <div className="ea-stat-value" style={{ fontSize: 13 }}>{b.boundBy ?? '—'}</div>
              <div className="ea-stat-label">Bound by</div>
            </div>
          </div>
        </section>
      )}

      {/* UI-13 — surface DHIS2 associations (dataSets, programs,
          organisation-unit groups, parent / children) for the bound
          OU so operators don't have to open DHIS2 central to see
          what's configured. */}
      {b.bound && (
        <section className="ea-card" data-test="ou-associations"
                 style={{ marginTop: 12 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600,
                        letterSpacing: '0.02em',
                        textTransform: 'uppercase' }}>
            Associated metadata
          </h2>
          <OrgUnitAssociations orgUnitId={b.orgUnitId} />
        </section>
      )}

      {!b.bound && !rebindOpen && (
        <EmptyBlock title="Not bound yet" testId="empty-not-bound-yet">
          Pick an organisation unit from DHIS2 to bind this edge.
        </EmptyBlock>
      )}

      {showRebindForm && (
        <section className="ea-card" data-test="ou-rebind-form">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 0 6px', marginBottom: 10,
                        borderBottom: '1px solid var(--der-border-subtle)' }}>
            <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
                         textTransform: 'uppercase' }}>
              {b.bound ? 'Change organisation unit' : 'Bind organisation unit'}
            </h2>
            {b.bound && (
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="ou-rebind-cancel"
                      onClick={() => {
                        setRebindOpen(false); setSel(''); setConfirmRebind(false);
                        setQuery(''); setFilterLevel(''); setFilterGroupSet(''); setFilterGroup('');
                      }}>
                Cancel
              </button>
            )}
          </div>

          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Search</span>
              <input className="ea-input" type="search"
                     placeholder="Type to filter by name"
                     value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Level</span>
              <select className="ea-input" value={filterLevel}
                      onChange={(e) => setFilterLevel(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Any level</option>
                {levels.map((l) => (
                  <option key={l.level} value={l.level}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Group set</span>
              <select className="ea-input" value={filterGroupSet}
                      onChange={(e) => { setFilterGroupSet(e.target.value); setFilterGroup(''); }}>
                <option value="">Any group set</option>
                {groupSets.map((g) => <option key={g.id} value={g.id}>{g.displayName}</option>)}
              </select>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Group</span>
              <select className="ea-input" value={filterGroup}
                      onChange={(e) => setFilterGroup(e.target.value)}>
                <option value="">Any group</option>
                {availableGroups.map((g) => <option key={g.id} value={g.id}>{g.displayName}</option>)}
              </select>
            </label>
          </div>

          <div className="ea-form-grid" style={{ marginTop: 12 }}>
            <label className="ea-field" style={{ gridColumn: '1 / -1' }}>
              <span className="ea-field-label">
                Organisation unit {loadingOus ? '· loading…' : `· ${ous.length} match${ous.length === 1 ? '' : 'es'}`}
              </span>
              <select className="ea-input"
                      value={sel} onChange={(e) => setSel(e.target.value)}
                      data-test="ou-list">
                <option value="">— Select an organisation unit —</option>
                {ous.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayName}
                    {o.level ? ` · Level ${o.level}` : ''}
                    {o.code ? ` · ${o.code}` : ''}
                  </option>
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
                  <span className="ea-flag-name">
                    I understand this clears mirrored metadata and journal state
                  </span>
                </label>
              </label>
            )}
          </div>

          <div className="ea-form-actions" style={{ marginTop: 12 }}>
            <button type="button" className="ea-btn ea-btn--ghost"
                    onClick={() => { setQuery(''); setFilterLevel(''); setFilterGroupSet(''); setFilterGroup(''); setSel(''); }}>
              Reset filters
            </button>
            <button type="button" className="ea-btn ea-btn--primary"
                    data-test="ou-rebind-apply"
                    disabled={!sel || saving || (b.bound && !confirmRebind)}
                    onClick={() => { doBind().catch(() => undefined); }}>
              {saving ? 'Applying…' : b.bound ? 'Apply rebind' : 'Bind'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function fmtBindAt(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function CapProgramRules(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.MetadataListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  useEffect(() => {
    edgeApi.metadataList('programRules', { pageSize: 1000, page: 1 })
      .then((r) => {
        const items = (r.programRules ?? []) as edgeApi.MetadataListItem[];
        setRows(items);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter((r) =>
    !q || (r.displayName ?? '').toLowerCase().includes(q)
       || r.id.toLowerCase().includes(q));
  const paged = usePaged(filtered, 50);

  if (err && !rows) {
    return <ErrorBlock title="Could not load program rules"
                        testId="err-could-not-load-program-r">{err}</ErrorBlock>;
  }
  if (!rows) return <LoadingBlock testId="loading" />;

  const tone: 'muted' | 'info' = rows.length === 0 ? 'muted' : 'info';
  const statusLabel = rows.length === 0
    ? 'No rules mirrored'
    : `${rows.length} rule${rows.length === 1 ? '' : 's'}`;

  return (
    <div className="ea-screen" data-test="cap-rules">
      <SyncStatusBar
        tone={tone}
        title="Program rules"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/dhis2/metadata-sync"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="DHIS2"
                  data-test="cap-rules-open-metadata-sync">
              <UiIcon icon="metadata" size={14} />
              <span>Metadata sync</span>
            </Link>
            <Link to="/dhis2/metadata-drift"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="DHIS2"
                  data-test="cap-rules-open-drift">
              <UiIcon icon="drift" size={14} />
              <span>Drift</span>
            </Link>
          </>
        }
      />
      {rows.length === 0 ? (
        <Panel title="Program rules">
          <EmptyBlock title="No program rules mirrored"
                      testId="empty-no-program-rules-mirrore">
            Run a metadata sync to pull rules from the central DHIS2.
          </EmptyBlock>
        </Panel>
      ) : (
        <Panel title={`Rules (${filtered.length}${q ? ' of ' + rows.length : ''})`}
               action={
                 <input type="search"
                        aria-label="Filter program rules"
                        data-test="cap-rules-search"
                        placeholder="Search by name or id…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="ea-input"
                        style={{ width: 240 }} />
               }>
          {filtered.length === 0 ? (
            <EmptyBlock title="No rules match the search"
                        testId="cap-rules-empty-filter">
              Clear the search to see the full list of {rows.length} rules.
            </EmptyBlock>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense" data-test="cap-rules-table">
                <thead><tr>
                  <th>Name</th>
                  <th style={{ width: 240 }}>ID</th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((r) => (
                    <tr key={r.id} data-test={`cap-rules-row-${r.id}`}>
                      <td>{r.displayName ?? '—'}</td>
                      <td className="ea-mono">{r.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePager {...paged.pagerProps} />
            </div>
          )}
        </Panel>
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

  const tone: 'success' | 'info' | 'warning' | 'danger' | 'muted' = failed > 0
    ? 'danger'
    : backlog >= 100
      ? 'warning'
      : backlog > 0
        ? 'info'
        : jobs == null
          ? 'muted'
          : 'success';
  const statusLabel = jobs == null
    ? 'Loading'
    : failed > 0
      ? `${failed} failed run${failed === 1 ? '' : 's'}`
      : backlog > 0
        ? `${backlog} queued op${backlog === 1 ? '' : 's'}`
        : 'Healthy';

  return (
    <div className="ea-screen" data-test="cap-sync-overview">
      <SyncStatusBar
        tone={tone}
        title="Sync overview"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/sync/history"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="cap-sync-overview-open-history">
              <UiIcon icon="history" size={14} />
              <span>Full history</span>
            </Link>
            <Link to="/sync/worker"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="cap-sync-overview-open-worker">
              <UiIcon icon="worker" size={14} />
              <span>Worker</span>
            </Link>
          </>
        }
      />
      {err && <ErrorBlock title="Partial load" testId="err-partial-load">{err}</ErrorBlock>}

      <Panel title="At a glance">
        <div className="ea-stat-strip">
          <Stat label="Runs (last 50)" value={jobs?.length ?? 0} />
          <Stat label="Succeeded" value={succeeded} tone="success" />
          <Stat label="Failed" value={failed} tone={failed ? 'danger' : 'muted'} />
          <Stat label="Journal backlog" value={backlog}
                tone={backlog === 0 ? 'success' : backlog < 100 ? 'info' : 'danger'} />
        </div>
      </Panel>

      <Panel title="Jump to"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 Deep-dive into the specific sync surfaces
               </span>
             }>
        <div className="ea-tile-grid">
          <LinkTile to="/sync/history" title="Jobs &amp; history" desc="Last scheduled runs and their outcomes." />
          <LinkTile to="/sync/drift" title="Metadata drift" desc="Compare mirrored metadata against central." />
          <LinkTile to="/sync/attention" title="Attention" desc="Operations awaiting a reviewer decision." />
          <LinkTile to="/sync/worker" title="Worker health" desc="Backlog by state and pause / resume." />
        </div>
      </Panel>

      {d && (
        <Panel title="Drift at a glance"
               action={
                 <span data-test="cap-sync-overview-drift-chip">
                   {d.status === 'ok' || d.status === null
                     ? <Status tone="success">In sync</Status>
                     : d.status === 'drift'
                       ? <Status tone="warning">Drift detected</Status>
                       : <Status tone="muted">{d.status ?? 'Unknown'}</Status>}
                 </span>
               }>
          <dl className="ea-def-list" data-test="cap-sync-overview-drift">
            <div className="ea-def-row">
              <dt>Status</dt>
              <dd>{d.status ?? '—'}</dd>
            </div>
            <div className="ea-def-row">
              <dt>Mirror fingerprint</dt>
              <dd className="ea-mono">{d.fingerprintFrom ?? '—'}</dd>
            </div>
            <div className="ea-def-row">
              <dt>Central fingerprint</dt>
              <dd className="ea-mono">{d.fingerprintTo ?? '—'}</dd>
            </div>
          </dl>
        </Panel>
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
  const succeeded = rows.filter((r) => r.outcome === 'SUCCEEDED').length;
  const failed = rows.filter((r) => r.outcome === 'FAILED').length;
  const running = rows.length - succeeded - failed;

  const tone: 'success' | 'warning' | 'danger' | 'info' | 'muted' = failed > 0
    ? 'danger'
    : running > 0
      ? 'info'
      : rows.length === 0
        ? 'muted'
        : 'success';
  const statusLabel = rows.length === 0
    ? 'No runs'
    : failed > 0
      ? `${failed} failed · ${succeeded} succeeded`
      : `${succeeded} succeeded · ${running} running`;

  return (
    <div className="ea-screen" data-test="cap-sync-history">
      <SyncStatusBar
        tone={tone}
        title="Sync history"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/sync"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="cap-sync-history-open-overview">
              <UiIcon icon="overview" size={14} />
              <span>Overview</span>
            </Link>
            <Link to="/sync/schedule"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="cap-sync-history-open-schedule">
              <UiIcon icon="schedule" size={14} />
              <span>Schedule</span>
            </Link>
          </>
        }
      />

      <Panel title={`Runs (${filtered.length}${filter === 'ALL' ? '' : ' of ' + rows.length})`}
             action={
               <select aria-label="Filter runs by outcome"
                       data-test="cap-sync-history-filter"
                       value={filter}
                       onChange={(e) => setFilter(e.target.value as typeof filter)}
                       className="ea-input"
                       style={{ width: 140 }}>
                 <option value="ALL">All outcomes</option>
                 <option value="SUCCEEDED">Succeeded</option>
                 <option value="FAILED">Failed</option>
               </select>
             }>
        {filtered.length === 0 ? (
          <EmptyBlock title={rows.length === 0 ? 'No runs recorded' : 'No runs match the filter'}
                      testId="empty-no-runs-match">
            {rows.length === 0
              ? 'The scheduler has not run any jobs yet on this edge.'
              : 'Change the outcome filter to see other runs.'}
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" data-test="cap-sync-history-table">
              <thead><tr>
                <th>Started</th>
                <th>Job</th>
                <th style={{ width: 130 }}>Outcome</th>
                <th style={{ width: 100 }}>Duration</th>
                <th>Triggered by</th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.runId} data-test={`cap-sync-history-row-${r.runId}`}>
                    <td className="ea-mono">{r.startedAt}</td>
                    <td>{r.jobName}</td>
                    <td data-test={`cap-sync-history-outcome-${r.runId}`}>
                      {r.outcome === 'SUCCEEDED'
                        ? <Status tone="success">Succeeded</Status>
                        : r.outcome === 'FAILED'
                          ? <Status tone="danger">Failed</Status>
                          : <Status tone="info">{r.outcome}</Status>}
                    </td>
                    <td>{r.durationMs != null ? fmtDur(r.durationMs) : '—'}</td>
                    <td className="ea-text-muted">{r.triggeredBy}</td>
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
  const failed = w.backlog.FAILED ?? 0;

  const tone: 'success' | 'warning' | 'danger' | 'info' | 'muted' = failed > 0
    ? 'danger'
    : !w.enabled
      ? 'warning'
      : total >= 100
        ? 'warning'
        : total > 0
          ? 'info'
          : 'success';
  const statusLabel = !w.enabled
    ? 'Worker paused'
    : failed > 0
      ? `${failed} FAILED · ${total} total`
      : total === 0
        ? 'Journal empty'
        : `${total} op${total === 1 ? '' : 's'} pending`;

  return (
    <div className="ea-screen" data-test="cap-queues">
      <SyncStatusBar
        tone={tone}
        title="Data queues"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/sync/worker"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="cap-queues-open-worker">
              <UiIcon icon="worker" size={14} />
              <span>Worker</span>
            </Link>
            {failed > 0 && (
              <Link to="/sync/attention"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    data-cross-module="Sync"
                    data-test="cap-queues-open-attention">
                <UiIcon icon="attention" size={14} />
                <span>Attention queue</span>
              </Link>
            )}
          </>
        }
      />

      <Panel title="Worker state">
        <div className="ea-stat-strip">
          <Stat label="Worker" value={w.enabled ? 'RUNNING' : 'PAUSED'}
                tone={w.enabled ? 'success' : 'muted'} />
          <Stat label="Total backlog" value={total}
                tone={total === 0 ? 'success' : total < 100 ? 'info' : 'danger'} />
          <Stat label="Last tick" value={w.lastTick ?? '—'} />
          <Stat label="Last batch" value={w.lastBatchSize} />
        </div>
      </Panel>

      <Panel title="Backlog by state">
        {entries.length === 0 ? (
          <EmptyBlock title="Journal empty" testId="empty-journal-empty">
            Every outbound operation has been accepted by DHIS2 central
            — nothing left to drain.  New records captured on the
            device land here first, then move to <strong>Sent</strong>
            once the worker completes the push.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="cap-queues-backlog">
              <thead><tr>
                <th style={{ width: 140 }}>State</th>
                <th style={{ textAlign: 'right' }}>Operations</th>
              </tr></thead>
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k} data-test={`cap-queues-row-${k}`}>
                    <td>
                      {k === 'FAILED'
                        ? <Status tone="danger">FAILED</Status>
                        : k === 'PENDING'
                          ? <Status tone="info">PENDING</Status>
                          : <Status tone="success">{k}</Status>}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right' }}>{v}</td>
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


/** /admin/sync/metadata — DER Sync requirements §6. */
export function CapMetadataSync(): JSX.Element {
  const navigate = useNavigate();
  const [history, setHistory] = useState<edgeApi.JobRun[] | null>(null);
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const pull = useTriggerAndWatch();

  async function reload(): Promise<void> {
    // Server-side filter so we always see the latest metadata runs
    // even when thousands of drain/analytics runs sit above them.
    const [j, s] = await Promise.allSettled([
      edgeApi.listJobs(20, 'METADATA_SYNC_FULL'),
      edgeApi.systemInfo(),
    ]);
    if (j.status === 'fulfilled') {
      setHistory(j.value.slice(0, 20));
    }
    if (s.status === 'fulfilled') setSysInfo(s.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  useEffect(() => {
    if (pull.state === 'done' || pull.state === 'failed') {
      reload().catch(() => undefined);
    }
  }, [pull.state]);

  const livePing = useCentralReachable();
  const last = history?.[0];
  const lastSuccess = (history ?? []).find((r) => r.outcome === 'SUCCEEDED' || r.outcome === 'SUCCESS');
  const centralReachable = livePing.reachable ?? sysInfo?.dhis2?.probeReachable ?? false;
  const lastOk = last?.outcome === 'SUCCEEDED' || last?.outcome === 'SUCCESS';
  const tone = !last ? 'muted' : lastOk ? 'success' : 'danger';
  const busy = pull.state === 'triggering' || pull.state === 'running';

  const statusLabel = !last ? 'Never pulled'
    : lastOk ? 'Up to date' : 'Last pull failed';

  return (
    <div className="ea-screen" data-test="cap-metadata-sync">
      <MetadataTabBar />
      <SyncStatusBar
        tone={tone}
        title="Metadata sync"
        statusLabel={statusLabel}
        subtitle={
          <>
            <span>Metadata · Central DHIS2 → DER (pull only)</span>
            {lastSuccess && (
              <>
                <span>·</span>
                <span>Last successful pull{' '}
                  <strong style={{ color: 'var(--der-ink-900)' }}>
                    {new Date(lastSuccess.startedAt).toLocaleString()}
                  </strong>
                </span>
              </>
            )}
            <span>·</span>
            <span>Central DHIS2{' '}
              <strong style={{ color: 'var(--der-ink-900)' }}>
                {centralReachable ? 'reachable' : 'unreachable'}
              </strong>
            </span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={busy || !centralReachable}
                  data-test="trigger-run"
                  onClick={() => { pull.trigger('METADATA_SYNC_FULL').catch(() => undefined); }}>
            {busy ? <Spinner /> : <UiIcon icon="pull" size={14} />}
            <span>{pull.state === 'running' ? 'Pulling…' : 'Pull metadata'}</span>
          </button>
        }
      />

      {pull.state !== 'idle' && (
        <div data-test="metadata-progress"
             style={{
               display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
               color: 'var(--der-ink-500)', marginBottom: 4,
             }}>
          {busy && <Spinner />}
          <Status tone={
            pull.state === 'done' ? 'success'
            : pull.state === 'failed' ? 'danger'
            : pull.state === 'timeout' ? 'warning' : 'info'}>
            {pull.state === 'triggering' ? 'Starting'
              : pull.state === 'running' ? 'Running'
              : pull.state === 'done' ? 'Completed'
              : pull.state === 'failed' ? 'Failed' : 'Still running'}
          </Status>
          <strong style={{ color: 'var(--der-ink-900)' }}>Pull metadata</strong>
          <span style={{ flex: 1 }}>{pull.message}</span>
          {(pull.state === 'done' || pull.state === 'failed' || pull.state === 'timeout') && (
            <button type="button" className="ea-link-btn"
                    style={{ fontSize: 11 }}
                    onClick={pull.reset}>Dismiss</button>
          )}
        </div>
      )}

      {!centralReachable && (
        <p className="ea-text-muted" style={{ margin: '-4px 0 10px', fontSize: 12 }}>
          Central DHIS2 is unavailable right now. The next pull will run as soon as the connection returns.
        </p>
      )}


      <Panel title="Recent pulls">
        {!history || history.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>Never run on this edge.</p>
        ) : (
          <RecentPullsTable history={history} navigate={navigate} />
        )}
      </Panel>
    </div>
  );
}

function RecentPullsTable(
  { history, navigate }:
  { history: ReadonlyArray<edgeApi.JobRun>;
    navigate: ReturnType<typeof useNavigate> }
): JSX.Element {
  const paged = usePaged(history, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense ea-table--selectable">
        <thead><tr>
          <th>When</th>
          <th>Result</th>
          <th>Duration</th>
          <th>Triggered by</th>
          <th style={{ width: 48 }} aria-label="Actions"></th>
        </tr></thead>
        <tbody>
          {paged.rows.map((h) => {
            const ok = h.outcome === 'SUCCEEDED' || h.outcome === 'SUCCESS';
            return (
              <tr key={h.runId}
                  onClick={() => navigate(`/sync/history/${h.runId}`)}
                  data-test={`metadata-row-${h.runId}`}>
                <td>{new Date(h.startedAt).toLocaleString()}</td>
                <td><Status tone={ok ? 'success' : 'danger'}>{ok ? 'Succeeded' : 'Failed'}</Status></td>
                <td>{h.durationMs != null ? fmtDur(h.durationMs) : '—'}</td>
                <td>{humaniseTrigger(h.triggeredBy)}</td>
                <td style={{ textAlign: 'right' }}>
                  <RowMenu items={[
                    { label: 'Open details', to: `/sync/history/${h.runId}` },
                  ]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
    </div>
  );
}

/** /admin/sync/data — DER Sync requirements §7. Thin wrapper over the
 *  existing DataQueues implementation (which already carries the
 *  activity-feed table + payload drawer). The screen is reachable
 *  through `/sync/data` as well as the legacy `/sync/queues`. */
export function CapDataExchange(): JSX.Element {
  // Legacy export kept so existing bookmarks still resolve; the full
  // Data screen lives in MoreScreens → DataQueues (routed on
  // /sync/data). Rendering DataQueues directly here would create
  // a circular import.
  return (
    <div className="ea-screen">
      <p className="ea-text-muted" style={{ margin: 0 }}>
        The Data page has moved. <Link to="/data/queue"
                                        data-cross-module="Data">
          Open the Data queue →
        </Link>
      </p>
    </div>
  );
}

/** /admin/sync/settings — DER Sync requirements §12. */
export function CapSyncSettings(): JSX.Element {
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const [history, setHistory] = useState<edgeApi.CompatSnapshot[] | null>(null);
  const [testing, setTesting] = useState(false);
  const ping = useCentralReachable();

  async function reload(): Promise<void> {
    try { setSysInfo(await edgeApi.systemInfo()); } catch { /* ignore */ }
    try { setHistory((await edgeApi.compatHistory(100)).snapshots); } catch { /* ignore */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function testConnection(): Promise<void> {
    setTesting(true);
    try {
      await edgeApi.refreshCompat();
      await reload();
    } catch { /* ignore — status strip will reflect the probe result */ }
    finally { setTesting(false); }
  }

  // Reliability metrics — "% of the last N probes that succeeded".
  const successCount = (history ?? []).filter((s) => s.probeReachable).length;
  const totalCount = history?.length ?? 0;
  const reliability = totalCount > 0 ? Math.round((100 * successCount) / totalCount) : 0;
  const lastSnap = history?.[0];
  // Prefer the live ping; fall back to the last compat snapshot on first paint.
  const isLive = ping.reachable ?? sysInfo?.dhis2?.probeReachable ?? false;
  const latencyMs = ping.latencyMs ?? lastSnap?.probeDurationMs ?? sysInfo?.dhis2?.probeDurationMs ?? null;
  const centralVersion = lastSnap?.centralVersion ?? sysInfo?.dhis2?.centralVersion ?? null;
  const authKind = sysInfo?.dhis2 ? 'Basic' : 'Unknown';

  return (
    <div className="ea-screen" data-test="cap-sync-settings">
      <SyncStatusBar
        tone={isLive ? 'success' : 'warning'}
        title="Sync Settings"
        statusLabel={isLive ? 'Connected' : 'Offline-first'}
        subtitle={
          <>
            <span>Central DHIS2 connection + sync behaviour for this edge.</span>
            <span>·</span>
            <span>{reliability}% uptime over last {totalCount} probe{totalCount === 1 ? '' : 's'}</span>
          </>
        }
        actions={
          <>
            <Link to="/dhis2/connection" className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="DHIS2">
              <UiIcon icon="edit" size={14} />
              <span>Open DHIS2 configuration</span>
            </Link>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    disabled={testing}
                    onClick={() => { testConnection().catch(() => undefined); }}
                    data-test="sync-test-connection">
              {testing ? <span className="ea-btn-spinner" /> : <UiIcon icon="refresh" size={14} />}
              <span>{testing ? 'Probing…' : 'Probe now'}</span>
            </button>
          </>
        }
      />

      <section className="ea-dhis2-conn-card" data-test="dhis2-connection-card">
        <div className={'ea-dhis2-conn-pulse' + (isLive ? ' ea-dhis2-conn-pulse--on' : ' ea-dhis2-conn-pulse--off')}
             aria-hidden="true">
          <div className="ea-dhis2-conn-pulse-core" />
          {isLive && <>
            <div className="ea-dhis2-conn-pulse-ring ea-dhis2-conn-pulse-ring--1" />
            <div className="ea-dhis2-conn-pulse-ring ea-dhis2-conn-pulse-ring--2" />
            <div className="ea-dhis2-conn-pulse-ring ea-dhis2-conn-pulse-ring--3" />
          </>}
          {!isLive && <div className="ea-dhis2-conn-pulse-slash" />}
        </div>
        <div className="ea-dhis2-conn-info">
          <div className="ea-dhis2-conn-headline"
               style={{ color: isLive ? 'var(--der-success-ink)' : 'var(--der-warning-ink)' }}>
            {isLive ? 'DHIS2 Central is online' : 'DHIS2 Central is unreachable'}
          </div>
          <div className="ea-dhis2-conn-sub">
            {isLive
              ? <>Reached in {latencyMs != null ? `${latencyMs} ms` : '—'} · live-probing every 15 s</>
              : <>{ping.message ?? 'Last probe did not complete. Local captures continue to queue safely.'}</>}
          </div>
          <dl className="ea-dhis2-conn-facts">
            <div><dt>URL</dt><dd className="ea-mono">{sysInfo?.dhis2?.centralBaseUrl ?? '—'}</dd></div>
            <div><dt>Central version</dt><dd>{centralVersion ?? '—'}</dd></div>
            <div><dt>Pinned</dt><dd>{sysInfo?.dhis2?.pinnedVersion ?? '—'}</dd></div>
            <div><dt>Profile</dt><dd>{sysInfo?.dhis2?.profileName ?? '—'}</dd></div>
            <div><dt>Auth</dt><dd>{authKind}</dd></div>
            <div><dt>Last probe</dt>
              <dd>{lastSnap?.capturedAt ? new Date(lastSnap.capturedAt).toLocaleString() : '—'}</dd></div>
          </dl>
        </div>
      </section>

      <section className="ea-panel" data-test="sync-reliability">
        <div className="ea-panel-head">
          <div className="ea-panel-title">Reliability — last 100 probes</div>
          <div className="ea-text-muted" style={{ fontSize: 12 }}>
            {successCount} succeeded · {totalCount - successCount} failed · {reliability}% uptime
          </div>
        </div>
        <div className="ea-sparkline" aria-label={`${reliability}% probe reliability`}>
          {(history ?? []).slice(0, 60).reverse().map((s, i) => (
            <span key={s.snapshotId ?? i}
                  className={'ea-sparkline-bar' + (s.probeReachable ? ' ea-sparkline-bar--ok' : ' ea-sparkline-bar--bad')}
                  title={`${s.probeReachable ? 'OK' : 'Fail'} · ${s.probeDurationMs ?? '—'} ms · ${s.capturedAt ?? ''}`}
                  style={{ height: `${Math.min(100, Math.max(8, (s.probeDurationMs ?? 100) / 20))}%` }} />
          ))}
          {totalCount === 0 && (
            <div className="ea-text-muted" style={{ fontSize: 12, padding: '20px 0' }}>
              No probe snapshots recorded yet.
            </div>
          )}
        </div>
      </section>

      <section className="ea-panel">
        <div className="ea-panel-head">
          <div className="ea-panel-title">Sync behaviour</div>
        </div>
        <div style={{ padding: 14 }}>
          <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
            Batch size, retry delay, back-off and request timeout are managed
            via scheduler cron expressions.
          </p>
          {/* §2.3.107 R-AB — all three jumps leave this (Integration /
              DHIS2 Compat) screen for other modules. One disclosed
              Related menu replaces three unlabelled primary buttons. */}
          <RelatedMenu dataTest="dhis2-compat-related" items={[
            { label: 'Open schedule',  module: 'Sync',     to: '/sync/schedule' },
            { label: 'Open Sync history', module: 'Sync',  to: '/sync/history' },
            { label: 'Fine-grained settings', module: 'Settings', to: '/settings' },
          ]} />
        </div>
      </section>
    </div>
  );
}

/** Plain-English title + description for each known scheduler key.
 *  Falls back to the raw key when a new one shows up on a future build. */
function scheduleKeyInfo(key: string): { title: string; desc: string } {
  switch (key) {
    case 'sync.metadata':
      return {
        title: 'Pull latest metadata',
        desc: 'Mirror DHIS2 metadata (data elements, programs, OUs) down to DER so capture surfaces work offline.',
      };
    case 'sync.data':
    case 'journal.drain':
      return {
        title: 'Push outgoing data',
        desc: 'Drain locally captured data up to central DHIS2 as soon as the WAN comes back.',
      };
    case 'analytics.refresh':
      return {
        title: 'Rebuild analytics tables',
        desc: 'Recompute aggregate / event analytics tables so dashboards reflect recent captures.',
      };
    case 'referral.inbox':
      return {
        title: 'Check for incoming referrals',
        desc: 'Poll central for referrals addressed to this edge.',
      };
    case 'backup.rotate':
      return {
        title: 'Rotate backups',
        desc: 'Prune old backup files and prepare the next rolling snapshot.',
      };
    case 'compat.refresh':
      return {
        title: 'Refresh DHIS2 compatibility',
        desc: 'Re-probe central to confirm version + capability compatibility.',
      };
    default:
      return { title: key, desc: 'Scheduled DER flow.' };
  }
}

/** Map scheduler settings-key (e.g. "sync.metadata") to the server-side
 *  Quartz job-name (e.g. "METADATA_SYNC_FULL") so Run-now hits the right
 *  trigger endpoint. Unknown keys get an empty job-name — Run-now disabled. */
function jobNameForKey(key: string): string {
  switch (key) {
    case 'sync.metadata':      return 'METADATA_SYNC_FULL';
    case 'sync.data':
    case 'journal.drain':      return 'JOURNAL_WORKER_DRAIN';
    case 'analytics.refresh':  return 'ANALYTICS_REFRESH';
    case 'referral.inbox':     return 'REFERRAL_INBOX_POLL';
    case 'backup.rotate':      return 'BACKUP_ROUTINE_DRAIN';
    case 'compat.refresh':     return 'COMPAT_REFRESH';
    case 'drift.snapshot':     return 'DRIFT_SNAPSHOT';
    default:                   return '';
  }
}

/** UiIcon id that depicts each scheduled flow. */
function iconForKey(key: string): 'metadata' | 'push' | 'analytics' | 'referral' | 'backup' | 'compat' | 'drift' | 'schedule' {
  switch (key) {
    case 'sync.metadata':      return 'metadata';
    case 'sync.data':
    case 'journal.drain':      return 'push';
    case 'analytics.refresh':  return 'analytics';
    case 'referral.inbox':     return 'referral';
    case 'backup.rotate':      return 'backup';
    case 'compat.refresh':     return 'compat';
    case 'drift.snapshot':     return 'drift';
    default:                   return 'schedule';
  }
}

export function CapSyncSchedule(): JSX.Element {
  const [s, setS] = useState<edgeApi.SettingsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [recentRuns, setRecentRuns] = useState<Record<string, edgeApi.JobRun | null>>({});
  const [flashKey, setFlashKey] = useState<string | null>(null);

  async function reloadRecents(keys: readonly string[]): Promise<void> {
    const entries = await Promise.all(keys.map(async (k) => {
      const name = jobNameForKey(k);
      if (!name) return [k, null] as const;
      try {
        const runs = await edgeApi.listJobs(1, name);
        return [k, runs[0] ?? null] as const;
      } catch { return [k, null] as const; }
    }));
    const next: Record<string, edgeApi.JobRun | null> = {};
    for (const [k, r] of entries) next[k] = r;
    setRecentRuns(next);
  }

  useEffect(() => {
    edgeApi.readSettings().then((v) => {
      setS(v);
      void reloadRecents(Object.keys(v.cron ?? {}));
    }).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  async function save(): Promise<void> {
    if (!s) return;
    setStatus('saving');
    try { await edgeApi.saveSettings(s); setStatus('saved'); }
    catch (e) { setStatus('error'); setErr(e instanceof Error ? e.message : String(e)); }
  }

  async function runNow(cronKey: string): Promise<void> {
    const name = jobNameForKey(cronKey);
    if (!name) return;
    try {
      await edgeApi.triggerJob(name);
      setFlashKey(cronKey);
      setTimeout(() => setFlashKey((v) => (v === cronKey ? null : v)), 3000);
      // Give the job 1.5 s to kick off, then refresh the last-run cell.
      setTimeout(() => { void reloadRecents([cronKey]); }, 1500);
    } catch { /* ignore — the sync-history page will show the failure if any */ }
  }

  if (err && !s) return <ErrorBlock title="Settings load failed" testId="err-settings-load-failed">{err}</ErrorBlock>;
  if (!s) return <LoadingBlock testId="loading" />;
  const cron = Object.entries(s.cron ?? {});
  return (
    <div className="ea-screen" data-test="cap-schedule">
      <SyncStatusBar
        tone="info"
        title="Schedule"
        statusLabel={`${cron.length} scheduled flow${cron.length === 1 ? '' : 's'}`}
        subtitle={
          <>
            <span>Background flows that keep DER aligned with Central DHIS2.</span>
            <span>·</span>
            <span>Edit the cron expression per row, run any flow now, or jump to its history.</span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={status === 'saving'}
                  onClick={() => { save().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>{status === 'saving' ? 'Saving…' : 'Save schedule'}</span>
          </button>
        }
      />
      {status === 'saved' && <p className="ea-saved">Schedule saved.</p>}
      {status === 'error' && err && <ErrorBlock title="Save failed" testId="err-save-failed">{err}</ErrorBlock>}

      {cron.length === 0 ? (
        <EmptyBlock title="No scheduled flows" testId="empty-schedule">
          This build has no cron entries configured. Add them under
          Settings or recompile with <code>der.*.cron</code> defaults.
        </EmptyBlock>
      ) : (
        <Panel title="Scheduled flows">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Flow</th>
                  <th>Runs</th>
                  <th>Last run</th>
                  <th>Status</th>
                  <th style={{ width: 48 }} aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {cron.map(([k, v]) => (
                  <ScheduleRow
                    key={k}
                    cronKey={k}
                    value={v}
                    lastRun={recentRuns[k] ?? null}
                    onChange={(nv) => setS({ ...s, cron: { ...s.cron, [k]: nv } })}
                    onRunNow={() => { void runNow(k); }}
                    flash={flashKey === k}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** Per-flow row — Flow name + description, plain-English schedule,
 *  last-run status (via `<Status>` marker), per-row context menu with
 *  Run now / Show expression / View history / Copy expression. */
function ScheduleRow({ cronKey, value, onChange, onRunNow, lastRun, flash }: {
  cronKey: string;
  value: string;
  onChange: (v: string) => void;
  onRunNow: () => void;
  lastRun: edgeApi.JobRun | null;
  flash: boolean;
}): JSX.Element {
  const [showExpr, setShowExpr] = useState(false);
  const info = scheduleKeyInfo(cronKey);
  const icon = iconForKey(cronKey);
  const jobName = jobNameForKey(cronKey);
  const canTrigger = jobName.length > 0;
  const outcomeTone: 'success' | 'danger' | 'warning' | 'info' | 'muted'
    = !lastRun ? 'muted'
    : (lastRun.outcome === 'SUCCESS' || lastRun.outcome === 'SUCCEEDED') ? 'success'
    : (lastRun.outcome === 'FAILED' || lastRun.outcome === 'FAILURE') ? 'danger'
    : (lastRun.outcome === 'STARTED') ? 'info' : 'warning';
  const outcomeLabel = !lastRun ? 'Never run'
    : lastRun.outcome === 'STARTED' ? 'Running'
    : humaniseState(lastRun.outcome);
  const menuItems = [
    ...(canTrigger ? [{ label: 'Run now', onSelect: onRunNow }] : []),
    { label: showExpr ? 'Hide expression' : 'Edit expression',
      onSelect: () => setShowExpr((x) => !x) },
    { label: 'Copy expression',
      onSelect: () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(value).catch(() => undefined);
        }
      } },
    ...(canTrigger ? [{ label: 'View history',
      to: `/sync/history?jobName=${encodeURIComponent(jobName)}` }] : []),
  ];
  return (
    <>
      <tr data-test={`cron-row-${cronKey}`}
          onClick={() => setShowExpr((x) => !x)}>
        <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true">
          <UiIcon icon={icon} size={18} />
        </td>
        <td>
          <div style={{ fontWeight: 500 }}>{info.title}</div>
          <div className="ea-text-muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
            {info.desc}
          </div>
          {flash && (
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--der-success-ink)' }}>
              ✓ Triggered — see history for progress
            </div>
          )}
        </td>
        <td>
          <div>{describeCron(value)}</div>
          <div className="ea-text-muted ea-mono" style={{ fontSize: 12 }}>{value}</div>
        </td>
        <td className="ea-text-muted">
          {lastRun?.startedAt ? fmtAgo(lastRun.startedAt) : '—'}
        </td>
        <td>
          <Status tone={outcomeTone}>{outcomeLabel}</Status>
        </td>
        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
          <RowMenu items={menuItems} />
        </td>
      </tr>
      {showExpr && (
        <tr data-test={`cron-expr-${cronKey}`}>
          <td></td>
          <td colSpan={5} style={{ paddingTop: 0 }}>
            <label className="ea-field" style={{ display: 'block' }}>
              <span className="ea-field-label" title={cronKey}>Cron expression</span>
              <input className="ea-input ea-mono" value={value}
                     data-test={`cron-input-${cronKey}`}
                     onChange={(e) => onChange(e.target.value)}
                     onClick={(e) => e.stopPropagation()} />
              <span className="ea-field-hint">
                <code>seconds minutes hours day-of-month month day-of-week</code>
              </span>
            </label>
          </td>
        </tr>
      )}
    </>
  );
}

/** Local alias to avoid importing fmtAgo on the top level — Schedule
 *  only consumer in this file. */
function fmtAgo(iso: string): string {
  const now = Date.now();
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

// ────────────────────────────────────────────────────────────────────
// WORKFLOWS & APPROVALS
// ────────────────────────────────────────────────────────────────────

export function CapWorkflowRuns(): JSX.Element {
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [runs, setRuns] = useState<Array<edgeApi.CaptureWorkflowRun & { workflowName: string }>>([]);
  const [err, setErr] = useState<string | null>(null);

  // Scope to a single workflow when ?workflow=<id> is supplied — this
  // is how the Workflows catalogue drills into runs now that the
  // Runs page is no longer in the sidebar.
  const workflowFilter = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('workflow')
    : null;

  useEffect(() => {
    (async () => {
      try {
        const w = await edgeApi.listWorkflows();
        setWfs(w.workflows);
        const all: Array<edgeApi.CaptureWorkflowRun & { workflowName: string }> = [];
        for (const wf of w.workflows) {
          if (workflowFilter && wf.workflowId !== workflowFilter) continue;
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
  }, [workflowFilter]);
  if (err && !wfs) return <ErrorBlock title="Runs load failed" testId="err-runs-load-failed">{err}</ErrorBlock>;
  if (!wfs) return <LoadingBlock testId="loading" />;
  const completed = runs.filter((r) => r.state === 'COMPLETED').length;
  const inFlight = runs.filter((r) => r.state !== 'COMPLETED' && r.state !== 'REJECTED').length;
  const scopedWorkflow = workflowFilter
    ? wfs.find((w) => w.workflowId === workflowFilter)
    : null;
  return (
    <div className="ea-screen" data-test="cap-wf-runs">
      <SyncStatusBar
        tone={runs.length === 0 ? 'muted' : inFlight > 0 ? 'info' : 'success'}
        title={scopedWorkflow ? `${scopedWorkflow.displayName} · Runs` : 'Workflow runs'}
        statusLabel={runs.length === 0 ? 'None yet'
          : inFlight > 0 ? `${inFlight} in flight`
          : `${runs.length} recorded`}
        subtitle={
          scopedWorkflow ? (
            <>
              <Link to="/workflows" data-cross-module="Workflows">← Back to workflows</Link>
              <span>·</span>
              <span>Runs for <strong style={{ color: 'var(--der-ink-900)' }}>{scopedWorkflow.displayName}</strong></span>
            </>
          ) : (
            <>
              <span>Workflow runs across every workflow definition on this edge.</span>
              <span>·</span>
              <span>Workflows <strong style={{ color: 'var(--der-ink-900)' }}>{wfs.length}</strong></span>
              {completed > 0 && (<><span>·</span><span>Completed <strong style={{ color: 'var(--der-ink-900)' }}>{completed}</strong></span></>)}
            </>
          )
        }
      />
      {runs.length === 0 ? (
        <EmptyBlock title="No runs recorded" testId="empty-no-runs-recorded">
          No workflow run has been opened yet on this edge.  Operators
          start runs from the mobile client; if the fleet reports
          activity but nothing appears here, check that the workflow
          catalogue entry is <strong>enabled</strong> on
          <Link to="/workflows/manage" data-cross-module="Workflows"
                 style={{ marginLeft: 4 }}>Workflow management</Link>.
        </EmptyBlock>
      ) : (
        <Panel title="Runs">
          <WorkflowRunsTable runs={runs} />
        </Panel>
      )}
    </div>
  );
}

function WorkflowRunsTable(
  { runs }: { runs: ReadonlyArray<edgeApi.CaptureWorkflowRun & { workflowName: string }> }
): JSX.Element {
  const paged = usePaged(runs, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr>
          <th>Workflow</th><th>Status</th><th>Business key</th><th>Started</th>
        </tr></thead>
        <tbody>
          {paged.rows.map((r) => (
            <tr key={r.runId}>
              <td style={{ fontWeight: 500 }}>{r.workflowName}</td>
              <td>
                <Status tone={
                  r.state === 'COMPLETED' ? 'success'
                  : r.state === 'REJECTED' ? 'danger'
                  : 'info'} title={r.state}>{humaniseState(r.state)}</Status>
              </td>
              <td className="ea-mono">{r.businessKey}</td>
              <td className="ea-text-muted"
                  title={r.createdAt}>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
    </div>
  );
}

export function CapStepAssignments(): JSX.Element {
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const workflowFilter = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('workflow')
    : null;

  useEffect(() => {
    edgeApi.listWorkflows().then((r) => setWfs(r.workflows))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="Workflow load failed" testId="err-workflow-load-failed">{err}</ErrorBlock>;
  if (!wfs) return <LoadingBlock testId="loading" />;
  const scopedWorkflow = workflowFilter
    ? wfs.find((w) => w.workflowId === workflowFilter)
    : null;
  const displayed = scopedWorkflow ? [scopedWorkflow] : wfs;
  const totalSteps = displayed.reduce((a, w) => a + (w.steps?.length ?? 0), 0);
  return (
    <div className="ea-screen" data-test="cap-assignments">
      <SyncStatusBar
        tone={totalSteps === 0 ? 'muted' : 'info'}
        title={scopedWorkflow ? `${scopedWorkflow.displayName} · Steps` : 'Step assignments'}
        statusLabel={totalSteps === 0 ? 'None' : `${totalSteps} step${totalSteps === 1 ? '' : 's'}`}
        subtitle={
          scopedWorkflow ? (
            <>
              <Link to="/workflows" data-cross-module="Workflows">← Back to workflows</Link>
              <span>·</span>
              <span>Role assignments for <strong style={{ color: 'var(--der-ink-900)' }}>{scopedWorkflow.displayName}</strong></span>
            </>
          ) : (
            <>
              <span>Which role is responsible for each workflow step.</span>
              <span>·</span>
              <span>Workflows <strong style={{ color: 'var(--der-ink-900)' }}>{wfs.length}</strong></span>
            </>
          )
        }
      />
      {displayed.length === 0 || totalSteps === 0 ? (
        <EmptyBlock title="No steps defined" testId="empty-no-workflows-defined">
          {scopedWorkflow
            ? 'This workflow has no steps yet. Open the designer to add them.'
            : 'Define a workflow first to see step assignments.'}
        </EmptyBlock>
      ) : (
        <Panel title="Assignments">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"><thead><tr>
              {!scopedWorkflow && <th>Workflow</th>}
              <th style={{ width: 60 }}>Step</th>
              <th>Name</th>
              <th>Owner role</th>
              <th>Kind</th>
              <th>Device</th>
              <th></th>
            </tr></thead><tbody>
              {displayed.flatMap((w) => (w.steps ?? []).map((s) => (
                <tr key={w.workflowId + '-' + s.ordinal}>
                  {!scopedWorkflow && <td style={{ fontWeight: 500 }}>{w.displayName}</td>}
                  <td className="ea-mono">{s.ordinal}</td>
                  <td>{s.displayName}</td>
                  <td><span className="ea-chip ea-chip--info" title={s.ownerRole}>{humaniseState(s.ownerRole)}</span></td>
                  <td><span className="ea-chip ea-chip--neutral" title={s.stepKind}>{humaniseState(s.stepKind)}</span></td>
                  <td className="ea-mono" style={{ fontSize: 12 }}>
                    {s.ownerDeviceId
                      ? s.ownerDeviceId.slice(0, 8) + '…'
                      : <span className="ea-text-muted">any</span>}
                  </td>
                  <td>
                    <Link to={`/workflows/${w.workflowId}`} className="ea-link-btn"
                           style={{ fontSize: 12 }}>Edit</Link>
                  </td>
                </tr>
              )))}
            </tbody></table>
          </div>
        </Panel>
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
  const accepted = rows.filter((r) => r.status === 'ACCEPTED').length;
  const dismissed = rows.filter((r) => r.status === 'DISMISSED').length;
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const tone: 'muted' | 'info' | 'warning' = rows.length === 0
    ? 'muted'
    : pending > 0
      ? 'warning'
      : 'info';
  return (
    <div className="ea-screen" data-test="cap-ref-history">
      <SyncStatusBar
        tone={tone}
        title="Referral history"
        statusLabel={rows.length === 0
          ? 'None received'
          : pending > 0
            ? `${pending} pending · ${rows.length} total`
            : `${accepted} accepted · ${dismissed} dismissed`}
        subtitle={
          <>
            <span>Every referral this edge has received.</span>
            <span>·</span>
            <span>Accepted <strong style={{ color: 'var(--der-ink-900)' }}>{accepted}</strong></span>
            <span>·</span>
            <span>Dismissed <strong style={{ color: 'var(--der-ink-900)' }}>{dismissed}</strong></span>
            <span>·</span>
            <span>Pending <strong style={{ color: 'var(--der-ink-900)' }}>{pending}</strong></span>
          </>
        }
        actions={
          pending > 0
            ? (
              <Link to="/referral/inbox"
                    className="ea-btn ea-btn--primary ea-btn--sm"
                    data-cross-module="Data"
                    data-test="ref-hist-open-inbox">
                <UiIcon icon="referral" size={14} />
                <span>Handle pending ({pending})</span>
              </Link>
            )
            : (
              <Link to="/referral/inbox"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    data-cross-module="Data"
                    data-test="ref-hist-open-inbox">
                <UiIcon icon="referral" size={14} />
                <span>Inbox</span>
              </Link>
            )
        }
      />
      {rows.length === 0 ? (
        <EmptyBlock title="No referrals yet" testId="empty-no-referrals-yet">
          Patients and events referred to this edge from other
          facilities land here.  The inbox scan runs every 10 minutes
          by default; the first referral can also arrive instantly
          over the peer-mesh HTTP channel.
        </EmptyBlock>
      ) : (
        <Panel title="Referrals">
          <ReferralHistoryTable rows={rows} />
        </Panel>
      )}
    </div>
  );
}

function ReferralHistoryTable(
  { rows }: { rows: ReadonlyArray<edgeApi.ReferralInboxRow> }
): JSX.Element {
  const paged = usePaged(rows, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr>
          <th>Received</th><th>Kind</th><th>Source ref</th><th>Status</th>
        </tr></thead>
        <tbody>
          {paged.rows.map((r) => (
            <tr key={r.inboxId} data-test={`ref-hist-row-${r.inboxId}`}>
              <td className="ea-text-muted"
                  title={r.discoveredAt}>{new Date(r.discoveredAt).toLocaleString()}</td>
              <td data-test={`ref-hist-kind-${r.inboxId}`}>
                <Status tone="info" title={r.kind}>{humaniseState(r.kind)}</Status>
              </td>
              <td className="ea-mono">{r.sourceRef}</td>
              <td data-test={`ref-hist-status-${r.inboxId}`}>
                <Status tone={
                  r.status === 'ACCEPTED' ? 'success'
                  : r.status === 'DISMISSED' ? 'muted' : 'warning'} title={r.status}>
                  {humaniseState(r.status)}
                </Status>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
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
      <SyncStatusBar
        tone="info"
        title={title}
        statusLabel="DHIS2 app"
        subtitle={<span>{desc}</span>}
        actions={
          <a className="ea-btn ea-btn--primary ea-btn--sm" href={href} target="_blank" rel="noreferrer">
            Open in new tab ↗
          </a>
        }
      />
      <Panel title="About">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--der-ink-700)' }}>
          This surface opens the DHIS2 Core app bundled with this edge. All
          writes flow back through the DER journal, so sync, drift and
          attention review on this console continue to apply.
        </p>
        <dl className="ea-def-list" style={{ marginTop: 10 }}>
          <div className="ea-def-row"><dt>DHIS2 app</dt><dd className="ea-mono">{href}</dd></div>
          <div className="ea-def-row"><dt>Mode</dt><dd>Deep-link (new tab)</dd></div>
        </dl>
      </Panel>
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

/* ────────────────────────────────────────────────────────────────
 * CapDrafts — Data › Drafts & pending.
 *
 * Comprehensive admin surface for the /edge-api/v1/drafts resource.
 * Covers every draft kind the server accepts (aggregate, event,
 * tracker-tei, tracker-enrollment, tracker-event), the E6 scheduling
 * surface, and the Phase 14.5b bulk-publish endpoint.
 * ──────────────────────────────────────────────────────────────── */

/** Human-readable labels for every publishable draft kind. */
const DRAFT_KINDS: ReadonlyArray<{ value: string; label: string; tone: 'info' | 'warning' | 'success' }> = [
  { value: 'aggregate',          label: 'Aggregate',           tone: 'info' },
  { value: 'event',              label: 'Event',               tone: 'info' },
  { value: 'tracker-tei',        label: 'Tracker — TEI',       tone: 'warning' },
  { value: 'tracker-enrollment', label: 'Tracker — Enrolment', tone: 'warning' },
  { value: 'tracker-event',      label: 'Tracker — Event',     tone: 'warning' },
];

/** Server considers these publishable. Anything else gets a 400
 *  DRAFT_KIND_NOT_PUBLISHABLE and we hide the publish button. */
const PUBLISHABLE_KINDS = new Set(DRAFT_KINDS.map((k) => k.value));

interface PublishError {
  draftId: string;
  message: string;
}

export function CapDrafts(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowRunId = searchParams.get('workflowRunId');
  const [rows, setRows] = useState<edgeApi.DraftRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [perRowErrors, setPerRowErrors] = useState<ReadonlyArray<PublishError>>([]);
  const [kindFilter, setKindFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewDraft, setPreviewDraft] = useState<edgeApi.DraftRow | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<edgeApi.DraftRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.listDrafts({ workflowRunId: workflowRunId ?? undefined });
      setRows(r.drafts);
      /* Clear selections that reference drafts that have since
       * drained — the operator shouldn't carry a stale checkbox
       * state across a reload. */
      setSelected((prev) => {
        const nextIds = new Set(r.drafts.map((d) => d.draftId));
        const kept = new Set<string>();
        prev.forEach((id) => { if (nextIds.has(id)) kept.add(id); });
        return kept;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { reload().catch(() => undefined);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [workflowRunId]);

  async function remove(id: string): Promise<void> {
    try { await edgeApi.deleteDraft(id); await reload(); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  /* Publish semantics: server rejects non-publishable kinds with 400
   * DRAFT_KIND_NOT_PUBLISHABLE; publishable kinds with conflicts keep
   * the draft and report per-row rejection reasons. */
  async function publish(d: edgeApi.DraftRow): Promise<void> {
    try {
      const r = await edgeApi.publishDraft(d.draftId);
      await reload();
      if (!r.draftConsumed) {
        const n = r.conflicts.length;
        setPerRowErrors((prev) => [
          ...prev.filter((e) => e.draftId !== d.draftId),
          { draftId: d.draftId,
            message: `Draft kept — ${n} row${n === 1 ? '' : 's'} rejected by central or validation.` },
        ]);
      } else {
        setPerRowErrors((prev) => prev.filter((e) => e.draftId !== d.draftId));
      }
    } catch (e) {
      setPerRowErrors((prev) => [
        ...prev.filter((x) => x.draftId !== d.draftId),
        { draftId: d.draftId,
          message: `Publish failed (${d.kind}): ${e instanceof Error ? e.message : String(e)}` },
      ]);
    }
  }

  async function publishSelected(): Promise<void> {
    if (selected.size === 0) return;
    setBusy(true); setErr(null);
    try {
      const ids = Array.from(selected);
      const r = await edgeApi.publishDraftsBatch(ids);
      await reload();
      const kept = r.results.filter((row) => row.status === 'FAILED'
        || row.draftConsumed === false);
      setPerRowErrors(kept.map((row) => ({
        draftId: row.draftId ?? 'unknown',
        message: row.error ?? `Draft kept — ${(row.conflicts ?? []).length} row(s) rejected.`,
      })));
      setSelected(new Set());
    } catch (e) {
      setErr(`Bulk publish failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function schedule(draftId: string, publishAt: string): Promise<void> {
    try {
      await edgeApi.scheduleDraftPublish(draftId, publishAt);
      await reload();
      setScheduleDraft(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function cancelSchedule(draftId: string): Promise<void> {
    try { await edgeApi.cancelDraftSchedule(draftId); await reload(); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  if (err && !rows) return <ErrorBlock title="Drafts load failed" testId="err-drafts-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const filtered = rows.filter((r) => {
    if (kindFilter !== 'ALL' && r.kind !== kindFilter) return false;
    if (search && !(r.title ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const scheduledCount = rows.filter((r) => r.scheduledPublishAt).length;
  const publishableFiltered = filtered.filter((r) => PUBLISHABLE_KINDS.has(r.kind));

  return (
    <div className="ea-screen" data-test="cap-drafts">
      {workflowRunId && (
        <ScopedFilterChip
          label={`Workflow run ${workflowRunId.slice(0, 8)}`}
          openTo={`/workflows/monitoring/runs/${encodeURIComponent(workflowRunId)}`}
          openLabel="Open run"
          onClear={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('workflowRunId');
            setSearchParams(next, { replace: true });
          }}
          hint="Showing only drafts captured by this workflow run (via drafts.workflow_run_id)."
        />
      )}
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'info'}
        title="Drafts & pending"
        statusLabel={rows.length === 0
          ? 'All submitted'
          : `${rows.length} draft${rows.length === 1 ? '' : 's'}${scheduledCount > 0 ? ` · ${scheduledCount} scheduled` : ''}`}
        subtitle={
          <>
            <span>
              Captures saved locally but not yet submitted. Publish individually,
              schedule for later (E6), or batch-select up to 100 for one-click
              drain (Phase 14.5b).
            </span>
            {rows.length > 0 && (<>
              <span>·</span>
              <LocalVsCentralBadge state={null} size="xs" />
            </>)}
          </>
        }
      />

      {err && (
        <ErrorBlock title="Drafts action failed" testId="err-drafts-action-failed">
          {err}
        </ErrorBlock>
      )}

      {rows.length === 0 ? (
        <EmptyBlock title="No drafts" testId="empty-no-drafts">
          Every local capture has either been submitted or discarded.
        </EmptyBlock>
      ) : (
        <>
          <Panel title="Filters">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span className="ea-text-muted">Kind</span>
                <select data-test="drafts-kind-filter"
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                        className="ea-input">
                  <option value="ALL">All ({rows.length})</option>
                  {DRAFT_KINDS.map((k) => {
                    const count = rows.filter((r) => r.kind === k.value).length;
                    return (
                      <option key={k.value} value={k.value} disabled={count === 0}>
                        {k.label} ({count})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, flex: '1 1 240px' }}>
                <span className="ea-text-muted">Search title</span>
                <input type="search" data-test="drafts-search"
                       value={search}
                       onChange={(e) => setSearch(e.target.value)}
                       placeholder="Filter by title…"
                       className="ea-input" style={{ flex: 1 }} />
              </label>
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="drafts-refresh"
                      onClick={() => { reload().catch(() => undefined); }}>
                Refresh
              </button>
            </div>
          </Panel>

          {publishableFiltered.length > 0 && (
            <div className="ea-toolbar"
                 style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
              <button type="button"
                      className="ea-btn ea-btn--primary"
                      data-test="drafts-publish-selected"
                      disabled={selected.size === 0 || busy}
                      onClick={() => { publishSelected().catch(() => undefined); }}>
                {busy ? 'Publishing…' : `Publish selected (${selected.size})`}
              </button>
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="drafts-select-all-publishable"
                      disabled={publishableFiltered.length === 0}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          publishableFiltered.forEach((d) => next.add(d.draftId));
                          return next;
                        });
                      }}>
                Select all publishable ({publishableFiltered.length})
              </button>
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="drafts-clear-selection"
                      disabled={selected.size === 0}
                      onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
              <span className="ea-text-muted" style={{ fontSize: 12 }}>
                Server batch cap: 100 drafts per request.
              </span>
            </div>
          )}

          <Panel title={`${filtered.length} draft${filtered.length === 1 ? '' : 's'}${filtered.length !== rows.length ? ` of ${rows.length}` : ''}`}>
            <DraftsTable rows={filtered}
                         selected={selected}
                         toggleSelected={(id) => setSelected((prev) => {
                           const next = new Set(prev);
                           if (next.has(id)) next.delete(id); else next.add(id);
                           return next;
                         })}
                         perRowErrors={perRowErrors}
                         remove={remove}
                         publish={publish}
                         cancelSchedule={cancelSchedule}
                         openPreview={setPreviewDraft}
                         openSchedule={setScheduleDraft} />
          </Panel>
        </>
      )}

      {previewDraft && (
        <DraftPreviewModal draft={previewDraft} onClose={() => setPreviewDraft(null)} />
      )}
      {scheduleDraft && (
        <DraftScheduleModal draft={scheduleDraft}
                            onCancel={() => setScheduleDraft(null)}
                            onConfirm={(at) => { schedule(scheduleDraft.draftId, at).catch(() => undefined); }} />
      )}
    </div>
  );
}

/* ─── draft row kind pill ─── */

function kindTone(kind: string): 'info' | 'warning' | 'muted' {
  const entry = DRAFT_KINDS.find((k) => k.value === kind);
  if (!entry) return 'muted';
  return entry.tone === 'success' ? 'info' : entry.tone === 'warning' ? 'warning' : 'info';
}

function kindLabel(kind: string): string {
  return DRAFT_KINDS.find((k) => k.value === kind)?.label ?? humaniseState(kind);
}

/* ─── drafts table ─── */

function DraftsTable(
  { rows, selected, toggleSelected, perRowErrors, remove, publish, cancelSchedule,
    openPreview, openSchedule }: {
    rows: ReadonlyArray<edgeApi.DraftRow>;
    selected: Set<string>;
    toggleSelected: (id: string) => void;
    perRowErrors: ReadonlyArray<PublishError>;
    remove: (id: string) => Promise<unknown>;
    publish: (d: edgeApi.DraftRow) => Promise<unknown>;
    cancelSchedule: (id: string) => Promise<unknown>;
    openPreview: (d: edgeApi.DraftRow) => void;
    openSchedule: (d: edgeApi.DraftRow) => void;
  }
): JSX.Element {
  const paged = usePaged(rows, 25);
  if (rows.length === 0) {
    return (
      <EmptyBlock title="No drafts match" testId="empty-drafts-filtered">
        Clear the kind filter or the search box to see the full draft
        list.  Every draft that lands here was captured locally and is
        waiting for publish, schedule, or discard.
      </EmptyBlock>
    );
  }
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr>
          <th style={{ width: 28 }}><span className="ea-visually-hidden">Select</span></th>
          <th>Updated</th>
          <th>Kind</th>
          <th>Title</th>
          <th>Scheduled</th>
          <th style={{ width: 240 }}>Actions</th>
        </tr></thead>
        <tbody>
          {paged.rows.map((d) => {
            const publishable = PUBLISHABLE_KINDS.has(d.kind);
            const scheduled = Boolean(d.scheduledPublishAt);
            const rowErr = perRowErrors.find((e) => e.draftId === d.draftId);
            return (
              <>
                <tr key={d.draftId}
                    data-test={`draft-row-${d.draftId}`}
                    className={scheduled ? 'ea-row-highlight' : undefined}>
                  <td>
                    {publishable && (
                      <input type="checkbox"
                             data-test={`draft-select-${d.draftId}`}
                             aria-label={`Select draft ${d.title ?? d.draftId}`}
                             checked={selected.has(d.draftId)}
                             onChange={() => toggleSelected(d.draftId)} />
                    )}
                  </td>
                  <td className="ea-text-muted"
                      title={d.updatedAt}>{new Date(d.updatedAt).toLocaleString()}</td>
                  <td>
                    <Status tone={kindTone(d.kind)}>{kindLabel(d.kind)}</Status>
                  </td>
                  <td>
                    {d.title
                      ? <strong>{d.title}</strong>
                      : <span className="ea-text-muted">Untitled draft</span>}
                    <div className="ea-text-muted ea-mono"
                         style={{ fontSize: 11, marginTop: 2 }}>
                      {d.draftId.slice(0, 8)}…
                    </div>
                  </td>
                  <td>
                    {scheduled
                      ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="ea-chip ea-chip--warning"
                                data-test={`draft-scheduled-${d.draftId}`}
                                title={d.scheduledPublishAt ?? ''}>
                            Scheduled
                          </span>
                          <span className="ea-text-muted" style={{ fontSize: 11 }}>
                            {d.scheduledPublishAt
                              ? new Date(d.scheduledPublishAt).toLocaleString()
                              : ''}
                          </span>
                        </div>
                      )
                      : <span className="ea-text-muted">—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {publishable && (
                        <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                                data-test={`draft-publish-${d.draftId}`}
                                onClick={() => { publish(d).catch(() => undefined); }}>
                          Publish now
                        </button>
                      )}
                      {publishable && !scheduled && (
                        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                data-test={`draft-schedule-${d.draftId}`}
                                onClick={() => openSchedule(d)}>
                          Schedule…
                        </button>
                      )}
                      {publishable && scheduled && (
                        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                data-test={`draft-cancel-schedule-${d.draftId}`}
                                onClick={() => { cancelSchedule(d.draftId).catch(() => undefined); }}>
                          Cancel schedule
                        </button>
                      )}
                      <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                              data-test={`draft-inspect-${d.draftId}`}
                              onClick={() => openPreview(d)}>
                        Inspect
                      </button>
                      <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                              data-test={`draft-discard-${d.draftId}`}
                              onClick={() => {
                                confirmThenRun(
                                  `Discard draft "${d.title ?? 'Untitled'}"? The captured values will be lost.`,
                                  () => { remove(d.draftId).catch(() => undefined); });
                              }}>
                        Discard
                      </button>
                    </div>
                  </td>
                </tr>
                {rowErr && (
                  <tr key={`${d.draftId}-err`}>
                    <td></td>
                    <td colSpan={5}>
                      <div className="ea-chip ea-chip--danger"
                           data-test={`draft-row-error-${d.draftId}`}>
                        {rowErr.message}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
    </div>
  );
}

/* ─── payload preview modal ─── */

function DraftPreviewModal({ draft, onClose }:
  { draft: edgeApi.DraftRow; onClose: () => void }): JSX.Element {
  return (
    <div className="ea-modal-overlay"
         data-test="draft-preview-modal"
         onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1000 }}>
      <div className="ea-modal"
           onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface, #fff)',
                    border: '1px solid var(--der-border, #d4dae2)',
                    borderRadius: 8,
                    padding: 24, maxWidth: 720, width: '90%',
                    maxHeight: '85vh', overflow: 'auto',
                    boxShadow: 'var(--el-3, 0 10px 30px rgba(15,28,46,0.18))' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between',
                         alignItems: 'center', margin: '0 0 16px' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {draft.title ?? 'Untitled draft'}
          </h2>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-test="draft-preview-close"
                  onClick={onClose}>Close</button>
        </header>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr',
                     gap: '6px 16px', fontSize: 13, margin: 0 }}>
          <dt className="ea-text-muted">Kind</dt><dd style={{ margin: 0 }}>{kindLabel(draft.kind)}</dd>
          <dt className="ea-text-muted">Draft id</dt>
          <dd className="ea-mono" style={{ margin: 0 }}>{draft.draftId}</dd>
          <dt className="ea-text-muted">Updated</dt>
          <dd style={{ margin: 0 }}>{new Date(draft.updatedAt).toLocaleString()}</dd>
          {draft.scheduledPublishAt && (
            <>
              <dt className="ea-text-muted">Scheduled at</dt>
              <dd style={{ margin: 0 }}>
                {new Date(draft.scheduledPublishAt).toLocaleString()}
              </dd>
            </>
          )}
        </dl>
        <h3 style={{ marginTop: 16, fontSize: 14 }}>Payload</h3>
        <pre data-test="draft-preview-payload"
             style={{ maxHeight: 400, overflow: 'auto',
                      background: 'var(--der-ink-50, #f5f7fa)',
                      padding: 12, borderRadius: 6,
                      fontSize: 12, lineHeight: 1.5,
                      border: '1px solid var(--der-border, #e5e9ee)',
                      margin: 0 }}>
          {JSON.stringify(draft.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/* ─── schedule-at modal ─── */

function DraftScheduleModal({ draft, onCancel, onConfirm }:
  { draft: edgeApi.DraftRow; onCancel: () => void;
    onConfirm: (iso: string) => void }): JSX.Element {
  /* Local datetime input gives 'YYYY-MM-DDTHH:mm' (no timezone).
   * Default: now + 1 hour, operator can edit. */
  const defaultLocal = (() => {
    const d = new Date(Date.now() + 3600 * 1000);
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
           `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const [when, setWhen] = useState(defaultLocal);
  const [err, setErr] = useState<string | null>(null);
  function submit(): void {
    if (!when) { setErr('Pick a date and time.'); return; }
    const asDate = new Date(when);
    if (Number.isNaN(asDate.getTime())) { setErr('Not a valid date-time.'); return; }
    if (asDate.getTime() < Date.now() - 5000) {
      setErr('The time must be at or after now (5-second grace).');
      return;
    }
    onConfirm(asDate.toISOString());
  }
  return (
    <div className="ea-modal-overlay"
         data-test="draft-schedule-modal"
         onClick={onCancel}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1000 }}>
      <div className="ea-modal"
           onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface, #fff)',
                    border: '1px solid var(--der-border, #d4dae2)',
                    borderRadius: 8,
                    padding: 24, maxWidth: 480, width: '90%',
                    boxShadow: 'var(--el-3, 0 10px 30px rgba(15,28,46,0.18))' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between',
                         alignItems: 'center', margin: '0 0 16px' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Schedule publish</h2>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  onClick={onCancel}>Close</button>
        </header>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          The <strong>{kindLabel(draft.kind)}</strong> draft
          {draft.title ? <> &ldquo;{draft.title}&rdquo;</> : <> {draft.draftId.slice(0, 8)}</>}
          {' '}will be auto-published by the scheduler at the
          selected time. You can cancel before then from this list.
        </p>
        <label style={{ display: 'block', margin: '12px 0', fontSize: 13 }}>
          <span className="ea-text-muted" style={{ display: 'block', marginBottom: 4 }}>
            Publish at
          </span>
          <input type="datetime-local"
                 data-test="draft-schedule-when"
                 value={when}
                 onChange={(e) => setWhen(e.target.value)}
                 className="ea-input"
                 style={{ display: 'block', width: '100%', padding: '6px 10px' }} />
        </label>
        {err && (
          <div className="ea-chip ea-chip--danger"
               data-test="draft-schedule-err"
               style={{ margin: '8px 0' }}>
            {err}
          </div>
        )}
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8,
                         marginTop: 16, paddingTop: 12,
                         borderTop: '1px solid var(--der-border, #e5e9ee)' }}>
          <button type="button" className="ea-btn ea-btn--ghost"
                  onClick={onCancel}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary"
                  data-test="draft-schedule-submit"
                  onClick={submit}>Schedule</button>
        </footer>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * CapMaintenance — Data › Maintenance.
 *
 * One-off operator actions covering every Quartz job registered in
 * SchedulerConfig plus backup + journal-worker + metadata-mirror
 * controls. Jobs are grouped by purpose so an operator doesn't have
 * to hunt through a flat list of 15 names.
 * ──────────────────────────────────────────────────────────────── */

interface MaintJob {
  name: string;
  label: string;
  desc: string;
}
interface MaintGroup {
  heading: string;
  blurb: string;
  jobs: ReadonlyArray<MaintJob>;
}

/** Full catalogue — one entry per Quartz job registered in
 *  server/src/main/java/.../scheduler/SchedulerConfig.java. */
const MAINT_GROUPS: ReadonlyArray<MaintGroup> = [
  {
    heading: 'DHIS2 synchronisation',
    blurb: 'Mirror metadata, pull data back from Central, probe compatibility.',
    jobs: [
      { name: 'METADATA_SYNC',
        label: 'Pull metadata',
        desc: 'Mirror DHIS2 metadata (programs, data elements, orgUnits, rules).' },
      { name: 'COMPAT_REFRESH',
        label: 'Refresh compat snapshot',
        desc: 'Re-probe DHIS2 version + API capabilities now.' },
      { name: 'DRIFT_SNAPSHOT',
        label: 'Snapshot drift',
        desc: 'Diff the local mirror against Central and record a drift report.' },
      { name: 'DATA_PULL',
        label: 'Pull data from Central',
        desc: 'ADR-0034 three-way merge of aggregate / event / tracker data.' },
      { name: 'SCOPE_DRIFT',
        label: 'Audit scope drift',
        desc: '§2.3.116 R-AM — detect orgUnit-scope drift against the authoritative source.' },
    ],
  },
  {
    heading: 'Outbound journal',
    blurb: 'Drive the write-through journal: drain, reap stuck rows, pick up matured scheduled drafts.',
    jobs: [
      { name: 'JOURNAL_WORKER_DRAIN',
        label: 'Drain journal',
        desc: 'Push every pending outbound record (aggregate / event / tracker / referral).' },
      { name: 'STUCK_INFLIGHT_REAP',
        label: 'Reap stuck IN_FLIGHT',
        desc: 'Phase 12.1 — requeue rows left IN_FLIGHT past the publisher-stall deadline.' },
      { name: 'SCHEDULED_DRAFT_PUBLISH',
        label: 'Publish matured drafts',
        desc: 'E6 — pick up every draft whose scheduled_publish_at is past-due.' },
    ],
  },
  {
    heading: 'Referral mesh',
    blurb: 'Keep the cross-edge referral graph healthy.',
    jobs: [
      { name: 'REFERRAL_INBOX_POLL',
        label: 'Poll referral inbox',
        desc: 'Scan the inbox for pending cross-edge referrals addressed to this hop.' },
      { name: 'REFERRAL_ESCALATION',
        label: 'Escalate overdue referrals',
        desc: 'Phase 10.3.2 — raise escalation on referrals past their ack deadline.' },
    ],
  },
  {
    heading: 'Housekeeping',
    blurb: 'Analytics + backup drain + miscellany.',
    jobs: [
      { name: 'ANALYTICS_REFRESH',
        label: 'Refresh analytics',
        desc: 'Rebuild the local analytics / cross-module drill-path indices.' },
      { name: 'BACKUP_DRAIN',
        label: 'Drain backup queue',
        desc: 'Pick up queued backup / restore requests and run them.' },
    ],
  },
];

const BACKUP_KINDS = [
  { kind: 'AUDIT' as const,
    label: 'Audit backup',
    desc: 'Hash-chained audit log only — small, safe to run anytime.' },
  { kind: 'FULL' as const,
    label: 'Full backup',
    desc: 'Database + metadata mirror + installed apps + Flyway history.' },
];

export function CapMaintenance(): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(label); setErr(null); setMsg(null);
    try {
      await fn();
      setMsg(`${label}: queued.`);
    } catch (e) {
      setErr(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ea-screen" data-test="cap-maint">
      <SyncStatusBar
        tone={busy ? 'warning' : 'muted'}
        title="Maintenance"
        statusLabel={busy ?? 'Idle'}
        actions={
          <>
            <Link to="/sync"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="maint-open-sync">
              <UiIcon icon="overview" size={14} />
              <span>Sync</span>
            </Link>
            <Link to="/sync/history"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="maint-open-sync-history">
              <UiIcon icon="history" size={14} />
              <span>Sync history</span>
            </Link>
          </>
        }
      />

      {msg && (
        <div className="ea-callout ea-callout--success"
             data-test="maint-msg" role="status">{msg}</div>
      )}
      {err && (
        <ErrorBlock title="Maintenance action failed" testId="err-action-failed">
          {err}
        </ErrorBlock>
      )}

      {MAINT_GROUPS.map((group) => (
        <Panel key={group.heading} title={group.heading}>
          <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
            {group.blurb}
          </p>
          <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 8 }}>
            {group.jobs.map((j) => (
              <button key={j.name} type="button"
                      className="ea-link-tile ea-link-tile--btn"
                      data-test={`maint-trigger-${j.name}`}
                      disabled={busy === j.label}
                      onClick={() => { run(j.label, () => edgeApi.triggerJob(j.name)).catch(() => undefined); }}>
                <div className="ea-link-tile-icon" aria-hidden="true">▶</div>
                <div className="ea-link-tile-body">
                  <div className="ea-link-tile-title">{j.label}</div>
                  <div className="ea-link-tile-desc">
                    {busy === j.label ? 'Starting…' : j.desc}
                  </div>
                  <div className="ea-text-muted ea-mono"
                       style={{ fontSize: 10, marginTop: 2 }}>
                    {j.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="Backups">
        <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
          Request a snapshot of the audit log or the full edge state.
          Successful runs land in the backup queue, drained by the
          BACKUP_DRAIN job in the Housekeeping group above.
        </p>
        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 8 }}>
          {BACKUP_KINDS.map((b) => (
            <button key={b.kind} type="button"
                    className="ea-link-tile ea-link-tile--btn"
                    data-test={`maint-backup-${b.kind}`}
                    disabled={busy === b.label}
                    onClick={() => { run(b.label, () => edgeApi.requestBackup(b.kind)).catch(() => undefined); }}>
              <div className="ea-link-tile-icon" aria-hidden="true">⬇</div>
              <div className="ea-link-tile-body">
                <div className="ea-link-tile-title">{b.label}</div>
                <div className="ea-link-tile-desc">{b.desc}</div>
                <div className="ea-text-muted ea-mono"
                     style={{ fontSize: 10, marginTop: 2 }}>
                  POST /backup/request {b.kind}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
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
  const admins = users.filter((u) => u.roles.includes('ADMIN')).length;
  return (
    <div className="ea-screen" data-test="cap-mappings">
      <SyncStatusBar
        tone="muted"
        title="DHIS2 user mapping"
        statusLabel={`${users.length} edge user${users.length === 1 ? '' : 's'}`}
        subtitle={
          <>
            <span>Edge accounts and their mapping to DHIS2 central users.</span>
            {admins > 0 && (<>
              <span>·</span>
              <span>Admins <strong style={{ color: 'var(--der-ink-900)' }}>{admins}</strong></span>
            </>)}
          </>
        }
      />
      <Panel title="Edge users">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"><thead><tr>
            <th>Edge user</th><th>Roles</th><th style={{ width: 160 }}>DHIS2 mapping</th>
          </tr></thead><tbody>
            {users.map((u) => (
              <tr key={u.userId}>
                <td>
                  <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                  <div className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>{u.username}</div>
                </td>
                <td>
                  {u.roles.map((r) => (
                    <span key={r} className="ea-chip ea-chip--info"
                          title={r} style={{ marginRight: 4 }}>
                      {humaniseState(r)}
                    </span>
                  ))}
                </td>
                <td><span className="ea-chip ea-chip--neutral">Unmapped</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </Panel>
    </div>
  );
}

/** `/access/roles` — Role catalogue list view.
 *
 *  Table of every role (built-in or custom) with a per-row context
 *  menu (Edit → /access/roles/:id, Duplicate → preselects authorities,
 *  Delete for custom roles, View users with this role).  "New role"
 *  button in the status bar.  SYNC_WORKER is hidden (internal only).
 */
export function CapRoles(): JSX.Element {
  const [roles, setRoles] = useState<edgeApi.EdgeRoleDefinition[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUILTIN' | 'CUSTOM'>('ALL');

  const refresh = (): void => {
    edgeApi.listRoles()
      .then((r) => setRoles(r))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => { refresh(); }, []);

  if (err && !roles) {
    return <ErrorBlock title="Roles load failed"
                        testId="err-roles-load-failed">{err}</ErrorBlock>;
  }
  if (roles == null) {
    return <LoadingBlock testId="loading-roles" />;
  }

  // Hide SYNC_WORKER from the grantable set (internal only).
  const visible = roles.filter((r) => r.builtinKey !== 'SYNC_WORKER');
  const assignedCount = visible.reduce((s, r) => s + r.userCount, 0);
  const customCount = visible.filter((r) => !r.builtin).length;

  const filtered = visible.filter((r) => {
    if (typeFilter === 'BUILTIN' && !r.builtin) return false;
    if (typeFilter === 'CUSTOM' && r.builtin) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q)
        || (r.description ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="ea-screen" data-test="cap-roles">
<SyncStatusBar
        tone={customCount > 0 ? 'info' : 'muted'}
        title="Roles catalogue"
        statusLabel={`${visible.length} role${visible.length === 1 ? '' : 's'} · ${customCount} custom · ${assignedCount} grant${assignedCount === 1 ? '' : 's'}`}
        actions={
          <>
            <Link to="/access/roles/new"
                  className="ea-btn ea-btn--primary ea-btn--sm"
                  data-cross-module="Access"
                  data-test="cap-roles-new">
              <UiIcon icon="plus" size={14} />
              <span>New role</span>
            </Link>
            <Link to="/access/authorities"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="cap-roles-open-authorities">
              <UiIcon icon="activity" size={14} />
              <span>Browse authorities</span>
            </Link>
            <Link to="/provisioning/users"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="cap-roles-open-users">
              <UiIcon icon="edit" size={14} />
              <span>Manage users</span>
            </Link>
          </>
        }
      />

      {saveMsg && (
        <div className="ea-callout ea-callout--success"
             data-test="cap-roles-save-msg"
             role="status">{saveMsg}</div>
      )}
      {err && roles && (
        <div className="ea-callout ea-callout--danger"
             data-test="cap-roles-save-err"
             role="alert">{err}</div>
      )}

      <Panel
        title="Roles"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="search"
                   aria-label="Filter roles by name"
                   data-test="cap-roles-search"
                   placeholder="Search…"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="ea-input"
                   style={{ width: 180 }} />
            <select aria-label="Filter roles by type"
                    data-test="cap-roles-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                    className="ea-input"
                    style={{ width: 130 }}>
              <option value="ALL">All types</option>
              <option value="BUILTIN">Built-in</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
        }>
        {filtered.length === 0 ? (
          <EmptyBlock title={visible.length === 0 ? 'No roles' : 'No roles match the filter'}
                      testId="cap-roles-empty">
            {visible.length === 0
              ? 'Create the first role to assign to users.'
              : 'Clear the search or type filter to see the full list.'}
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table" data-test="cap-roles-table">
              <thead><tr>
                <th>Role</th>
                <th style={{ width: 110 }}>Type</th>
                <th style={{ width: 120, textAlign: 'right' }}>Authorities</th>
                <th style={{ width: 90, textAlign: 'right' }}>Users</th>
                <th style={{ width: 160 }}>Updated</th>
                <th style={{ width: 40 }} aria-label="actions"></th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.roleId} data-test={`cap-roles-row-${r.roleId}`}>
                    <td>
                      <Link to={`/access/roles/${encodeURIComponent(r.roleId)}`}
                             data-test={`cap-roles-link-${r.roleId}`}
                             style={{ fontWeight: 600, color: 'var(--der-ink-900)',
                                      textDecoration: 'none' }}>
                        {r.name}
                      </Link>
                      {r.description && (
                        <div className="ea-text-muted" style={{ fontSize: 12 }}>
                          {r.description}
                        </div>
                      )}
                    </td>
                    <td data-test={`cap-roles-type-${r.roleId}`}>
                      {r.builtin
                        ? <Status tone="info">Built-in</Status>
                        : <Status tone="success">Custom</Status>}
                    </td>
                    <td style={{ textAlign: 'right' }}
                        data-test={`cap-roles-auth-${r.roleId}`}>
                      {r.authorities.length}
                    </td>
                    <td style={{ textAlign: 'right' }}
                        data-test={`cap-roles-userct-${r.roleId}`}>
                      {r.userCount}
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}>
                      {r.updatedAt.replace('T', ' ').slice(0, 16)}
                    </td>
                    <td>
                      <RowMenu items={[
                        { label: 'Edit',
                          to: `/access/roles/${encodeURIComponent(r.roleId)}` },
                        { label: 'Duplicate',
                          to: `/access/roles/new?copyFrom=${encodeURIComponent(r.roleId)}`,
                          disabled: r.authorities.length === 0 },
                        { label: 'View users with this role',
                          to: `/provisioning/users?role=${encodeURIComponent(r.builtinKey ?? r.name)}` },
                        { label: 'Delete',
                          danger: true,
                          disabled: r.builtin,
                          onSelect: r.builtin ? undefined : () => {
                            confirmThenRun(
                              r.userCount > 0
                                ? `Delete role '${r.name}' — ${r.userCount} user${r.userCount === 1 ? '' : 's'} will lose the mapped authorities.`
                                : `Delete role '${r.name}'.`,
                              () => {
                                edgeApi.deleteRole(r.roleId).then(() => {
                                  setSaveMsg(`Deleted role '${r.name}'.`);
                                  refresh();
                                }).catch((e: unknown) => {
                                  setErr(e instanceof Error ? e.message : String(e));
                                });
                              });
                          },
                        },
                      ]} />
                    </td>
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

/** `/access/roles/:roleId` + `/access/roles/new` — routed detail page
 *  used for both create and edit.  Supports `?copyFrom=<roleId>` on the
 *  create path to preselect authorities from an existing role. */
export function RoleEditorPage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramRoleId = params.roleId ?? '';
  const isCreate = paramRoleId === '' || paramRoleId === 'new';
  const copyFromId = searchParams.get('copyFrom');

  const [roles, setRoles] = useState<edgeApi.EdgeRoleDefinition[] | null>(null);
  const [catalog, setCatalog] = useState<edgeApi.EdgeAuthorityEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([edgeApi.listRoles(), edgeApi.listAuthorityCatalog()])
      .then(([r, c]) => { setRoles(r); setCatalog(c); })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err && !roles) {
    return <ErrorBlock title="Role editor failed to load"
                        testId="err-role-editor">{err}</ErrorBlock>;
  }
  if (roles == null || catalog == null) {
    return <LoadingBlock testId="loading-role-editor" />;
  }

  const existing = isCreate
    ? null
    : (roles.find((r) => r.roleId === paramRoleId) ?? null);
  if (!isCreate && !existing) {
    return <ErrorBlock title="Role not found"
                        testId="err-role-not-found">
             <span>No role with id <code>{paramRoleId}</code>.</span>
             &nbsp;<Link to="/access/roles"
                         data-cross-module="Access">Back to roles</Link>.
           </ErrorBlock>;
  }

  const seed = isCreate
    ? (copyFromId ? roles.find((r) => r.roleId === copyFromId) ?? null : null)
    : existing;
  const seedAuthorities = seed?.authorities ?? [];
  const copiedName = isCreate && copyFromId && seed
    ? `${seed.name} (copy)`
    : '';

  const authoritiesByModule = new Map<string, edgeApi.EdgeAuthorityEntry[]>();
  for (const a of catalog) {
    const list = authoritiesByModule.get(a.module) ?? [];
    list.push(a);
    authoritiesByModule.set(a.module, list);
  }

  return (
    <div className="ea-screen" data-test="role-editor-page">
<SyncStatusBar
        tone="info"
        title={existing ? `Edit role: ${existing.name}` : 'New role'}
        statusLabel={existing
          ? (existing.builtin ? 'Built-in role' : `Custom role · ${existing.userCount} user${existing.userCount === 1 ? '' : 's'}`)
          : 'Draft'}
        subtitle={existing
          ? 'Edit this role’s description + authority grants.  Built-in roles keep their name.'
          : 'Create a role bundling a subset of the authority catalogue.'}
        actions={
          <Link to="/access/roles"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="Access"
                data-test="role-editor-back">
            ← Back to roles
          </Link>
        }
      />
      <RoleEditor
        key={paramRoleId || 'new'}
        existing={existing}
        catalog={catalog}
        authoritiesByModule={authoritiesByModule}
        seedName={copiedName}
        seedAuthorities={seedAuthorities}
        onSaved={(_msg, savedRoleId) => navigate(`/access/roles/${encodeURIComponent(savedRoleId)}`)}
        onDeleted={() => navigate('/access/roles')}
        onError={(m) => setErr(m)}
        onCancelCreate={() => navigate('/access/roles')}
      />
      {err && roles && (
        <div className="ea-callout ea-callout--danger"
             data-test="role-editor-err"
             role="alert">{err}</div>
      )}
    </div>
  );
}

/** `/access/authorities` — read-only authority reference.
 *
 *  Pure descriptive page: every authority is listed with what it
 *  **allows** and what its **absence restricts** (the enforcement
 *  clause), plus the count of visible roles that currently grant it.
 *  No row menus, no edit paths — authorities themselves are immutable;
 *  configuration happens on the Roles page. */
export function CapAuthorities(): JSX.Element {
  const [catalog, setCatalog] = useState<edgeApi.EdgeAuthorityEntry[] | null>(null);
  const [roles, setRoles] = useState<edgeApi.EdgeRoleDefinition[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  useEffect(() => {
    Promise.all([edgeApi.listAuthorityCatalog(), edgeApi.listRoles()])
      .then(([c, r]) => { setCatalog(c); setRoles(r); })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err && !catalog) {
    return <ErrorBlock title="Authority catalogue load failed"
                        testId="err-authorities-load-failed">{err}</ErrorBlock>;
  }
  if (catalog == null || roles == null) {
    return <LoadingBlock testId="loading-authorities" />;
  }

  // Count how many visible roles hold each authority (SYNC_WORKER excluded).
  const visibleRoles = roles.filter((r) => r.builtinKey !== 'SYNC_WORKER');
  const rolesByAuthority = new Map<string, edgeApi.EdgeRoleDefinition[]>();
  for (const r of visibleRoles) {
    for (const a of r.authorities) {
      const list = rolesByAuthority.get(a) ?? [];
      list.push(r);
      rolesByAuthority.set(a, list);
    }
  }

  const modules = Array.from(new Set(catalog.map((a) => a.module)));
  const filtered = catalog.filter((a) => {
    if (moduleFilter !== 'ALL' && a.module !== moduleFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.authority.toLowerCase().includes(q)
        || (a.allows ?? a.description).toLowerCase().includes(q)
        || (a.restricts ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="ea-screen" data-test="cap-authorities">
<SyncStatusBar
        tone="info"
        title="Authority catalogue"
        statusLabel={`${catalog.length} authorit${catalog.length === 1 ? 'y' : 'ies'} · ${modules.length} module${modules.length === 1 ? '' : 's'} · read-only`}
        actions={
          <Link to="/access/roles"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="Access"
                data-test="cap-authorities-open-roles">
            <UiIcon icon="activity" size={14} />
            <span>Roles catalogue</span>
          </Link>
        }
      />
      <Panel
        title="Authorities"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="search"
                   aria-label="Filter authorities"
                   data-test="cap-authorities-search"
                   placeholder="Search…"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="ea-input"
                   style={{ width: 180 }} />
            <select aria-label="Filter authorities by module"
                    data-test="cap-authorities-filter"
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    className="ea-input"
                    style={{ width: 160 }}>
              <option value="ALL">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        }>
        {filtered.length === 0 ? (
          <EmptyBlock title="No authorities match the filter"
                      testId="cap-authorities-empty">
            Clear the search or module filter to see the full list.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table" data-test="cap-authorities-table">
              <thead><tr>
                <th style={{ width: 110 }}>Module</th>
                <th style={{ width: 260 }}>Authority</th>
                <th>Allows</th>
                <th>Restricts (when absent)</th>
                <th style={{ width: 90, textAlign: 'right' }}>Roles</th>
              </tr></thead>
              <tbody>
                {filtered.map((a) => {
                  const holding = rolesByAuthority.get(a.authority) ?? [];
                  return (
                    <tr key={a.authority}
                        data-test={`cap-authorities-row-${a.authority}`}>
                      <td>{a.module}</td>
                      <td data-test={`cap-authorities-name-${a.authority}`}>
                        <Link to={`/access/authorities/${encodeURIComponent(a.authority)}`}
                               data-cross-module="Access"
                               data-test={`cap-authorities-link-${a.authority}`}
                               style={{ color: 'var(--der-ink-900)',
                                        textDecoration: 'none' }}>
                          <code>{a.authority}</code>
                        </Link>
                      </td>
                      <td data-test={`cap-authorities-allows-${a.authority}`}>
                        {a.allows ?? a.description}
                      </td>
                      <td className="ea-text-muted"
                          data-test={`cap-authorities-restricts-${a.authority}`}
                          style={{ fontSize: 12 }}>
                        {a.restricts ?? '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}
                          data-test={`cap-authorities-roles-${a.authority}`}>
                        {holding.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** `/access/authorities/:authority` — detail page for a single authority:
 *  which roles grant it, and from there which users effectively hold it. */
export function AuthorityDetailPage(): JSX.Element {
  const params = useParams();
  const authority = decodeURIComponent(params.authority ?? '');
  const [catalog, setCatalog] = useState<edgeApi.EdgeAuthorityEntry[] | null>(null);
  const [roles, setRoles] = useState<edgeApi.EdgeRoleDefinition[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([edgeApi.listAuthorityCatalog(), edgeApi.listRoles()])
      .then(([c, r]) => { setCatalog(c); setRoles(r); })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err && !catalog) {
    return <ErrorBlock title="Authority detail load failed"
                        testId="err-authority-detail">{err}</ErrorBlock>;
  }
  if (catalog == null || roles == null) {
    return <LoadingBlock testId="loading-authority-detail" />;
  }

  const entry = catalog.find((a) => a.authority === authority) ?? null;
  if (!entry) {
    return <ErrorBlock title="Authority not found"
                        testId="err-authority-not-found">
             <span>No authority named <code>{authority}</code>.</span>
             &nbsp;<Link to="/access/authorities"
                         data-cross-module="Access">Back to authorities</Link>.
           </ErrorBlock>;
  }

  const holding = roles.filter(
    (r) => r.builtinKey !== 'SYNC_WORKER' && r.authorities.includes(authority),
  );

  const allowsText = entry.allows ?? entry.description;
  const restrictsText = entry.restricts ?? '';

  return (
    <div className="ea-screen" data-test="authority-detail">
<SyncStatusBar
        tone="info"
        title={authority}
        statusLabel={`${entry.module} · ${holding.length} role${holding.length === 1 ? '' : 's'} · read-only`}
        subtitle={allowsText}
        actions={
          <Link to="/access/authorities"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="Access"
                data-test="authority-detail-back">
            ← Back to authorities
          </Link>
        }
      />
      <Panel title="What this authority controls">
        <dl className="ea-def-list" data-test="authority-detail-meta">
          <div className="ea-def-row">
            <dt>Module</dt>
            <dd>{entry.module}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Allows</dt>
            <dd data-test="authority-detail-allows">{allowsText}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Restricts (when absent)</dt>
            <dd data-test="authority-detail-restricts">
              {restrictsText || '—'}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Roles granting this authority">
        {holding.length === 0 ? (
          <EmptyBlock title="No role grants this authority"
                      testId="authority-detail-empty">
            Edit a role on the Roles catalogue to grant it.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table" data-test="authority-detail-roles">
              <thead><tr>
                <th>Role</th>
                <th style={{ width: 110 }}>Type</th>
                <th style={{ width: 120, textAlign: 'right' }}>Authorities</th>
                <th style={{ width: 90, textAlign: 'right' }}>Users</th>
              </tr></thead>
              <tbody>
                {holding.map((r) => (
                  <tr key={r.roleId} data-test={`authority-detail-role-${r.roleId}`}>
                    <td>
                      <Link to={`/access/roles/${encodeURIComponent(r.roleId)}`}
                             data-cross-module="Access"
                             style={{ fontWeight: 600,
                                      color: 'var(--der-ink-900)',
                                      textDecoration: 'none' }}>
                        {r.name}
                      </Link>
                    </td>
                    <td>{r.builtin
                          ? <Status tone="info">Built-in</Status>
                          : <Status tone="success">Custom</Status>}</td>
                    <td style={{ textAlign: 'right' }}>{r.authorities.length}</td>
                    <td style={{ textAlign: 'right' }}>{r.userCount}</td>
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

interface RoleEditorProps {
  existing: edgeApi.EdgeRoleDefinition | null;
  catalog: edgeApi.EdgeAuthorityEntry[];
  authoritiesByModule: Map<string, edgeApi.EdgeAuthorityEntry[]>;
  seedName?: string;
  seedAuthorities?: ReadonlyArray<string>;
  onSaved: (msg: string, roleId: string) => void;
  onDeleted: (msg: string) => void;
  onError: (msg: string) => void;
  onCancelCreate: () => void;
}

function RoleEditor(props: RoleEditorProps): JSX.Element {
  const isEdit = props.existing !== null;
  const nameLocked = isEdit && (props.existing?.builtin ?? false);

  const [name, setName] = useState<string>(
    props.existing?.name ?? props.seedName ?? '',
  );
  const [description, setDescription] = useState<string>(props.existing?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(props.existing?.authorities ?? props.seedAuthorities ?? []),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (authority: string): void => {
    const next = new Set(selected);
    if (next.has(authority)) next.delete(authority);
    else next.add(authority);
    setSelected(next);
  };

  const submit = async (): Promise<void> => {
    if (!nameLocked && name.trim().length === 0) {
      props.onError('Role name is required.');
      return;
    }
    setSaving(true);
    try {
      const authorities = Array.from(selected);
      if (isEdit && props.existing) {
        const updated = await edgeApi.updateRole(props.existing.roleId, {
          name: nameLocked ? undefined : name.trim(),
          description: description.trim() || null,
          authorities,
        });
        props.onSaved(`Updated role '${props.existing.name}'.`, updated.roleId);
      } else {
        const created = await edgeApi.createRole({
          name: name.trim(),
          description: description.trim() || null,
          authorities,
        });
        props.onSaved(`Created role '${created.name}'.`, created.roleId);
      }
    } catch (e: unknown) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (): void => {
    if (!props.existing || props.existing.builtin) return;
    confirmThenRun(
      props.existing.userCount > 0
        ? `Delete role '${props.existing.name}' — ${props.existing.userCount} user${props.existing.userCount === 1 ? '' : 's'} will lose the mapped authorities.`
        : `Delete role '${props.existing.name}'.`,
      () => {
        edgeApi.deleteRole(props.existing!.roleId).then(() => {
          props.onDeleted(`Deleted role '${props.existing!.name}'.`);
        }).catch((e: unknown) => {
          props.onError(e instanceof Error ? e.message : String(e));
        });
      });
  };

  const title = isEdit && props.existing ? `Edit role '${props.existing.name}'` : 'New role';
  const authCount = selected.size;

  return (
    <Panel
      title={title}
      action={
        <span className="ea-text-muted" style={{ fontSize: 12 }}>
          {authCount} / {props.catalog.length} authorit{authCount === 1 ? 'y' : 'ies'} selected
        </span>
      }>
      <div data-test="cap-roles-editor" className="ea-role-editor">
        {/* --- Name + description ------------------------------------- */}
        <div className="ea-role-editor-fields">
          <label className="ea-role-editor-field">
            <span className="ea-role-editor-label">
              Role name{nameLocked && ' (built-in — read only)'}
            </span>
            <input type="text"
                   aria-label="Role name"
                   data-test="cap-roles-editor-name"
                   value={name}
                   disabled={nameLocked}
                   onChange={(e) => setName(e.target.value)}
                   className="ea-input" />
          </label>
          <label className="ea-role-editor-field">
            <span className="ea-role-editor-label">Description</span>
            <input type="text"
                   aria-label="Role description"
                   data-test="cap-roles-editor-desc"
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   className="ea-input" />
          </label>
        </div>

        {/* --- Authority groups --------------------------------------- */}
        <div data-test="cap-roles-editor-authorities"
             className="ea-role-auth-groups">
          {Array.from(props.authoritiesByModule.entries()).map(([module, entries]) => {
            const activeInGroup = entries.filter((e) => selected.has(e.authority)).length;
            return (
              <section key={module}
                       className="ea-role-auth-group"
                       data-test={`cap-roles-editor-module-${module}`}>
                <header className="ea-role-auth-group-head">
                  <span className="ea-role-auth-group-title">{module}</span>
                  <span className="ea-chip ea-chip--muted">
                    {activeInGroup} / {entries.length}
                  </span>
                  <button type="button"
                          className="ea-link-btn"
                          data-test={`cap-roles-editor-module-${module}-all`}
                          onClick={() => {
                            const next = new Set(selected);
                            const allOn = entries.every((e) => next.has(e.authority));
                            for (const e of entries) {
                              if (allOn) next.delete(e.authority);
                              else next.add(e.authority);
                            }
                            setSelected(next);
                          }}>
                    {entries.every((e) => selected.has(e.authority))
                      ? 'Clear all'
                      : 'Select all'}
                  </button>
                </header>
                <div className="ea-role-auth-grid">
                  {entries.map((a) => (
                    <label key={a.authority}
                           className="ea-role-auth-item">
                      <input type="checkbox"
                             aria-label={a.authority}
                             data-test={`cap-roles-editor-auth-${a.authority}`}
                             checked={selected.has(a.authority)}
                             onChange={() => toggle(a.authority)} />
                      <span>
                        <code>{a.authority}</code>
                        <span className="ea-text-muted ea-role-auth-item-desc">
                          {a.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* --- Footer: Save / Delete / Cancel --------------------------- */}
        <div className="ea-role-editor-footer">
          {isEdit && props.existing && !props.existing.builtin && (
            <button type="button"
                    className="ea-btn ea-btn--danger ea-btn--sm"
                    data-test="cap-roles-editor-delete"
                    onClick={handleDelete}>
              Delete role
            </button>
          )}
          <div className="ea-role-editor-footer-actions">
            {!isEdit && (
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="cap-roles-editor-cancel"
                      onClick={props.onCancelCreate}>Cancel</button>
            )}
            <button type="button"
                    className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="cap-roles-editor-save"
                    disabled={saving}
                    onClick={() => { void submit(); }}>
              {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create role')}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** `/admin/access/sessions` — active session count + policy + audit
 *  cross-links. Per-session details (device, IP, last-seen) are not
 *  exposed in this build; the screen clearly declares that scope and
 *  surfaces the rotation + audit paths an ADMIN actually has. */
export function CapSessions(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [recentAuth, setRecentAuth] = useState<edgeApi.SecurityAuditEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.allSettled([
        edgeApi.systemInfo(),
        edgeApi.listUsers(),
        edgeApi.securityAuditEvents({ eventType: 'SIGN_IN', limit: 10 }),
      ]);
      if (a.status === 'fulfilled') setSi(a.value);
      else setErr(a.reason instanceof Error ? a.reason.message : String(a.reason));
      if (b.status === 'fulfilled') setUsers(b.value.users);
      if (c.status === 'fulfilled') setRecentAuth(c.value);
    })().catch(() => undefined);
  }, []);

  if (err) return <ErrorBlock title="Sessions load failed" testId="err-sessions-load-failed">{err}</ErrorBlock>;
  if (!si || !users) return <LoadingBlock testId="loading" />;
  const sessions = si.database.sessionCount ?? 0;

  return (
    <div className="ea-screen" data-test="cap-sessions">
      <SyncStatusBar
        tone={sessions > 0 ? 'success' : 'muted'}
        title="User sessions"
        statusLabel={sessions === 0 ? 'No active sessions' : `${sessions} active`}
        subtitle={
          <>
            <span>Live sign-in sessions on this edge. Sessions auto-expire with the <code>DER_SESSION</code> cookie.</span>
            <span>·</span>
            <span>Known users <strong style={{ color: 'var(--der-ink-900)' }}>{users.length}</strong></span>
          </>
        }
        actions={
          <>
            <Link to="/access/credentials"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="cap-sessions-open-credentials">
              <UiIcon icon="audit" size={14} />
              <span>Credential policy</span>
            </Link>
            <Link to="/audit/events?eventType=SIGN_IN"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Security"
                   data-test="cap-sessions-open-audit">
              <UiIcon icon="audit" size={14} />
              <span>Sign-in audit</span>
            </Link>
          </>
        }
      />

      <Panel title="Session policy">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Active sessions</dt>
            <dd className="ea-mono" data-test="cap-sessions-count">
              {sessions}
            </dd></div>
          <div className="ea-def-row"><dt>Storage</dt>
            <dd className="ea-mono">DER_SESSION cookie (HttpOnly, SameSite=Strict)</dd></div>
          <div className="ea-def-row"><dt>Auto-expiry</dt>
            <dd>60-minute idle TTL (configurable via <code>der.session.ttl-minutes</code>)</dd></div>
          <div className="ea-def-row"><dt>Rotation</dt>
            <dd>
              Admin-triggered via <Link to="/admin-tasks"
                                            data-cross-module="Lifecycle"
                                            data-test="cap-sessions-clear">
                Admin tasks → Clear sessions
              </Link>
            </dd></div>
        </dl>
        <p className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                                                lineHeight: 1.5 }}
           data-test="cap-sessions-scope-note">
          Per-session details (device, IP, last-seen timestamp) are not
          exposed on this edge build. Audit the sign-in event stream
          for who connected and when. A per-session table is slated for
          the FR-16 identity extensions roadmap.
        </p>
      </Panel>

      <Panel title="Recent sign-ins">
        {recentAuth.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
             data-test="cap-sessions-audit-empty">
            No SIGN_IN events recorded recently.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="cap-sessions-audit">
              <thead><tr>
                <th>When</th><th>Actor</th><th>Outcome</th><th>Client</th>
              </tr></thead>
              <tbody>
                {recentAuth.map((e, i) => (
                  <tr key={`${e.observedAt}-${i}`}>
                    <td className="ea-mono" style={{ fontSize: 12 }}
                        title={e.observedAt}>{fmtAgo(e.observedAt)}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>
                      {e.actorUserId?.slice(0, 8) ?? '—'}
                    </td>
                    <td>
                      <Status tone={
                        e.outcome === 'SUCCESS' ? 'success'
                        : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                        {e.outcome}
                      </Status>
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}>
                      {e.clientIp ?? '—'}
                    </td>
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

/** `/admin/access/credentials` — credential-policy surface. Every
 *  field cites its backing source (spring property, migration, ADR)
 *  so a reviewer can walk the policy end-to-end without guessing. */
export function CapCredentials(): JSX.Element {
  return (
    <div className="ea-screen" data-test="cap-creds">
      <SyncStatusBar
        tone="info"
        title="Credentials"
        statusLabel="Password-only (MFA + SSO planned)"
        subtitle={
          <>
            <span>How users prove who they are on this edge. Rotations + resets are admin-driven in this build.</span>
          </>
        }
        actions={
          <>
            <Link to="/access/sessions"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="cap-creds-open-sessions">
              <UiIcon icon="activity" size={14} />
              <span>Sessions</span>
            </Link>
            <Link to="/provisioning/users"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="cap-creds-open-users">
              <UiIcon icon="edit" size={14} />
              <span>Reset a user</span>
            </Link>
          </>
        }
      />

      <Panel title="Password policy">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Minimum length</dt>
            <dd data-test="cap-creds-min-length">
              12 characters (mixed upper + lower + digits)
            </dd></div>
          <div className="ea-def-row"><dt>Hashing</dt>
            <dd className="ea-mono">Argon2id (<code>m=65536, t=3, p=1</code>)</dd></div>
          <div className="ea-def-row"><dt>Rotation</dt>
            <dd>Admin-driven via <Link to="/provisioning/users"
                                           data-cross-module="Access">Users dashboard</Link> — self-service reset is not available in this build.</dd></div>
          <div className="ea-def-row"><dt>Lockout</dt>
            <dd>5 consecutive failures → 15-minute lockout per account</dd></div>
        </dl>
      </Panel>

      <Panel title="Session binding">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Cookie</dt>
            <dd className="ea-mono">DER_SESSION · HttpOnly · SameSite=Strict · Secure (over TLS)</dd></div>
          <div className="ea-def-row"><dt>Idle TTL</dt>
            <dd>60 minutes (configurable via <code>der.session.ttl-minutes</code>)</dd></div>
          <div className="ea-def-row"><dt>Revocation</dt>
            <dd>Admin → <Link to="/admin-tasks"
                                 data-cross-module="Lifecycle"
                                 data-test="cap-creds-clear-sessions">Admin tasks → Clear sessions</Link></dd></div>
        </dl>
      </Panel>

      <Panel title="Second factors + federation">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>TOTP (RFC-6238)</dt>
            <dd data-test="cap-creds-totp">
              <span className="ea-chip ea-chip--info">Implemented</span>
              <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                Backing <code>TotpService</code> ships; enrolment UI slated for FR-16-04.
              </span>
            </dd></div>
          <div className="ea-def-row"><dt>External SSO (OIDC)</dt>
            <dd>
              <span className="ea-chip ea-chip--muted">Roadmap</span>
              <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                DHIS2 IdP federation is on the post-1.0 roadmap (ADR-TBD).
              </span>
            </dd></div>
        </dl>
      </Panel>

      <Panel title="Audit">
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Credential events (<code>SIGN_IN</code>, <code>SIGN_IN_FAILED</code>,
          <code>PASSWORD_CHANGED</code>) are written to the security audit
          log. <Link to="/audit/events?eventType=PASSWORD_CHANGED"
                       data-cross-module="Security"
                       data-test="cap-creds-open-audit">
            View password-change events →
          </Link>
        </p>
      </Panel>
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

/** `/admin/devices/enrolment` — pending-approval queue. ADMIN-only
 *  actions: approve, revoke. Every mutation confirms first (ADR-0019
 *  — device enrolment can't be undone without a fresh QR). */
export function CapDeviceEnrolment(): JSX.Element {
  const [rows, err, reload] = useDevices();
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function approve(id: string): Promise<void> {
    setBusyFor(id); setMsg(null);
    try {
      await edgeApi.approveDevice(id);
      setMsg(`Device ${id.slice(0, 8)}… approved.`);
      await reload();
    } catch { /* surfaces via err state next reload */ }
    finally { setBusyFor(null); }
  }
  async function revoke(id: string): Promise<void> {
    setBusyFor(id); setMsg(null);
    try {
      await edgeApi.revokeDevice(id);
      setMsg(`Device ${id.slice(0, 8)}… revoked.`);
      await reload();
    } catch { /* ignore */ }
    finally { setBusyFor(null); }
  }

  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const pending = rows.filter((r) => r.status === 'PENDING');
  const approved = rows.filter((r) => r.status === 'APPROVED');

  return (
    <div className="ea-screen" data-test="cap-enrolment">
      <SyncStatusBar
        tone={pending.length > 0 ? 'warning' : 'success'}
        title="Device enrolment"
        statusLabel={pending.length === 0
          ? 'No pending'
          : `${pending.length} pending`}
        subtitle={
          <>
            <span>Devices that have requested access and are awaiting ADMIN approval.</span>
            <span>·</span>
            <span>Approved <strong style={{ color: 'var(--der-ink-900)' }}>{approved.length}</strong></span>
            <span>·</span>
            <span>Total <strong style={{ color: 'var(--der-ink-900)' }}>{rows.length}</strong></span>
          </>
        }
        actions={
          <>
            <Link to="/devices"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Devices"
                   data-test="cap-enrolment-open-fleet">
              <UiIcon icon="activity" size={14} />
              <span>Device fleet</span>
            </Link>
            <Link to="/network/clients"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Network"
                   data-test="cap-enrolment-open-network">
              <UiIcon icon="refresh" size={14} />
              <span>Connected devices</span>
            </Link>
          </>
        }
      />

      {msg && <p className="ea-saved" data-test="cap-enrolment-saved">{msg}</p>}

      {pending.length === 0 ? (
        <EmptyBlock title="No pending enrolments" testId="empty-no-pending-enrolments">
          All currently known devices have been reviewed. Operators scanning
          a fresh QR code land in this queue automatically.
        </EmptyBlock>
      ) : (
        <Panel title={`${pending.length} pending device${pending.length === 1 ? '' : 's'}`}>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="cap-enrolment-pending">
              <thead><tr>
                <th>Device</th><th>Form factor</th><th>Enrolled</th>
                <th>User agent</th>
                <th style={{ width: 200 }}>
                  <span className="ea-visually-hidden">Actions</span>
                </th>
              </tr></thead>
              <tbody>
                {pending.map((r) => {
                  const busy = busyFor === r.deviceId;
                  return (
                    <tr key={r.deviceId}
                        data-test={`cap-enrolment-row-${r.deviceId}`}>
                      <td>
                        <div className="ea-mono" style={{ fontSize: 12 }}>
                          {r.deviceId}
                        </div>
                        {r.displayName && (
                          <div className="ea-text-muted" style={{ fontSize: 11 }}>
                            {r.displayName}
                          </div>
                        )}
                      </td>
                      <td>{r.formFactor ?? '—'}</td>
                      <td className="ea-text-muted"
                          style={{ fontSize: 12 }}
                          title={r.enrolledAt}>{fmtAgo(r.enrolledAt)}</td>
                      <td className="ea-text-muted"
                          style={{ fontSize: 11, wordBreak: 'break-all' }}>
                        {r.userAgent ?? '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6,
                                        justifyContent: 'flex-end' }}>
                          <button type="button"
                                  className="ea-btn ea-btn--primary ea-btn--sm"
                                  disabled={busy}
                                  data-test={`cap-enrolment-approve-${r.deviceId}`}
                                  onClick={() => {
                                    confirmThenRun(
                                      `Approve device ${r.deviceId.slice(0, 12)}…? It will be allowed to sign in and sync data.`,
                                      () => { approve(r.deviceId).catch(() => undefined); });
                                  }}>
                            {busy ? '…' : 'Approve'}
                          </button>
                          <button type="button"
                                  className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                                  disabled={busy}
                                  data-test={`cap-enrolment-revoke-${r.deviceId}`}
                                  onClick={() => {
                                    confirmThenRun(
                                      `Revoke device ${r.deviceId.slice(0, 12)}…? Its enrolment token will be invalidated and the operator must re-scan the QR.`,
                                      () => { revoke(r.deviceId).catch(() => undefined); });
                                  }}>
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="How enrolment works">
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7,
                       fontSize: 13 }}>
          <li>Operator scans the DER-generated enrolment QR on their device.</li>
          <li>Device registers with its deviceId + user-agent; row appears
            here in <code>PENDING</code>.</li>
          <li>ADMIN clicks <strong>Approve</strong>; device is allowed to sign
            in; <code>DEVICE_APPROVED</code> audit event is written.</li>
          <li>Revoke invalidates the enrolment token — operator must re-scan
            to try again.</li>
        </ol>
      </Panel>
    </div>
  );
}

/** `/admin/devices/ownership` — device → assigned-user mapping with
 *  per-status filter + search. Assignment lives on the enrolment
 *  record (`assignedUserId`); this screen surfaces it. */
export function CapOwnership(): JSX.Element {
  const [rows, err] = useDevices();
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    edgeApi.listUsers().then((r) => setUsers(r.users)).catch(() => undefined);
  }, []);

  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const nameFor = (id: string | null | undefined): string =>
    (id && users.find((u) => u.userId === id)?.displayName) || '—';
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (q) {
      const name = nameFor(r.assignedUserId).toLowerCase();
      return r.deviceId.toLowerCase().includes(q)
          || name.includes(q)
          || (r.displayName ?? '').toLowerCase().includes(q);
    }
    return true;
  });
  const assigned = rows.filter((r) => !!r.assignedUserId).length;
  const unassigned = rows.length - assigned;

  return (
    <div className="ea-screen" data-test="cap-ownership">
      <SyncStatusBar
        tone={unassigned > 0 ? 'warning' : 'success'}
        title="Device ownership"
        statusLabel={`${assigned}/${rows.length} assigned`}
        subtitle={
          <>
            <span>Each device&apos;s assigned operator. Unassigned approved devices sign in but don&apos;t carry user attribution.</span>
          </>
        }
        actions={
          <Link to="/devices/enrolment"
                 className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="Devices"
                 data-test="cap-ownership-open-enrolment">
            <UiIcon icon="plus" size={14} />
            <span>Enrolment queue</span>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyBlock title="No devices enrolled" testId="empty-no-devices-enrolled">
          Enrol a device first — ownership shows the assigned operator.
        </EmptyBlock>
      ) : (
        <Panel title={`${filtered.length} device${filtered.length === 1 ? '' : 's'}`}
               action={
                 <>
                   <input className="ea-input" type="search"
                          style={{ maxWidth: 220 }}
                          placeholder="Search by device ID or owner"
                          value={query}
                          aria-label="Search devices"
                          data-test="cap-ownership-search"
                          onChange={(e) => setQuery(e.target.value)} />
                   <select className="ea-input" style={{ maxWidth: 140 }}
                           value={statusFilter}
                           aria-label="Filter by status"
                           data-test="cap-ownership-filter"
                           onChange={(e) => setStatusFilter(e.target.value)}>
                     <option value="ALL">All statuses</option>
                     <option value="APPROVED">Approved</option>
                     <option value="PENDING">Pending</option>
                     <option value="REVOKED">Revoked</option>
                   </select>
                 </>
               }>
          {filtered.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
               data-test="cap-ownership-empty">
              No devices match this filter.
            </p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr>
                  <th>Device</th><th>Assigned user</th>
                  <th>Status</th><th>Last seen</th>
                  <th style={{ width: 48 }}>
                    <span className="ea-visually-hidden">Actions</span>
                  </th>
                </tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.deviceId}
                        data-test={`cap-ownership-row-${r.deviceId}`}>
                      <td>
                        <div className="ea-mono" style={{ fontSize: 12 }}>
                          {r.deviceId}
                        </div>
                        {r.displayName && (
                          <div className="ea-text-muted" style={{ fontSize: 11 }}>
                            {r.displayName}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.assignedUserId
                          ? nameFor(r.assignedUserId)
                          : <span className="ea-chip ea-chip--warning"
                                   data-test={`cap-ownership-unassigned-${r.deviceId}`}>
                              Unassigned
                            </span>}
                      </td>
                      <td>
                        <Status tone={
                          r.status === 'APPROVED' ? 'success'
                          : r.status === 'PENDING' ? 'info'
                          : 'danger'}>
                          {r.status}
                        </Status>
                      </td>
                      <td className="ea-text-muted" style={{ fontSize: 12 }}
                          title={r.lastSeenAt ?? ''}>
                        {r.lastSeenAt ? fmtAgo(r.lastSeenAt) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <RowMenu items={[
                          { label: 'Open details',
                            to: `/devices/${r.deviceId}` },
                          { label: 'View audit',
                            to: `/audit/events?device=${encodeURIComponent(r.deviceId)}` },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

/** `/admin/devices/connections` — approved-devices activity sorted by
 *  last-seen with stale detection + search. */
export function CapConnections(): JSX.Element {
  const [rows, err] = useDevices();
  const [query, setQuery] = useState('');

  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const active = rows.filter((r) => r.status === 'APPROVED');
  const sorted = [...active].sort(
    (a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));

  const now = Date.now();
  const staleCount = sorted.filter(
    (r) => !r.lastSeenAt || now - Date.parse(r.lastSeenAt) > 24 * 3600 * 1000,
  ).length;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sorted.filter((r) => r.deviceId.toLowerCase().includes(q)
                               || (r.displayName ?? '').toLowerCase().includes(q))
    : sorted;

  return (
    <div className="ea-screen" data-test="cap-connections">
      <SyncStatusBar
        tone={staleCount > 0 ? 'warning' : active.length > 0 ? 'success' : 'muted'}
        title="Active connections"
        statusLabel={`${active.length} approved · ${staleCount} stale`}
        subtitle={
          <>
            <span>Approved devices sorted by most recent check-in. Stale = no activity in the last 24h.</span>
            <span>·</span>
            <span>Fleet <strong style={{ color: 'var(--der-ink-900)' }}>{rows.length}</strong></span>
          </>
        }
        actions={
          <Link to="/devices/diagnostics"
                 className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="Devices"
                 data-test="cap-connections-open-diagnostics">
            <UiIcon icon="diagnostics" size={14} />
            <span>Diagnostics</span>
          </Link>
        }
      />

      {sorted.length === 0 ? (
        <EmptyBlock title="No active devices" testId="empty-no-active-devices">
          Approve a device enrolment to see it here once it checks in.
        </EmptyBlock>
      ) : (
        <Panel title={`${filtered.length} device${filtered.length === 1 ? '' : 's'}`}
               action={
                 <input className="ea-input" type="search"
                        style={{ maxWidth: 240 }}
                        placeholder="Search by device ID or label"
                        value={query}
                        aria-label="Search connected devices"
                        data-test="cap-connections-search"
                        onChange={(e) => setQuery(e.target.value)} />
               }>
          {filtered.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
               data-test="cap-connections-empty">
              No devices match this filter.
            </p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr>
                  <th>Device</th><th>Last seen</th>
                  <th>Firmware</th><th>User agent</th>
                  <th style={{ width: 90 }}>Freshness</th>
                </tr></thead>
                <tbody>
                  {filtered.map((r) => {
                    const stale = !r.lastSeenAt
                      || now - Date.parse(r.lastSeenAt) > 24 * 3600 * 1000;
                    return (
                      <tr key={r.deviceId}
                          data-test={`cap-connections-row-${r.deviceId}`}>
                        <td>
                          <div className="ea-mono" style={{ fontSize: 12 }}>
                            {r.deviceId}
                          </div>
                          {r.displayName && (
                            <div className="ea-text-muted" style={{ fontSize: 11 }}>
                              {r.displayName}
                            </div>
                          )}
                        </td>
                        <td className="ea-text-muted" style={{ fontSize: 12 }}
                            title={r.lastSeenAt ?? 'never'}>
                          {r.lastSeenAt ? fmtAgo(r.lastSeenAt) : 'never'}
                        </td>
                        <td className="ea-mono" style={{ fontSize: 12 }}>
                          {r.firmwareVersion ?? '—'}
                        </td>
                        <td className="ea-text-muted"
                            style={{ fontSize: 11, wordBreak: 'break-all' }}>
                          {r.userAgent ?? '—'}
                        </td>
                        <td data-test={`cap-connections-fresh-${r.deviceId}`}>
                          <Status tone={stale ? 'warning' : 'success'}>
                            {stale ? 'Stale' : 'Fresh'}
                          </Status>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

/** `/admin/devices/diagnostics` — fleet-wide health check. Surfaces
 *  stale, pending, revoked + firmware drift so an ADMIN can see the
 *  fleet at a glance. */
export function CapDeviceDiagnostics(): JSX.Element {
  const [rows, err] = useDevices();
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  if (err) return <ErrorBlock title="Device load failed" testId="err-device-load-failed">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const now = Date.now();
  const isStale = (r: edgeApi.EdgeDeviceRow): boolean => !r.lastSeenAt
    || now - Date.parse(r.lastSeenAt) > 24 * 3600 * 1000;
  const stale = rows.filter(isStale);
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const revoked = rows.filter((r) => r.status === 'REVOKED').length;

  /* Firmware-drift detection — the most common firmware version is the
   * canonical pin; anything different is a drift candidate. */
  const fwCount: Record<string, number> = {};
  for (const r of rows) {
    const fw = r.firmwareVersion ?? 'unknown';
    fwCount[fw] = (fwCount[fw] ?? 0) + 1;
  }
  const topFw = Object.entries(fwCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const driftCount = rows.filter(
    (r) => (r.firmwareVersion ?? 'unknown') !== topFw).length;

  const visible = showStaleOnly ? stale : rows;

  return (
    <div className="ea-screen" data-test="cap-dev-diag">
      <SyncStatusBar
        tone={stale.length > 0 || revoked > 0 ? 'warning' : 'success'}
        title="Device diagnostics"
        statusLabel={`${rows.length} device${rows.length === 1 ? '' : 's'}`}
        subtitle={
          <>
            <span>Per-device check-in + firmware state.</span>
            <span>·</span>
            <span>Stale (&gt;24h) <strong style={{ color: 'var(--der-ink-900)' }}>{stale.length}</strong></span>
            <span>·</span>
            <span>Pending <strong style={{ color: 'var(--der-ink-900)' }}>{pending}</strong></span>
            <span>·</span>
            <span>Revoked <strong style={{ color: 'var(--der-ink-900)' }}>{revoked}</strong></span>
          </>
        }
        actions={
          <Link to="/devices/connections"
                 className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="Devices"
                 data-test="cap-dev-diag-open-connections">
            <UiIcon icon="activity" size={14} />
            <span>Active connections</span>
          </Link>
        }
      />

      {Object.keys(fwCount).length > 1 && (
        <Panel title="Firmware drift"
               action={
                 <span data-test="cap-dev-diag-drift-badge">
                   <Status tone={driftCount > 0 ? 'warning' : 'success'}>
                     {driftCount === 0 ? 'Uniform' : `${driftCount} drifted`}
                   </Status>
                 </span>
               }>
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Canonical firmware</dt>
              <dd className="ea-mono" data-test="cap-dev-diag-fw-canonical">
                {topFw}
              </dd></div>
            <div className="ea-def-row"><dt>Distinct versions</dt>
              <dd className="ea-mono">{Object.keys(fwCount).length}</dd></div>
            <div className="ea-def-row"><dt>Distribution</dt>
              <dd>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                  {Object.entries(fwCount).sort((a, b) => b[1] - a[1]).map(([fw, n]) => (
                    <li key={fw}>
                      <code>{fw}</code> — {n} device{n === 1 ? '' : 's'}
                    </li>
                  ))}
                </ul>
              </dd></div>
          </dl>
        </Panel>
      )}

      {rows.length === 0 ? (
        <EmptyBlock title="No devices enrolled" testId="empty-no-devices">
          Scan a device-enrolment QR code from the mobile client to
          add the first device, or walk the operator through
          <Link to="/devices/enrolment" data-cross-module="Access"
                 style={{ marginLeft: 4 }}>Device enrolment</Link>.
        </EmptyBlock>
      ) : (
        <Panel title={`${visible.length} of ${rows.length} devices`}
               action={
                 <label style={{ fontSize: 12, display: 'inline-flex',
                                  gap: 6, alignItems: 'center' }}>
                   <input type="checkbox"
                          checked={showStaleOnly}
                          data-test="cap-dev-diag-stale-only"
                          onChange={(e) => setShowStaleOnly(e.target.checked)} />
                   Show stale only ({stale.length})
                 </label>
               }>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Device</th><th>Status</th>
                <th>Firmware</th><th>Last seen</th><th>Enrolled</th>
              </tr></thead>
              <tbody>
                {visible.map((r) => {
                  const stale = isStale(r);
                  const drift = topFw && (r.firmwareVersion ?? 'unknown') !== topFw;
                  return (
                    <tr key={r.deviceId}
                        data-test={`cap-dev-diag-row-${r.deviceId}`}>
                      <td>
                        <div className="ea-mono" style={{ fontSize: 12 }}>
                          {r.deviceId}
                        </div>
                        {r.displayName && (
                          <div className="ea-text-muted" style={{ fontSize: 11 }}>
                            {r.displayName}
                          </div>
                        )}
                      </td>
                      <td>
                        <Status tone={
                          r.status === 'APPROVED' ? 'success'
                          : r.status === 'PENDING' ? 'info'
                          : 'danger'}>
                          {r.status}
                        </Status>
                      </td>
                      <td>
                        <span className={'ea-chip ea-chip--'
                          + (drift ? 'warning' : 'muted')}
                              title={drift ? 'Differs from canonical firmware' : ''}
                              data-test={`cap-dev-diag-fw-${r.deviceId}`}>
                          {r.firmwareVersion ?? '—'}
                        </span>
                      </td>
                      <td>
                        <Status tone={stale ? 'warning' : 'success'}
                                title={r.lastSeenAt ?? 'never'}>
                          {r.lastSeenAt ? fmtAgo(r.lastSeenAt) : 'never'}
                        </Status>
                      </td>
                      <td className="ea-text-muted" style={{ fontSize: 12 }}
                          title={r.enrolledAt}>{fmtAgo(r.enrolledAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
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
  const totalFailed = jobs.filter((j) => j.outcome === 'FAILED').length;
  const totalSucc = jobs.filter((j) => j.outcome === 'SUCCEEDED').length;
  const overallRel = totalFailed + totalSucc > 0
    ? Math.round((100 * totalSucc) / (totalSucc + totalFailed))
    : null;
  const tone: 'success' | 'info' | 'warning' | 'danger' | 'muted' =
    overallRel == null
      ? 'muted'
      : overallRel >= 95
        ? 'success'
        : overallRel >= 80
          ? 'info'
          : overallRel >= 50
            ? 'warning'
            : 'danger';
  const statusLabel = overallRel == null
    ? 'No runs yet'
    : `${overallRel}% reliability over last ${jobs.length}`;

  return (
    <div className="ea-screen" data-test="cap-metrics">
      <HealthTabBar />
      <SyncStatusBar
        tone={tone}
        title="System metrics"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/monitoring/health"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="System"
                  data-test="cap-metrics-open-health">
              <UiIcon icon="health" size={14} />
              <span>Service health</span>
            </Link>
            <Link to="/sync/history"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Sync"
                  data-test="cap-metrics-open-history">
              <UiIcon icon="history" size={14} />
              <span>Sync history</span>
            </Link>
          </>
        }
      />
      <Panel title="At a glance">
        <div className="ea-stat-strip">
          <Stat label="Mapped users" value={si.attribution?.mappedUsers ?? '—'} />
          <Stat label="Scheduler jobs" value={si.scheduler.totalJobs ?? '—'} />
          <Stat label="Executing now" value={si.scheduler.executingJobs ?? 0}
                tone={(si.scheduler.executingJobs ?? 0) > 0 ? 'info' : 'muted'} />
          <Stat label="Reliability" value={overallRel == null ? '—' : `${overallRel}%`}
                tone={tone === 'muted' ? 'muted' : tone === 'danger' ? 'danger' : 'success'} />
        </div>
      </Panel>
      <Panel title="Job reliability"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 Grouped by job name · last 100 runs
               </span>
             }>
        {Object.keys(byJob).length === 0 ? (
          <EmptyBlock title="No runs recorded" testId="cap-metrics-empty">
            The scheduler has not completed any runs yet on this edge.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" data-test="cap-metrics-table">
              <thead><tr>
                <th>Job</th>
                <th style={{ width: 100, textAlign: 'right' }}>Succeeded</th>
                <th style={{ width: 90, textAlign: 'right' }}>Failed</th>
                <th style={{ width: 120 }}>Reliability</th>
              </tr></thead>
              <tbody>
                {Object.entries(byJob).map(([name, b]) => {
                  const total = b.succ + b.fail;
                  const rel = total ? Math.round((100 * b.succ) / total) : null;
                  return (
                    <tr key={name} data-test={`cap-metrics-row-${name}`}>
                      <td className="ea-mono">{name}</td>
                      <td style={{ textAlign: 'right' }}>{b.succ}</td>
                      <td style={{ textAlign: 'right' }}>{b.fail}</td>
                      <td data-test={`cap-metrics-rel-${name}`}>
                        {rel == null
                          ? <span className="ea-text-muted">—</span>
                          : rel >= 95
                            ? <Status tone="success">{rel}%</Status>
                            : rel >= 80
                              ? <Status tone="info">{rel}%</Status>
                              : <Status tone="danger">{rel}%</Status>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
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
    <Status tone={ok ? 'success' : 'danger'}>{ok ? 'OK' : 'FAIL'}</Status>;

  const components = [
    { name: 'DER service', ok: isDerUp(h.status),
      detail: `v${si.build.version}`, mono: true },
    { name: 'Database',
      ok: si.database.configured && !si.database.probeError,
      detail: si.database.probeError ?? si.database.product ?? '—' },
    { name: 'Scheduler', ok: si.scheduler.started,
      detail: si.scheduler.standbyMode ? 'standby' : 'running' },
    { name: 'DHIS2 central', ok: si.dhis2.probeReachable,
      detail: si.dhis2.reason ?? si.dhis2.centralVersion ?? '—' },
    { name: 'Storage', ok: si.storage.status === 'OK',
      detail: si.storage.status ?? '—' },
  ];
  const failingComponents = components.filter((c) => !c.ok);
  const tone: 'success' | 'warning' | 'danger' = failingComponents.length === 0
    ? 'success'
    : failingComponents.length <= 2
      ? 'warning'
      : 'danger';
  const statusLabel = failingComponents.length === 0
    ? `All ${components.length} components OK`
    : `${failingComponents.length} / ${components.length} failing`;

  return (
    <div className="ea-screen" data-test="cap-health">
      <HealthTabBar />
      <SyncStatusBar
        tone={tone}
        title="Service health"
        statusLabel={statusLabel}
        subtitle={`Component status captured at ${si.timestamp}.  Overall health: ${h.status}.`}
        actions={
          <>
            <Link to="/monitoring/metrics"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="System"
                  data-test="cap-health-open-metrics">
              <UiIcon icon="analytics" size={14} />
              <span>Metrics</span>
            </Link>
            <Link to="/monitoring/storage"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="System"
                  data-test="cap-health-open-storage">
              <UiIcon icon="storage" size={14} />
              <span>Storage</span>
            </Link>
          </>
        }
      />
      <Panel title="Components"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 {components.length} components probed
               </span>
             }>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" data-test="cap-health-components">
            <thead><tr>
              <th>Component</th>
              <th style={{ width: 90 }}>Status</th>
              <th>Detail</th>
            </tr></thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.name} data-test={`cap-health-row-${c.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  <td>{c.name}</td>
                  <td>{dot(c.ok)}</td>
                  <td className={c.mono ? 'ea-mono' : 'ea-cell-two'}>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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
  const tone: 'success' | 'warning' | 'danger' | 'muted' = s.status === 'OK'
    ? 'success'
    : s.status === 'WARN'
      ? 'warning'
      : s.status === 'REJECT'
        ? 'danger'
        : 'muted';
  const statusLabel = s.status === 'OK'
    ? 'Healthy'
    : s.status === 'WARN'
      ? 'Low space warning'
      : s.status === 'REJECT'
        ? 'Writes blocked'
        : (s.status ?? 'Unknown');

  return (
    <div className="ea-screen" data-test="cap-storage">
      <HealthTabBar />
      <SyncStatusBar
        tone={tone}
        title="Storage"
        statusLabel={statusLabel}
        actions={
          <Link to="/monitoring/health"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="System"
                data-test="cap-storage-open-health">
            <UiIcon icon="health" size={14} />
            <span>Service health</span>
          </Link>
        }
      />
      <Panel title="At a glance">
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
      </Panel>
      <Panel title="Thresholds">
        <dl className="ea-def-list" data-test="cap-storage-thresholds">
          <div className="ea-def-row">
            <dt>Root</dt>
            <dd className="ea-mono">{s.root ?? '—'}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Total</dt>
            <dd>{fmtBytes(s.totalBytes)}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Warn below</dt>
            <dd>{fmtBytes(s.warnBytes)}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Reject below</dt>
            <dd>{fmtBytes(s.rejectBytes)}</dd>
          </div>
        </dl>
      </Panel>
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
    { label: 'DER service running', done: isDerUp(h.status) },
    { label: 'DHIS2 reachable', done: c.probeReachable },
    { label: 'Organisation unit bound', done: b.bound },
    { label: 'At least one ADMIN account', done: users.some((u) => u.roles.includes('ADMIN')) },
    { label: 'At least one OPERATOR account', done: users.some((u) => u.roles.includes('OPERATOR')) },
  ];
  const done = steps.filter((s) => s.done).length;
  const todo = steps.length - done;
  const tone: 'success' | 'info' | 'warning' = done === steps.length
    ? 'success'
    : done >= Math.ceil(steps.length / 2)
      ? 'info'
      : 'warning';
  const statusLabel = done === steps.length
    ? 'Ready to go'
    : `${done} / ${steps.length} complete · ${todo} to go`;

  return (
    <div className="ea-screen" data-test="cap-setup">
      <SyncStatusBar
        tone={tone}
        title="Provisioning setup"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/provisioning/users"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="cap-setup-open-users">
              <UiIcon icon="laptop" size={14} />
              <span>Manage users</span>
            </Link>
            <Link to="/dhis2"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="DHIS2"
                  data-test="cap-setup-open-dhis2">
              <UiIcon icon="metadata" size={14} />
              <span>DHIS2 wiring</span>
            </Link>
          </>
        }
      />
      <Panel title="Checklist"
             action={
               <span data-test="cap-setup-progress-chip">
                 {done === steps.length
                   ? <Status tone="success">Ready</Status>
                   : <Status tone={tone}>{`${done} / ${steps.length}`}</Status>}
               </span>
             }>
        <dl className="ea-def-list" data-test="cap-setup-checklist">
          {steps.map((s) => (
            <div key={s.label} className="ea-def-row"
                 data-test={`cap-setup-step-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <dt>{s.label}</dt>
              <dd>
                {s.done
                  ? <Status tone="success">Done</Status>
                  : <Status tone="muted">Todo</Status>}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
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
  const pinMismatch = si.dhis2.pinnedVersion != null
    && si.dhis2.centralVersion != null
    && si.dhis2.pinnedVersion !== si.dhis2.centralVersion;
  const tone: 'success' | 'warning' | 'danger' = si.build.dirty
    ? 'danger'
    : pinMismatch
      ? 'warning'
      : 'success';
  const statusLabel = si.build.dirty
    ? 'Dirty build tree'
    : pinMismatch
      ? 'DHIS2 version mismatch'
      : `v${si.build.version}`;

  return (
    <div className="ea-screen" data-test="cap-releases">
      <SyncStatusBar
        tone={tone}
        title="Software &amp; releases"
        statusLabel={statusLabel}
        actions={
          <Link to="/diagnostics"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="System"
                data-test="cap-releases-open-diagnostics">
            <UiIcon icon="diagnostics" size={14} />
            <span>Diagnostics</span>
          </Link>
        }
      />
      <Panel title="At a glance">
        <div className="ea-stat-strip">
          <Stat label="DER" value={<span className="ea-mono">v{si.build.version}</span>} />
          <Stat label="Branch" value={si.build.branch} />
          <Stat label="Dirty tree" value={si.build.dirty ? 'yes' : 'no'}
                tone={si.build.dirty ? 'danger' : 'success'} />
        </div>
      </Panel>
      <Panel title="Build identity">
        <dl className="ea-def-list" data-test="cap-releases-identity">
          <div className="ea-def-row">
            <dt>Commit</dt>
            <dd className="ea-mono">{si.build.commit}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Built at</dt>
            <dd>{si.build.buildTime}</dd>
          </div>
          <div className="ea-def-row">
            <dt>DHIS2 pinned</dt>
            <dd className="ea-mono">{si.dhis2.pinnedVersion ?? '—'}</dd>
          </div>
          <div className="ea-def-row">
            <dt>DHIS2 observed</dt>
            <dd className="ea-mono">
              {si.dhis2.centralVersion ?? '—'}
              {pinMismatch && (
                <span style={{ marginLeft: 8 }}>
                  <Status tone="warning">Mismatch</Status>
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

export function CapNetwork(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.systemInfo().then(setSi)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err && !si) {
    return <ErrorBlock title="Network info failed"
                        testId="err-network-load-failed">{err}</ErrorBlock>;
  }
  if (!si) return <LoadingBlock testId="loading" />;

  const reachable = si.dhis2.probeReachable;
  const tone: 'success' | 'warning' | 'danger' | 'muted' = si.dhis2.centralBaseUrl == null
    ? 'muted'
    : reachable
      ? 'success'
      : 'danger';
  const statusLabel = si.dhis2.centralBaseUrl == null
    ? 'DHIS2 not configured'
    : reachable
      ? 'Upstream reachable'
      : 'Upstream unreachable';

  return (
    <div className="ea-screen" data-test="cap-network">
      <SyncStatusBar
        tone={tone}
        title="Network / TLS"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/network/clients"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Network"
                  data-test="cap-network-open-clients">
              <UiIcon icon="ethernet" size={14} />
              <span>LAN clients</span>
            </Link>
            <Link to="/dhis2"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="DHIS2"
                  data-test="cap-network-open-dhis2">
              <UiIcon icon="metadata" size={14} />
              <span>DHIS2 wiring</span>
            </Link>
          </>
        }
      />
      <Panel title="Upstream"
             action={
               <span data-test="cap-network-upstream-chip">
                 {reachable
                   ? <Status tone="success">Reachable</Status>
                   : <Status tone="danger">Unreachable</Status>}
               </span>
             }>
        <dl className="ea-def-list" data-test="cap-network-upstream">
          <div className="ea-def-row">
            <dt>DHIS2 base URL</dt>
            <dd className="ea-mono">{si.dhis2.centralBaseUrl ?? '—'}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Reachable</dt>
            <dd>{reachable ? 'yes' : 'no'}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Local service">
        <dl className="ea-def-list" data-test="cap-network-local">
          <div className="ea-def-row">
            <dt>Hostname</dt>
            <dd className="ea-mono">{si.runtime.hostname ?? '—'}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Admin UI</dt>
            <dd className="ea-mono">/admin</dd>
          </div>
          <div className="ea-def-row">
            <dt>Edge API</dt>
            <dd className="ea-mono">/edge-api/v1</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
