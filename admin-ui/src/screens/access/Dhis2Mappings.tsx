import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtAgo, SyncStatusBar, confirmThenRun } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

export function Dhis2Mappings(): JSX.Element {
  const [searchParams] = useSearchParams();
  const focusUserId = searchParams.get('user');
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [mappings, setMappings] = useState<
    Record<string, edgeApi.EdgeUserDhis2Mapping>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<
    { edgeUserId: string; uid: string; username: string; displayName: string } | null>(null);
  const [query, setQuery] = useState('');

  async function reload(): Promise<void> {
    try {
      const [u, m] = await Promise.all([
        edgeApi.listUsers(), edgeApi.listUserDhis2Mappings(),
      ]);
      setUsers(u.users);
      const byUser: Record<string, edgeApi.EdgeUserDhis2Mapping> = {};
      for (const row of m) byUser[row.edgeUserId] = row;
      setMappings(byUser);
      // Deep-link: if ?user=<id> is set, pre-open the edit dialog for
      // that user (either an existing mapping or a fresh one).
      if (focusUserId) {
        const user = u.users.find((x) => x.userId === focusUserId);
        if (user) {
          const existing = byUser[focusUserId];
          setEditDraft({
            edgeUserId: user.userId,
            uid: existing?.dhis2UserUid ?? '',
            username: existing?.dhis2Username ?? user.username,
            displayName: existing?.dhis2DisplayName
                           ?? user.displayName ?? '',
          });
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [focusUserId]);

  async function save(): Promise<void> {
    if (!editDraft) return;
    setSavingFor(editDraft.edgeUserId); setErr(null); setMsg(null);
    try {
      await edgeApi.setUserDhis2Mapping(editDraft.edgeUserId, {
        dhis2UserUid: editDraft.uid.trim(),
        dhis2Username: editDraft.username.trim(),
        dhis2DisplayName: editDraft.displayName.trim() || null,
      });
      setMsg(`Mapping saved for @${editDraft.username}.`);
      setEditDraft(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingFor(null); }
  }

  async function clearFor(edgeUserId: string, username: string): Promise<void> {
    setSavingFor(edgeUserId); setErr(null); setMsg(null);
    try {
      await edgeApi.clearUserDhis2Mapping(edgeUserId);
      setMsg(`Mapping cleared for @${username}.`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingFor(null); }
  }

  if (err && !users) {
    return <ErrorBlock title="DHIS2 mappings load failed"
                        testId="err-dhis2-mappings">{err}</ErrorBlock>;
  }
  if (!users) return <LoadingBlock testId="loading" />;

  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) =>
    !q || u.username.toLowerCase().includes(q)
       || (u.displayName ?? '').toLowerCase().includes(q));
  const mappedCount = Object.keys(mappings).length;
  const unmapped = users.length - mappedCount;

  return (
    <div className="ea-screen" data-test="dhis2-mappings">
      <SyncStatusBar
        tone={unmapped > 0 ? 'warning' : 'success'}
        title="DHIS2 user mappings"
        statusLabel={unmapped === 0
          ? 'All users mapped'
          : `${unmapped} unmapped`}
        subtitle={
          <>
            <span>Mapped <strong>{mappedCount}</strong></span>
            <span>·</span>
            <span>Total <strong>{users.length}</strong></span>
          </>
        }
        actions={
          <Link to="/provisioning/users"
                 className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="Access"
                 data-test="dhis2-mappings-open-users">
            <UiIcon icon="edit" size={14} />
            <span>Manage users</span>
          </Link>
        }
      />

      {err && <ErrorBlock title="Mapping change failed"
                            testId="err-dhis2-mappings-save">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="dhis2-mappings-saved">{msg}</p>}

      <Panel title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
             action={
               <input className="ea-input" type="search"
                      style={{ maxWidth: 240 }}
                      placeholder="Search by name or username"
                      value={query}
                      aria-label="Search edge users"
                      data-test="dhis2-mappings-search"
                      onChange={(e) => setQuery(e.target.value)} />
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
             data-test="dhis2-mappings-empty">
            {users.length === 0
              ? 'No edge users provisioned yet.'
              : 'No users match this filter.'}
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Edge user</th>
                <th>DHIS2 UID</th>
                <th>DHIS2 username</th>
                <th>Mapped</th>
                <th style={{ width: 170 }}>
                  <span className="ea-visually-hidden">Actions</span>
                </th>
              </tr></thead>
              <tbody>
                {filtered.map((u) => {
                  const m = mappings[u.userId];
                  const saving = savingFor === u.userId;
                  return (
                    <tr key={u.userId}
                        data-test={`dhis2-mappings-row-${u.username}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {u.displayName || u.username}
                        </div>
                        <div className="ea-text-muted ea-mono"
                             style={{ fontSize: 11 }}>
                          @{u.username}
                        </div>
                      </td>
                      <td className="ea-mono" style={{ fontSize: 12 }}>
                        {m
                          ? m.dhis2UserUid
                          : <span className="ea-chip ea-chip--warning"
                                  data-test={`dhis2-mappings-unmapped-${u.username}`}>
                              Unmapped
                            </span>}
                      </td>
                      <td className="ea-mono" style={{ fontSize: 12 }}>
                        {m ? m.dhis2Username : '—'}
                      </td>
                      <td className="ea-text-muted"
                          style={{ fontSize: 12 }}
                          title={m?.mappedAt}>
                        {m ? fmtAgo(m.mappedAt) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button"
                                  className="ea-btn ea-btn--ghost ea-btn--sm"
                                  disabled={saving}
                                  data-test={`dhis2-mappings-edit-${u.username}`}
                                  onClick={() => setEditDraft({
                                    edgeUserId: u.userId,
                                    uid: m?.dhis2UserUid ?? '',
                                    username: m?.dhis2Username ?? u.username,
                                    displayName: m?.dhis2DisplayName
                                                   ?? u.displayName ?? '',
                                  })}>
                            {m ? 'Edit' : 'Map'}
                          </button>
                          {m && (
                            <button type="button"
                                    className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                                    disabled={saving}
                                    data-test={`dhis2-mappings-clear-${u.username}`}
                                    onClick={() => {
                                      confirmThenRun(
                                        `Clear the DHIS2 mapping for @${u.username}? Future captured records will carry no central attribution until a new mapping is set.`,
                                        () => { clearFor(u.userId, u.username).catch(() => undefined); });
                                    }}>
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Audit"
             action={
               <Link to="/audit/events?eventType=USER_DHIS2_MAPPING_SET"
                      className="ea-link-btn"
                      data-cross-module="Security"
                      data-test="dhis2-mappings-open-audit">
                 View mapping audit →
               </Link>
             }>
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Every save writes <code>USER_DHIS2_MAPPING_SET</code> and every
          clear writes <code>USER_DHIS2_MAPPING_CLEARED</code> to the
          security audit log.
        </p>
      </Panel>

      {editDraft && (
        <div className="ea-modal-overlay"
             data-test="dhis2-mappings-dialog"
             onClick={() => (savingFor ? undefined : setEditDraft(null))}
             style={{ position: 'fixed', inset: 0,
                       background: 'rgba(15,28,46,0.5)',
                       display: 'flex', alignItems: 'center',
                       justifyContent: 'center', zIndex: 1000 }}>
          <div className="ea-modal"
               onClick={(e) => e.stopPropagation()}
               style={{ background: 'var(--der-surface)',
                         border: '1px solid var(--der-border)',
                         padding: 24, maxWidth: 480, width: '90%',
                         boxShadow: 'var(--el-3)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>
              {mappings[editDraft.edgeUserId] ? 'Edit' : 'Map'} DHIS2 user
            </h3>
            <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
              The DHIS2 UID is the 11-char identifier from DHIS2&apos;s
              <code> /api/users</code> endpoint. The username is the
              familiar sign-in handle.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 12 }}>DHIS2 UID (11 chars)
                <input className="ea-input ea-mono"
                       value={editDraft.uid}
                       aria-label="DHIS2 UID"
                       data-test="dhis2-mappings-input-uid"
                       onChange={(e) => setEditDraft(
                         (d) => d && { ...d, uid: e.target.value })} />
              </label>
              <label style={{ fontSize: 12 }}>DHIS2 username
                <input className="ea-input"
                       value={editDraft.username}
                       aria-label="DHIS2 username"
                       data-test="dhis2-mappings-input-username"
                       onChange={(e) => setEditDraft(
                         (d) => d && { ...d, username: e.target.value })} />
              </label>
              <label style={{ fontSize: 12 }}>DHIS2 display name (optional)
                <input className="ea-input"
                       value={editDraft.displayName}
                       aria-label="DHIS2 display name"
                       data-test="dhis2-mappings-input-display"
                       onChange={(e) => setEditDraft(
                         (d) => d && { ...d, displayName: e.target.value })} />
              </label>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8,
                            justifyContent: 'flex-end' }}>
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      disabled={!!savingFor}
                      onClick={() => setEditDraft(null)}>
                Cancel
              </button>
              <button type="button"
                      className="ea-btn ea-btn--primary ea-btn--sm"
                      disabled={!!savingFor
                                  || editDraft.uid.trim().length === 0
                                  || editDraft.username.trim().length === 0}
                      data-test="dhis2-mappings-save"
                      onClick={() => { save().catch(() => undefined); }}>
                {savingFor ? 'Saving…' : 'Save mapping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

