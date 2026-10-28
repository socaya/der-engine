import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { HeroHeader } from '../components/HeroHeader';
import { useOrgUnit } from '../components/OrgUnitContext';
import { ErrorBlock, LoadingBlock, EmptyBlock } from '../components/ScreenStates';
import { usePaged, TablePager, describeCron, Panel, humaniseState, SyncStatusBar, Spinner, useTriggerAndWatch, RowMenu, confirmThenRun, Status } from './mockups/shared';

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

  return (
    <div className="ea-screen" data-test="cap-connection">
      <HeroHeader
        title="Central connection"
        subtitle="Edit the DHIS2 central-connection and compatibility policy for this edge. ADMIN only."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ea-btn ea-btn--ghost"
                    disabled={refreshing}
                    onClick={() => { refresh().catch(() => undefined); }}>
              {refreshing ? 'Probing…' : 'Probe now'}
            </button>
            <button type="button" className="ea-btn ea-btn--primary"
                    disabled={saving}
                    onClick={() => { save().catch(() => undefined); }}>
              {saving ? 'Saving…' : 'Save connection'}
            </button>
          </div>
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

      {msg && <p className="ea-saved">{msg}</p>}
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
              <span className="ea-field-hint">
                If set, DER prefers the PAT (Bearer) over username/password Basic auth.
              </span>
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
            <p>ADR-0006 compatibility policy — hard floor, max tested version and probe strictness.</p>
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
            <p>Opt-in passthrough so custom DHIS2 apps running on DER can call analytics / dataStore / etc. straight through to central.</p>
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
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <h1 className="ea-dash-hero-title">Organisation unit</h1>
        </div>
        {b.bound && !rebindOpen && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ea-btn ea-btn--primary"
                    data-test="ou-change"
                    onClick={() => setRebindOpen(true)}>
              Change organisation unit
            </button>
          </div>
        )}
      </section>

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
                <span className="ea-chip ea-chip--success">bound</span>
                {level > 0 && <span className="ea-chip ea-chip--info">Level {level}</span>}
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
  useEffect(() => {
    edgeApi.metadataList('programRules', { pageSize: 1000, page: 1 })
      .then((r) => {
        const items = (r.programRules ?? []) as edgeApi.MetadataListItem[];
        setRows(items);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  const paged = usePaged(rows ?? [], 50);
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
              {paged.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.displayName ?? '—'}</td>
                  <td className="ea-mono">{r.id}</td>
                </tr>
              ))}
            </tbody></table>
            <TablePager {...paged.pagerProps} />
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

  const last = history?.[0];
  const lastSuccess = (history ?? []).find((r) => r.outcome === 'SUCCEEDED' || r.outcome === 'SUCCESS');
  const centralReachable = sysInfo?.dhis2?.probeReachable ?? false;
  const lastOk = last?.outcome === 'SUCCEEDED' || last?.outcome === 'SUCCESS';
  const tone = !last ? 'muted' : lastOk ? 'success' : 'danger';
  const busy = pull.state === 'triggering' || pull.state === 'running';

  const statusLabel = !last ? 'Never pulled'
    : lastOk ? 'Up to date' : 'Last pull failed';

  return (
    <div className="ea-screen" data-test="cap-metadata-sync">
      <SyncStatusBar
        tone={tone}
        title="Metadata"
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
            {busy && <><Spinner /><span style={{ marginLeft: 6 }} /></>}
            {pull.state === 'running' ? 'Pulling…' : 'Pull metadata'}
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
          <span className={'ea-chip ea-chip--'
            + (pull.state === 'done' ? 'success'
              : pull.state === 'failed' ? 'danger'
              : pull.state === 'timeout' ? 'warning' : 'info')}>
            {pull.state === 'triggering' ? 'Starting'
              : pull.state === 'running' ? 'Running'
              : pull.state === 'done' ? 'Completed'
              : pull.state === 'failed' ? 'Failed' : 'Still running'}
          </span>
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
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable" style={{ width: '100%' }}>
              <thead><tr>
                <th>When</th>
                <th>Result</th>
                <th>Duration</th>
                <th>Triggered by</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {history.map((h) => {
                  const ok = h.outcome === 'SUCCEEDED' || h.outcome === 'SUCCESS';
                  return (
                    <tr key={h.runId}
                        onClick={() => navigate(`/sync/history/${h.runId}`)}
                        data-test={`metadata-row-${h.runId}`}>
                      <td>{new Date(h.startedAt).toLocaleString()}</td>
                      <td><Status tone={ok ? 'success' : 'danger'}>{ok ? 'Succeeded' : 'Failed'}</Status></td>
                      <td>{h.durationMs != null ? fmtDur(h.durationMs) : '—'}</td>
                      <td>{humaniseState(h.triggeredBy)}</td>
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
          </div>
        )}
      </Panel>
    </div>
  );
}

/** /admin/sync/data — DER Sync requirements §7. Thin wrapper over the
 *  existing MockupDataQueues implementation (which already carries the
 *  activity-feed table + payload drawer). The screen is reachable
 *  through `/sync/data` as well as the legacy `/sync/queues`. */
export function CapDataExchange(): JSX.Element {
  // Legacy export kept so existing bookmarks still resolve; the full
  // Data screen lives in MoreScreens → MockupDataQueues (routed on
  // /sync/data). Rendering MockupDataQueues directly here would create
  // a circular import.
  return (
    <div className="ea-screen">
      <p className="ea-text-muted" style={{ margin: 0 }}>
        The Data page has moved. <Link to="/sync/data">Open the new Data page →</Link>
      </p>
    </div>
  );
}

/** /admin/sync/settings — DER Sync requirements §12. */
export function CapSyncSettings(): JSX.Element {
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const [testing, setTesting] = useState(false);
  const [testFlash, setTestFlash] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try { setSysInfo(await edgeApi.systemInfo()); } catch { /* ignore */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function testConnection(): Promise<void> {
    setTesting(true); setTestFlash(null);
    try {
      const si = await edgeApi.systemInfo();
      setSysInfo(si);
      setTestFlash(si.dhis2?.probeReachable
        ? `Connection OK. Central DHIS2 ${si.dhis2.centralVersion} responded in ${si.dhis2.probeDurationMs} ms.`
        : 'Central DHIS2 is not reachable from this edge.');
    } catch (e) {
      setTestFlash(e instanceof Error ? e.message : String(e));
    } finally { setTesting(false); }
  }

  const reachable = sysInfo?.dhis2?.probeReachable ?? false;
  return (
    <div className="ea-screen" data-test="cap-sync-settings">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <Panel title="Central DHIS2"
               action={
                 <>
                   <Link to="/dhis2/connection" className="ea-btn ea-btn--ghost ea-btn--sm">
                     Open DHIS2 Configuration
                   </Link>
                   <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                           disabled={testing}
                           onClick={() => { testConnection().catch(() => undefined); }}
                           data-test="sync-test-connection">
                     {testing ? 'Testing…' : 'Test connection'}
                   </button>
                 </>
               }>
          <p className="ea-text-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
            These values are read-only here. They are managed in the DHIS2 Module.
          </p>
          {testFlash && <p className="ea-saved" style={{ margin: '0 0 8px' }}>{testFlash}</p>}
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Central DHIS2 URL</dt>
              <dd className="ea-mono">{sysInfo?.dhis2?.centralBaseUrl ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Pinned version</dt>
              <dd>{sysInfo?.dhis2?.pinnedVersion ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Central version</dt>
              <dd>{sysInfo?.dhis2?.centralVersion ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Connection status</dt>
              <dd>
                <span className={'ea-chip ea-chip--' + (reachable ? 'success' : 'warning')}>
                  {reachable ? 'Reachable' : 'Unreachable'}
                </span>
              </dd></div>
            <div className="ea-def-row"><dt>Authentication</dt>
              <dd>{sysInfo?.dhis2?.probeReachable ? 'Working' : 'Unknown'}</dd></div>
          </dl>
        </Panel>

        <Panel title="Sync behaviour · advanced">
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
            Batch size, retry delay, back-off and request timeout are managed in the
            schedule screen under <Link to="/sync/schedule">Schedule</Link>. Fine-grained
            overrides live under <Link to="/settings">Settings</Link>.
          </p>
        </Panel>
      </div>
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="ea-btn ea-btn--primary"
                disabled={status === 'saving'}
                onClick={() => { save().catch(() => undefined); }}>
          {status === 'saving' ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
      {status === 'saved' && <p className="ea-saved">Schedule saved.</p>}
      {status === 'error' && err && <ErrorBlock title="Save failed" testId="err-save-failed">{err}</ErrorBlock>}
      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Scheduled sync flows</h2>
            <p>When each background flow runs. Plain-English summary first; the exact cron expression is editable below each row.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cron.length === 0 && (
              <div className="ea-field-hint">No scheduled flows configured on this build.</div>
            )}
            {cron.map(([k, v]) => (
              <CronRow key={k}
                       cronKey={k}
                       value={v}
                       onChange={(nv) => setS({ ...s, cron: { ...s.cron, [k]: nv } })} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** One scheduled flow — plain-English summary with the cron expression
 *  tucked behind a "Show expression" toggle (DER Sync spec §8). */
function CronRow({ cronKey, value, onChange }: {
  cronKey: string; value: string; onChange: (v: string) => void;
}): JSX.Element {
  const [showExpr, setShowExpr] = useState(false);
  const info = scheduleKeyInfo(cronKey);
  return (
    <div data-test={`cron-row-${cronKey}`}
         style={{
           padding: '10px 12px', border: '1px solid var(--der-border-subtle)',
           borderRadius: 6,
         }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--der-ink-900)' }}>
            {info.title}
          </div>
          <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
            {info.desc}
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <strong>Runs {describeCron(value).toLowerCase()}</strong>
          </div>
        </div>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                onClick={() => setShowExpr((x) => !x)}>
          {showExpr ? 'Hide expression' : 'Show expression'}
        </button>
      </div>
      {showExpr && (
        <label className="ea-field" style={{ marginTop: 8 }}>
          <span className="ea-field-label" title={cronKey}>Cron expression</span>
          <input className="ea-input ea-mono" value={value}
                 data-test={`cron-input-${cronKey}`}
                 onChange={(e) => onChange(e.target.value)} />
          <span className="ea-field-hint">
            Quartz syntax: <code>seconds minutes hours day-of-month month day-of-week</code>.
            Leave blank to use the compiled default.
          </span>
        </label>
      )}
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
              <Link to="/workflows">← Back to workflows</Link>
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
          Operators have not started any workflow yet, or no workflow is enabled.
        </EmptyBlock>
      ) : (
        <Panel title="Runs">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"><thead><tr>
              <th>Workflow</th><th>Status</th><th>Business key</th><th>Started</th>
            </tr></thead><tbody>
              {runs.map((r) => (
                <tr key={r.runId}>
                  <td style={{ fontWeight: 500 }}>{r.workflowName}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.state === 'COMPLETED' ? 'success'
                        : r.state === 'REJECTED' ? 'danger'
                          : 'info')} title={r.state}>{humaniseState(r.state)}</span></td>
                  <td className="ea-mono">{r.businessKey}</td>
                  <td className="ea-text-muted" style={{ fontSize: 12 }}
                      title={r.createdAt}>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </Panel>
      )}
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
              <Link to="/workflows">← Back to workflows</Link>
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
            </tr></thead><tbody>
              {displayed.flatMap((w) => (w.steps ?? []).map((s) => (
                <tr key={w.workflowId + '-' + s.ordinal}>
                  {!scopedWorkflow && <td style={{ fontWeight: 500 }}>{w.displayName}</td>}
                  <td className="ea-mono">{s.ordinal}</td>
                  <td>{s.displayName}</td>
                  <td><span className="ea-chip ea-chip--info" title={s.ownerRole}>{humaniseState(s.ownerRole)}</span></td>
                  <td><span className="ea-chip ea-chip--neutral" title={s.stepKind}>{humaniseState(s.stepKind)}</span></td>
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
  return (
    <div className="ea-screen" data-test="cap-ref-history">
      <SyncStatusBar
        tone={rows.length === 0 ? 'muted' : 'info'}
        title="Referral history"
        statusLabel={`${rows.length} total`}
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
      />
      {rows.length === 0 ? (
        <EmptyBlock title="No referrals yet" testId="empty-no-referrals-yet">Nothing has been referred to this edge.</EmptyBlock>
      ) : (
        <Panel title="Referrals">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"><thead><tr>
              <th>Received</th><th>Kind</th><th>Source ref</th><th>Status</th>
            </tr></thead><tbody>
              {rows.map((r) => (
                <tr key={r.inboxId}>
                  <td className="ea-text-muted" style={{ fontSize: 12 }}
                      title={r.discoveredAt}>{new Date(r.discoveredAt).toLocaleString()}</td>
                  <td><span className="ea-chip ea-chip--info" title={r.kind}>{humaniseState(r.kind)}</span></td>
                  <td className="ea-mono">{r.sourceRef}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (r.status === 'ACCEPTED' ? 'success'
                        : r.status === 'DISMISSED' ? 'neutral' : 'warning')} title={r.status}>
                    {humaniseState(r.status)}
                  </span></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </Panel>
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
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'info'}
        title="Drafts"
        statusLabel={rows.length === 0 ? 'All submitted' : `${rows.length} draft${rows.length === 1 ? '' : 's'}`}
        subtitle={<span>Captures saved locally but not yet submitted to a workflow.</span>}
      />
      {rows.length === 0 ? (
        <EmptyBlock title="No drafts" testId="empty-no-drafts">
          Every local capture has either been submitted or discarded.
        </EmptyBlock>
      ) : (
        <Panel title={`${rows.length} draft${rows.length === 1 ? '' : 's'}`}>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Updated</th>
                <th>Kind</th>
                <th>Title</th>
                <th style={{ width: 90 }}>Action</th>
              </tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.draftId}>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}
                        title={d.updatedAt}>{new Date(d.updatedAt).toLocaleString()}</td>
                    <td><span className="ea-chip ea-chip--neutral" title={d.kind}>
                      {humaniseState(d.kind)}
                    </span></td>
                    <td>{d.title ?? <span className="ea-text-muted">Untitled draft</span>}</td>
                    <td>
                      <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                              onClick={() => {
                                confirmThenRun(
                                  `Discard draft "${d.title ?? 'Untitled'}"? The captured values will be lost.`,
                                  () => { remove(d.draftId).catch(() => undefined); });
                              }}>
                        Discard
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
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
  const jobCatalogue: ReadonlyArray<{ name: string; label: string; desc: string }> = [
    { name: 'METADATA_SYNC_FULL', label: 'Pull metadata',
      desc: 'Mirror DHIS2 metadata (programs, data elements, OUs) now.' },
    { name: 'AGGREGATE_DATA_PUSH', label: 'Push aggregate data',
      desc: 'Send captured aggregate data values to Central DHIS2.' },
    { name: 'JOURNAL_DRAIN', label: 'Drain journal',
      desc: 'Push every pending outbound record (all types) now.' },
  ];
  return (
    <div className="ea-screen" data-test="cap-maint">
      <SyncStatusBar
        tone="muted"
        title="Maintenance"
        statusLabel={busy ? 'Running' : 'Idle'}
        subtitle={<span>One-off operator actions. Prefer the dedicated Sync pages for routine operations.</span>}
      />
      {msg && <p className="ea-saved">{msg}</p>}
      {err && <ErrorBlock title="Action failed" testId="err-action-failed">{err}</ErrorBlock>}

      <Panel title="Trigger sync jobs">
        <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
          Manual trigger for the three main scheduler jobs. These normally
          run on their schedule and are also exposed on the Sync pages.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                       gap: 8 }}>
          {jobCatalogue.map((j) => (
            <button key={j.name} type="button" className="ea-link-tile ea-link-tile--btn"
                    disabled={busy === j.name}
                    onClick={() => { run(j.label, () => edgeApi.triggerJob(j.name)).catch(() => undefined); }}>
              <div className="ea-link-tile-icon" aria-hidden="true">▶</div>
              <div className="ea-link-tile-body">
                <div className="ea-link-tile-title">{j.label}</div>
                <div className="ea-link-tile-desc">
                  {busy === j.label ? 'Starting…' : j.desc}
                </div>
                <div className="ea-text-muted ea-mono" style={{ fontSize: 10, marginTop: 2 }}>
                  {j.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Backups">
        <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
          Create a snapshot of the audit log or the full edge state.
          Full backups cover the database, metadata mirror and installed apps.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                       gap: 8 }}>
          <button type="button" className="ea-link-tile ea-link-tile--btn"
                  disabled={busy === 'AUDIT backup'}
                  onClick={() => { run('AUDIT backup', () => edgeApi.requestBackup('AUDIT')).catch(() => undefined); }}>
            <div className="ea-link-tile-icon" aria-hidden="true">⬇</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Audit backup</div>
              <div className="ea-link-tile-desc">Hash-chained audit log only.</div>
            </div>
          </button>
          <button type="button" className="ea-link-tile ea-link-tile--btn"
                  disabled={busy === 'FULL backup'}
                  onClick={() => { run('FULL backup', () => edgeApi.requestBackup('FULL')).catch(() => undefined); }}>
            <div className="ea-link-tile-icon" aria-hidden="true">⬇</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Full backup</div>
              <div className="ea-link-tile-desc">Database + metadata mirror + apps.</div>
            </div>
          </button>
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
      <p className="ea-field-hint" style={{ padding: '12px 0', fontSize: 12 }}>
        Direct DHIS2 user mapping is applied by sync and is not yet editable from this console.
      </p>
    </div>
  );
}

export function CapRoles(): JSX.Element {
  const ROLES = [
    { id: 'ADMIN', label: 'Admin',
      desc: 'Full control: provisioning, sync, apps, settings, recovery.' },
    { id: 'OPERATOR', label: 'Operator',
      desc: 'Captures data on the device; reads own drafts and recent runs.' },
    { id: 'REVIEWER', label: 'Reviewer',
      desc: 'Reviews pending approvals and conflicts; cannot change settings.' },
  ];
  return (
    <div className="ea-screen" data-test="cap-roles">
      <SyncStatusBar
        tone="muted"
        title="Roles & permissions"
        statusLabel="Fixed set"
        subtitle={<span>The role set shipped with this DER build. Role editing is intentionally fixed.</span>}
      />
      <Panel title="Roles">
        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 10 }}>
          {ROLES.map((r) => (
            <div key={r.id}
                 style={{
                   padding: '12px 14px',
                   border: '1px solid var(--der-border-subtle)',
                   borderRadius: 6,
                   background: 'white',
                 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="ea-chip ea-chip--primary" title={r.id}>{r.label}</span>
                <span className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>{r.id}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--der-ink-700)', lineHeight: 1.5 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </Panel>
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
  const sessions = si.database.sessionCount ?? 0;
  return (
    <div className="ea-screen" data-test="cap-sessions">
      <SyncStatusBar
        tone={sessions > 0 ? 'success' : 'muted'}
        title="User sessions"
        statusLabel={sessions === 0 ? 'No active sessions' : `${sessions} active`}
        subtitle={
          <>
            <span>Live sign-in sessions on this edge. Sessions auto-expire with the DER_SESSION cookie.</span>
            <span>·</span>
            <span>Known users <strong style={{ color: 'var(--der-ink-900)' }}>{users.length}</strong></span>
          </>
        }
      />
      <Panel title="Session management">
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Per-session details (device, IP, last seen) are not yet exposed on this edge.
          To invalidate every session at once, rotate the <code>DER_SESSION</code> secret
          via Settings.
        </p>
      </Panel>
    </div>
  );
}

export function CapCredentials(): JSX.Element {
  return (
    <div className="ea-screen" data-test="cap-creds">
      <SyncStatusBar
        tone="muted"
        title="Credentials"
        statusLabel="Password only"
        subtitle={<span>How users prove who they are on this edge.</span>}
      />
      <Panel title="Credential policy">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Password minimum</dt>
            <dd>12 characters, mixed upper, lower, digits</dd></div>
          <div className="ea-def-row"><dt>Session storage</dt>
            <dd className="ea-mono">DER_SESSION cookie (HttpOnly, SameSite)</dd></div>
          <div className="ea-def-row"><dt>Multi-factor</dt>
            <dd><span className="ea-chip ea-chip--neutral">Not configured</span></dd></div>
          <div className="ea-def-row"><dt>External SSO</dt>
            <dd><span className="ea-chip ea-chip--neutral">Not configured</span></dd></div>
        </dl>
      </Panel>
      <p className="ea-field-hint" style={{ padding: '12px 0', fontSize: 12 }}>
        MFA and OIDC federation ship in a later DER release. Password resets today
        require an admin re-provision.
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
    <Status tone={ok ? 'success' : 'danger'}>{ok ? 'OK' : 'FAIL'}</Status>;
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
              <td>{dot(isDerUp(h.status))}</td>
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
    { label: 'DER service running', done: isDerUp(h.status) },
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
