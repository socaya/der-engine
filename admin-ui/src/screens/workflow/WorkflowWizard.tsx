import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import * as md from './wizardMetadata';
import type {
  Breakable, FieldCandidate, MetadataOption, WizardWorkflowType,
} from './wizardMetadata';

/**
 * Three-step guided workflow authoring. Operators pick what they want
 * to capture by name — never a UID, never an enum, never JSON.
 *
 * Step 1 — Type: Aggregate / Event / Tracker.
 * Step 2 — What: searchable list of DataSets or Programs by name.
 * Step 3 — Who: sections / stages of the chosen metadata as rows,
 *   each with include-checkbox + device picker. Order of inclusion
 *   becomes the capture order (linear dependency chain).
 */

export interface WorkflowWizardProps {
  api?: Pick<typeof edgeApi, 'saveWorkflow' | 'listDevices' | 'getWorkflow'>;
  /** Pass to edit an existing workflow. Omitted → new workflow mode. */
  workflowId?: string;
}

type Stage = 1 | 2 | 3;

type FieldReq = 'REQUIRED' | 'OPTIONAL';

interface StepRow {
  breakable: Breakable;
  included: boolean;
  ownerDeviceId: string | null;
  ownerRole: 'OPERATOR' | 'REVIEWER' | 'ADMIN';
  /** `null` until the operator expands the row — avoids a fetch per
   *  stage on page load (programs with 50 stages → 50 fetches). */
  fieldCandidates: FieldCandidate[] | null;
  /** Per-field include + requirement. Keyed by field UID. */
  fieldSelection: Record<string, { included: boolean; requirement: FieldReq }>;
  expanded: boolean;
}

export function WorkflowWizard({ api = edgeApi, workflowId }:
    WorkflowWizardProps = {}): JSX.Element {
  const navigate = useNavigate();
  const editing = workflowId != null && workflowId !== 'new';
  const [stage, setStage] = useState<Stage>(editing ? 3 : 1);
  const [loadingExisting, setLoadingExisting] = useState(editing);
  const [wizardIncompatible, setWizardIncompatible] = useState(false);

  // Step 1 — type
  const [type, setType] = useState<WizardWorkflowType | null>(null);

  // Step 2 — what
  const [name, setName] = useState('');
  const [metadataOptions, setMetadataOptions] = useState<MetadataOption[] | null>(null);
  const [metadataSearch, setMetadataSearch] = useState('');
  const [chosenMetadata, setChosenMetadata] = useState<MetadataOption | null>(null);

  // Step 3 — who
  const [breakables, setBreakables] = useState<Breakable[] | null>(null);
  const [rows, setRows] = useState<StepRow[]>([]);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);

  // §37–§42 — metadata snapshot pinning (edit mode only).
  const [snapshots, setSnapshots] = useState<edgeApi.MetadataSnapshot[]>([]);
  const [pinnedSnapshotId, setPinnedSnapshotId] = useState<number | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load devices once — needed on step 3.
  useEffect(() => {
    api.listDevices().then((d) => setDevices(d.devices ?? [])).catch(() => undefined);
  }, [api]);

  // Edit mode — load snapshots + current pin so we can offer the
  // picker on step 3.
  useEffect(() => {
    if (!editing || workflowId == null) return;
    edgeApi.listSnapshots()
      .then((r) => setSnapshots(r.snapshots))
      .catch(() => undefined);
    edgeApi.getWorkflowPin(workflowId)
      .then((r) => setPinnedSnapshotId(r.snapshotId))
      .catch(() => undefined);
  }, [editing, workflowId]);

  // Edit mode — pre-fill the wizard from an existing workflow.
  useEffect(() => {
    if (!editing || workflowId == null) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const w = await api.getWorkflow(workflowId);
        if (!md.isWizardCompatible(w)) {
          if (!cancelled) {
            setWizardIncompatible(true);
            setLoadingExisting(false);
          }
          return;
        }
        const detected = await md.detectWorkflowType(
          w.boundMetadataKind, w.boundMetadataId);
        if (cancelled) return;
        setType(detected.type);
        setChosenMetadata(detected.metadata);
        setName(w.displayName);
        const bs = detected.type === 'AGGREGATE'
          ? await md.listDataSetSections(w.boundMetadataId)
          : detected.type === 'EVENT'
            ? [{ id: w.boundMetadataId, displayName: 'Whole event',
                 sectionKind: 'EVENT_INSTANCE' as const }]
            : await md.listProgramStages(w.boundMetadataId);
        if (cancelled) return;
        setBreakables(bs);
        // Pre-tick + preserve role/device from existing steps.
        const bySectionRef = new Map(w.steps
          .filter((s) => s.sectionRef)
          .map((s) => [s.sectionRef, s] as const));
        const prefilled: StepRow[] = bs.map((b) => {
          const existing = bySectionRef.get(b.id);
          const selection: Record<string, { included: boolean; requirement: FieldReq }> = {};
          existing?.fields?.forEach((f) => {
            selection[f.fieldRef] = {
              included: true,
              requirement: f.requirement === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL',
            };
          });
          return {
            breakable: b,
            included: existing != null,
            ownerRole: (existing?.ownerRole as StepRow['ownerRole']) ?? 'OPERATOR',
            ownerDeviceId: existing?.ownerDeviceId ?? null,
            fieldCandidates: null,
            fieldSelection: selection,
            expanded: false,
          };
        });
        // Breakables the workflow included but the metadata no longer has
        // (metadata changed since the workflow was authored).
        const seenRefs = new Set(bs.map((b) => b.id));
        w.steps.forEach((s) => {
          if (s.sectionRef && !seenRefs.has(s.sectionRef)) {
            const selection: Record<string, { included: boolean; requirement: FieldReq }> = {};
            s.fields?.forEach((f) => {
              selection[f.fieldRef] = {
                included: true,
                requirement: f.requirement === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL',
              };
            });
            prefilled.push({
              breakable: { id: s.sectionRef, displayName: s.displayName
                             + ' (not in current metadata)',
                           sectionKind: (s.sectionKind
                             ?? 'DATASET_SECTION') as Breakable['sectionKind'] },
              included: true,
              ownerRole: (s.ownerRole as StepRow['ownerRole']) ?? 'OPERATOR',
              ownerDeviceId: s.ownerDeviceId ?? null,
              fieldCandidates: null,
              fieldSelection: selection,
              expanded: false,
            });
          }
        });
        setRows(prefilled);
        setLoadingExisting(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
          setLoadingExisting(false);
        }
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api, editing, workflowId]);

  // Load metadata options when entering step 2.
  useEffect(() => {
    if (stage !== 2 || type === null) {
      return;
    }
    setMetadataOptions(null);
    setLoadError(null);
    const loader = type === 'AGGREGATE' ? md.listDataSets()
                  : type === 'EVENT' ? md.listPrograms('EVENT')
                  : md.listPrograms('TRACKER');
    loader
      .then((opts) => setMetadataOptions(opts))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [stage, type]);

  // Load breakables when entering step 3 — only in create mode. Edit
  // mode uses the prefill effect below (loads breakables and matches
  // them against the existing workflow's steps in one atomic update).
  useEffect(() => {
    if (editing) {
      return;
    }
    if (stage !== 3 || type === null || chosenMetadata === null) {
      return;
    }
    setBreakables(null);
    setLoadError(null);
    const loader = type === 'AGGREGATE'
      ? md.listDataSetSections(chosenMetadata.id)
      : type === 'EVENT'
        ? Promise.resolve<Breakable[]>([
            { id: chosenMetadata.id,
              displayName: 'Whole event',
              sectionKind: 'EVENT_INSTANCE' },
          ])
        : md.listProgramStages(chosenMetadata.id);
    loader
      .then((bs) => {
        setBreakables(bs);
        setRows(bs.map((b) => ({
          breakable: b,
          // Default: section-based (small list) → ticked;
          // stage-based (often 50+) → unticked so the operator
          // explicitly picks what to capture.
          included: bs.length <= 6,
          ownerDeviceId: null,
          ownerRole: 'OPERATOR',
          fieldCandidates: null,
          fieldSelection: {},
          expanded: false,
        })));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [stage, type, chosenMetadata]);

  const filteredOptions = useMemo(() => {
    if (metadataOptions == null) return null;
    const q = metadataSearch.trim().toLowerCase();
    if (q === '') return metadataOptions;
    return metadataOptions.filter((o) => o.displayName.toLowerCase().includes(q));
  }, [metadataOptions, metadataSearch]);

  const includedRows = rows.filter((r) => r.included);
  const canSave = stage === 3 && name.trim() !== '' && includedRows.length > 0;

  async function doSave(): Promise<void> {
    if (!canSave || type === null || chosenMetadata === null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = md.buildWorkflowPayload({
        workflowId: editing ? workflowId : undefined,
        displayName: name.trim(),
        type,
        metadata: chosenMetadata,
        steps: includedRows.map((r) => ({
          breakable: r.breakable,
          ownerDeviceId: r.ownerDeviceId,
          ownerRole: r.ownerRole,
          fields: Object.entries(r.fieldSelection)
            .filter(([, s]) => s.included)
            .map(([fieldRef, s]) => ({ fieldRef, requirement: s.requirement })),
        })),
      });
      const saved = await api.saveWorkflow(payload);
      // On create → go to the edit view of the new workflow. On edit
      // → stay here with success toast via /workflows list.
      if (editing) {
        navigate('/workflows');
      } else {
        navigate(`/workflows/${saved.workflowId}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing && loadingExisting) {
    return (
      <div className="ea-screen ea-wizard">
        <LoadingBlock testId="wiz-loading-existing" />
      </div>
    );
  }

  if (editing && wizardIncompatible) {
    return (
      <div className="ea-screen ea-wizard" data-test="wiz-incompat">
        <h1>Edit workflow</h1>
        <ErrorBlock title="This workflow uses advanced options"
                     testId="wiz-incompat-notice">
          It mixes section kinds the guided editor does not model yet.
          Edit it with the advanced designer.
        </ErrorBlock>
        <p>
          <Link to={`/workflows/${workflowId}/advanced`}
                 className="ea-btn ea-btn--primary"
                 data-test="wiz-open-advanced">
            Open advanced designer →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="ea-screen ea-wizard" data-test="wiz-root">
      <h1 data-test="wiz-heading">
        {editing ? `Edit workflow${name ? ': ' + name : ''}` : 'New capture workflow'}
      </h1>
      {editing && (
        <p className="ea-text-muted" data-test="wiz-edit-advanced-hint">
          Prefer raw form?{' '}
          <Link to={`/workflows/${workflowId}/advanced`}
                 data-test="wiz-link-advanced">
            Open advanced designer
          </Link>
          .
        </p>
      )}

      <nav className="ea-wizard-nav" data-test="wiz-nav" aria-label="Wizard steps">
        <StageDot n={1} label="Type" current={stage} />
        <StageDot n={2} label="What" current={stage} />
        <StageDot n={3} label="Who" current={stage} />
      </nav>

      {loadError && <ErrorBlock title="Metadata load failed"
                                 testId="wiz-load-error">{loadError}</ErrorBlock>}

      {stage === 1 && (
        <section data-test="wiz-step-type" className="ea-wizard-step">
          <h2>What are you capturing?</h2>
          <TypeCard current={type} value="AGGREGATE" setValue={setType}
                     title="Aggregate reporting form"
                     subtitle="Monthly or weekly dataset" />
          <TypeCard current={type} value="EVENT" setValue={setType}
                     title="Event program"
                     subtitle="One-off visit, immunisation" />
          <TypeCard current={type} value="TRACKER" setValue={setType}
                     title="Tracker program"
                     subtitle="Patient enrolment + follow-up" />
          <WizardFooter
            onBack={null}
            onNext={() => setStage(2)}
            nextDisabled={type === null}
          />
        </section>
      )}

      {stage === 2 && (
        <section data-test="wiz-step-what" className="ea-wizard-step">
          <h2>Which {typeLabel(type)}?</h2>

          <label className="ea-wizard-field">
            <span>Workflow name</span>
            <input type="text" data-test="wiz-name" value={name}
                    placeholder="e.g. Monthly ANC report"
                    onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="ea-wizard-field">
            <span>Search</span>
            <input type="search" data-test="wiz-search"
                    placeholder={`Filter ${typeLabel(type)}s by name`}
                    value={metadataSearch}
                    onChange={(e) => setMetadataSearch(e.target.value)} />
          </label>

          {filteredOptions == null && <LoadingBlock testId="wiz-metadata-loading" />}
          {filteredOptions && filteredOptions.length === 0 && (
            <p className="ea-text-muted" data-test="wiz-metadata-empty">
              No {typeLabel(type)}s match “{metadataSearch}”.
            </p>
          )}
          {filteredOptions && filteredOptions.length > 0 && (
            <ul className="ea-wizard-picklist" data-test="wiz-metadata-list" role="radiogroup">
              {filteredOptions.map((o) => (
                <li key={o.id}>
                  <label className={'ea-wizard-pickrow'
                    + (chosenMetadata?.id === o.id ? ' is-selected' : '')}>
                    <input type="radio" name="wiz-metadata"
                            data-test={`wiz-metadata-${o.id}`}
                            checked={chosenMetadata?.id === o.id}
                            onChange={() => setChosenMetadata(o)} />
                    <span>{o.displayName}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <WizardFooter
            onBack={() => setStage(1)}
            onNext={() => setStage(3)}
            nextDisabled={chosenMetadata == null || name.trim() === ''}
          />
        </section>
      )}

      {stage === 3 && (
        <section data-test="wiz-step-who" className="ea-wizard-step">
          <h2>Who captures what?</h2>
          <p className="ea-text-muted">
            Tick the parts of “{chosenMetadata?.displayName}” that will be
            captured, assign a device to each, and the order you tick in
            becomes the capture order.
          </p>
          {editing && (
            <label className="ea-wizard-field">
              <span>Workflow name</span>
              <input type="text" data-test="wiz-name" value={name}
                      onChange={(e) => setName(e.target.value)} />
            </label>
          )}

          {editing && snapshots.length > 0 && (
            <div className="ea-wizard-pin-panel" data-test="wiz-pin-panel">
              <label className="ea-wizard-field" style={{ maxWidth: 540 }}>
                <span>Metadata snapshot pin</span>
                <select data-test="wiz-pin-select"
                         value={pinnedSnapshotId == null ? '' : String(pinnedSnapshotId)}
                         disabled={pinSaving}
                         onChange={(e) => {
                           const next = e.target.value === ''
                             ? null
                             : Number(e.target.value);
                           setPinSaving(true);
                           edgeApi.setWorkflowPin(workflowId!, next)
                             .then(() => setPinnedSnapshotId(next))
                             .catch(() => undefined)
                             .finally(() => setPinSaving(false));
                         }}>
                  <option value="">Float with the live mirror</option>
                  {snapshots.map((s) => (
                    <option key={s.snapshotId} value={s.snapshotId}
                             disabled={s.status === 'RETIRED'
                                        && s.snapshotId !== pinnedSnapshotId}>
                      #{s.snapshotId} · {new Date(s.importedAt).toLocaleDateString()}
                      {' · '}{s.counts.programs + s.counts.dataElements} rows
                      {s.status === 'RETIRED' ? ' (retired)' : ''}
                    </option>
                  ))}
                </select>
                <span className="ea-text-muted" style={{ fontSize: 12 }}>
                  {pinnedSnapshotId == null
                    ? 'Workflow floats with the latest metadata — upstream drift may invalidate steps.'
                    : 'Workflow stays locked to this snapshot regardless of upstream drift.'}
                </span>
              </label>
            </div>
          )}

          {breakables == null && <LoadingBlock testId="wiz-breakables-loading" />}
          {breakables && (
            <table className="ea-wizard-rows" data-test="wiz-rows">
              <thead>
                <tr>
                  <th scope="col" aria-label="Expand" style={{ width: 24 }} />
                  <th scope="col">Include</th>
                  <th scope="col">
                    {typeLabel(type) === 'dataset' ? 'Section' : 'Stage'}
                  </th>
                  <th scope="col">Role</th>
                  <th scope="col">Device</th>
                </tr>
              </thead>
              <tbody>
                {rows.flatMap((r, i) => {
                  const summary = fieldSummary(r);
                  return [
                    (
                      <tr key={r.breakable.id} data-test={`wiz-row-${i}`}
                           className={(r.included ? '' : 'is-dim')
                             + (r.breakable.parentId ? ' is-nested' : '')}>
                        <td>
                          <button type="button"
                                   className="ea-icon-btn"
                                   data-test={`wiz-row-${i}-expand`}
                                   disabled={!r.included}
                                   onClick={() => toggleExpand(i)}
                                   aria-label={r.expanded ? 'Collapse fields' : 'Expand fields'}>
                            {r.expanded ? '▾' : '▸'}
                          </button>
                        </td>
                        <td>
                          <input type="checkbox"
                                  data-test={`wiz-row-${i}-include`}
                                  checked={r.included}
                                  onChange={(e) => updateRow(i, { included: e.target.checked })} />
                        </td>
                        <td style={r.breakable.parentId ? { paddingLeft: 32 } : undefined}>
                          <div>
                            {r.breakable.parentId && (
                              <span className="ea-text-muted" style={{ fontSize: 11, marginRight: 6 }}>↳</span>
                            )}
                            {r.breakable.displayName}
                          </div>
                          {summary && (
                            <div className="ea-text-muted" style={{ fontSize: 12 }}
                                  data-test={`wiz-row-${i}-field-summary`}>
                              {summary}
                            </div>
                          )}
                        </td>
                        <td>
                          <select data-test={`wiz-row-${i}-role`}
                                   value={r.ownerRole} disabled={!r.included}
                                   onChange={(e) => updateRow(i,
                                     { ownerRole: e.target.value as StepRow['ownerRole'] })}>
                            <option value="OPERATOR">Capture operator</option>
                            <option value="REVIEWER">Reviewer</option>
                            <option value="ADMIN">Administrator</option>
                          </select>
                        </td>
                        <td>
                          <select data-test={`wiz-row-${i}-device`}
                                   value={r.ownerDeviceId ?? ''}
                                   disabled={!r.included}
                                   onChange={(e) => updateRow(i, {
                                     ownerDeviceId: e.target.value === ''
                                       ? null : e.target.value,
                                   })}>
                            <option value="">— any available device —</option>
                            {devices.map((d) => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.displayName ?? d.deviceId.slice(0, 12)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ),
                    r.expanded && r.included && (
                      <tr key={`${r.breakable.id}-fields`}
                           className="ea-wizard-fields-row"
                           data-test={`wiz-row-${i}-fields`}>
                        <td></td>
                        <td colSpan={4}>
                          {r.fieldCandidates == null ? (
                            <span className="ea-text-muted" style={{ fontSize: 12 }}>
                              Loading fields…
                            </span>
                          ) : r.fieldCandidates.length === 0 ? (
                            <span className="ea-text-muted" style={{ fontSize: 12 }}>
                              No fields found for this breakable in the mirror.
                              Save without selection to capture everything in the section.
                            </span>
                          ) : (
                            <div className="ea-wizard-field-selector">
                              <div className="ea-wizard-field-selector-head">
                                <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                         data-test={`wiz-row-${i}-fields-all`}
                                         onClick={() => bulkSetFieldSelection(i, true)}>
                                  Select all
                                </button>
                                <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                         data-test={`wiz-row-${i}-fields-none`}
                                         onClick={() => bulkSetFieldSelection(i, false)}>
                                  Clear
                                </button>
                              </div>
                              <ul className="ea-wizard-field-list">
                                {r.fieldCandidates.map((f) => {
                                  const sel = r.fieldSelection[f.id];
                                  const included = sel?.included ?? false;
                                  const req = sel?.requirement
                                               ?? (f.compulsory ? 'REQUIRED' : 'OPTIONAL');
                                  return (
                                    <li key={f.id}
                                         data-test={`wiz-row-${i}-field-${f.id}`}>
                                      <label>
                                        <input type="checkbox"
                                                data-test={`wiz-row-${i}-field-${f.id}-include`}
                                                checked={included}
                                                onChange={(e) => updateFieldSelection(i, f.id,
                                                  { included: e.target.checked,
                                                    requirement: req as FieldReq })} />
                                        <span>{f.displayName}</span>
                                        {f.compulsory && (
                                          <span className="ea-pill ea-pill--muted"
                                                 style={{ marginLeft: 6, fontSize: 10 }}>
                                            upstream required
                                          </span>
                                        )}
                                      </label>
                                      {included && (
                                        <select data-test={`wiz-row-${i}-field-${f.id}-req`}
                                                 value={req}
                                                 onChange={(e) => updateFieldSelection(i, f.id,
                                                   { included: true,
                                                     requirement: e.target.value as FieldReq })}>
                                          <option value="REQUIRED">Required</option>
                                          <option value="OPTIONAL">Optional</option>
                                        </select>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })}
              </tbody>
            </table>
          )}

          {saveError && <ErrorBlock title="Save failed"
                                     testId="wiz-save-error">{saveError}</ErrorBlock>}

          <WizardFooter
            onBack={editing ? null : () => setStage(2)}
            onSave={{ onClick: doSave, disabled: !canSave || saving, saving,
                       label: editing ? 'Save changes' : 'Create workflow' }}
          />
        </section>
      )}
    </div>
  );

  function updateRow(ix: number, patch: Partial<StepRow>): void {
    // Functional form — successive rapid updates (e.g. unticking many
    // rows in a row) accumulate correctly instead of overwriting from
    // a stale `rows` closure.
    setRows((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix], ...patch };
      // Mutex between a stage and its sections: ticking the stage
      // unticks any sibling PROGRAM_STAGE_SECTION rows under it;
      // ticking a section unticks the parent stage.
      if (patch.included === true) {
        const b = copy[ix].breakable;
        if (b.sectionKind === 'PROGRAM_STAGE') {
          for (let j = 0; j < copy.length; j++) {
            if (copy[j].breakable.parentId === b.id && copy[j].included) {
              copy[j] = { ...copy[j], included: false };
            }
          }
        } else if (b.sectionKind === 'PROGRAM_STAGE_SECTION' && b.parentId) {
          for (let j = 0; j < copy.length; j++) {
            if (copy[j].breakable.id === b.parentId && copy[j].included) {
              copy[j] = { ...copy[j], included: false };
            }
          }
        }
      }
      return copy;
    });
  }

  function toggleExpand(ix: number): void {
    setRows((prev) => {
      const copy = [...prev];
      const row = copy[ix];
      const willExpand = !row.expanded;
      copy[ix] = { ...row, expanded: willExpand };
      if (willExpand && row.fieldCandidates == null) {
        // Lazy fetch per row — only hit the server when the operator
        // opens the field selector.
        md.listFieldCandidates(row.breakable)
          .then((fields) => setRows((p) => {
            const next = [...p];
            // Preserve any selection the operator pre-set (edit mode).
            const existingSel = next[ix].fieldSelection;
            const seeded: Record<string, { included: boolean; requirement: FieldReq }> = {};
            fields.forEach((f) => {
              seeded[f.id] = existingSel[f.id] ?? {
                included: f.compulsory,
                requirement: f.compulsory ? 'REQUIRED' : 'OPTIONAL',
              };
            });
            // Carry over any pre-set selection whose field is not in
            // the current candidates (metadata drift).
            Object.entries(existingSel).forEach(([k, v]) => {
              if (!(k in seeded)) seeded[k] = v;
            });
            next[ix] = { ...next[ix], fieldCandidates: fields, fieldSelection: seeded };
            return next;
          }))
          .catch(() => setRows((p) => {
            const next = [...p];
            next[ix] = { ...next[ix], fieldCandidates: [] };
            return next;
          }));
      }
      return copy;
    });
  }

  function updateFieldSelection(ix: number, fieldId: string,
                                 next: { included: boolean; requirement: FieldReq }): void {
    setRows((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix],
                    fieldSelection: { ...copy[ix].fieldSelection, [fieldId]: next } };
      return copy;
    });
  }

  function bulkSetFieldSelection(ix: number, selected: boolean): void {
    setRows((prev) => {
      const copy = [...prev];
      const row = copy[ix];
      const candidates = row.fieldCandidates ?? [];
      const next: Record<string, { included: boolean; requirement: FieldReq }> = {};
      candidates.forEach((f) => {
        next[f.id] = {
          included: selected,
          requirement: f.compulsory ? 'REQUIRED' : 'OPTIONAL',
        };
      });
      copy[ix] = { ...row, fieldSelection: next };
      return copy;
    });
  }

  function fieldSummary(row: StepRow): string | null {
    const total = Object.values(row.fieldSelection).filter((s) => s.included).length;
    if (total === 0) return null;
    const req = Object.values(row.fieldSelection)
      .filter((s) => s.included && s.requirement === 'REQUIRED').length;
    return `${total} field${total === 1 ? '' : 's'} · ${req} required`;
  }
}

function StageDot({ n, label, current }:
                   { n: Stage; label: string; current: Stage }): JSX.Element {
  const state = n < current ? 'done' : n === current ? 'active' : 'future';
  return (
    <span className={`ea-wizard-dot is-${state}`} data-test={`wiz-dot-${n}`}>
      <span className="ea-wizard-dot-ring" aria-hidden="true" />
      <span className="ea-wizard-dot-label">{n}. {label}</span>
    </span>
  );
}

function TypeCard({ current, value, setValue, title, subtitle }: {
    current: WizardWorkflowType | null;
    value: WizardWorkflowType;
    setValue: (v: WizardWorkflowType) => void;
    title: string;
    subtitle: string;
}): JSX.Element {
  const selected = current === value;
  return (
    <label className={'ea-wizard-type-card' + (selected ? ' is-selected' : '')}
            data-test={`wiz-type-${value.toLowerCase()}`}>
      <input type="radio" name="wiz-type" value={value}
              checked={selected} onChange={() => setValue(value)} />
      <span className="ea-wizard-type-title">{title}</span>
      <span className="ea-wizard-type-sub">{subtitle}</span>
    </label>
  );
}

function WizardFooter({ onBack, onNext, nextDisabled, onSave }: {
    onBack: null | (() => void);
    onNext?: () => void;
    nextDisabled?: boolean;
    onSave?: { onClick: () => void; disabled: boolean; saving: boolean; label?: string };
}): JSX.Element {
  return (
    <div className="ea-wizard-footer">
      {onBack && (
        <button type="button" className="ea-btn ea-btn--ghost"
                 data-test="wiz-back" onClick={onBack}>← Back</button>
      )}
      <span style={{ flex: 1 }} />
      {onNext && (
        <button type="button" className="ea-btn ea-btn--primary"
                 data-test="wiz-next" onClick={onNext}
                 disabled={nextDisabled}>Next →</button>
      )}
      {onSave && (
        <button type="button" className="ea-btn ea-btn--primary"
                 data-test="wiz-save" onClick={onSave.onClick}
                 disabled={onSave.disabled}>
          {onSave.saving ? 'Saving…' : (onSave.label ?? 'Create workflow')}
        </button>
      )}
    </div>
  );
}

function typeLabel(t: WizardWorkflowType | null): string {
  switch (t) {
    case 'AGGREGATE': return 'dataset';
    case 'EVENT': return 'event program';
    case 'TRACKER': return 'tracker program';
    default: return '';
  }
}
