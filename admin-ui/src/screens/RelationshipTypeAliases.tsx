import { useCallback, useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/** Admin alias overrides for relationship types (spec §REL-C-017).
 *
 *  Lists every relationship type the mirror knows about with its
 *  central directional labels alongside admin-editable override
 *  inputs. Overrides are per-edge, survive metadata sync, and
 *  surface transparently in the Capture app the next time the
 *  capture clients fetch the type list.
 *
 *  Scope deliberately minimal — one flat table, inline edit, no
 *  bulk ops; alias configuration is low-volume + one-off per
 *  type, so a dedicated editor would be overkill. */
export function RelationshipTypeAliases(): JSX.Element {
  const [types, setTypes] = useState<
    ReadonlyArray<edgeApi.RelationshipTypeRow>>([]);
  const [draft, setDraft] = useState<Record<string, {
    fromToName: string; toFromName: string;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true); setErr(null);
    try {
      const rows = await edgeApi.listRelationshipTypes();
      setTypes(rows);
      // Reset draft inputs to match server state after reload.
      const next: typeof draft = {};
      for (const r of rows) {
        next[r.relationshipTypeUid] = {
          fromToName: r.adminFromToName ?? '',
          toFromName: r.adminToFromName ?? '',
        };
      }
      setDraft(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload().catch(() => undefined); }, [reload]);

  function updateDraft(uid: string,
    patch: Partial<{ fromToName: string; toFromName: string }>):
      void {
    setDraft((prev) => ({
      ...prev,
      [uid]: { ...prev[uid], ...patch } as {
        fromToName: string; toFromName: string;
      },
    }));
  }

  async function saveOne(uid: string): Promise<void> {
    const d = draft[uid];
    if (!d) return;
    setActionBusy('save:' + uid); setActionMsg(null); setErr(null);
    try {
      const res = await edgeApi.relationshipTypeSetAliases(uid, {
        fromToName: d.fromToName.trim() === '' ? null : d.fromToName,
        toFromName: d.toFromName.trim() === '' ? null : d.toFromName,
      });
      setActionMsg(`alias saved on ${res.displayName}`
        + ` (fromTo: ${res.adminFromToName ?? '—'},`
        + ` toFrom: ${res.adminToFromName ?? '—'})`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setActionBusy(null); }
  }

  async function clearOne(uid: string): Promise<void> {
    setActionBusy('clear:' + uid); setActionMsg(null); setErr(null);
    try {
      const res = await edgeApi.relationshipTypeClearAliases(uid);
      setActionMsg(`alias cleared on ${res.displayName}`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setActionBusy(null); }
  }

  if (loading && types.length === 0) {
    return <LoadingBlock testId="reltypealias-loading" />;
  }
  if (err && types.length === 0) {
    return (
      <ErrorBlock testId="reltypealias-err"
                   title="Could not load relationship types">
        {err}
      </ErrorBlock>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column',
      gap: 16, padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline',
        gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          Relationship type aliases
        </h1>
        <span style={{ color: '#5b6478', fontSize: 13, flex: 1 }}>
          Override directional labels shown in the Capture wizard
          without touching central DHIS2 metadata.
        </span>
        <button type="button"
                data-test="reltypealias-refresh"
                onClick={() => { void reload(); }}
                disabled={loading}
                style={{ padding: '6px 14px', fontSize: 13,
                  background: '#147cd7', color: '#fff',
                  border: 0, borderRadius: 3, cursor: 'pointer' }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {(actionMsg || err) && (
        <div style={{ padding: '10px 14px', borderRadius: 4,
          background: err ? '#fde3e3' : '#e3f7eb',
          color: err ? '#c13030' : '#1b8243',
          fontSize: 13 }}
             data-test="reltypealias-status">
          {err ?? actionMsg}
        </div>
      )}

      <Panel title={`Types (${types.length})`}>
        {types.length === 0 ? (
          <p style={{ color: '#5b6478' }}>
            No relationship types in the mirror. Sync metadata
            first.
          </p>
        ) : (
          <table data-test="reltypealias-table"
                 style={{ width: '100%', borderCollapse: 'collapse',
                   fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left',
                borderBottom: '1px solid #d9dde6' }}>
                <th style={{ padding: '8px 10px' }}>Type</th>
                <th style={{ padding: '8px 10px' }}>Central labels</th>
                <th style={{ padding: '8px 10px' }}>fromToName override</th>
                <th style={{ padding: '8px 10px' }}>toFromName override</th>
                <th style={{ padding: '8px 10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => {
                const d = draft[t.relationshipTypeUid] ?? {
                  fromToName: '', toFromName: '' };
                const dirty =
                  (d.fromToName ?? '') !== (t.adminFromToName ?? '')
                  || (d.toFromName ?? '') !== (t.adminToFromName ?? '');
                const hasOverride =
                  t.adminFromToName !== null
                    && t.adminFromToName !== undefined
                  || t.adminToFromName !== null
                    && t.adminToFromName !== undefined;
                const savingBusy =
                  actionBusy === 'save:' + t.relationshipTypeUid;
                const clearBusy =
                  actionBusy === 'clear:' + t.relationshipTypeUid;
                return (
                  <tr key={t.relationshipTypeUid}
                      style={{ borderBottom: '1px solid #ebeef3' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <strong>{t.displayName}</strong>
                      <div style={{ fontSize: 11, color: '#5b6478',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        marginTop: 2 }}>
                        {t.relationshipTypeUid}
                        {t.bidirectional ? ' · both ways' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px',
                      color: '#5b6478' }}>
                      <div>→ {t.centralFromToName ?? <em>unset</em>}</div>
                      <div>← {t.centralToFromName ?? <em>unset</em>}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input type="text"
                             data-test={`reltypealias-ft-${t.relationshipTypeUid}`}
                             value={d.fromToName}
                             placeholder={t.centralFromToName
                               ?? t.displayName}
                             onChange={(e) => updateDraft(
                               t.relationshipTypeUid,
                               { fromToName: e.target.value })}
                             style={{ width: '100%', fontSize: 13,
                               padding: '4px 8px',
                               border: '1px solid #d9dde6',
                               borderRadius: 3 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input type="text"
                             data-test={`reltypealias-tf-${t.relationshipTypeUid}`}
                             value={d.toFromName}
                             placeholder={t.centralToFromName
                               ?? t.displayName}
                             onChange={(e) => updateDraft(
                               t.relationshipTypeUid,
                               { toFromName: e.target.value })}
                             style={{ width: '100%', fontSize: 13,
                               padding: '4px 8px',
                               border: '1px solid #d9dde6',
                               borderRadius: 3 }} />
                    </td>
                    <td style={{ padding: '8px 10px',
                      whiteSpace: 'nowrap' }}>
                      <button type="button"
                              data-test={`reltypealias-save-${t.relationshipTypeUid}`}
                              disabled={!dirty
                                || actionBusy !== null}
                              onClick={() => { void saveOne(
                                t.relationshipTypeUid); }}
                              style={{ padding: '4px 10px',
                                fontSize: 12,
                                border: '1px solid #147cd7',
                                background: dirty ? '#147cd7'
                                  : '#f8f9fb',
                                color: dirty ? '#fff' : '#9097a8',
                                borderRadius: 3,
                                cursor: dirty
                                  ? 'pointer' : 'default' }}>
                        {savingBusy ? '…' : 'Save'}
                      </button>
                      {' '}
                      <button type="button"
                              data-test={`reltypealias-clear-${t.relationshipTypeUid}`}
                              disabled={!hasOverride
                                || actionBusy !== null}
                              onClick={() => { void clearOne(
                                t.relationshipTypeUid); }}
                              style={{ padding: '4px 10px',
                                fontSize: 12,
                                border: '1px solid #d9dde6',
                                background: '#fff',
                                color: hasOverride
                                  ? '#101a32' : '#9097a8',
                                borderRadius: 3,
                                cursor: hasOverride
                                  ? 'pointer' : 'default' }}>
                        {clearBusy ? '…' : 'Clear'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
