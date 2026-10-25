import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';
import { ScreenHeader } from '../components/ScreenHeader';
import { HealthCards } from '../components/HealthCards';
import { HeroHeader } from '../components/HeroHeader';
import { SystemComponents } from '../components/SystemComponents';
import { QuickActions } from '../components/QuickActions';
import { RecentActivity } from '../components/RecentActivity';
import { usePaged, TablePager } from './mockups/shared';

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
      | 'bindOrgUnit' | 'listOrgUnits' | 'systemInfo'> } = {}): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [binding, setBinding] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [orgUnits, setOrgUnits] = useState<edgeApi.OrgUnitRow[]>([]);
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [selected, setSelected] = useState('');
  const [confirmRebind, setConfirmRebind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const [hr, cr, br, si] = await Promise.all([
        api.health(), api.compat(), api.getOrgUnitBinding(),
        api.systemInfo ? api.systemInfo().catch(() => null) : Promise.resolve(null),
      ]);
      setH(hr); setC(cr); setBinding(br); setSysInfo(si);
      setLastFetched(new Date());
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
    <div className="ea-screen ea-overview">
      <HeroHeader
        title="Setup overview"
        subtitle="Monitor the health, status and performance of your DER environment."
        version={h.version}
        centralVersion={c.centralVersion ?? undefined}
        lastFetched={lastFetched}
        actions={
          <button
            type="button"
            className="primary"
            onClick={() => { reload().catch(() => undefined); }}
          >
            Refresh
          </button>
        }
      />
      {!h.dhis2Integrated && <OfflineBanner testId="ea01-offline" />}
      <HealthCards info={sysInfo} />

      <div className="ea-overview-grid">
        <SystemComponents info={sysInfo} />
        <RecentActivity />
      </div>

      {!binding.bound && (
        <section className="ea-ou-picker" data-test="ea01-orgunit-picker">
          <h2>Bind this edge to an orgUnit</h2>
          <p>
            This edge isn't bound yet. Writes are rejected until an admin
            picks the orgUnit this device will capture against.
          </p>
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
                <button type="button" data-test="ea01-orgunit-bind" className="primary"
                  disabled={!selected || saving}
                  onClick={() => { doBind().catch(() => undefined); }}>
                  {saving ? 'Binding…' : 'Bind orgUnit'}
                </button>
              </>
            )}
        </section>
      )}
      {binding.bound && (
        <section className="ea-ou-rebind" data-test="ea01-orgunit-rebind">
          <h2>orgUnit binding</h2>
          <dl>
            <dt>Bound to</dt>
            <dd>{binding.orgUnitDisplayName} ({binding.orgUnitPath})</dd>
          </dl>
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

      <QuickActions />
    </div>
  );
}

// EA-02 Users list ----------------------------------------------------
function userInitials(nameOrUsername: string): string {
  const parts = nameOrUsername.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function roleTone(role: string): 'primary' | 'teal' | 'neutral' {
  const r = role.toUpperCase();
  if (r === 'ADMIN') return 'primary';
  if (r === 'OPERATOR') return 'teal';
  return 'neutral';
}

export function EAUsersList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listUsers'> } = {}): JSX.Element {
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let cancelled = false;
    api.listUsers()
      .then((r) => {
        if (!cancelled) {
          setUsers(r.users);
          setLastFetched(new Date());
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Users failed" testId="ea02-error">{error}</ErrorBlock>;
  if (users === null) return <LoadingBlock testId="ea02-loading" />;
  const total = users.length;
  const admins = users.filter((u) => u.roles.some((r) => r.toUpperCase() === 'ADMIN')).length;
  const operators = users.filter((u) => u.roles.some((r) => r.toUpperCase() === 'OPERATOR')).length;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) =>
        u.username.toLowerCase().includes(q)
        || u.displayName.toLowerCase().includes(q)
        || u.roles.some((r) => r.toLowerCase().includes(q)))
    : users;
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Users"
        subtitle="Operators and administrators provisioned on this edge."
        lastFetched={lastFetched}
        actions={
          <Link to="/provisioning/users/new" className="ea-btn ea-btn--primary" data-test="ea02-new">
            + Add user
          </Link>
        }
      />
      <h1 data-test="ea02-heading" className="ea-visually-hidden">Provisioned users</h1>

      <div className="ea-stat-strip" role="group" aria-label="User summary">
        <StatCard label="Total users" value={total} tone="info" />
        <StatCard label="Administrators" value={admins} tone="success" />
        <StatCard label="Operators" value={operators} tone="muted" />
      </div>

      {users.length === 0 ? (
        <EmptyBlock title="No users yet" testId="ea02-empty">
          Bootstrap an ADMIN account via the environment variable, then add
          operators here.
        </EmptyBlock>
      ) : (
        <section className="ea-card">
          <div className="ea-card-toolbar">
            <div className="ea-filter-search">
              <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, username or role"
                aria-label="Search users"
                data-test="ea02-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span className="ea-card-count">{filtered.length} of {total}</span>
          </div>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--users">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Username</th>
                  <th scope="col">Roles</th>
                  <th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <div className="ea-user-cell">
                        <span className="ea-user-cell-avatar" aria-hidden="true">
                          {userInitials(u.displayName || u.username)}
                        </span>
                        <span
                          className="ea-user-cell-name"
                          data-test={`ea02-user-${u.userId}`}
                        >
                          {u.displayName} ({u.username})
                        </span>
                      </div>
                    </td>
                    <td className="ea-mono">{u.username}</td>
                    <td data-test={`ea02-roles-${u.userId}`}>
                      <span className="ea-role-chips">
                        {u.roles.map((r) => (
                          <span key={r} className={`ea-chip ea-chip--${roleTone(r)}`}>{r}</span>
                        ))}
                      </span>
                    </td>
                    <td className="ea-table-actions">
                      <span className="ea-link-btn ea-link-btn--muted" aria-disabled="true" title="Edit — not yet available">
                        Edit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// EA-03 User create ---------------------------------------------------
interface UserCreateErrors {
  username?: string;
  displayName?: string;
  password?: string;
  confirm?: string;
}

function validateUserCreate(u: string, d: string, p: string, c: string): UserCreateErrors {
  const errs: UserCreateErrors = {};
  if (!u) errs.username = 'Username is required.';
  else if (!/^[a-z][a-z0-9_.-]{2,31}$/i.test(u))
    errs.username = 'Use 3–32 chars: letters, digits, dot, underscore, hyphen; must start with a letter.';
  if (!d) errs.displayName = 'Display name is required.';
  else if (d.length < 2) errs.displayName = 'At least 2 characters.';
  if (!p) errs.password = 'Password is required.';
  else if (p.length < 12) errs.password = 'At least 12 characters.';
  else if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p))
    errs.password = 'Mix upper, lower, and digit characters.';
  if (p && c && p !== c) errs.confirm = 'Passwords do not match.';
  return errs;
}

export function EAUserCreate({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'createUser'> } = {}): JSX.Element {
  const [u, setU] = useState(''); const [d, setD] = useState('');
  const [p, setP] = useState(''); const [c, setC] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const errs = validateUserCreate(u, d, p, c);
  const canSubmit = Object.keys(errs).length === 0 && p === c && status !== 'saving';

  async function doSave(): Promise<void> {
    setStatus('saving'); setError(null);
    try {
      await api.createUser({ username: u, displayName: d, password: p, roles: [role] });
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      if (/USER_EXISTS/i.test(msg)) setError('That username is already taken. Choose another.');
      else if (/USERNAME_INVALID/i.test(msg)) setError('That username is rejected by the server. Try something simpler.');
      else if (/PASSWORD_WEAK/i.test(msg)) setError('The server rejected the password as too weak.');
      else setError(msg);
    }
  }

  function fieldError(name: keyof UserCreateErrors): string | null {
    return touched[name] && errs[name] ? errs[name]! : null;
  }

  return (
    <div className="ea-screen">
      <HeroHeader
        title="Add user"
        subtitle="Provision an operator or administrator account on this edge."
        actions={
          <Link to="/provisioning/users" className="ea-btn ea-btn--ghost">← Back to users</Link>
        }
      />
      <div data-test="ea03-header" hidden />

      <section className="ea-card ea-form-card">
        <form
          className="ea-form"
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) void doSave(); }}
        >
          <div className="ea-form-section">
            <div className="ea-form-section-head">
              <h2>Account</h2>
              <p>Identity shown on captured records and audit entries.</p>
            </div>
            <div className="ea-form-grid">
              <label className="ea-field">
                <span className="ea-field-label">Username</span>
                <input
                  className="ea-input"
                  data-test="ea03-username"
                  value={u}
                  onChange={(e) => setU(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                  aria-invalid={!!fieldError('username')}
                  placeholder="e.g. nurse.alice"
                />
                <span className="ea-field-hint">3–32 chars. Letters, digits, dot, underscore, hyphen.</span>
                {fieldError('username') && (
                  <span className="ea-field-error" data-test="ea03-err-username">
                    {fieldError('username')}
                  </span>
                )}
              </label>
              <label className="ea-field">
                <span className="ea-field-label">Display name</span>
                <input
                  className="ea-input"
                  data-test="ea03-display"
                  value={d}
                  onChange={(e) => setD(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
                  aria-invalid={!!fieldError('displayName')}
                  placeholder="Full name as it should appear"
                />
                {fieldError('displayName') && (
                  <span className="ea-field-error" data-test="ea03-err-display">
                    {fieldError('displayName')}
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className="ea-form-section">
            <div className="ea-form-section-head">
              <h2>Credentials</h2>
              <p>Minimum 12 characters mixing upper, lower, and digits.</p>
            </div>
            <div className="ea-form-grid">
              <label className="ea-field">
                <span className="ea-field-label">Password</span>
                <input
                  className="ea-input"
                  data-test="ea03-password"
                  type="password"
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  aria-invalid={!!fieldError('password')}
                  autoComplete="new-password"
                />
                {fieldError('password') && (
                  <span className="ea-field-error" data-test="ea03-err-password">
                    {fieldError('password')}
                  </span>
                )}
              </label>
              <label className="ea-field">
                <span className="ea-field-label">Confirm password</span>
                <input
                  className="ea-input"
                  data-test="ea03-confirm"
                  type="password"
                  value={c}
                  onChange={(e) => setC(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                  aria-invalid={!!fieldError('confirm')}
                  autoComplete="new-password"
                />
                {fieldError('confirm') && (
                  <span className="ea-field-error" data-test="ea03-err-confirm">
                    {fieldError('confirm')}
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className="ea-form-section">
            <div className="ea-form-section-head">
              <h2>Access</h2>
              <p>What this user can do on the edge once signed in.</p>
            </div>
            <div className="ea-role-picker" role="radiogroup" aria-label="Role">
              <select
                className="ea-input ea-visually-hidden"
                data-test="ea03-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="OPERATOR">OPERATOR — captures data on the device</option>
                <option value="ADMIN">ADMIN — manages this edge</option>
              </select>
              <button
                type="button"
                className={'ea-role-card' + (role === 'OPERATOR' ? ' ea-role-card--active' : '')}
                onClick={() => setRole('OPERATOR')}
                aria-pressed={role === 'OPERATOR'}
              >
                <span className="ea-chip ea-chip--teal">OPERATOR</span>
                <span className="ea-role-card-desc">Captures aggregate / event / tracker data on this device.</span>
              </button>
              <button
                type="button"
                className={'ea-role-card' + (role === 'ADMIN' ? ' ea-role-card--active' : '')}
                onClick={() => setRole('ADMIN')}
                aria-pressed={role === 'ADMIN'}
              >
                <span className="ea-chip ea-chip--primary">ADMIN</span>
                <span className="ea-role-card-desc">Manages users, sync, apps and settings on this edge.</span>
              </button>
            </div>
          </div>

          <div className="ea-form-actions">
            <Link to="/provisioning/users" className="ea-btn ea-btn--ghost">Cancel</Link>
            <button
              type="submit"
              className="ea-btn ea-btn--primary"
              data-test="ea03-submit"
              disabled={!canSubmit}
            >
              {status === 'saving' ? 'Creating…' : 'Create user'}
            </button>
          </div>

          {status === 'saved' && (
            <p data-test="ea03-saved" className="ea-saved">
              User created. They can now sign in with the credentials you provided.
            </p>
          )}
          {status === 'error' && error && (
            <div className="ea-form-error">
              <ErrorBlock title="Create failed" testId="ea03-error">{error}</ErrorBlock>
            </div>
          )}
        </form>
      </section>
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
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  async function reload(): Promise<void> {
    try {
      const r = await api.compatHistory(50);
      setRows(r.snapshots);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  const paged = usePaged(rows ?? [], 50);
  if (error) return <ErrorBlock title="History failed" testId="ea05-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea05-loading" />;
  const selected = selectedIdx !== null ? rows[selectedIdx] ?? null : null;

  return (
    <div className="ea-screen">
      <ScreenHeader
        title="Compat history"
        subtitle={`${rows.length} snapshots. Click a row for details.`}
        lastFetched={lastFetched}
        onRefresh={reload}
        testId="ea05-header"
      />
      <section>
        {rows.length === 0
          ? <EmptyBlock title="No snapshots yet" testId="ea05-empty">
              Trigger a probe refresh to populate history.</EmptyBlock>
          : <>
              <table data-test="ea05-table">
                <thead><tr>
                  <th>Profile</th><th>Version</th><th>Probe (ms)</th>
                  <th>Captured</th><th>Reachable</th>
                </tr></thead>
                <tbody>{paged.rows.map((r, i) => (
                  <tr key={i}
                      onClick={() => setSelectedIdx((paged.page - 1) * paged.pageSize + i)}
                      className={selectedIdx === (paged.page - 1) * paged.pageSize + i ? 'ea-row-selected' : ''}
                      style={{ cursor: 'pointer' }}
                      data-test={`ea05-row-${i}`}>
                    <td data-test={`ea05-row-profile-${i}`}>{r.profileName}</td>
                    <td>{r.centralVersion}</td>
                    <td>{r.probeDurationMs ?? '—'}</td>
                    <td>{r.capturedAt ?? '—'}</td>
                    <td>
                      <span className={`ea-chip ea-chip--${r.probeReachable ? 'success' : 'danger'}`}>
                        {r.probeReachable ? 'yes' : 'no'}
                      </span>
                    </td>
                  </tr>
                ))}</tbody></table>
              <TablePager {...paged.pagerProps} />
            </>}
      </section>

      {selected && (
        <div className="ea-drawer" role="dialog" aria-label="Snapshot detail" data-test="ea05-drawer">
          <div className="ea-drawer-head">
            <h2>Snapshot detail</h2>
            <button type="button"
                    onClick={() => setSelectedIdx(null)}
                    data-test="ea05-drawer-close">Close</button>
          </div>
          <dl>
            <dt>Profile</dt><dd>{selected.profileName}</dd>
            <dt>Central version</dt><dd>{selected.centralVersion ?? '—'}</dd>
            <dt>Probe duration</dt><dd>{selected.probeDurationMs ?? '—'} ms</dd>
            <dt>Captured at</dt><dd>{selected.capturedAt ?? '—'}</dd>
            <dt>Reachable</dt>
            <dd>
              <span className={`ea-chip ea-chip--${selected.probeReachable ? 'success' : 'danger'}`}>
                {selected.probeReachable ? 'yes' : 'no'}
              </span>
            </dd>
            {selected.snapshotId !== undefined && (
              <><dt>Snapshot id</dt><dd>{selected.snapshotId}</dd></>
            )}
            {selected.engineVersion && (
              <><dt>Engine version</dt><dd>{selected.engineVersion}</dd></>
            )}
            <dt>Status</dt><dd>{selected.status ?? '—'}</dd>
          </dl>
          {selected.capabilities && (
            <>
              <h3>Capabilities</h3>
              <pre data-test="ea05-drawer-capabilities">
                {JSON.stringify(selected.capabilities, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// EA-06 Jobs list ---------------------------------------------------
export function EAJobsList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listJobs'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.JobRun[] | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'jobName' | 'startedAt' | 'outcome' | 'duration'>('startedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterJob, setFilterJob] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  async function reload(): Promise<void> {
    try {
      const r = await api.listJobs(500);
      setRows(r);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  const toggleSort = (col: typeof sortCol): void => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  if (error) return <ErrorBlock title="Jobs failed" testId="ea06-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea06-loading" />;

  // Outcome counts for status strip
  const total = rows.length;
  const nSuccess = rows.filter((r) => r.outcome === 'SUCCESS').length;
  const nFailed = rows.filter((r) => r.outcome === 'FAILED' || r.outcome === 'ERROR').length;
  const nOther = total - nSuccess - nFailed;

  const outcomes = Array.from(new Set(rows.map((r) => r.outcome)));
  const filtered = rows.filter((r) => {
    if (filterJob && !r.jobName.toLowerCase().includes(filterJob.toLowerCase())) return false;
    if (filterOutcome !== 'ALL' && r.outcome !== filterOutcome) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortCol === 'jobName') return dir * a.jobName.localeCompare(b.jobName);
    if (sortCol === 'startedAt') return dir * a.startedAt.localeCompare(b.startedAt);
    if (sortCol === 'outcome') return dir * a.outcome.localeCompare(b.outcome);
    return dir * ((a.durationMs ?? 0) - (b.durationMs ?? 0));
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = selectedId !== null ? rows.find((r) => r.runId === selectedId) ?? null : null;

  function arrow(col: typeof sortCol): string {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }
  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDuration(ms?: number): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  }
  function outcomeChipCls(o: string): string {
    if (o === 'SUCCESS') return 'ea-chip ea-chip--success';
    if (o === 'FAILED' || o === 'ERROR') return 'ea-chip ea-chip--danger';
    if (o === 'RUNNING') return 'ea-chip ea-chip--info';
    return 'ea-chip ea-chip--warning';
  }

  return (
    <div className="ea-screen">
      <HeroHeader
        title="Synchronisation jobs"
        subtitle="Scheduled Quartz runs across metadata, journal drain, backup, analytics and referral polling."
        lastFetched={lastFetched}
        actions={
          <>
            <button type="button" onClick={() => { reload().catch(() => undefined); }} data-test="ea06-refresh">
              Refresh
            </button>
            <Link to="/sync/jobs/trigger" className="ea-link-btn" data-test="ea06-trigger-link">
              Trigger a job
            </Link>
          </>
        }
      />

      <div className="ea-stat-strip" data-test="ea06-strip">
        <StatCard label="Total runs" value={total} tone="info" />
        <StatCard label="Succeeded" value={nSuccess} tone="success" />
        <StatCard label="Failed" value={nFailed} tone="danger" />
        <StatCard label="Other" value={nOther} tone="muted" />
      </div>

      <section>
        <div className="ea-filter-chips" data-test="ea06-chips">
          <span className="ea-filter-chips-label">Outcome</span>
          {['ALL', ...outcomes].map((o) => (
            <button
              key={o}
              type="button"
              className={`ea-filter-chip${filterOutcome === o ? ' ea-filter-chip--active' : ''}`}
              onClick={() => { setFilterOutcome(o); setPage(1); }}
              data-test={`ea06-chip-${o}`}
            >
              {o}
            </button>
          ))}
          <label className="ea-filter-chips-search">
            <span className="sr-only">Search job name</span>
            <input
              type="search"
              value={filterJob}
              onChange={(e) => { setFilterJob(e.target.value); setPage(1); }}
              placeholder="Search job name…"
              data-test="ea06-filter-job"
            />
          </label>
        </div>

        {pageRows.length === 0
          ? <EmptyBlock title="No runs match" testId="ea06-empty">Change the filter or clear it.</EmptyBlock>
          : <>
              <div className="ea-table-wrap">
                <table data-test="ea06-table">
                  <thead><tr>
                    <th><button type="button" onClick={() => toggleSort('jobName')} data-test="ea06-sort-job">Job{arrow('jobName')}</button></th>
                    <th><button type="button" onClick={() => toggleSort('startedAt')} data-test="ea06-sort-started">Started{arrow('startedAt')}</button></th>
                    <th><button type="button" onClick={() => toggleSort('outcome')} data-test="ea06-sort-outcome">Outcome{arrow('outcome')}</button></th>
                    <th><button type="button" onClick={() => toggleSort('duration')} data-test="ea06-sort-duration">Duration{arrow('duration')}</button></th>
                    <th></th>
                  </tr></thead>
                  <tbody>{pageRows.map((r) => (
                    <tr
                      key={r.runId}
                      className={selectedId === r.runId ? 'ea-row-selected' : ''}
                      onClick={() => setSelectedId(r.runId)}
                      style={{ cursor: 'pointer' }}
                      data-test={`ea06-row-${r.runId}`}
                    >
                      <td data-test={`ea06-row-job-${r.runId}`}>
                        <div className="ea-cell-two">
                          <div className="ea-cell-primary">{r.jobName}</div>
                          <div className="ea-cell-secondary">run {r.runId}</div>
                        </div>
                      </td>
                      <td>{fmtDate(r.startedAt)}</td>
                      <td><span className={outcomeChipCls(r.outcome)}>{r.outcome}</span></td>
                      <td>{fmtDuration(r.durationMs ?? undefined)}</td>
                      <td className="ea-cell-right">
                        <span className="ea-row-arrow" aria-hidden="true">›</span>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="ea-pagination" data-test="ea06-pagination">
                <span className="ea-pagination-info">
                  {sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                  –{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
                </span>
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} data-test="ea06-prev">Prev</button>
                <span>Page {safePage} of {totalPages}</span>
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} data-test="ea06-next">Next</button>
              </div>
            </>}
      </section>

      {selected && (
        <div className="ea-drawer" role="dialog" aria-label="Job run detail" data-test="ea06-drawer">
          <div className="ea-drawer-head">
            <h2>Job run detail</h2>
            <button type="button"
                    onClick={() => setSelectedId(null)}
                    data-test="ea06-drawer-close">Close</button>
          </div>
          <dl>
            <dt>Job</dt><dd>{selected.jobName}</dd>
            <dt>Run id</dt><dd>{selected.runId}</dd>
            <dt>Started</dt><dd>{selected.startedAt}</dd>
            <dt>Finished</dt><dd>{selected.finishedAt ?? '—'}</dd>
            <dt>Outcome</dt><dd><span className={outcomeChipCls(selected.outcome)}>{selected.outcome}</span></dd>
            <dt>Duration</dt><dd>{fmtDuration(selected.durationMs ?? undefined)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function StatCard(
  { label, value, tone }: { label: string; value: number; tone: 'info' | 'success' | 'danger' | 'muted' },
): JSX.Element {
  return (
    <div className={`ea-stat ea-stat--${tone}`} data-test={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="ea-stat-value">{value.toLocaleString()}</div>
      <div className="ea-stat-label">{label}</div>
    </div>
  );
}

// EA-07 Job trigger -------------------------------------------------
const JOB_CATALOG: readonly { name: string; label: string; desc: string }[] = [
  { name: 'METADATA_SYNC_FULL', label: 'Metadata sync (full)',
    desc: 'Fetch the full metadata snapshot (OUs, dataElements, programs, …) from DHIS2 central and overwrite the local mirror.' },
  { name: 'COMPAT_PROBE_REFRESH', label: 'Compatibility probe refresh',
    desc: 'Re-run the DHIS2 compatibility probe against the configured central and persist a new snapshot.' },
  { name: 'DRIFT_SNAPSHOT', label: 'Drift snapshot',
    desc: 'Compute a fingerprint of the current mirror vs the last snapshot to detect metadata drift.' },
  { name: 'JOURNAL_WORKER_DRAIN', label: 'Journal worker drain',
    desc: 'Drain the pending journal — attempt to deliver outgoing data value sets, events and trackers to central.' },
];

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
  const current = JOB_CATALOG.find((j) => j.name === name) ?? JOB_CATALOG[0];
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Trigger a job"
        subtitle="Fire a scheduled sync job now instead of waiting for its cron window."
      />
      <section className="ea-trigger-card" data-test="ea07-card">
        <div className="ea-trigger-pick">
          <label htmlFor="ea07-name"><span>Job</span></label>
          <select
            id="ea07-name"
            data-test="ea07-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setStatus('idle'); setError(null); }}
          >
            {JOB_CATALOG.map((j) => (
              <option key={j.name} value={j.name}>{j.label}</option>
            ))}
          </select>
          <div className="ea-trigger-code"><code>{current.name}</code></div>
          <p className="ea-trigger-desc">{current.desc}</p>
        </div>
        <div className="ea-trigger-cta">
          <button
            type="submit"
            data-test="ea07-fire"
            disabled={status === 'triggering'}
            onClick={() => { doTrigger().catch(() => undefined); }}
          >
            {status === 'triggering' ? 'Firing…' : 'Fire now'}
          </button>
          {status === 'ok' && (
            <p className="ea-saved" data-test="ea07-ok">Triggered. Check Jobs for the run outcome.</p>
          )}
        </div>
      </section>
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
    return (
      <div className="ea-screen">
        <HeroHeader title="Metadata drift" subtitle="No snapshot yet." />
        <EmptyBlock title="No drift snapshot" testId="ea08-empty">
          Trigger a metadata sync first.
        </EmptyBlock>
      </div>
    );
  }
  const same = data.fingerprintFrom === data.fingerprintTo;
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Metadata drift"
        subtitle="Fingerprint comparison between the latest two metadata snapshots."
        actions={
          <button type="button" data-test="ea08-refresh" disabled={refreshing}
                  onClick={() => { setRefreshing(true);
                    load(true).finally(() => setRefreshing(false)); }}>
            {refreshing ? 'Running…' : 'Re-run drift'}
          </button>
        }
      />
      <div className="ea-drift" data-test="ea08-pair">
        <div className="ea-drift-col">
          <div className="ea-drift-label">From snapshot</div>
          <div className="ea-drift-value">{data.snapshotFrom}</div>
          <code className="ea-drift-fp">{data.fingerprintFrom?.slice(0, 24) ?? '—'}</code>
        </div>
        <div className={`ea-drift-sep ea-drift-sep--${same ? 'ok' : 'warn'}`}>
          <div className="ea-drift-sep-icon" aria-hidden="true">
            {same
              ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12l5 5L20 7"/></svg>
              : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 7h4m8 10h4M8 7l8 10M16 7l-8 10"/></svg>
            }
          </div>
          <div className="ea-drift-sep-label" data-test="ea08-same">
            Fingerprint {same ? 'equal' : 'different'}
          </div>
        </div>
        <div className="ea-drift-col">
          <div className="ea-drift-label">To snapshot</div>
          <div className="ea-drift-value">{data.snapshotTo}</div>
          <code className="ea-drift-fp">{data.fingerprintTo?.slice(0, 24) ?? '—'}</code>
        </div>
      </div>
    </div>
  );
}

// EA-10..13 Conflict review ---------------------------------------
export function EAConflictList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listConflicts'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.ConflictRow[] | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function reload(): Promise<void> {
    try {
      const r = await api.listConflicts();
      setRows(r); setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);
  if (error) return <ErrorBlock title="Conflicts failed" testId="ea10-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea10-loading" />;
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Conflicts to review"
        subtitle="Journal entries that need an authorised reviewer before they can drain to central."
        lastFetched={lastFetched}
        actions={
          <button type="button" onClick={() => { reload().catch(() => undefined); }} data-test="ea10-refresh">
            Refresh
          </button>
        }
      />
      <section>
        {rows.length === 0
          ? <EmptyBlock title="No conflicts" testId="ea10-empty">
              Nothing in CONFLICT_REVIEW state right now.
            </EmptyBlock>
          : (
            <div className="ea-table-wrap">
              <table data-test="ea10-table">
                <thead><tr>
                  <th>Entity</th>
                  <th>Reference</th>
                  <th>Operation id</th>
                  <th></th>
                </tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.operationId} data-test={`ea10-row-${r.operationId}`}>
                    <td>
                      <span className="ea-chip ea-chip--warning">{r.entityType}</span>
                    </td>
                    <td className="ea-mono">{r.entityRef}</td>
                    <td className="ea-mono ea-ink-muted">{r.operationId.slice(0, 8)}…</td>
                    <td className="ea-cell-right">
                      <Link to={`/conflicts/${r.operationId}`} className="ea-link-btn">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </section>
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
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load(): Promise<void> {
    try {
      setH(await api.workerHealth());
      setLastFetched(new Date());
    } catch (err) {
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
  const toneFor = (state: string): 'info' | 'success' | 'danger' | 'muted' => {
    if (state === 'CENTRAL_ACCEPTED') return 'success';
    if (state === 'CENTRAL_REJECTED' || state === 'CONFLICT_REVIEW') return 'danger';
    if (state === 'PENDING' || state === 'IN_FLIGHT' || state === 'RETRYABLE') return 'info';
    return 'muted';
  };
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Journal worker"
        subtitle="Pulls pending operations out of the journal and attempts to deliver them to DHIS2 central."
        lastFetched={lastFetched}
        actions={
          <>
            <button type="button" onClick={() => { load().catch(() => undefined); }} data-test="ea14-refresh">
              Refresh
            </button>
            <button type="button" className="primary" data-test="ea14-toggle"
                    onClick={() => { toggle().catch(() => undefined); }}>
              {h.enabled ? 'Pause worker' : 'Resume worker'}
            </button>
          </>
        }
      />
      <section className="ea-worker-status" data-test="ea14-status">
        <div className="ea-worker-status-row">
          <div>
            <div className="ea-worker-status-label">Status</div>
            <div className="ea-worker-status-value">
              <span
                className={`ea-chip ea-chip--${h.enabled ? 'success' : 'warning'}`}
                data-test="ea14-enabled"
              >
                {h.enabled ? 'RUNNING' : 'PAUSED'}
              </span>
            </div>
          </div>
          <div>
            <div className="ea-worker-status-label">Last tick</div>
            <div className="ea-worker-status-value" data-test="ea14-tick">{h.lastTick ?? '—'}</div>
          </div>
          <div>
            <div className="ea-worker-status-label">Last batch size</div>
            <div className="ea-worker-status-value" data-test="ea14-batch">{h.lastBatchSize}</div>
          </div>
        </div>
      </section>
      <div className="ea-stat-strip ea-stat-strip--wrap" data-test="ea14-backlog">
        {Object.entries(h.backlog).map(([state, n]) => (
          <div
            key={state}
            className={`ea-stat ea-stat--${toneFor(state)}`}
            data-test={`ea14-backlog-${state}`}
          >
            <div className="ea-stat-value">{n}</div>
            <div className="ea-stat-label">{state.replace(/_/g, ' ')}</div>
          </div>
        ))}
      </div>
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

// EA-APR-01 Approval queue (ADR-0016) -------------------------------
export function EAApprovalQueue({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listPendingApprovals' | 'approveOperation'
      | 'rejectOperation'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.PendingApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyOp, setBusyOp] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  async function reload(): Promise<void> {
    try {
      const resp = await api.listPendingApprovals();
      setRows(resp.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function doApprove(opId: string): Promise<void> {
    setBusyOp(opId);
    try {
      await api.approveOperation(opId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOp(null);
    }
  }

  async function doReject(opId: string): Promise<void> {
    setBusyOp(opId);
    try {
      await api.rejectOperation(opId, rejectReason[opId] ?? '');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOp(null);
    }
  }

  if (error) return <ErrorBlock title="Approval queue error" testId="apr-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="apr-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="apr-heading">Pending approvals</h1>
      {rows.length === 0 ? (
        <EmptyBlock title="No pending approvals" testId="apr-empty">
          Nothing is waiting for a reviewer. Writes that do not need approval
          drain straight through.
        </EmptyBlock>
      ) : (
        <table className="ea-approvals">
          <thead>
            <tr>
              <th>Operation</th><th>Type</th><th>Entity</th>
              <th>Submitted at</th><th>Reason (reject)</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.operationId} data-test={`apr-row-${r.operationId}`}>
                <td><code data-test={`apr-op-${r.operationId}`}>{r.operationId.slice(0, 8)}</code></td>
                <td>{r.entityType}</td>
                <td>{r.entityRef}</td>
                <td>{r.createdAt}</td>
                <td>
                  <input
                    type="text"
                    data-test={`apr-reason-${r.operationId}`}
                    value={rejectReason[r.operationId] ?? ''}
                    onChange={(e) => {
                      setRejectReason({ ...rejectReason, [r.operationId]: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    data-test={`apr-approve-${r.operationId}`}
                    disabled={busyOp === r.operationId}
                    onClick={() => { doApprove(r.operationId).catch(() => undefined); }}>
                    Approve
                  </button>
                  <button
                    type="button"
                    data-test={`apr-reject-${r.operationId}`}
                    disabled={busyOp === r.operationId}
                    onClick={() => { doReject(r.operationId).catch(() => undefined); }}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// EA-CWF-01 Capture-workflow catalogue (ADR-0018 slice A) ----------
export function EACaptureWorkflowList({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listWorkflows' | 'deleteWorkflow'> } = {}): JSX.Element {
  const [workflows, setWorkflows] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const resp = await api.listWorkflows();
      setWorkflows(resp.workflows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function remove(id: string): Promise<void> {
    try {
      await api.deleteWorkflow(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) return <ErrorBlock title="Workflow catalogue error" testId="cwf01-error">{error}</ErrorBlock>;
  if (workflows === null) return <LoadingBlock testId="cwf01-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="cwf01-heading">Capture workflows</h1>
      <p>
        Compose multi-step capture flows over your DHIS2 datasets.
        Slice A supports dataSet bindings only; event / tracker bindings
        land in <code>der-1.3.0</code>.
      </p>
      <Link to="/workflows/new" data-test="cwf01-new">New workflow</Link>
      {workflows.length === 0 ? (
        <EmptyBlock title="No workflows yet" testId="cwf01-empty">
          Click <strong>New workflow</strong> to configure the first one.
        </EmptyBlock>
      ) : (
        <table className="ea-workflows">
          <thead>
            <tr>
              <th>Name</th><th>Binding</th><th>Version</th>
              <th>Enabled</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((w) => (
              <tr key={w.workflowId} data-test={`cwf01-row-${w.workflowId}`}>
                <td>
                  <Link to={`/workflows/${w.workflowId}`}
                    data-test={`cwf01-open-${w.workflowId}`}>
                    {w.displayName}
                  </Link>
                </td>
                <td>{w.boundMetadataKind}:{w.boundMetadataId}</td>
                <td>v{w.version}</td>
                <td data-test={`cwf01-enabled-${w.workflowId}`}>
                  {w.enabled ? 'yes' : 'no'}
                </td>
                <td>
                  <button
                    type="button"
                    data-test={`cwf01-delete-${w.workflowId}`}
                    onClick={() => { remove(w.workflowId).catch(() => undefined); }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// EA-CWF-02 Designer -----------------------------------------------
export function EACaptureWorkflowDesigner({ api = edgeApi, workflowId }:
    { api?: Pick<typeof edgeApi, 'getWorkflow' | 'saveWorkflow' | 'listDevices'
      | 'exportWorkflow' | 'importWorkflow'>;
      workflowId?: string } = {}): JSX.Element {
  const [existing, setExisting] = useState<edgeApi.CaptureWorkflowSummary | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [boundMetadataKind, setBoundMetadataKind] =
    useState<edgeApi.CanonicalWorkflow['boundMetadataKind']>('DATA_SET');
  const [boundMetadataId, setBoundMetadataId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [stepsJson, setStepsJson] = useState('[]');
  const [depsJson, setDepsJson] = useState('[]');
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [importText, setImportText] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[] | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (workflowId && workflowId !== 'new') {
        const w = await api.getWorkflow(workflowId);
        setExisting(w);
        setDisplayName(w.displayName);
        setBoundMetadataKind(w.boundMetadataKind);
        setBoundMetadataId(w.boundMetadataId);
        setEnabled(w.enabled);
        setStepsJson(JSON.stringify(w.steps, null, 2));
        setDepsJson(JSON.stringify(w.dependencies, null, 2));
      }
      if (api.listDevices) {
        const d = await api.listDevices();
        setDevices(d.devices ?? []);
      }
    })().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [api, workflowId]);

  async function doSave(): Promise<void> {
    setStatus('saving');
    setError(null);
    try {
      const steps = JSON.parse(stepsJson) as edgeApi.CaptureWorkflowStep[];
      const dependencies = JSON.parse(depsJson) as edgeApi.CaptureWorkflowDependency[];
      await api.saveWorkflow({
        workflowId: existing?.workflowId,
        displayName, boundMetadataKind, boundMetadataId, enabled, steps, dependencies,
      });
      setStatus('saved');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function doExport(): Promise<void> {
    if (!existing || !api.exportWorkflow) return;
    try {
      const canonical = await api.exportWorkflow(existing.workflowId);
      setExportJson(JSON.stringify(canonical, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function doImport(dryRun: boolean): Promise<void> {
    if (!api.importWorkflow) return;
    setError(null);
    try {
      const body = JSON.parse(importText) as edgeApi.CanonicalWorkflow;
      const resp = await api.importWorkflow(body, dryRun);
      setImportWarnings(resp.warnings);
      if (!dryRun) {
        setStatus('saved');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="ea-screen">
      <h1 data-test="cwf02-heading">
        {existing ? `Edit workflow: ${existing.displayName}` : 'New workflow'}
      </h1>
      {error && <ErrorBlock title="Save failed" testId="cwf02-error">{error}</ErrorBlock>}
      {status === 'saved' && (
        <p className="ea-ok" data-test="cwf02-saved">Saved.</p>
      )}
      <label>
        <span>Display name</span>
        <input type="text" data-test="cwf02-name" value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); }} />
      </label>
      <label>
        <span>Binding kind</span>
        <select data-test="cwf02-binding-kind" value={boundMetadataKind}
          onChange={(e) => { setBoundMetadataKind(
            e.target.value as edgeApi.CanonicalWorkflow['boundMetadataKind']); }}>
          <option value="DATA_SET">Dataset</option>
          <option value="PROGRAM">Program (event-only)</option>
          <option value="PROGRAM_STAGE">Program stage (tracker)</option>
        </select>
      </label>
      <label>
        <span>Bound metadata UID</span>
        <input type="text" data-test="cwf02-binding" value={boundMetadataId}
          onChange={(e) => { setBoundMetadataId(e.target.value); }} />
      </label>
      <label>
        <input type="checkbox" data-test="cwf02-enabled" checked={enabled}
          onChange={(e) => { setEnabled(e.target.checked); }} />
        Enabled
      </label>
      {devices.length > 0 && (
        <details className="ea-cwf-device-ref" data-test="cwf02-devices">
          <summary>Enrolled devices ({devices.length}) — paste UUID into
            a step's <code>ownerDeviceId</code> to bind it (ADR-0022)</summary>
          <ul>
            {devices.map((d) => (
              <li key={d.deviceId} data-test={`cwf02-device-${d.deviceId}`}>
                <code>{d.deviceId}</code>{' '}
                <small>{d.userAgent ?? d.deviceId.slice(0, 8)}</small>{' '}
                <span>({d.status})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <label>
        <span>Steps (JSON array; slice A ships a simple editor)</span>
        <textarea data-test="cwf02-steps" rows={10} value={stepsJson}
          onChange={(e) => { setStepsJson(e.target.value); }} />
      </label>
      <label>
        <span>Dependencies (JSON array)</span>
        <textarea data-test="cwf02-deps" rows={6} value={depsJson}
          onChange={(e) => { setDepsJson(e.target.value); }} />
      </label>
      <button type="button" data-test="cwf02-save"
        disabled={status === 'saving' || !displayName || !boundMetadataId}
        onClick={() => { doSave().catch(() => undefined); }}>
        {status === 'saving' ? 'Saving…' : 'Save workflow'}
      </button>
      {existing && (
        <section className="ea-cwf-export" data-test="cwf02-export-section">
          <h2>Export (ADR-0024)</h2>
          <button type="button" data-test="cwf02-export"
            onClick={() => { doExport().catch(() => undefined); }}>
            Export as canonical JSON
          </button>
          {exportJson && (
            <textarea readOnly data-test="cwf02-export-output" rows={10}
              value={exportJson} />
          )}
        </section>
      )}
      <section className="ea-cwf-import" data-test="cwf02-import-section">
        <h2>Import</h2>
        <textarea data-test="cwf02-import-input" rows={6} value={importText}
          placeholder='{"schemaVersion":1,…}'
          onChange={(e) => { setImportText(e.target.value); }} />
        <button type="button" data-test="cwf02-import-dry"
          disabled={!importText}
          onClick={() => { doImport(true).catch(() => undefined); }}>
          Validate (dry-run)
        </button>
        <button type="button" data-test="cwf02-import-apply"
          disabled={!importText}
          onClick={() => { doImport(false).catch(() => undefined); }}>
          Apply import
        </button>
        {importWarnings && (
          <ul data-test="cwf02-import-warnings">
            {importWarnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

// EA-DVC-01 Device fleet (ADR-0019) -------------------------------
export function EADeviceFleet({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listDevices' | 'approveDevice'
      | 'suspendDevice' | 'revokeDevice' | 'deleteDevice'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const resp = await api.listDevices();
      setRows(resp.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function act(id: string,
                      fn: (id: string) => Promise<unknown>): Promise<void> {
    setBusy(id);
    try {
      await fn(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorBlock title="Device fleet error" testId="dvc01-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="dvc01-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="dvc01-heading">Device fleet</h1>
      {rows.length === 0 ? (
        <EmptyBlock title="No devices enrolled" testId="dvc01-empty">
          Devices appear here when their client calls <code>POST /devices/enroll</code>.
        </EmptyBlock>
      ) : (
        <table className="ea-devices">
          <thead>
            <tr>
              <th>Device</th><th>Status</th><th>Last seen</th>
              <th>User agent</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.deviceId} data-test={`dvc01-row-${d.deviceId}`}>
                <td><code>{d.deviceId.slice(0, 8)}</code></td>
                <td data-test={`dvc01-status-${d.deviceId}`}>{d.status}</td>
                <td>{d.lastSeenAt ?? '—'}</td>
                <td title={d.userAgent ?? ''}>
                  {(d.userAgent ?? '').slice(0, 40)}
                </td>
                <td>
                  {d.status !== 'APPROVED' && d.status !== 'REVOKED' && (
                    <button type="button" data-test={`dvc01-approve-${d.deviceId}`}
                      disabled={busy === d.deviceId}
                      onClick={() => { act(d.deviceId, api.approveDevice).catch(() => undefined); }}>
                      Approve
                    </button>
                  )}
                  {d.status === 'APPROVED' && (
                    <button type="button" data-test={`dvc01-suspend-${d.deviceId}`}
                      disabled={busy === d.deviceId}
                      onClick={() => { act(d.deviceId, api.suspendDevice).catch(() => undefined); }}>
                      Suspend
                    </button>
                  )}
                  {d.status !== 'REVOKED' && (
                    <button type="button" data-test={`dvc01-revoke-${d.deviceId}`}
                      disabled={busy === d.deviceId}
                      onClick={() => { act(d.deviceId, api.revokeDevice).catch(() => undefined); }}>
                      Revoke
                    </button>
                  )}
                  {d.status === 'REVOKED' && (
                    <button type="button" data-test={`dvc01-delete-${d.deviceId}`}
                      disabled={busy === d.deviceId}
                      onClick={() => { act(d.deviceId, api.deleteDevice).catch(() => undefined); }}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// EA-ANA-01 Facility analytics (ADR-0020) -------------------------
export function EAFacilityAnalytics({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'analyticsSummary' | 'analyticsRejections'
      | 'analyticsRefresh'> } = {}): JSX.Element {
  const [resp, setResp] = useState<edgeApi.FacilitySummaryResponse | null>(null);
  const [rejections, setRejections] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function reload(): Promise<void> {
    try {
      const [s, r] = await Promise.all([
        api.analyticsSummary(),
        api.analyticsRejections(),
      ]);
      setResp(s);
      setRejections(r.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function doRefresh(): Promise<void> {
    setRefreshing(true);
    setError(null);
    try {
      await api.analyticsRefresh();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  if (error) return <ErrorBlock title="Analytics error" testId="ana01-error">{error}</ErrorBlock>;
  if (resp === null) return <LoadingBlock testId="ana01-loading" />;

  const aggregate = resp.rows.filter((r) => r.kind === 'AGGREGATE');
  const events = resp.rows.filter((r) => r.kind === 'EVENT');
  const aggregateTotal = aggregate.reduce((n, r) => n + r.n, 0);
  const eventTotal = events.reduce((n, r) => n + r.n, 0);

  return (
    <div className="ea-screen">
      <h1 data-test="ana01-heading">Facility analytics</h1>
      <p className="ea-ana-refreshed">
        Last refreshed:{' '}
        <span data-test="ana01-last-refreshed">
          {resp.lastRefreshedAt ?? 'never'}
        </span>{' '}
        <button type="button" data-test="ana01-refresh"
          disabled={refreshing}
          onClick={() => { doRefresh().catch(() => undefined); }}>
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </p>
      <section className="ea-ana-cards">
        <div className="ea-ana-card" data-test="ana01-card-aggregate">
          <strong>Aggregate submissions</strong>
          <div className="ea-ana-count"
            data-test="ana01-count-aggregate">{aggregateTotal}</div>
          <small>{aggregate.length} period/OU buckets</small>
        </div>
        <div className="ea-ana-card" data-test="ana01-card-event">
          <strong>Events captured</strong>
          <div className="ea-ana-count"
            data-test="ana01-count-event">{eventTotal}</div>
          <small>{events.length} day/OU buckets</small>
        </div>
        <div className="ea-ana-card" data-test="ana01-card-rejections">
          <strong>Recent rejections</strong>
          <div className="ea-ana-count"
            data-test="ana01-count-rejections">
            {rejections ?? '—'}
          </div>
          <small>last 500 security_audit rows</small>
        </div>
      </section>
      {resp.rows.length === 0 ? (
        <EmptyBlock title="No analytics data yet" testId="ana01-empty">
          Capture some aggregate values or events, then refresh.
        </EmptyBlock>
      ) : (
        <table className="ea-ana-table">
          <thead>
            <tr>
              <th>OrgUnit</th><th>Period</th><th>Kind</th><th>n</th>
            </tr>
          </thead>
          <tbody>
            {resp.rows.map((r) => (
              <tr key={`${r.orgUnitId}:${r.period}:${r.kind}`}
                data-test={`ana01-row-${r.orgUnitId}-${r.period}-${r.kind}`}>
                <td><code>{r.orgUnitId}</code></td>
                <td>{r.period}</td>
                <td>{r.kind}</td>
                <td>{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// EA-AUD-01 Hash-chain verifier (ADR-0021) ------------------------
export function EAAuditVerify({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'verifyAuditChain'> } = {}): JSX.Element {
  const [resp, setResp] = useState<edgeApi.AuditChainVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setResp(await api.verifyAuditChain());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ea-screen">
      <h1 data-test="aud01-heading">Verify audit chain</h1>
      <p>Walks every row of <code>security_audit</code> and reports the
        first hash-chain break (if any). ADMIN only.</p>
      <button type="button" data-test="aud01-run"
        disabled={busy}
        onClick={() => { run().catch(() => undefined); }}>
        {busy ? 'Verifying…' : 'Run verification'}
      </button>
      {error && (
        <ErrorBlock title="Verify failed" testId="aud01-error">{error}</ErrorBlock>
      )}
      {resp && (
        <section className="ea-aud-result" data-test="aud01-result">
          <dl>
            <dt>Result</dt>
            <dd data-test="aud01-status">
              {resp.ok ? 'OK — chain intact' : 'BROKEN'}
            </dd>
            <dt>Rows checked</dt>
            <dd data-test="aud01-total">{resp.totalRows}</dd>
            {!resp.ok && (
              <>
                <dt>First broken audit_id</dt>
                <dd data-test="aud01-break-id">{resp.firstBreakAuditId}</dd>
                <dt>Reason</dt>
                <dd data-test="aud01-break-reason">{resp.firstBreakReason}</dd>
              </>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}

// EA-REF-01 Referral inbox (ADR-0027) ------------------------------
export function EAReferralInbox({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listReferralInbox'
      | 'acceptReferralInbox' | 'dismissReferralInbox'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.ReferralInboxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const resp = await api.listReferralInbox();
      setRows(resp.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function resolve(inboxId: string, action: 'accept' | 'dismiss'): Promise<void> {
    if (!api.acceptReferralInbox || !api.dismissReferralInbox) return;
    setBusy(inboxId);
    setError(null);
    try {
      if (action === 'accept') await api.acceptReferralInbox(inboxId);
      else await api.dismissReferralInbox(inboxId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorBlock title="Inbox error" testId="ref01-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ref01-loading" />;

  return (
    <div className="ea-screen">
      <h1 data-test="ref01-heading">Referral inbox</h1>
      <p>Pending referrals discovered on central addressed to this
        edge's bound organisation unit (ADR-0027).</p>
      {rows.length === 0 ? (
        <EmptyBlock title="No pending referrals" testId="ref01-empty">
          The next inbox scan runs on <code>der.referral.inbox.cron</code>
          (default every 10 minutes). Enable the HTTP scan with
          <code> der.referral.http.enabled=true</code>.
        </EmptyBlock>
      ) : (
        <table className="ea-ref-table">
          <thead>
            <tr>
              <th>Kind</th><th>Source ref</th><th>Discovered</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.inboxId} data-test={`ref01-row-${r.inboxId}`}>
                <td>{r.kind}</td>
                <td><code>{r.sourceRef}</code></td>
                <td>{r.discoveredAt}</td>
                <td>
                  <button type="button"
                    data-test={`ref01-accept-${r.inboxId}`}
                    disabled={busy === r.inboxId}
                    onClick={() => { resolve(r.inboxId, 'accept').catch(() => undefined); }}>
                    Accept
                  </button>
                  {' '}
                  <button type="button"
                    data-test={`ref01-dismiss-${r.inboxId}`}
                    disabled={busy === r.inboxId}
                    onClick={() => { resolve(r.inboxId, 'dismiss').catch(() => undefined); }}>
                    Dismiss
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// C2: audit events timeline screen
export function EAAuditEvents({ api = edgeApi }:
    { api?: Pick<typeof edgeApi, 'listAuditEvents'> } = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.AuditEventRow[] | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function reload(): Promise<void> {
    try {
      const r = await api.listAuditEvents({
        eventType: eventTypeFilter || undefined, limit });
      setRows(r.events);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  useEffect(() => { reload().catch(() => undefined); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, eventTypeFilter, limit]);

  if (error) return <ErrorBlock title="Events failed" testId="auditev-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="auditev-loading" />;
  const uniqueTypes = Array.from(new Set(rows.map((r) => r.eventType))).sort();

  return (
    <div className="ea-screen">
      <ScreenHeader
        title="Audit events"
        subtitle={`${rows.length} most-recent events${eventTypeFilter ? ` of type ${eventTypeFilter}` : ''}`}
        lastFetched={lastFetched}
        onRefresh={reload}
        testId="auditev-header"
      />
      <section>
        <div className="ea-toolbar">
          <label>
            <span>Event type</span>
            <select data-test="auditev-filter-type"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}>
              <option value="">All</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Limit</span>
            <select data-test="auditev-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </label>
        </div>
        {rows.length === 0
          ? <EmptyBlock title="No events" testId="auditev-empty">
              Audit events will show up here as the system runs.</EmptyBlock>
          : <table data-test="auditev-table">
              <thead><tr>
                <th>When</th><th>Event</th><th>Outcome</th><th>Actor</th><th>Detail</th>
              </tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} data-test={`auditev-row-${i}`}>
                  <td>{r.observedAt}</td>
                  <td>{r.eventType}</td>
                  <td>
                    <span className={`ea-chip ea-chip--${
                      r.outcome === 'SUCCESS' ? 'success'
                      : r.outcome === 'DENIED' ? 'danger'
                      : 'info'}`}>{r.outcome}</span>
                  </td>
                  <td>{r.actorUserId ? r.actorUserId.slice(0, 8) : '—'}</td>
                  <td>
                    <button type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                      data-test={`auditev-toggle-${i}`}>
                      {expanded[i] ? 'Hide' : 'Show'}
                    </button>
                    {expanded[i] && (
                      <pre className="ea-audit-detail" data-test={`auditev-detail-${i}`}>
                        {r.detail}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>}
      </section>
    </div>
  );
}
