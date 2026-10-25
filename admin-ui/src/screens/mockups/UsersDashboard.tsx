import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { KpiTile, Panel, SplitWithDrawer, Dot, fmtDate, useOuContext, usePaged, TablePager } from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** DER Users Dashboard — matches docs/media/ui/DER Users Dashboard Overview.png */
export function MockupUsersDashboard(): JSX.Element {
  const [ctx] = useOuContext();
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

  const total = users.length;
  const pendingMapping = users.length;
  const authIssues = 0;

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Users &amp; Access</div>
          <h1 className="ea-dash-hero-title">Users</h1>
          <p className="ea-dash-hero-sub">Operators and administrators provisioned on this edge.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ea-btn ea-btn--ghost">Import</button>
          <Link to="/provisioning/users/new" className="ea-btn ea-btn--primary">+ Add User</Link>
        </div>
      </section>

      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconUsers />}
                 label="Total DER Users" value={total} />
        <KpiTile tone="success" icon={<IconCheck />}
                 label="Active Users" value={total}
                 caption="all signed-in capable" />
        <KpiTile tone="warning" icon={<IconLink />}
                 label="Pending Mapping" value={pendingMapping}
                 caption="unmapped to DHIS2" />
        <KpiTile tone={authIssues > 0 ? 'danger' : 'success'} icon={<IconShield />}
                 label="Authentication Issues" value={authIssues} />
      </div>

      <section className="ea-ou-bar">
        <div className="ea-ou-bar-left">
          <span className="ea-ou-bar-label">Single synchronised organisation unit</span>
          <div className="ea-ou-crumbs">
            <span className="ea-ou-crumb ea-ou-crumb--active">{ctx.facility}</span>
            {ctx.bound && <span className="ea-text-muted">bound</span>}
          </div>
        </div>
        <div>
          <Link to="/integration/organisation-unit" className="ea-link-btn">Change</Link>
        </div>
      </section>

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`Users (${total})`}
                 action={
                   <input className="ea-input" style={{ maxWidth: 240 }} type="search"
                          placeholder="Search by name or username"
                          value={query} onChange={(e) => setQuery(e.target.value)} />
                 }>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr>
                  <th>User</th><th>DER User ID</th><th>Organisation Unit</th><th>Central DHIS2 User</th>
                  <th>Mapping Status</th><th>Sync Status</th><th>Last Login</th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((u) => (
                    <tr key={u.userId} className={sel?.userId === u.userId ? 'ea-row--active' : ''}
                        onClick={() => setSel(u)}>
                      <td>
                        <div className="ea-user-cell">
                          <span className="ea-user-cell-avatar" aria-hidden="true">
                            {initials(u.displayName || u.username)}
                          </span>
                          <span>
                            <div className="ea-user-cell-name">{u.displayName}</div>
                            <div className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>{u.username}</div>
                          </span>
                        </div>
                      </td>
                      <td className="ea-mono">{u.userId.slice(0, 8)}…</td>
                      <td>{ctx.facility}</td>
                      <td className="ea-text-muted">— unmapped —</td>
                      <td><span className="ea-chip ea-chip--warning">Pending</span></td>
                      <td><Dot tone="muted" /> idle</td>
                      <td className="ea-mono">—</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>No users to show.</td></tr>
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
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{user.displayName}</h3>
          <div className="ea-text-muted" style={{ fontSize: 12 }}>{user.roles.join(' · ')}</div>
        </div>
      </div>
      <div className="ea-section-tabs" style={{ marginTop: 12, marginBottom: 0 }}>
        <button type="button" className={'ea-section-tab' + (tab === 'details' ? ' ea-section-tab--active' : '')} onClick={() => setTab('details')}>Details</button>
        <button type="button" className={'ea-section-tab' + (tab === 'permissions' ? ' ea-section-tab--active' : '')} onClick={() => setTab('permissions')}>Permissions</button>
        <button type="button" className={'ea-section-tab' + (tab === 'history' ? ' ea-section-tab--active' : '')} onClick={() => setTab('history')}>Sync History</button>
      </div>
      {tab === 'details' && (
        <>
          <h4 style={{ margin: '8px 0 4px', fontSize: 12, color: 'var(--der-ink-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DER Information</h4>
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>User ID</dt><dd className="ea-mono">{user.userId}</dd></div>
            <div className="ea-def-row"><dt>Username</dt><dd className="ea-mono">{user.username}</dd></div>
            <div className="ea-def-row"><dt>Display Name</dt><dd>{user.displayName}</dd></div>
            <div className="ea-def-row"><dt>Roles</dt><dd>{user.roles.map((r) => <span key={r} className="ea-chip ea-chip--primary">{r}</span>)}</dd></div>
          </dl>
          <h4 style={{ margin: '12px 0 4px', fontSize: 12, color: 'var(--der-ink-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Central DHIS2</h4>
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Mapping</dt><dd><span className="ea-chip ea-chip--warning">Unmapped</span></dd></div>
            <div className="ea-def-row"><dt>DHIS2 User</dt><dd className="ea-text-muted">—</dd></div>
          </dl>
        </>
      )}
      {tab === 'permissions' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {user.roles.includes('ADMIN') && <li>• Manage users, apps, settings, sync, recovery</li>}
          {user.roles.includes('OPERATOR') && <li>• Capture aggregate / event / tracker data</li>}
          {user.roles.includes('REVIEWER') && <li>• Review approvals and conflicts</li>}
        </ul>
      )}
      {tab === 'history' && (
        <p className="ea-text-muted" style={{ margin: 0 }}>No per-user sync history available yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <button type="button" className="ea-btn ea-btn--primary">Validate Mapping</button>
        <button type="button" className="ea-btn ea-btn--ghost">Reset Login</button>
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
function IconUsers(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6" /></svg>); }
function IconCheck(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>); }
function IconLink(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14l-3 3a4 4 0 11-5.7-5.7l3-3M14 10l3-3a4 4 0 115.7 5.7l-3 3M8 16l8-8" /></svg>); }
function IconShield(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 10-4.8-1.7-8-5.5-8-10V6l8-3z" /></svg>); }
export { fmtDate };
