import { useCallback, useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { ScreenHeader } from '../components/ScreenHeader';

/** Admin UI for the composite-kind catalogue (spec §4 / §3.4).
 *  Admins register composite kinds (Lab Request, Prescription,
 *  Care Episode, or any facility-specific composite semantic)
 *  and bind each to the DHIS2 program stages whose data elements
 *  drive the head + line-item forms in the Capture app.
 *
 *  Scope of this screen:
 *  - List every registered kind with its stage bindings, sync
 *    policy, and configuration-complete flag.
 *  - Inline-edit displayName, description, stage UIDs, sync
 *    policy; Save per row.
 *  - + New kind at the top of the panel (code + displayName +
 *    stages all at once; subsequent edits use the inline row
 *    form).
 *  - Soft-delete via a Delete button per row (confirm dialog).
 *
 *  Stage UIDs are plain text inputs for this slice — the admin
 *  copy-pastes from the metadata mirror page. A future refinement
 *  can swap them for a stage-picker dropdown once we have a
 *  generic metadata-stage selector in the admin shell. */
export function CompositeKindCatalogue(): JSX.Element {
  const [kinds, setKinds] = useState<
    ReadonlyArray<edgeApi.CompositeKindRow>>([]);
  const [draft, setDraft] = useState<Record<string, {
    displayName: string; description: string;
    headProgramStageUid: string; itemProgramStageUid: string;
    syncPolicy: 'EDGE_ONLY' | 'EXPORTABLE';
  }>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  // + New kind form state
  const [newCode, setNewCode] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newHeadStage, setNewHeadStage] = useState('');
  const [newItemStage, setNewItemStage] = useState('');

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true); setErr(null);
    try {
      const rows = await edgeApi.listCompositeKinds();
      setKinds(rows);
      const next: typeof draft = {};
      for (const r of rows) {
        next[r.kindCode] = {
          displayName: r.displayName,
          description: r.description ?? '',
          headProgramStageUid: r.headProgramStageUid ?? '',
          itemProgramStageUid: r.itemProgramStageUid ?? '',
          syncPolicy: r.syncPolicy,
        };
      }
      setDraft(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload().catch(() => undefined); }, [reload]);

  function patchDraft(code: string,
    patch: Partial<typeof draft[string]>): void {
    setDraft((prev) => ({
      ...prev,
      [code]: { ...prev[code], ...patch } as typeof draft[string],
    }));
  }

  async function saveOne(code: string): Promise<void> {
    const d = draft[code];
    if (!d) return;
    setActionBusy('save:' + code);
    setActionMsg(null); setErr(null);
    try {
      const res = await edgeApi.upsertCompositeKind(code, {
        displayName: d.displayName,
        description: d.description.trim() === ''
          ? null : d.description,
        headProgramStageUid: d.headProgramStageUid.trim() === ''
          ? null : d.headProgramStageUid.trim(),
        itemProgramStageUid: d.itemProgramStageUid.trim() === ''
          ? null : d.itemProgramStageUid.trim(),
        syncPolicy: d.syncPolicy,
      });
      setActionMsg(`${res.displayName} saved`
        + (res.configurationComplete
          ? ' · configuration complete'
          : ' · head stage still unset'));
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setActionBusy(null); }
  }

  async function deleteOne(code: string): Promise<void> {
    const confirmed = window.confirm(
        `Soft-delete composite kind "${code}"? Existing composites `
      + 'of this kind keep their data but the kind no longer '
      + 'appears in the Capture app.');
    if (!confirmed) return;
    setActionBusy('del:' + code);
    setActionMsg(null); setErr(null);
    try {
      await edgeApi.deleteCompositeKind(code);
      setActionMsg(`${code} soft-deleted`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setActionBusy(null); }
  }

  async function createKind(): Promise<void> {
    const code = newCode.trim();
    const name = newDisplayName.trim();
    if (code === '' || name === '') {
      setErr('kind_code and displayName are required');
      return;
    }
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(code)) {
      setErr('kind_code must be uppercase A-Z/0-9/_ '
        + '(start with a letter, max 64 chars)');
      return;
    }
    setActionBusy('create'); setActionMsg(null); setErr(null);
    try {
      await edgeApi.upsertCompositeKind(code, {
        displayName: name,
        headProgramStageUid: newHeadStage.trim() === ''
          ? null : newHeadStage.trim(),
        itemProgramStageUid: newItemStage.trim() === ''
          ? null : newItemStage.trim(),
        syncPolicy: 'EDGE_ONLY',
      });
      setActionMsg(`${name} (${code}) registered`);
      setNewCode(''); setNewDisplayName('');
      setNewHeadStage(''); setNewItemStage('');
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setActionBusy(null); }
  }

  if (loading && kinds.length === 0) {
    return <LoadingBlock testId="compkinds-loading" />;
  }
  if (err && kinds.length === 0) {
    return (
      <ErrorBlock testId="compkinds-err"
                   title="Could not load composite kinds">
        {err}
      </ErrorBlock>
    );
  }

  return (
    <div className="ea-screen" data-test="compkinds-screen">
      <ScreenHeader
        title="Composite kind catalogue"
        subtitle="Register DER_DOMAIN composite kinds and bind each to the DHIS2 program stages that drive their capture forms." />

      {(actionMsg || err) && (
        <div className={`ea-callout ea-callout--${err ? 'danger' : 'success'}`}
             role={err ? 'alert' : 'status'}
             data-test="compkinds-status"
             style={{ marginBottom: 12 }}>
          {err ?? actionMsg}
        </div>
      )}

      <Panel title="Register a new kind"
             action={
               <button type="button"
                       className="ea-btn ea-btn--ghost ea-btn--sm"
                       data-test="compkinds-refresh"
                       onClick={() => { void reload(); }}
                       disabled={loading}>
                 {loading ? 'Refreshing…' : 'Refresh'}
               </button>
             }>
        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) auto',
          gap: 10, alignItems: 'end' }}>
          <LabeledInput label="kind_code"
                         value={newCode}
                         testId="compkinds-new-code"
                         placeholder="e.g. PRESCRIPTION"
                         onChange={setNewCode} />
          <LabeledInput label="Display name"
                         value={newDisplayName}
                         testId="compkinds-new-name"
                         placeholder="e.g. Prescription"
                         onChange={setNewDisplayName} />
          <LabeledInput label="Head stage UID (optional)"
                         value={newHeadStage}
                         testId="compkinds-new-head"
                         placeholder="11-char program stage UID"
                         onChange={setNewHeadStage} />
          <LabeledInput label="Item stage UID (optional)"
                         value={newItemStage}
                         testId="compkinds-new-item"
                         placeholder="11-char program stage UID"
                         onChange={setNewItemStage} />
          <button type="button"
                  className="ea-btn ea-btn--primary"
                  data-test="compkinds-new-create"
                  disabled={actionBusy !== null}
                  onClick={() => { void createKind(); }}>
            {actionBusy === 'create' ? 'Registering…' : 'Register'}
          </button>
        </div>
      </Panel>

      <Panel title={`Registered kinds (${kinds.length})`}>
        {kinds.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}
             data-test="compkinds-empty">
            No composite kinds registered yet. Use the form above
            to add one.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="compkinds-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Display + description</th>
                  <th>Head stage</th>
                  <th>Item stage</th>
                  <th>Sync policy</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kinds.map((k) => {
                  const d = draft[k.kindCode] ?? {
                    displayName: '', description: '',
                    headProgramStageUid: '', itemProgramStageUid: '',
                    syncPolicy: 'EDGE_ONLY' as const };
                  const dirty = d.displayName !== k.displayName
                    || d.description !== (k.description ?? '')
                    || d.headProgramStageUid
                      !== (k.headProgramStageUid ?? '')
                    || d.itemProgramStageUid
                      !== (k.itemProgramStageUid ?? '')
                    || d.syncPolicy !== k.syncPolicy;
                  const savingBusy = actionBusy === 'save:' + k.kindCode;
                  const delBusy = actionBusy === 'del:' + k.kindCode;
                  return (
                    <tr key={k.kindCode}
                        data-test={`compkinds-row-${k.kindCode}`}
                        style={{ verticalAlign: 'top' }}>
                      <td>
                        <code className="ea-mono">
                          {k.kindCode}
                        </code>
                        <div style={{ marginTop: 4 }}>
                          {k.configurationComplete ? (
                            <span className="ea-chip ea-chip--success"
                                  data-test={`compkinds-chip-${k.kindCode}`}>
                              configured
                            </span>
                          ) : (
                            <span className="ea-chip ea-chip--warning"
                                  data-test={`compkinds-chip-${k.kindCode}`}
                                  title="No head stage bound — Capture app can't offer this kind.">
                              unconfigured
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <input type="text"
                               className="ea-input"
                               data-test={`compkinds-name-${k.kindCode}`}
                               value={d.displayName}
                               onChange={(e) => patchDraft(k.kindCode,
                                 { displayName: e.target.value })}
                               style={{ width: '100%',
                                         marginBottom: 4 }} />
                        <textarea
                               className="ea-input"
                               data-test={`compkinds-desc-${k.kindCode}`}
                               value={d.description}
                               placeholder="Description (optional)"
                               rows={2}
                               onChange={(e) => patchDraft(k.kindCode,
                                 { description: e.target.value })}
                               style={{ width: '100%',
                                         fontSize: 12,
                                         resize: 'vertical' }} />
                      </td>
                      <td>
                        <input type="text"
                               className="ea-input ea-mono"
                               data-test={`compkinds-head-${k.kindCode}`}
                               value={d.headProgramStageUid}
                               placeholder="program stage UID"
                               onChange={(e) => patchDraft(k.kindCode,
                                 { headProgramStageUid: e.target.value })}
                               style={{ width: '100%',
                                         fontSize: 12 }} />
                      </td>
                      <td>
                        <input type="text"
                               className="ea-input ea-mono"
                               data-test={`compkinds-item-${k.kindCode}`}
                               value={d.itemProgramStageUid}
                               placeholder="program stage UID"
                               onChange={(e) => patchDraft(k.kindCode,
                                 { itemProgramStageUid: e.target.value })}
                               style={{ width: '100%',
                                         fontSize: 12 }} />
                      </td>
                      <td>
                        <select className="ea-input"
                                data-test={`compkinds-sync-${k.kindCode}`}
                                value={d.syncPolicy}
                                onChange={(e) => {
                                  const v = e.target.value as
                                    ('EDGE_ONLY' | 'EXPORTABLE');
                                  patchDraft(k.kindCode,
                                    { syncPolicy: v });
                                }}
                                style={{ width: '100%' }}>
                          <option value="EDGE_ONLY">EDGE_ONLY</option>
                          <option value="EXPORTABLE">EXPORTABLE</option>
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button"
                                className="ea-btn ea-btn--primary ea-btn--sm"
                                data-test={`compkinds-save-${k.kindCode}`}
                                disabled={!dirty
                                  || actionBusy !== null}
                                onClick={() => { void saveOne(
                                  k.kindCode); }}>
                          {savingBusy ? 'Saving…' : 'Save'}
                        </button>
                        {' '}
                        <button type="button"
                                className="ea-btn ea-btn--danger ea-btn--ghost ea-btn--sm"
                                data-test={`compkinds-del-${k.kindCode}`}
                                disabled={actionBusy !== null}
                                onClick={() => { void deleteOne(
                                  k.kindCode); }}>
                          {delBusy ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder,
  testId }: {
  label: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string; testId?: string;
}): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column',
                     gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--der-text-muted, #5b6478)' }}>
        {label}
      </span>
      <input type="text"
             className="ea-input"
             data-test={testId}
             value={value}
             placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
