import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, usePaged, TablePager, SyncStatusBar, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

const CANONICAL_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const;
const STALE_HOURS_THRESHOLD = 24 * 7;

export function UserScope(): JSX.Element {
  const [data, setData] = useState<{
    users: edgeApi.EdgeUserScopeRow[]; generatedAt: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  async function reload(): Promise<void> {
    setRefreshing(true);
    try {
      setData(await edgeApi.fetchUserScope());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  // Hooks must run before any early-return; compute the filtered set
  // + paginator up front so React sees a stable hook order.
  const q = query.trim().toLowerCase();
  const filtered = (data?.users ?? []).filter((u) => {
    if (q && !u.username.toLowerCase().includes(q)
         && !(u.displayName ?? '').toLowerCase().includes(q)) return false;
    if (filterRole !== 'ALL' && !u.roles.includes(filterRole)) return false;
    return true;
  });
  const paged = usePaged(filtered, 50);

  if (err && !data) {
    return <ErrorBlock title="User scope load failed"
                        testId="err-user-scope">{err}</ErrorBlock>;
  }
  if (!data) return <LoadingBlock testId="loading" />;

  const total = data.users.length;
  const active = data.users.filter((u) => !u.disabled).length;
  const admins = data.users.filter((u) => u.roles.includes('ADMIN')).length;
  const stale = data.users.filter((u) =>
    u.permissionAgeHours > STALE_HOURS_THRESHOLD).length;

  return (
    <div className="ea-screen" data-test="user-scope">
      <SyncStatusBar
        tone={stale > 0 ? 'warning' : 'info'}
        title="User scope"
        statusLabel={`${active}/${total} active`}
        subtitle={
          <>
            <span>Every user on this edge, their roles, and how recently their permissions were refreshed.</span>
            <span>·</span>
            <span>Admins <strong style={{ color: 'var(--der-ink-900)' }}>{admins}</strong></span>
            {stale > 0 && (<>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--der-warning-ink)' }}>
                  {stale} stale ({'>'}7 days)
                </strong>
              </span>
            </>)}
            <span>·</span>
            <span>Generated <strong style={{ color: 'var(--der-ink-900)' }}>
              {fmtAgo(data.generatedAt)}
            </strong></span>
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={refreshing}
                    data-test="user-scope-refresh"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <Link to="/provisioning/users"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Provisioning"
                   data-test="user-scope-open-provisioning">
              <UiIcon icon="edit" size={14} />
              <span>Manage users</span>
            </Link>
          </>
        }
      />

      <Panel title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
             action={
               <>
                 <input className="ea-input" type="search"
                        style={{ maxWidth: 220 }}
                        placeholder="Search username or display name"
                        value={query}
                        data-test="user-scope-search"
                        onChange={(e) => setQuery(e.target.value)} />
                 <select className="ea-input" style={{ maxWidth: 160 }}
                         value={filterRole}
                         aria-label="Filter users by role"
                         data-test="user-scope-role-filter"
                         onChange={(e) => setFilterRole(e.target.value)}>
                   <option value="ALL">All roles</option>
                   {CANONICAL_ROLES.map((r) =>
                     (<option key={r} value={r}>{r}</option>))}
                 </select>
               </>
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
             data-test="user-scope-empty">
            No users match this filter.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>User</th><th>Origin</th>
                {CANONICAL_ROLES.map((r) => (
                  <th key={r} style={{ textAlign: 'center' }}>{r}</th>
                ))}
                <th>Other roles</th>
                <th>Permission age</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {paged.rows.map((u) => {
                  const otherRoles = u.roles
                    .filter((r) => !(CANONICAL_ROLES as readonly string[]).includes(r));
                  const isStale = u.permissionAgeHours > STALE_HOURS_THRESHOLD;
                  return (
                    <tr key={u.userId}
                        data-test={`user-row-${u.username}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {u.displayName || u.username}
                        </div>
                        <div className="ea-text-muted ea-mono"
                             style={{ fontSize: 11 }}>
                          @{u.username}
                        </div>
                      </td>
                      <td>
                        <span className="ea-chip ea-chip--info"
                              data-test={`user-origin-${u.username}`}>
                          {u.origin}
                        </span>
                      </td>
                      {CANONICAL_ROLES.map((role) => (
                        <td key={role} style={{ textAlign: 'center' }}
                            data-test={`user-${u.username}-${role}`}>
                          {u.roles.includes(role)
                            ? <span aria-label={`has ${role}`}
                                     style={{ color: 'var(--der-success-ink)',
                                              fontWeight: 600 }}>✓</span>
                            : <span aria-hidden="true"
                                     className="ea-text-muted">·</span>}
                        </td>
                      ))}
                      <td className="ea-text-muted" style={{ fontSize: 12 }}>
                        {otherRoles.length === 0 ? '—' : otherRoles.join(', ')}
                      </td>
                      <td>
                        <span className={
                          'ea-chip ea-chip--' + (isStale ? 'warning' : 'muted')}
                              title={fmtDate(u.updatedAt)}
                              data-test={`user-age-${u.username}`}>
                          {u.permissionAgeHours}h
                        </span>
                      </td>
                      <td>
                        <Status tone={u.disabled ? 'danger' : 'success'}>
                          {u.disabled ? 'Disabled' : 'Active'}
                        </Status>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>
    </div>
  );
}

