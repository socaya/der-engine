import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, Dot, fmtDate, usePaged, TablePager,
  SyncStatusBar, humaniseState, RowMenu, BackLink,
} from './shared';
import { UiIcon } from '../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/** `/admin/provisioning/users` — Users dashboard. */
export function MockupUsersDashboard(): JSX.Element {
  const navigate = useNavigate();
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [query, setQuery] = useState('');

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
            <UiIcon icon="plus" size={14} />
            <span>Add user</span>
          </Link>
        }
      />

      <Panel title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
             action={
               <input className="ea-input" style={{ maxWidth: 240 }} type="search"
                      placeholder="Search by name or username"
                      value={query} onChange={(e) => setQuery(e.target.value)} />
             }>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense ea-table--selectable">
            <thead><tr>
              <th style={{ width: 36 }}></th>
              <th>Display name</th>
              <th>Username</th>
              <th>Roles</th>
              <th style={{ width: 150 }}>DHIS2 mapping</th>
              <th style={{ width: 170 }}>Central permissions verified</th>
              <th style={{ width: 110 }}>Last login</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {paged.rows.map((u) => {
                const verified = (u as unknown as { lastVerifiedAt?: string }).lastVerifiedAt;
                const stale = verified ? (Date.now() - Date.parse(verified) > 2 * 3600_000) : true;
                return (
                  <tr key={u.userId}
                      onClick={() => navigate(`/provisioning/users/${u.userId}`)}
                      data-test={`user-row-${u.userId}`}>
                    <td>
                      <span className="ea-user-cell-avatar" aria-hidden="true">
                        {initials(u.displayName || u.username)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{u.displayName}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{u.username}</td>
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
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Open details', to: `/provisioning/users/${u.userId}` },
                      ]} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>
                  {users.length === 0 ? 'No users provisioned yet.' : 'No users match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
          <TablePager {...paged.pagerProps} />
        </div>
      </Panel>
    </div>
  );
}

/** `/admin/provisioning/users/:userId` — per-user details page.
 *  Replaces the former right-side drawer. */
export function MockupUserDetail(): JSX.Element {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<edgeApi.ProvisionedUser | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'details' | 'permissions' | 'history'>('details');

  useEffect(() => {
    if (!userId) return;
    edgeApi.listUsers().then((r) => {
      const u = r.users.find((x) => x.userId === userId);
      if (!u) { setErr('User not found on this edge.'); return; }
      setUser(u);
    }).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [userId]);

  if (err) return <ErrorBlock title="Could not load user" testId="err-user-detail">{err}</ErrorBlock>;
  if (!user) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen" data-test="user-detail">
      <BackLink to="/provisioning/users" label="Back to Users" />
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 style={{ margin: 0 }}>{user.displayName}</h1>
          <div className="ea-screen-header-sub">
            <span className="ea-mono">{user.username}</span>
            {user.roles.map((r) => (
              <span key={r} className="ea-chip ea-chip--primary" title={r}>
                {humaniseState(r)}
              </span>
            ))}
          </div>
        </div>
        <div className="ea-screen-header-right">
          <button type="button" className="ea-btn ea-btn--primary">Validate mapping</button>
          <button type="button" className="ea-btn ea-btn--ghost">Reset login</button>
        </div>
      </header>
      <section className="ea-panel">
        <div className="ea-section-tabs" style={{ marginBottom: 10 }}>
          <button type="button" className={'ea-section-tab' + (tab === 'details' ? ' ea-section-tab--active' : '')} onClick={() => setTab('details')}>Details</button>
          <button type="button" className={'ea-section-tab' + (tab === 'permissions' ? ' ea-section-tab--active' : '')} onClick={() => setTab('permissions')}>Permissions</button>
          <button type="button" className={'ea-section-tab' + (tab === 'history' ? ' ea-section-tab--active' : '')} onClick={() => setTab('history')}>Activity</button>
        </div>
        {tab === 'details' && (
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>User ID</dt>
              <dd className="ea-mono" style={{ fontSize: 13 }}>{user.userId}</dd></div>
            <div className="ea-def-row"><dt>Username</dt>
              <dd className="ea-mono">{user.username}</dd></div>
            <div className="ea-def-row"><dt>Display name</dt><dd>{user.displayName}</dd></div>
            <div className="ea-def-row"><dt>DHIS2 mapping</dt>
              <dd><span className="ea-chip ea-chip--neutral">Unmapped</span></dd></div>
          </dl>
        )}
        {tab === 'permissions' && (
          <ul style={{ listStyle: 'none', padding: 10, margin: 0, fontSize: 14 }}>
            {user.roles.includes('ADMIN') && <li style={{ padding: '4px 0' }}>• Manage users, apps, settings, sync, recovery</li>}
            {user.roles.includes('OPERATOR') && <li style={{ padding: '4px 0' }}>• Capture aggregate / event / tracker data</li>}
            {user.roles.includes('REVIEWER') && <li style={{ padding: '4px 0' }}>• Review approvals and conflicts</li>}
          </ul>
        )}
        {tab === 'history' && (
          <p className="ea-text-muted" style={{ margin: 10, fontSize: 14 }}>
            Per-user activity not yet exposed on this edge.
          </p>
        )}
      </section>
    </div>
  );
}

function initials(s: string): string {
  const parts = s.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
export { fmtDate, Dot };
