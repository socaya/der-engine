import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, Dot, fmtDate, usePaged, TablePager,
  SyncStatusBar, humaniseState, RowMenu, BackLink, ScopedFilterChip,
} from './shared';
import { UiIcon } from '../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { Dhis2UserPicker } from '../components/Dhis2UserPicker';

/** `/admin/provisioning/users` — Users dashboard.
 *
 *  Deep-link filters (support cross-module nav from the role catalogue
 *  + DHIS2 mappings screen):
 *    ?role=<ADMIN|OPERATOR|…|custom-role-name>  — filter by role grant
 *    ?mapped=yes|no                             — filter by DHIS2 mapping state
 */
export function MockupUsersDashboard(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleFilter = searchParams.get('role');
  const mappedFilter = searchParams.get('mapped'); // 'yes' | 'no' | null
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  /* Fold the DHIS2 mapping table in so the mapping column reflects
   * live state instead of a hard-coded "Unmapped". Non-fatal: if the
   * mappings endpoint 403s (non-ADMIN session) we just render every
   * row as Unmapped and the "Map DHIS2" action is still available. */
  const [mappings, setMappings] = useState<
    Record<string, edgeApi.EdgeUserDhis2Mapping>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    edgeApi.listUsers().then((r) => setUsers(r.users)).catch(() => undefined);
    edgeApi.listUserDhis2Mappings().then((rows) => {
      const byUser: Record<string, edgeApi.EdgeUserDhis2Mapping> = {};
      for (const r of rows) byUser[r.edgeUserId] = r;
      setMappings(byUser);
    }).catch(() => undefined);
  }, []);

  function clearScopedFilters(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('role');
    next.delete('mapped');
    setSearchParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = users ?? [];
    if (roleFilter) {
      /* Case-insensitive match so both built-in enum keys (ADMIN) and
       * custom role names (e.g. "Clinical nurses") route cleanly. */
      const r = roleFilter.toLowerCase();
      base = base.filter((u) => u.roles.some((x) => x.toLowerCase() === r));
    }
    if (mappedFilter === 'yes') {
      base = base.filter((u) => mappings[u.userId] != null);
    } else if (mappedFilter === 'no') {
      base = base.filter((u) => mappings[u.userId] == null);
    }
    return q ? base.filter((u) => u.username.toLowerCase().includes(q)
      || u.displayName.toLowerCase().includes(q)) : base;
  }, [users, mappings, query, roleFilter, mappedFilter]);

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
          <>
            <Link to="/users/scope"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="users-open-scope">
              <UiIcon icon="activity" size={14} />
              <span>Scope viewer</span>
            </Link>
            <Link to="/access/credentials"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="users-open-credentials">
              <UiIcon icon="qr" size={14} />
              <span>Credentials</span>
            </Link>
            <Link to="/access/sessions"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="users-open-sessions">
              <UiIcon icon="activity" size={14} />
              <span>Sessions</span>
            </Link>
            <Link to="/access/dhis2-mappings"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Access"
                   data-test="users-open-mappings">
              <UiIcon icon="metadata" size={14} />
              <span>DHIS2 mappings</span>
            </Link>
            <Link to="/provisioning/users/new" className="ea-btn ea-btn--primary ea-btn--sm"
                   data-cross-module="Access">
              <UiIcon icon="plus" size={14} />
              <span>Add user</span>
            </Link>
          </>
        }
      />

      {(roleFilter || mappedFilter) && (
        <ScopedFilterChip
          label={[
            roleFilter ? `role = ${roleFilter}` : null,
            mappedFilter === 'yes' ? 'mapped to DHIS2' : null,
            mappedFilter === 'no' ? 'not mapped to DHIS2' : null,
          ].filter(Boolean).join(' · ')}
          openTo={roleFilter ? '/access/roles' : '/access/dhis2-mappings'}
          openLabel={roleFilter ? 'Open roles catalogue' : 'Open DHIS2 mappings'}
          onClear={clearScopedFilters}
        />
      )}

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
                      {(() => {
                        const m = mappings[u.userId];
                        if (m) {
                          return (
                            <span className="ea-chip ea-chip--success"
                                  title={`DHIS2 ${m.dhis2Username} · UID ${m.dhis2UserUid}`}
                                  data-test={`users-mapping-${u.userId}`}>
                              {m.dhis2Username}
                            </span>
                          );
                        }
                        return (
                          <span className="ea-chip ea-chip--warning"
                                title="No DHIS2 mapping — captures attribute as edge-system on Central"
                                data-test={`users-unmapped-${u.userId}`}>
                            Unmapped
                          </span>
                        );
                      })()}
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
                        { label: mappings[u.userId] ? 'Edit DHIS2 mapping' : 'Map DHIS2 user',
                          to: `/provisioning/users/${encodeURIComponent(u.userId)}/dhis2-mapping` },
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
          <Link to={`/provisioning/users/${encodeURIComponent(user.userId)}/dhis2-mapping`}
                className="ea-btn ea-btn--primary"
                data-test="user-detail-open-dhis2-mapping">
            <UiIcon icon="metadata" size={14} />
            <span>DHIS2 mapping</span>
          </Link>
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

/**
 * `/provisioning/users/:userId/dhis2-mapping` — per-user mapping edit.
 *
 * Operators clicking 'Map DHIS2 user' / 'Edit DHIS2 mapping' from a
 * user row land here (nested route under the user they started from)
 * rather than on the global /access/dhis2-mappings list.  BackLink
 * returns them to the user detail; after save, the panel refreshes
 * in-place so the operator can see the updated mapping.
 */
export function MockupUserDhis2Mapping(): JSX.Element {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<edgeApi.ProvisionedUser | null>(null);
  const [mapping, setMapping] =
    useState<edgeApi.EdgeUserDhis2Mapping | null>(null);
  const [draft, setDraft] = useState<{
    uid: string; username: string; displayName: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setErr(null); setNotFound(false);
    Promise.all([
      edgeApi.listUsers(),
      edgeApi.listUserDhis2Mappings(),
    ]).then(([u, m]) => {
      const row = u.users.find((x) => x.userId === userId);
      if (!row) { setNotFound(true); return; }
      setUser(row);
      setMapping(m.find((x) => x.edgeUserId === userId) ?? null);
    }).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [userId]);

  async function save(): Promise<void> {
    if (!draft || !userId) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      const saved = await edgeApi.setUserDhis2Mapping(userId, {
        dhis2UserUid: draft.uid.trim(),
        dhis2Username: draft.username.trim(),
        dhis2DisplayName: draft.displayName.trim() || null,
      });
      setMapping(saved);
      setMsg(`Mapping saved — @${saved.dhis2Username}`);
      setDraft(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  async function clearMapping(): Promise<void> {
    if (!userId || !mapping) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      await edgeApi.clearUserDhis2Mapping(userId);
      setMapping(null);
      setMsg('Mapping cleared.  Captured records will carry no DHIS2 attribution until a new mapping is set.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  function pickCandidate(c: edgeApi.EdgeDhis2UserCandidate | null): void {
    if (c == null) {
      setDraft((prev) => prev ? { uid: '', username: '', displayName: '' } : prev);
      return;
    }
    if (c.id == null || c.username == null) return;
    setDraft({
      uid: c.id,
      username: c.username,
      displayName: c.displayName ?? '',
    });
  }

  if (notFound) {
    return (
      <ErrorBlock title="User not found"
                   testId="err-user-mapping-not-found">
        <span>No user with id <code>{userId}</code> on this edge.</span>
        &nbsp;<Link to="/provisioning/users"
                    data-cross-module="Access">Back to users</Link>.
      </ErrorBlock>
    );
  }
  if (err && !user) {
    return <ErrorBlock title="DHIS2 mapping load failed"
                        testId="err-user-mapping">{err}</ErrorBlock>;
  }
  if (!user) return <LoadingBlock testId="loading" />;

  const mapped = mapping != null;
  return (
    <div className="ea-screen" data-test="user-dhis2-mapping">
      <BackLink to={`/provisioning/users/${encodeURIComponent(user.userId)}`}
                label="Back to user detail" />

      <SyncStatusBar
        tone={mapped ? 'success' : 'warning'}
        title={`DHIS2 mapping — ${user.displayName}`}
        statusLabel={mapped ? `Mapped to @${mapping!.dhis2Username}` : 'Unmapped'}
        subtitle={
          <>
            <span>ADR-0032 attribution: every record this user captures
              carries the mapped DHIS2 user&apos;s uid as <code>storedBy</code>
              on publish.  Unmapped users can capture locally but their
              records will not be attributed on central.</span>
          </>
        }
        actions={
          <>
            <Link to="/access/dhis2-mappings"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="user-dhis2-mapping-open-list">
              <UiIcon icon="metadata" size={14} />
              <span>All mappings</span>
            </Link>
            {!draft && (
              <button type="button"
                      className="ea-btn ea-btn--primary ea-btn--sm"
                      data-test="user-dhis2-mapping-edit"
                      onClick={() => setDraft({
                        uid: mapping?.dhis2UserUid ?? '',
                        username: mapping?.dhis2Username ?? user.username,
                        displayName: mapping?.dhis2DisplayName ?? user.displayName ?? '',
                      })}>
                <UiIcon icon="edit" size={14} />
                <span>{mapped ? 'Edit mapping' : 'Map DHIS2 user'}</span>
              </button>
            )}
          </>
        }
      />

      {msg && (
        <div className="ea-callout ea-callout--success"
             data-test="user-dhis2-mapping-msg" role="status">{msg}</div>
      )}
      {err && (
        <ErrorBlock title="Mapping action failed"
                     testId="err-user-mapping-action">{err}</ErrorBlock>
      )}

      <Panel title="Edge user">
        <dl className="ea-def-list" data-test="user-dhis2-mapping-edge">
          <div className="ea-def-row">
            <dt>Display name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Username</dt>
            <dd className="ea-mono">{user.username}</dd>
          </div>
          <div className="ea-def-row">
            <dt>User ID</dt>
            <dd className="ea-mono" style={{ fontSize: 13 }}>{user.userId}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="DHIS2 mapping"
             action={
               mapped && !draft && (
                 <div style={{ display: 'flex', gap: 8 }}>
                   <button type="button"
                           className="ea-btn ea-btn--ghost ea-btn--sm"
                           data-test="user-dhis2-mapping-edit-panel"
                           onClick={() => setDraft({
                             uid: mapping!.dhis2UserUid,
                             username: mapping!.dhis2Username,
                             displayName: mapping!.dhis2DisplayName ?? '',
                           })}>
                     <UiIcon icon="edit" size={14} />
                     <span>Edit mapping</span>
                   </button>
                   <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                         data-test="user-dhis2-mapping-clear"
                         disabled={saving}
                         onClick={() => {
                           if (window.confirm(
                             `Clear the DHIS2 mapping for @${user.username}?\n\n`
                             + 'Future captured records will carry no central attribution until a new mapping is set.')) {
                             void clearMapping();
                           }
                         }}>
                     Clear mapping
                   </button>
                 </div>
               )
             }>
        {!mapped && !draft && (
          <div data-test="user-dhis2-mapping-empty"
               className="ea-mapping-empty">
            <p className="ea-text-muted ea-mapping-empty-copy">
              No DHIS2 user is mapped to this edge user yet.  Pick a
              DHIS2 Central user to attribute records this operator
              captures.
            </p>
            <button type="button"
                    className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="user-dhis2-mapping-add"
                    onClick={() => setDraft({
                      uid: '', username: '', displayName: '',
                    })}>
              <UiIcon icon="plus" size={14} />
              <span>Add mapping</span>
            </button>
          </div>
        )}
        {mapped && !draft && (
          <dl className="ea-def-list" data-test="user-dhis2-mapping-current">
            <div className="ea-def-row">
              <dt>DHIS2 username</dt>
              <dd className="ea-mono">{mapping!.dhis2Username}</dd>
            </div>
            <div className="ea-def-row">
              <dt>DHIS2 uid</dt>
              <dd className="ea-mono">{mapping!.dhis2UserUid}</dd>
            </div>
            <div className="ea-def-row">
              <dt>DHIS2 display name</dt>
              <dd>{mapping!.dhis2DisplayName ?? '—'}</dd>
            </div>
            <div className="ea-def-row">
              <dt>Mapped at</dt>
              <dd className="ea-mono">
                {new Date(mapping!.mappedAt).toLocaleString()}
              </dd>
            </div>
            <div className="ea-def-row">
              <dt>Last verified</dt>
              <dd className="ea-mono">
                {mapping!.lastVerifiedAt
                  ? new Date(mapping!.lastVerifiedAt).toLocaleString()
                  : 'Never'}
              </dd>
            </div>
          </dl>
        )}
        {draft && (
          <div data-test="user-dhis2-mapping-form"
               className="ea-mapping-form">
            <div className="ea-field">
              <label className="ea-field-label"
                     htmlFor="user-dhis2-mapping-picker-input">
                DHIS2 Central user
              </label>
              <Dhis2UserPicker
                dataTest="user-dhis2-mapping-picker"
                value={draft.uid || null}
                selectedLabel={draft.uid
                  ? `@${draft.username}${draft.displayName ? ' — ' + draft.displayName : ''}`
                  : null}
                onChange={pickCandidate}
              />
              <span className="ea-field-hint">
                Backed by <code>GET /api/users</code> on the bound
                DHIS2 central.  If search fails you can paste the uid
                below.
              </span>
            </div>

            <dl className="ea-def-list" data-test="user-dhis2-mapping-chosen">
              <div className="ea-def-row">
                <dt>DHIS2 uid</dt>
                <dd>
                  <input type="text"
                         aria-label="DHIS2 uid"
                         data-test="user-dhis2-mapping-input-uid"
                         className="ea-input ea-mono"
                         value={draft.uid}
                         placeholder="Pick above, or paste an 11-char uid"
                         onChange={(e) => setDraft({ ...draft, uid: e.target.value })} />
                </dd>
              </div>
              <div className="ea-def-row">
                <dt>DHIS2 username</dt>
                <dd>
                  <input type="text"
                         aria-label="DHIS2 username"
                         data-test="user-dhis2-mapping-input-username"
                         className="ea-input"
                         value={draft.username}
                         onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
                </dd>
              </div>
              <div className="ea-def-row">
                <dt>DHIS2 display name</dt>
                <dd>
                  <input type="text"
                         aria-label="DHIS2 display name"
                         data-test="user-dhis2-mapping-input-display-name"
                         className="ea-input"
                         value={draft.displayName}
                         placeholder="optional"
                         onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
                </dd>
              </div>
            </dl>

            <div className="ea-mapping-form-actions">
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test="user-dhis2-mapping-cancel"
                      disabled={saving}
                      onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="button"
                      className="ea-btn ea-btn--primary ea-btn--sm"
                      data-test="user-dhis2-mapping-save"
                      disabled={saving
                        || draft.uid.trim().length === 0
                        || draft.username.trim().length === 0}
                      onClick={() => { void save(); }}>
                {saving ? 'Saving…' : 'Save mapping'}
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export { fmtDate, Dot };
