import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

/**
 * Phase 06 Release 2 — EA-01..18 admin screens.
 *
 * Each exported component is a focused screen that honours the required
 * UI states (loading / data-loaded / empty / error / offline) and admin
 * action semantics per `docs/ui/screens/EA-*.md`.
 */

// EA-01 Setup welcome / home ------------------------------------------
export function EASetupWelcome({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'health' | 'compat' | 'getOrgUnitBinding'
      | 'bindOrgUnit' | 'listOrgUnits'> } = {}): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [binding, setBinding] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [orgUnits, setOrgUnits] = useState<edgeApi.OrgUnitRow[]>([]);
  const [selected, setSelected] = useState('');
  const [confirmRebind, setConfirmRebind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const [hr, cr, br] = await Promise.all([
        api.health(), api.compat(), api.getOrgUnitBinding(),
      ]);
      setH(hr); setC(cr); setBinding(br);
      if (!br.bound) {
        const ous = await api.listOrgUnits();
        setOrgUnits(ous.organisationUnits);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function doBind(): Promise<void> {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api.bindOrgUnit(selected, confirmRebind);
      await reload();
      setSelected('');
      setConfirmRebind(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorBlock title="Setup probe failed" testId="ea01-error">{error}</ErrorBlock>;
  if (!h || !c || !binding) return <LoadingBlock testId="ea01-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea01-heading">Setup overview</h1>
      {!h.dhis2Integrated && <OfflineBanner testId="ea01-offline" />}
      <dl>
        <dt>DER version</dt><dd data-test="ea01-version">{h.version}</dd>
        <dt>DHIS2 central version</dt>
        <dd data-test="ea01-central">{c.centralVersion ?? 'unknown'}</dd>
        <dt>Compat profile</dt><dd data-test="ea01-profile">{c.profileName ?? '—'}</dd>
        <dt>Bound orgUnit</dt>
        <dd data-test="ea01-orgunit">
          {binding.bound
            ? `${binding.orgUnitDisplayName} (${binding.orgUnitPath})`
            : <span data-test="ea01-orgunit-unbound">— not bound; writes are rejected until an admin picks an orgUnit.</span>}
        </dd>
      </dl>
      {!binding.bound && (
        <section className="ea-ou-picker" data-test="ea01-orgunit-picker">
          <h2>Bind this edge to an orgUnit</h2>
          {orgUnits.length === 0
            ? <EmptyBlock title="No orgUnits in local mirror" testId="ea01-orgunit-empty">
                Run metadata sync first (Jobs tab) so the orgUnit tree is available locally.
              </EmptyBlock>
            : (
              <>
                <label>
                  <span>Select orgUnit</span>
                  <select data-test="ea01-orgunit-select"
                    value={selected} onChange={(e) => { setSelected(e.target.value); }}>
                    <option value="">— choose —</option>
                    {orgUnits.map((ou) => (
                      <option key={ou.id} value={ou.id} data-test={`ea01-orgunit-opt-${ou.id}`}>
                        {ou.displayName}{ou.path ? ` (${ou.path})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" data-test="ea01-orgunit-bind"
                  disabled={!selected || saving}
                  onClick={() => { doBind().catch(() => undefined); }}>
                  {saving ? 'Binding…' : 'Bind'}
                </button>
              </>
            )}
        </section>
      )}
      {binding.bound && (
        <section className="ea-ou-rebind" data-test="ea01-orgunit-rebind">
          <details>
            <summary>Rebind to a different orgUnit…</summary>
            <p>Rebinding does not purge local data; previous-OU rows are
               retained for admin triage.</p>
            <label>
              <span>New orgUnit id</span>
              <input type="text" data-test="ea01-orgunit-rebind-id"
                value={selected} onChange={(e) => { setSelected(e.target.value); }} />
            </label>
            <label>
              <input type="checkbox" data-test="ea01-orgunit-rebind-confirm"
                checked={confirmRebind}
                onChange={(e) => { setConfirmRebind(e.target.checked); }} />
              I confirm this rebind.
            </label>
            <button type="button" data-test="ea01-orgunit-rebind-submit"
              disabled={!selected || !confirmRebind || saving}
              onClick={() => { doBind().catch(() => undefined); }}>
              Rebind
            </button>
          </details>
        </section>
      )}
      <nav><Link to="/provisioning/users" data-test="ea01-provisioning">Provisioning</Link></nav>
    </div>
  );
}

// EA-02 Users list ----------------------------------------------------
export function EAUsersList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listUsers'> } = {}): JSX.Element {
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.listUsers()
      .then((r) => { if (!cancelled) setUsers(r.users); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Users failed" testId="ea02-error">{error}</ErrorBlock>;
  if (users === null) return <LoadingBlock testId="ea02-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea02-heading">Provisioned users</h1>
      <Link to="/provisioning/users/new" data-test="ea02-new">Add user</Link>
      {users.length === 0
        ? <EmptyBlock title="No users yet" testId="ea02-empty">Bootstrap an admin via env first.</EmptyBlock>
        : <ul>{users.map((u) => (
            <li key={u.userId}>
              <span data-test={`ea02-user-${u.userId}`}>{u.displayName} ({u.username})</span>
              {' — '}
              <span data-test={`ea02-roles-${u.userId}`}>{u.roles.join(', ')}</span>
            </li>
          ))}</ul>}
    </div>
  );
}

// EA-03 User create ---------------------------------------------------
export function EAUserCreate({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'createUser'> } = {}): JSX.Element {
  const [u, setU] = useState(''); const [d, setD] = useState('');
  const [p, setP] = useState(''); const [role, setRole] = useState('OPERATOR');
  const [status, setStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function doSave(): Promise<void> {
    setStatus('saving'); setError(null);
    try { await api.createUser({ username: u, displayName: d, password: p, roles: [role] });
      setStatus('saved');
    } catch (err) { setStatus('error');
      setError(err instanceof Error ? err.message : String(err)); }
  }
  return (
    <div className="ea-screen">
      <h1 data-test="ea03-heading">Create user</h1>
      <label><span>Username</span>
        <input data-test="ea03-username" value={u} onChange={(e) => setU(e.target.value)} /></label>
      <label><span>Display name</span>
        <input data-test="ea03-display" value={d} onChange={(e) => setD(e.target.value)} /></label>
      <label><span>Password</span>
        <input data-test="ea03-password" type="password" value={p}
               onChange={(e) => setP(e.target.value)} /></label>
      <label><span>Role</span>
        <select data-test="ea03-role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="OPERATOR">OPERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </select></label>
      <button type="button" data-test="ea03-submit" disabled={!u || !p || status === 'saving'}
              onClick={() => { doSave().catch(() => undefined); }}>Create</button>
      {status === 'saved' && <p data-test="ea03-saved">User created.</p>}
      {status === 'error' && error && (
        <ErrorBlock title="Create failed" testId="ea03-error">{error}</ErrorBlock>
      )}
    </div>
  );
}

// EA-04 Compat snapshot inspector ------------------------------------
export function EACompatInspector({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'compat' | 'refreshCompat'> } = {}): JSX.Element {
  const [snap, setSnap] = useState<edgeApi.CompatSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function load(): Promise<void> {
    try { setSnap(await api.compat()); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { load().catch(() => undefined); }, [api]);
  async function doRefresh(): Promise<void> {
    setRefreshing(true);
    try { setSnap(await api.refreshCompat()); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setRefreshing(false); }
  }
  if (error) return <ErrorBlock title="Compat probe failed" testId="ea04-error">{error}</ErrorBlock>;
  if (!snap) return <LoadingBlock testId="ea04-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea04-heading">DHIS2 compatibility</h1>
      <p>Profile: <span data-test="ea04-profile">{snap.profileName}</span></p>
      <p>Central version: <span data-test="ea04-version">{snap.centralVersion}</span></p>
      <p>Probe reachable:{' '}
        <span data-test="ea04-reachable">
          {snap.probeReachable ? 'yes' : 'no'}
        </span></p>
      <button type="button" data-test="ea04-refresh" disabled={refreshing}
              onClick={() => { doRefresh().catch(() => undefined); }}>
        {refreshing ? 'Refreshing…' : 'Refresh now'}
      </button>
    </div>
  );
}

// EA-05 Compat history ----------------------------------------------
export function EACompatHistory({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'compatHistory'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.CompatSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.compatHistory(20)
      .then((r) => { if (!cancelled) setRows(r.snapshots); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="History failed" testId="ea05-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea05-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea05-heading">Compat history</h1>
      {rows.length === 0
        ? <EmptyBlock title="No snapshots yet" testId="ea05-empty">
            Trigger a probe refresh to populate history.</EmptyBlock>
        : <table><thead><tr><th>Profile</th><th>Version</th><th>Reachable</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td data-test={`ea05-row-profile-${i}`}>{r.profileName}</td>
                <td>{r.centralVersion}</td>
                <td>{String(r.probeReachable)}</td>
              </tr>
            ))}</tbody></table>}
    </div>
  );
}

// EA-06 Jobs list ---------------------------------------------------
export function EAJobsList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listJobs'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.JobRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.listJobs(50)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Jobs failed" testId="ea06-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea06-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea06-heading">Scheduled job runs</h1>
      {rows.length === 0
        ? <EmptyBlock title="No runs yet" testId="ea06-empty">Jobs start on cron.</EmptyBlock>
        : <table><thead><tr><th>Job</th><th>Started</th><th>Outcome</th><th>Duration</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.runId}>
                <td data-test={`ea06-row-job-${r.runId}`}>{r.jobName}</td>
                <td>{r.startedAt}</td>
                <td>{r.outcome}</td>
                <td>{r.durationMs ?? '—'}</td>
              </tr>
            ))}</tbody></table>}
    </div>
  );
}

// EA-07 Job trigger -------------------------------------------------
export function EAJobTrigger({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'triggerJob'> } = {}): JSX.Element {
  const [name, setName] = useState('METADATA_SYNC_FULL');
  const [status, setStatus] = useState<'idle'|'triggering'|'ok'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function doTrigger(): Promise<void> {
    setStatus('triggering'); setError(null);
    try {
      const r = await api.triggerJob(name);
      if (r.error) throw new Error(r.error);
      setStatus('ok');
    } catch (err) { setStatus('error');
      setError(err instanceof Error ? err.message : String(err)); }
  }
  return (
    <div className="ea-screen">
      <h1 data-test="ea07-heading">Trigger a job</h1>
      <label><span>Job name</span>
        <select data-test="ea07-name" value={name} onChange={(e) => setName(e.target.value)}>
          <option>METADATA_SYNC_FULL</option>
          <option>COMPAT_PROBE_REFRESH</option>
          <option>DRIFT_SNAPSHOT</option>
          <option>JOURNAL_WORKER_DRAIN</option>
        </select></label>
      <button type="button" data-test="ea07-fire" disabled={status === 'triggering'}
              onClick={() => { doTrigger().catch(() => undefined); }}>Fire now</button>
      {status === 'ok' && <p data-test="ea07-ok">Triggered.</p>}
      {status === 'error' && error && (
        <ErrorBlock title="Trigger failed" testId="ea07-error">{error}</ErrorBlock>
      )}
    </div>
  );
}

// EA-08/09 Drift inspection ----------------------------------------
export function EADriftInspector({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'drift'> } = {}): JSX.Element {
  const [data, setData] = useState<edgeApi.DriftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function load(refresh: boolean): Promise<void> {
    setError(null);
    try { setData(await api.drift(refresh)); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { load(false).catch(() => undefined); }, [api]);
  if (error) return <ErrorBlock title="Drift failed" testId="ea08-error">{error}</ErrorBlock>;
  if (!data) return <LoadingBlock testId="ea08-loading" />;
  if (data.status === 'NO_SNAPSHOT') {
    return <EmptyBlock title="No drift snapshot" testId="ea08-empty">
      Trigger a metadata sync first.</EmptyBlock>;
  }
  return (
    <div className="ea-screen">
      <h1 data-test="ea08-heading">Metadata drift</h1>
      <p data-test="ea08-pair">
        from {data.snapshotFrom} to {data.snapshotTo}
      </p>
      <p data-test="ea08-same">
        Fingerprint {data.fingerprintFrom === data.fingerprintTo ? 'equal' : 'different'}
      </p>
      <button type="button" data-test="ea08-refresh" disabled={refreshing}
              onClick={() => { setRefreshing(true);
                load(true).finally(() => setRefreshing(false)); }}>
        {refreshing ? 'Running…' : 'Re-run drift'}
      </button>
    </div>
  );
}

// EA-10..13 Conflict review ---------------------------------------
export function EAConflictList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listConflicts'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.ConflictRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.listConflicts()
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Conflicts failed" testId="ea10-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea10-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea10-heading">Conflicts to review</h1>
      {rows.length === 0
        ? <EmptyBlock title="No conflicts" testId="ea10-empty">
            Nothing in CONFLICT_REVIEW state.</EmptyBlock>
        : <ul>{rows.map((r) => (
            <li key={r.operationId}>
              <Link to={`/conflicts/${r.operationId}`} data-test={`ea10-row-${r.operationId}`}>
                {r.entityType} {r.entityRef}
              </Link>
            </li>
          ))}</ul>}
    </div>
  );
}

export function EAConflictResolve({ api = edgeApi, operationId }:
    { api?: Pick<typeof edgeApi, 'resolveConflict' | 'reJournalConflict'>;
      operationId: string } ): JSX.Element {
  const [outcome, setOutcome] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [rationale, setRationale] = useState('');
  const [status, setStatus] = useState<'idle'|'working'|'done'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function doResolve(): Promise<void> {
    setStatus('working'); setError(null);
    try { await api.resolveConflict(operationId, outcome, rationale); setStatus('done'); }
    catch (err) { setStatus('error');
      setError(err instanceof Error ? err.message : String(err)); }
  }
  async function doReJournal(): Promise<void> {
    setStatus('working'); setError(null);
    try { await api.reJournalConflict(operationId); setStatus('done'); }
    catch (err) { setStatus('error');
      setError(err instanceof Error ? err.message : String(err)); }
  }
  return (
    <div className="ea-screen">
      <h1 data-test="ea11-heading">Resolve conflict</h1>
      <p data-test="ea11-id">{operationId}</p>
      <label><span>Outcome</span>
        <select data-test="ea11-outcome" value={outcome}
                onChange={(e) => setOutcome(e.target.value as 'ACCEPTED' | 'REJECTED')}>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="REJECTED">REJECTED</option>
        </select></label>
      <label><span>Rationale</span>
        <textarea data-test="ea11-rationale" value={rationale}
                  onChange={(e) => setRationale(e.target.value)} /></label>
      <button type="button" data-test="ea11-resolve" disabled={status === 'working'}
              onClick={() => { doResolve().catch(() => undefined); }}>Resolve</button>
      <button type="button" data-test="ea11-rejournal" disabled={status === 'working'}
              onClick={() => { doReJournal().catch(() => undefined); }}>Re-journal</button>
      {status === 'done' && <p data-test="ea11-done">Saved.</p>}
      {status === 'error' && error && (
        <ErrorBlock title="Conflict op failed" testId="ea11-error">{error}</ErrorBlock>
      )}
    </div>
  );
}

// EA-14..17 Journal worker health + pause/resume ------------------
export function EAWorkerHealth({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'workerHealth' | 'pauseWorker' | 'resumeWorker'> } = {}):
    JSX.Element {
  const [h, setH] = useState<edgeApi.WorkerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load(): Promise<void> {
    try { setH(await api.workerHealth()); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { load().catch(() => undefined); }, [api]);
  async function toggle(): Promise<void> {
    try {
      const fn = h?.enabled ? api.pauseWorker : api.resumeWorker;
      await fn();
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }
  if (error) return <ErrorBlock title="Worker health failed" testId="ea14-error">{error}</ErrorBlock>;
  if (!h) return <LoadingBlock testId="ea14-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea14-heading">Journal worker</h1>
      <p>Status: <span data-test="ea14-enabled">{h.enabled ? 'running' : 'paused'}</span></p>
      <p>Last tick: <span data-test="ea14-tick">{h.lastTick ?? '—'}</span></p>
      <p>Last batch: <span data-test="ea14-batch">{h.lastBatchSize}</span></p>
      <ul data-test="ea14-backlog">
        {Object.entries(h.backlog).map(([state, n]) => (
          <li key={state}>
            <span data-test={`ea14-backlog-${state}`}>{state}: {n}</span>
          </li>
        ))}
      </ul>
      <button type="button" data-test="ea14-toggle"
              onClick={() => { toggle().catch(() => undefined); }}>
        {h.enabled ? 'Pause' : 'Resume'}
      </button>
    </div>
  );
}

// EA-18 Metadata overview -----------------------------------------
export function EAMetadataOverview({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'metadataList'> } = {}): JSX.Element {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resources = ['dataSets', 'dataElements', 'organisationUnits',
          'programs', 'trackedEntityTypes'];
        const n: Record<string, number> = {};
        for (const r of resources) {
          const resp = await api.metadataList(r);
          const items = (resp[r] ?? resp.items ?? []) as unknown[];
          n[r] = items.length;
        }
        if (!cancelled) setCounts(n);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Metadata failed" testId="ea18-error">{error}</ErrorBlock>;
  if (!counts) return <LoadingBlock testId="ea18-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea18-heading">Mirror overview</h1>
      <ul>
        {Object.entries(counts).map(([k, v]) => (
          <li key={k}><span data-test={`ea18-count-${k}`}>{k}: {v}</span></li>
        ))}
      </ul>
    </div>
  );
}
