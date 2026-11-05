import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';
import { ScreenHeader } from '../components/ScreenHeader';
import { SyncStatusBar, Panel, confirmThenRun, Status, RowMenu } from './shared';
import { HealthCards } from '../components/HealthCards';
import { HeroHeader } from '../components/HeroHeader';
import { SystemComponents } from '../components/SystemComponents';
import { QuickActions } from '../components/QuickActions';
import { RecentActivity } from '../components/RecentActivity';
import { usePaged, TablePager } from './shared';
import { UiIcon } from '../components/UiIcon';
import { StepsEditor } from '../components/workflow/StepsEditor';
import { DependenciesEditor } from '../components/workflow/DependenciesEditor';
import { validateWorkflow, type ValidationError } from '../components/workflow/validate';

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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            This edge isn&apos;t bound yet. Writes are rejected until an admin
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
        lastFetched={lastFetched}
        actions={
          <Link to="/provisioning/users/new" className="ea-btn ea-btn--primary"
                 data-test="ea02-new" data-cross-module="Access">
            + Add user
          </Link>
        }
      />
      <h1 data-test="ea02-heading" className="ea-visually-hidden">Provisioned users</h1>

      <section className="ea-screen-header-sub" role="group" aria-label="User summary"
               style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12,
                        margin: '0 0 var(--sp-3)' }}>
        <span>Total users <strong style={{ color: 'var(--der-ink-900)' }}>{total}</strong></span>
        <span>·</span>
        <span style={{ color: 'var(--der-success-ink)' }}>Administrators <strong>{admins}</strong></span>
        <span>·</span>
        <span className="ea-text-muted">Operators <strong>{operators}</strong></span>
      </section>

      {users.length === 0 ? (
        <EmptyBlock title="No users provisioned yet" testId="ea02-empty">
          Bootstrap the first ADMIN account via the
          <code> DER_BOOTSTRAP_ADMIN_USERNAME</code> + password
          environment variables on the server, then sign in and add
          operators here with <strong>New user</strong>.
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
        actions={
          <Link to="/provisioning/users" className="ea-btn ea-btn--ghost"
                 data-cross-module="Access">← Back to users</Link>
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
                <span className="ea-field-hint">Min 12 chars, mixed case + digits.</span>
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
            <Link to="/provisioning/users" className="ea-btn ea-btn--ghost"
                   data-cross-module="Access">Cancel</Link>
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
            <p data-test="ea03-saved" className="ea-saved">User created.</p>
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  const paged = usePaged(rows ?? [], 50);
  if (error) return <ErrorBlock title="History failed" testId="ea05-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea05-loading" />;
  const selected = selectedIdx !== null ? rows[selectedIdx] ?? null : null;

  return (
    <div className="ea-screen">
      <ScreenHeader
        title="Compat history"
        subtitle={`${rows.length} snapshots`}
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  function outcomeTone(o: string): 'success' | 'danger' | 'info' | 'warning' {
    if (o === 'SUCCESS') return 'success';
    if (o === 'FAILED' || o === 'ERROR') return 'danger';
    if (o === 'RUNNING') return 'info';
    return 'warning';
  }

  return (
    <div className="ea-screen">
      <HeroHeader
        title="Synchronisation jobs"
        lastFetched={lastFetched}
        actions={
          <>
            <button type="button" onClick={() => { reload().catch(() => undefined); }} data-test="ea06-refresh">
              Refresh
            </button>
            {/* §2.3.107 R-AB — explicit module prefix so operators
                see this leaves the current (Integration/Scheduler)
                screen for the Sync module's job-trigger surface. */}
            <Link to="/sync/jobs/trigger" className="ea-link-btn"
                   data-test="ea06-trigger-link"
                   data-cross-module="Sync">
              Sync › Trigger a job
            </Link>
          </>
        }
      />

      <section className="ea-screen-header-sub" data-test="ea06-strip"
               style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12,
                        margin: '0 0 var(--sp-3)' }}>
        <span>Total runs <strong style={{ color: 'var(--der-ink-900)' }}>{total}</strong></span>
        <span>·</span>
        <span style={{ color: 'var(--der-success-ink)' }}>Succeeded <strong>{nSuccess}</strong></span>
        {nFailed > 0 && (<><span>·</span><span style={{ color: 'var(--der-danger-ink)' }}>Failed <strong>{nFailed}</strong></span></>)}
        {nOther > 0 && (<><span>·</span><span className="ea-text-muted">Other <strong>{nOther}</strong></span></>)}
      </section>

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
          ? <EmptyBlock title="No runs match the filter" testId="ea06-empty">
              Switch to <strong>All</strong> or pick a different outcome
              to see historical runs.  The scheduler records every run
              it kicks off, succeeded or not.
            </EmptyBlock>
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
                      <td><Status tone={outcomeTone(r.outcome)}>{r.outcome}</Status></td>
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
            <dt>Outcome</dt><dd><Status tone={outcomeTone(selected.outcome)}>{selected.outcome}</Status></dd>
            <dt>Duration</dt><dd>{fmtDuration(selected.durationMs ?? undefined)}</dd>
          </dl>
        </div>
      )}
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
            <p className="ea-saved" data-test="ea07-ok">Triggered.</p>
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false).catch(() => undefined); }, [api]);
  if (error) return <ErrorBlock title="Drift failed" testId="ea08-error">{error}</ErrorBlock>;
  if (!data) return <LoadingBlock testId="ea08-loading" />;
  if (data.status === 'NO_SNAPSHOT') {
    return (
      <div className="ea-screen">
        <HeroHeader title="Metadata drift" subtitle="No snapshot yet." />
        <EmptyBlock title="No drift snapshot" testId="ea08-empty">
          Drift is computed by diffing two metadata snapshots.  Trigger
          a metadata sync (or wait for the scheduled one) so DER has at
          least two snapshots to compare against central.
        </EmptyBlock>
      </div>
    );
  }
  const same = data.fingerprintFrom === data.fingerprintTo;
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Metadata drift"
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [api]);
  if (error) return <ErrorBlock title="Conflicts failed" testId="ea10-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea10-loading" />;
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Conflicts to review"
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
              Nothing to review.
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

/* EA-20/21/23 Conflict resolve: the rich MockupConflictDetail in
 * MoreScreens.tsx (routed at /sync/attention/:operationId) is the
 * canonical surface. The thin stub that once lived here, and its
 * /conflicts/:id direct mount, have been removed. */

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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const toneColorFor = (t: 'info' | 'success' | 'danger' | 'muted'): string => {
    if (t === 'success') return 'var(--der-success-ink)';
    if (t === 'danger') return 'var(--der-danger-ink)';
    if (t === 'info') return 'var(--der-primary-ink)';
    return 'var(--der-ink-500)';
  };
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Journal worker"
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
      <section data-test="ea14-backlog" style={{ display: 'flex', flexWrap: 'wrap',
                                                   gap: 14, fontSize: 13 }}>
        {Object.entries(h.backlog).map(([state, n], i) => (
          <span key={state} data-test={`ea14-backlog-${state}`}
                style={{ color: toneColorFor(toneFor(state)) }}>
            {i > 0 && <span className="ea-text-muted" style={{ marginRight: 14 }}>·</span>}
            {state.replace(/_/g, ' ')} <strong>{n}</strong>
          </span>
        ))}
      </section>
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="apr-heading">Pending approvals</h1>
        </div>
      </header>
      {rows.length === 0 ? (
        <EmptyBlock title="No pending approvals" testId="apr-empty">
          Nothing waiting for review.
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
    { api?: Pick<typeof edgeApi, 'listWorkflows' | 'deleteWorkflow'
      | 'listWorkflowRuns' | 'saveWorkflow' | 'getWorkflow' | 'exportWorkflow'> } = {}): JSX.Element {
  const [workflows, setWorkflows] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [runCounts, setRunCounts] = useState<Record<string, number>>({});
  const [bindingNames, setBindingNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const resp = await api.listWorkflows();
      setWorkflows(resp.workflows);
      // Fetch run counts in parallel so the catalogue can show a
      // per-workflow run tally without needing a global runs page.
      const counts: Record<string, number> = {};
      await Promise.all(resp.workflows.map(async (w) => {
        try {
          const r = await (api.listWorkflowRuns ?? edgeApi.listWorkflowRuns)(w.workflowId);
          counts[w.workflowId] = r.runs.length;
        } catch { counts[w.workflowId] = 0; }
      }));
      setRunCounts(counts);
      // §2.3.67 — resolve each workflow's binding UID to the mirror
      // display name so admins see "PEP Prevention HIV Programme"
      // instead of "PROGRAM:ypERhZSScUZ". De-duplicated by UID so a
      // catalogue with N workflows on the same program fires one
      // fetch, not N.
      const names: Record<string, string> = {};
      const seen = new Set<string>();
      const md = await import('./workflow/wizardMetadata');
      await Promise.all(resp.workflows.map(async (w) => {
        const key = `${w.boundMetadataKind}:${w.boundMetadataId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const kind = w.boundMetadataKind === 'DATA_SET' ? 'DATA_SET' : 'PROGRAM';
        try {
          const m = await md.fetchMetadataName(kind, w.boundMetadataId);
          names[key] = m.displayName;
        } catch { /* leave absent */ }
      }));
      setBindingNames(names);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function remove(id: string): Promise<void> {
    try {
      await api.deleteWorkflow(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function toggleEnabled(w: edgeApi.CaptureWorkflowSummary): Promise<void> {
    try {
      // Fetch full to preserve steps/dependencies (list endpoint
      // ships them inline, but a full get is defensive).
      const full = (api.getWorkflow ?? edgeApi.getWorkflow)
        ? await (api.getWorkflow ?? edgeApi.getWorkflow)(w.workflowId)
        : w;
      await (api.saveWorkflow ?? edgeApi.saveWorkflow)({
        ...full,
        enabled: !full.enabled,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function duplicate(w: edgeApi.CaptureWorkflowSummary): Promise<void> {
    try {
      const full = (api.getWorkflow ?? edgeApi.getWorkflow)
        ? await (api.getWorkflow ?? edgeApi.getWorkflow)(w.workflowId)
        : w;
      // Strip step ids so the server mints new UUIDs — reusing them
      // collides on capture_workflow_step_pkey. Drop dependencies too
      // since they reference the old step ids.
      const steps = full.steps.map((s) => ({ ...s, stepId: undefined }));
      await (api.saveWorkflow ?? edgeApi.saveWorkflow)({
        ...full,
        workflowId: undefined,                        // force server to mint new UUID
        displayName: `${full.displayName} (copy)`,
        enabled: false,                               // copies start disabled
        steps,
        dependencies: [],
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function exportJson(w: edgeApi.CaptureWorkflowSummary): Promise<void> {
    try {
      const canonical = await (api.exportWorkflow ?? edgeApi.exportWorkflow)(w.workflowId);
      const blob = new Blob([JSON.stringify(canonical, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `workflow-${w.displayName.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) return <ErrorBlock title="Workflow catalogue error" testId="cwf01-error">{error}</ErrorBlock>;
  if (workflows === null) return <LoadingBlock testId="cwf01-loading" />;
  const enabled = workflows.filter((w) => w.enabled).length;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={workflows.length === 0 ? 'muted' : enabled > 0 ? 'success' : 'warning'}
        title="Workflows"
        statusLabel={workflows.length === 0 ? 'None defined'
          : `${enabled} of ${workflows.length} enabled`}
        actions={
          <Link to="/workflows/new" className="ea-btn ea-btn--primary ea-btn--sm"
                data-test="cwf01-new" data-cross-module="Workflows">
            <UiIcon icon="plus" size={14} />
            <span>New workflow</span>
          </Link>
        }
      />
      {workflows.length === 0 ? (
        <EmptyBlock title="No workflows yet" testId="cwf01-empty">
          Click <strong>New workflow</strong> to configure the first one.
        </EmptyBlock>
      ) : (
        <Panel title="Catalogue">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Binding</th>
                  <th style={{ width: 70 }}>Version</th>
                  <th style={{ width: 70 }}>Steps</th>
                  <th style={{ width: 70 }}>Runs</th>
                  <th style={{ width: 90 }}>Enabled</th>
                  <th style={{ width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.workflowId} data-test={`cwf01-row-${w.workflowId}`}>
                    <td>
                      <Link to={`/workflows/${w.workflowId}`}
                            data-test={`cwf01-open-${w.workflowId}`}
                            style={{ fontWeight: 500 }}>
                        {w.displayName}
                      </Link>
                    </td>
                    <td>
                      {(() => {
                        const key = `${w.boundMetadataKind}:${w.boundMetadataId}`;
                        const name = bindingNames[key];
                        return (
                          <>
                            <span style={{ fontSize: 13 }}>
                              {name ?? w.boundMetadataId}
                            </span>
                            <div className="ea-text-muted"
                                  style={{ fontSize: 11 }}>
                              {w.boundMetadataKind === 'DATA_SET' ? 'Dataset'
                                : w.boundMetadataKind === 'PROGRAM' ? 'Program'
                                : w.boundMetadataKind}
                              {' · '}
                              <span className="ea-mono">{w.boundMetadataId}</span>
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="ea-mono">v{w.version}</td>
                    <td>
                      <Link to={`/workflows/${w.workflowId}#assignments`}
                            className="ea-link-btn" style={{ fontSize: 12 }}>
                        {(w.steps?.length ?? 0).toLocaleString()}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/workflows/runs?workflow=${w.workflowId}`}
                            className="ea-link-btn" style={{ fontSize: 12 }}>
                        {(runCounts[w.workflowId] ?? 0).toLocaleString()}
                      </Link>
                    </td>
                    <td data-test={`cwf01-enabled-${w.workflowId}`}>
                      <Status tone={w.enabled ? 'success' : 'muted'}>
                        {w.enabled ? 'Enabled' : 'Disabled'}
                      </Status>
                    </td>
                    <td style={{ textAlign: 'right' }}
                        data-test={`cwf01-row-menu-${w.workflowId}`}>
                      <RowMenu items={[
                        { label: 'Open designer', to: `/workflows/${w.workflowId}` },
                        { label: 'View runs',
                          to: `/workflows/runs?workflow=${w.workflowId}` },
                        { label: w.enabled ? 'Disable' : 'Enable',
                          onSelect: () => { void toggleEnabled(w); } },
                        { label: 'Duplicate',
                          onSelect: () => {
                            confirmThenRun(
                              `Duplicate "${w.displayName}"? A copy will be created disabled with "(copy)" appended.`,
                              () => { void duplicate(w); });
                          } },
                        { label: 'Export JSON',
                          onSelect: () => { void exportJson(w); } },
                        { label: 'Delete', danger: true,
                          onSelect: () => {
                            confirmThenRun(
                              `Delete the workflow "${w.displayName}"? Existing runs will remain in history but no new runs can start on this workflow.`,
                              () => { remove(w.workflowId).catch(() => undefined); });
                          } },
                      ]} />
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

// EA-CWF-02 Designer -----------------------------------------------
export function EACaptureWorkflowDesigner({ api = edgeApi, workflowId }:
    { api?: Pick<typeof edgeApi, 'getWorkflow' | 'saveWorkflow' | 'listDevices'
      | 'exportWorkflow' | 'importWorkflow'>;
      workflowId?: string } = {}): JSX.Element {
  const [existing, setExisting] = useState<edgeApi.CaptureWorkflowSummary | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [boundMetadataKind, setBoundMetadataKind] =
    useState<edgeApi.CanonicalWorkflow['boundMetadataKind']>('DATA_SET');
  // §2.3.101 R-M — binding kinds advertised by the connected Central.
  // Null = loading; empty = compat unavailable (full catalogue shown).
  const [supportedKinds, setSupportedKinds]
    = useState<ReadonlyArray<string> | null>(null);
  const [boundMetadataId, setBoundMetadataId] = useState('');
  const [enabled, setEnabled] = useState(true);
  /* V045 — workflow-level approval + default assignee. */
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [defaultDeviceId, setDefaultDeviceId] = useState<string>('');
  /* 2.3.13 form-based editors (primary) + raw JSON (advanced panel). */
  const [steps, setSteps] = useState<edgeApi.CaptureWorkflowStep[]>([]);
  const [dependencies, setDependencies] = useState<edgeApi.CaptureWorkflowDependency[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [stepsJson, setStepsJson] = useState('[]');
  const [depsJson, setDepsJson] = useState('[]');
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [importText, setImportText] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[] | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);

  // §2.3.101 R-M — fetch compat capability list once on mount. If
  // Central isn't reachable the dropdown falls back to the full
  // catalogue (operators save at their own risk).
  useEffect(() => {
    let alive = true;
    edgeApi.compat()
      .then((snap) => {
        if (!alive) return;
        const caps = snap.capabilities as
            Record<string, unknown> | undefined;
        const kinds = caps?.supportedBindingKinds;
        if (Array.isArray(kinds)) {
          setSupportedKinds(kinds as string[]);
        } else {
          setSupportedKinds([]);
        }
      })
      .catch(() => { if (alive) setSupportedKinds([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    (async () => {
      if (workflowId && workflowId !== 'new') {
        const w = await api.getWorkflow(workflowId);
        setExisting(w);
        setDisplayName(w.displayName);
        setBoundMetadataKind(w.boundMetadataKind);
        setBoundMetadataId(w.boundMetadataId);
        setEnabled(w.enabled);
        setRequiresApproval(w.requiresApproval ?? false);
        setDefaultDeviceId(w.defaultDeviceId ?? '');
        setSteps([...w.steps]);
        setDependencies([...w.dependencies]);
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
    // Prefer form-based state. Fall back to parsing the advanced JSON
    // panel only when it's visibly open (operator editing JSON directly).
    let stepsPayload = steps;
    let depsPayload = dependencies;
    if (showJsonPanel) {
      try {
        stepsPayload = JSON.parse(stepsJson) as edgeApi.CaptureWorkflowStep[];
        depsPayload = JSON.parse(depsJson) as edgeApi.CaptureWorkflowDependency[];
      } catch (ex) {
        setStatus('idle');
        setError('Invalid JSON in advanced panel: ' + (ex instanceof Error ? ex.message : String(ex)));
        return;
      }
    }
    const errs = validateWorkflow({
      displayName, boundMetadataId,
      steps: stepsPayload, dependencies: depsPayload,
    });
    setValidationErrors(errs);
    if (errs.length > 0) {
      setStatus('idle');
      return;
    }
    try {
      await api.saveWorkflow({
        workflowId: existing?.workflowId,
        displayName, boundMetadataKind, boundMetadataId, enabled,
        steps: stepsPayload, dependencies: depsPayload,
        requiresApproval,
        defaultDeviceId: defaultDeviceId === '' ? null : defaultDeviceId,
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
          {(() => {
            const supports = (k: string): boolean =>
                supportedKinds === null                 // still loading
                || supportedKinds.length === 0          // compat unavailable
                || supportedKinds.includes(k);
            return (
              <>
                <optgroup label="Aggregate">
                  {supports('DATA_SET') &&
                    <option value="DATA_SET">Dataset</option>}
                  {supports('DATA_SET_SECTION') &&
                    <option value="DATA_SET_SECTION">Dataset section</option>}
                  {supports('DATA_ELEMENT') &&
                    <option value="DATA_ELEMENT">Data element</option>}
                </optgroup>
                <optgroup label="Events / Tracker">
                  {supports('PROGRAM') &&
                    <option value="PROGRAM">Program (tracker or event-only)</option>}
                  {supports('PROGRAM_SECTION') &&
                    <option value="PROGRAM_SECTION">Program section (enrolment attribute group)</option>}
                  {supports('PROGRAM_STAGE') &&
                    <option value="PROGRAM_STAGE">Program stage</option>}
                  {supports('PROGRAM_STAGE_SECTION') &&
                    <option value="PROGRAM_STAGE_SECTION">Program-stage section</option>}
                  {supports('TRACKED_ENTITY_TYPE') &&
                    <option value="TRACKED_ENTITY_TYPE">Tracked-entity type</option>}
                  {supports('TRACKED_ENTITY_ATTRIBUTE') &&
                    <option value="TRACKED_ENTITY_ATTRIBUTE">Tracked-entity attribute (TEA)</option>}
                </optgroup>
              </>
            );
          })()}
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
      <label>
        <input type="checkbox" data-test="cwf02-requires-approval"
          checked={requiresApproval}
          onChange={(e) => { setRequiresApproval(e.target.checked); }} />
        Requires approval before upload
      </label>
      <label>
        <span>Default assigned device (optional — each step may override)</span>
        <select data-test="cwf02-default-device" value={defaultDeviceId}
          onChange={(e) => { setDefaultDeviceId(e.target.value); }}>
          <option value="">— none (step must bind explicitly) —</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.displayName ?? d.deviceId.slice(0, 12)}
              {d.formFactor && d.formFactor !== 'UNKNOWN'
                ? ` · ${d.formFactor.toLowerCase()}` : ''}
            </option>
          ))}
        </select>
      </label>
      {devices.length > 0 && (
        <details className="ea-cwf-device-ref" data-test="cwf02-devices">
          <summary>Enrolled devices ({devices.length})</summary>
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
      <fieldset style={{ border: '1px solid var(--der-border)',
                           borderRadius: 6, padding: 10, marginTop: 10 }}>
        <legend style={{ padding: '0 6px', fontSize: 13 }}>
          Steps · {steps.length}
        </legend>
        <StepsEditor steps={steps} devices={devices} onChange={setSteps} />
      </fieldset>
      <fieldset style={{ border: '1px solid var(--der-border)',
                           borderRadius: 6, padding: 10, marginTop: 10 }}>
        <legend style={{ padding: '0 6px', fontSize: 13 }}>
          Dependencies · {dependencies.length}
        </legend>
        <DependenciesEditor steps={steps} dependencies={dependencies}
                             onChange={setDependencies} />
      </fieldset>

      {validationErrors.length > 0 && (
        <div className="ea-alert ea-alert--danger"
             data-test="cwf02-validation"
             style={{ marginTop: 10, padding: 8, border: '1px solid var(--der-danger-ink)',
                       borderRadius: 4, fontSize: 13 }}>
          <strong>Please fix before saving:</strong>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {validationErrors.map((e, i) => (
              <li key={i}><code>{e.code}</code> — {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <details style={{ marginTop: 10 }}
               open={showJsonPanel}
               onToggle={(e) => { setShowJsonPanel(
                 (e.target as HTMLDetailsElement).open); }}>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>
          Advanced — edit raw JSON (steps + dependencies)
        </summary>
        <label>
          <span>Steps JSON</span>
          <textarea data-test="cwf02-steps" rows={10}
                     value={showJsonPanel ? stepsJson : JSON.stringify(steps, null, 2)}
                     onChange={(e) => { setStepsJson(e.target.value); }} />
        </label>
        <label>
          <span>Dependencies JSON</span>
          <textarea data-test="cwf02-deps" rows={6}
                     value={showJsonPanel ? depsJson
                       : JSON.stringify(dependencies, null, 2)}
                     onChange={(e) => { setDepsJson(e.target.value); }} />
        </label>
      </details>
      <button type="button" className="ea-btn ea-btn--primary"
        data-test="cwf02-save"
        disabled={status === 'saving' || !displayName || !boundMetadataId}
        onClick={() => { doSave().catch(() => undefined); }}>
        {status === 'saving' ? <span className="ea-btn-spinner" /> : <UiIcon icon="refresh" size={14} />}
        <span>{status === 'saving' ? 'Saving…' : 'Save workflow'}</span>
      </button>
      {existing && (
        <section className="ea-cwf-export" data-test="cwf02-export-section">
          <h2>Export</h2>
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          Generate a token from Device enrolment and scan its QR code
          on the device to enroll.
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [lastVerifiedAt, setLastVerifiedAt] = useState<Date | null>(null);

  async function run(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setResp(await api.verifyAuditChain());
      setLastVerifiedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /* Auto-run once on mount so operators land on an answered page. The
   * verification streams every security_audit row in insertion order
   * and re-hashes each — negligible on a typical edge (< 10k rows) and
   * worth the clarity. A Re-verify button lets them retry on demand. */
  useEffect(() => { run().catch(() => undefined); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tone: 'success' | 'warning' | 'danger' | 'muted' | 'info' = busy
    ? 'info'
    : resp == null
      ? 'muted'
      : resp.ok
        ? 'success'
        : 'danger';
  const statusLabel = busy
    ? 'Verifying…'
    : resp == null
      ? 'Not yet verified'
      : resp.ok
        ? `Intact · ${resp.totalRows.toLocaleString()} row${resp.totalRows === 1 ? '' : 's'}`
        : `Broken · ${resp.totalRows.toLocaleString()} row${resp.totalRows === 1 ? '' : 's'} scanned`;

  return (
    <div className="ea-screen" data-test="aud01">
      <SyncStatusBar
        tone={tone}
        title="Hash chain integrity"
        statusLabel={statusLabel}
        actions={
          <>
            <Link to="/audit/trail"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Security &amp; Audit"
                  data-test="aud01-open-trail">
              <UiIcon icon="audit" size={14} />
              <span>Audit trail</span>
            </Link>
            <button type="button"
                    className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="aud01-run"
                    disabled={busy}
                    onClick={() => { run().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>{busy ? 'Verifying…' : 'Re-verify'}</span>
            </button>
          </>
        }
      />

      {error && (
        <ErrorBlock title="Verify failed" testId="aud01-error">{error}</ErrorBlock>
      )}

      {resp && (
        <Panel title="Verification result"
               action={
                 <span data-test="aud01-status-chip">
                   {resp.ok
                     ? <Status tone="success">Chain intact</Status>
                     : <Status tone="danger">Broken</Status>}
                 </span>
               }>
          <dl className="ea-def-list" data-test="aud01-result">
            <div className="ea-def-row">
              <dt>Rows checked</dt>
              <dd className="ea-mono"
                  data-test="aud01-total">{resp.totalRows.toLocaleString()}</dd>
            </div>
            <div className="ea-def-row">
              <dt>Last verified</dt>
              <dd className="ea-mono" style={{ fontSize: 12 }}>
                {lastVerifiedAt ? lastVerifiedAt.toLocaleString() : '—'}
              </dd>
            </div>
            {!resp.ok && (
              <>
                <div className="ea-def-row">
                  <dt>First broken row</dt>
                  <dd data-test="aud01-break-id">
                    <code className="ea-mono">{resp.firstBreakAuditId}</code>
                    {resp.firstBreakAuditId != null && (
                      <>
                        {' '}
                        <Link to="/audit/trail"
                              className="ea-link-btn"
                              style={{ marginLeft: 8, fontSize: 12 }}
                              data-cross-module="Security &amp; Audit"
                              data-test="aud01-open-trail-at-break">
                          View in audit trail →
                        </Link>
                      </>
                    )}
                  </dd>
                </div>
                <div className="ea-def-row">
                  <dt>Reason</dt>
                  <dd data-test="aud01-break-reason">
                    <Status tone="danger">
                      {resp.firstBreakReason === 'PREV_HASH_MISMATCH'
                        ? 'Previous-hash mismatch'
                        : resp.firstBreakReason === 'ROW_HASH_MISMATCH'
                          ? 'Row-hash mismatch'
                          : resp.firstBreakReason}
                    </Status>
                  </dd>
                </div>
              </>
            )}
          </dl>
        </Panel>
      )}

      {resp == null && !error && busy && <LoadingBlock testId="aud01-loading" />}
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
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="ref01-heading">Referral inbox</h1>
        </div>
      </header>
      {rows.length === 0 ? (
        <EmptyBlock title="No pending referrals" testId="ref01-empty">
          Nothing to review.
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
          ? <EmptyBlock title="Audit stream empty" testId="auditev-empty">
              Sign-in attempts, workflow transitions, device enrolments,
              and config changes land here as the system runs.  Nothing
              has been recorded yet on this edge.
            </EmptyBlock>
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
