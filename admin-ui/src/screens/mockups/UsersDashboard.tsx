import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  Panel, SplitWithDrawer, Dot, fmtDate, usePaged, TablePager,
  SyncStatusBar, humaniseState,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** `/admin/provisioning/users` — Users dashboard. */
export function MockupUsersDashboard(): JSX.Element {
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<edgeApi.ProvisionedUser | null>(null);

  useEffect(() => {
    edgeApi.listUsers().then((r) => setUsers(r.users)).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = users ?? [];
    return q ? base.filter((u) => u.username.toLowerCase().includes(q)
      || u.displayName.toLowerCase().includes(q)) : base;
  }, [users, query]);

  const paged = usePaged(filtered, 50);

  if (!users) return <LoadingBlock testId="loading" />;

  const admins = users.filter((u) => u.roles.includes('ADMIN')).length;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={users.length === 0 ? 'muted' : 'info'}
        title="Users"
        statusLabel={users.length === 0 ? 'None provisioned'
          : `${users.length} provisioned`}
        subtitle={
          <>
            <span>Operators and administrators provisioned on this edge.</span>
            {admins > 0 && (<>
              <span>·</span>
              <span>Admins <strong style={{ color: 'var(--der-ink-900)' }}>{admins}</strong></span>
            </>)}
          </>
        }
        actions={
          <Link to="/provisioning/users/new" className="ea-btn ea-btn--primary ea-btn--sm">
            + Add user
          </Link>
        }
      />

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
                 action={
                   <input className="ea-input" style={{ maxWidth: 240 }} type="search"
                          placeholder="Search by name or username"
                          value={query} onChange={(e) => setQuery(e.target.value)} />
                 }>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th style={{ width: 150 }}>DHIS2 mapping</th>
                  <th style={{ width: 170 }}>Central permissions verified</th>
                  <th style={{ width: 110 }}>Last login</th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((u) => {
                    /* §20: show when Central permissions were last verified.
                       DER does not currently probe per-user; fall back to the
                       system-wide last Central compat probe timestamp. */
                    const verified = (u as unknown as { lastVerifiedAt?: string }).lastVerifiedAt;
                    const stale = verified ? (Date.now() - Date.parse(verified) > 2 * 3600_000) : true;
                    return (
                      <tr key={u.userId} className={sel?.userId === u.userId ? 'ea-row--active' : ''}
                          onClick={() => setSel(u)}>
                        <td>
                          <div className="ea-user-cell">
                            <span className="ea-user-cell-avatar" aria-hidden="true">
                              {initials(u.displayName || u.username)}
                            </span>
                            <span>
                              <div className="ea-user-cell-name">{u.displayName}</div>
                              <div className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{u.username}</div>
                            </span>
                          </div>
                        </td>
                        <td>
                          {u.roles.map((r) => (
                            <span key={r} className="ea-chip ea-chip--primary"
                                  title={r} style={{ marginRight: 4 }}>
                              {humaniseState(r)}
                            </span>
                          ))}
                        </td>
                        <td>
                          <span className="ea-chip ea-chip--neutral">Unmapped</span>
                        </td>
                        <td>
                          <span className={'ea-chip ea-chip--' + (stale ? 'warning' : 'success')}
                                title={verified ? `Last verified ${verified}` : 'Not yet verified by Central DHIS2'}>
                            {verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="ea-text-muted">—</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>
                      {users.length === 0 ? 'No users provisioned yet.' : 'No users match your search.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
              <TablePager {...paged.pagerProps} />
            </div>
          </Panel>
        }
        drawer={
          sel ? (
            <UserProfile user={sel} />
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select a user to see their profile.</p>
          )
        }
      />
    </div>
  );
}

function UserProfile({ user }: { user: edgeApi.ProvisionedUser }): JSX.Element {
  const [tab, setTab] = useState<'details' | 'permissions' | 'history'>('details');
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="ea-user-cell-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
          {initials(user.displayName || user.username)}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{user.displayName}</h3>
          <div className="ea-text-muted ea-mono" style={{ fontSize: 12 }}>{user.username}</div>
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        {user.roles.map((r) => (
          <span key={r} className="ea-chip ea-chip--primary"
                title={r} style={{ marginRight: 4 }}>
            {humaniseState(r)}
          </span>
        ))}
      </div>
      <div className="ea-section-tabs" style={{ marginTop: 12, marginBottom: 0 }}>
        <button type="button" className={'ea-section-tab' + (tab === 'details' ? ' ea-section-tab--active' : '')} onClick={() => setTab('details')}>Details</button>
        <button type="button" className={'ea-section-tab' + (tab === 'permissions' ? ' ea-section-tab--active' : '')} onClick={() => setTab('permissions')}>Permissions</button>
        <button type="button" className={'ea-section-tab' + (tab === 'history' ? ' ea-section-tab--active' : '')} onClick={() => setTab('history')}>Activity</button>
      </div>
      {tab === 'details' && (
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>User ID</dt>
            <dd className="ea-mono" style={{ fontSize: 10 }}>{user.userId}</dd></div>
          <div className="ea-def-row"><dt>Username</dt>
            <dd className="ea-mono">{user.username}</dd></div>
          <div className="ea-def-row"><dt>Display name</dt><dd>{user.displayName}</dd></div>
          <div className="ea-def-row"><dt>DHIS2 mapping</dt>
            <dd><span className="ea-chip ea-chip--neutral">Unmapped</span></dd></div>
        </dl>
      )}
      {tab === 'permissions' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
          {user.roles.includes('ADMIN') && <li style={{ padding: '4px 0' }}>• Manage users, apps, settings, sync, recovery</li>}
          {user.roles.includes('OPERATOR') && <li style={{ padding: '4px 0' }}>• Capture aggregate / event / tracker data</li>}
          {user.roles.includes('REVIEWER') && <li style={{ padding: '4px 0' }}>• Review approvals and conflicts</li>}
        </ul>
      )}
      {tab === 'history' && (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
          Per-user activity not yet exposed on this edge.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14,
                    paddingTop: 10, borderTop: '1px solid var(--der-border-subtle)' }}>
        <button type="button" className="ea-btn ea-btn--primary">Validate mapping</button>
        <button type="button" className="ea-btn ea-btn--ghost">Reset login</button>
      </div>
    </>
  );
}

function initials(s: string): string {
  const parts = s.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
export { fmtDate, Dot };
