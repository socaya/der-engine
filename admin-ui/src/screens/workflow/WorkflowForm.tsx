import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { HeroHeader } from '../../components/HeroHeader';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import * as md from './wizardMetadata';
import type {
  Breakable, FieldCandidate, MetadataOption, WizardWorkflowType,
} from './wizardMetadata';

type FieldReq = 'REQUIRED' | 'OPTIONAL';

interface StepRow {
  breakable: Breakable;
  included: boolean;
  ownerDeviceId: string | null;
  ownerRole: 'OPERATOR' | 'REVIEWER' | 'ADMIN';
  fieldCandidates: FieldCandidate[] | null;
  fieldSelection: Record<string, { included: boolean; requirement: FieldReq }>;
  expanded: boolean;
}

interface WorkflowLevel {
  enabled: boolean;
  requiresApproval: boolean;
  defaultDeviceId: string | null;
}

interface DepRow {
  fromBreakableId: string;
  toBreakableId: string;
  kind: 'COMPLETES_BEFORE';
}

export interface WorkflowFormProps {
  api?: Pick<typeof edgeApi, 'saveWorkflow' | 'listDevices' | 'getWorkflow'>;
}

export function WorkflowForm({ api = edgeApi }:
    WorkflowFormProps = {}): JSX.Element {
  const { id = '' } = useParams();
  const workflowId = id;
  const editing = workflowId !== '' && workflowId !== 'new';
  const navigate = useNavigate();

  const [loadingExisting, setLoadingExisting] = useState(editing);
  const [name, setName] = useState('');
  const [type, setType] = useState<WizardWorkflowType | null>(null);
  const [metadataOptions, setMetadataOptions] = useState<MetadataOption[] | null>(null);
  const [metadataSearch, setMetadataSearch] = useState('');
  const [chosenMetadata, setChosenMetadata] = useState<MetadataOption | null>(null);
  const [breakables, setBreakables] = useState<Breakable[] | null>(null);
  const [rows, setRows] = useState<StepRow[]>([]);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);
  const [wfLevel, setWfLevel] = useState<WorkflowLevel>({
    enabled: true, requiresApproval: false, defaultDeviceId: null,
  });
  const [deps, setDeps] = useState<DepRow[]>([]);
  const [depsTouched, setDepsTouched] = useState(false);
  const [snapshots, setSnapshots] = useState<edgeApi.MetadataSnapshot[]>([]);
  const [pinnedSnapshotId, setPinnedSnapshotId] = useState<number | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.listDevices().then((d) => setDevices(d.devices ?? []))
      .catch(() => undefined);
  }, [api]);
  useEffect(() => {
    if (!editing) return;
    edgeApi.listSnapshots().then((r) => setSnapshots(r.snapshots))
      .catch(() => undefined);
    edgeApi.getWorkflowPin(workflowId)
      .then((r) => setPinnedSnapshotId(r.snapshotId))
      .catch(() => undefined);
  }, [editing, workflowId]);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    (async () => {
      try {
        const w = await api.getWorkflow(workflowId);
        let detected: { type: WizardWorkflowType; metadata: MetadataOption };
        try {
          detected = await md.detectWorkflowType(w.boundMetadataKind, w.boundMetadataId);
        } catch {
          detected = {
            type: w.boundMetadataKind === 'DATA_SET' ? 'AGGREGATE' : 'TRACKER',
            metadata: { id: w.boundMetadataId,
                         displayName: w.boundMetadataId + ' (not in mirror)' },
          };
        }
        if (cancelled) return;
        setType(detected.type);
        setChosenMetadata(detected.metadata);
        setName(w.displayName);
        setWfLevel({
          enabled: w.enabled,
          requiresApproval: w.requiresApproval ?? false,
          defaultDeviceId: w.defaultDeviceId ?? null,
        });
        if (w.dependencies && w.dependencies.length > 0) {
          const stepRefById = new Map(w.steps.map((s) => [s.stepId, s.sectionRef]));
          const prefilled: DepRow[] = [];
          w.dependencies.forEach((d) => {
            const from = stepRefById.get(d.dependsOnStepId);
            const to = stepRefById.get(d.stepId);
            if (from && to) {
              prefilled.push({ fromBreakableId: from, toBreakableId: to,
                                 kind: 'COMPLETES_BEFORE' });
            }
          });
          if (prefilled.length > 0) {
            setDeps(prefilled);
            setDepsTouched(true);
          }
        }
        let bs: Breakable[];
        try {
          bs = detected.type === 'AGGREGATE'
            ? await md.listDataSetSections(w.boundMetadataId)
            : detected.type === 'EVENT'
              ? [{ id: w.boundMetadataId, displayName: 'Whole event',
                   sectionKind: 'EVENT_INSTANCE' as const }]
              : await md.listProgramStages(w.boundMetadataId);
        } catch {
          bs = [];
        }
        if (cancelled) return;
        setBreakables(bs);
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
        const seenRefs = new Set(bs.map((b) => b.id));
        w.steps.forEach((s) => {
          if (!seenRefs.has(s.sectionRef ?? '')) {
            const selection: Record<string, { included: boolean; requirement: FieldReq }> = {};
            s.fields?.forEach((f) => {
              selection[f.fieldRef] = {
                included: true,
                requirement: f.requirement === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL',
              };
            });
            const kind = (s.sectionKind ?? 'DATASET_SECTION') as Breakable['sectionKind'];
            const native = md.WIZARD_NATIVE_KINDS.has(kind);
            const label = native
              ? s.displayName + ' (not in current metadata)'
              : s.displayName + ' (advanced · ' + kind + ')';
            prefilled.push({
              breakable: { id: s.sectionRef ?? ('adhoc-' + s.stepId),
                            displayName: label,
                            sectionKind: kind },
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

  useEffect(() => {
    if (type === null) return;
    setMetadataOptions(null);
    const loader = type === 'AGGREGATE' ? md.listDataSets()
                  : type === 'EVENT' ? md.listPrograms('EVENT')
                  : md.listPrograms('TRACKER');
    loader
      .then((opts) => setMetadataOptions(opts))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [type]);

  useEffect(() => {
    if (editing) return;
    if (type === null || chosenMetadata === null) return;
    setBreakables(null);
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
          included: bs.length <= 6,
          ownerDeviceId: null,
          ownerRole: 'OPERATOR',
          fieldCandidates: null,
          fieldSelection: {},
          expanded: false,
        })));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [editing, type, chosenMetadata]);

  const filteredOptions = useMemo(() => {
    if (metadataOptions == null) return null;
    const q = metadataSearch.trim().toLowerCase();
    if (q === '') return metadataOptions;
    return metadataOptions.filter((o) =>
      o.displayName.toLowerCase().includes(q));
  }, [metadataOptions, metadataSearch]);

  const includedRows = rows.filter((r) => r.included);
  const canSave = name.trim() !== '' && chosenMetadata != null
                && includedRows.length > 0;

  function updateRow(ix: number, patch: Partial<StepRow>): void {
    setRows((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix], ...patch };
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
        md.listFieldCandidates(row.breakable)
          .then((fields) => setRows((p) => {
            const next = [...p];
            const existingSel = next[ix].fieldSelection;
            const seeded: Record<string, { included: boolean; requirement: FieldReq }> = {};
            fields.forEach((f) => {
              seeded[f.id] = existingSel[f.id] ?? {
                included: f.compulsory,
                requirement: f.compulsory ? 'REQUIRED' : 'OPTIONAL',
              };
            });
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

  async function doSave(): Promise<void> {
    if (!canSave || type === null || chosenMetadata === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = md.buildWorkflowPayload({
        workflowId: editing ? workflowId : undefined,
        displayName: name.trim(),
        type,
        metadata: chosenMetadata,
        enabled: wfLevel.enabled,
        requiresApproval: wfLevel.requiresApproval,
        defaultDeviceId: wfLevel.defaultDeviceId,
        steps: includedRows.map((r) => ({
          breakable: r.breakable,
          ownerDeviceId: r.ownerDeviceId,
          ownerRole: r.ownerRole,
          fields: Object.entries(r.fieldSelection)
            .filter(([, s]) => s.included)
            .map(([fieldRef, s]) => ({ fieldRef, requirement: s.requirement })),
        })),
        explicitDependencies: depsTouched
          ? deps.filter((d) => {
              const ids = new Set(includedRows.map((r) => r.breakable.id));
              return ids.has(d.fromBreakableId) && ids.has(d.toBreakableId);
            })
          : undefined,
      });
      const saved = await api.saveWorkflow(payload);
      navigate(editing ? '/workflows' : `/workflows/${saved.workflowId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing && loadingExisting) {
    return (
      <div className="ea-screen">
        <LoadingBlock testId="wf-form-loading" />
      </div>
    );
  }

  return (
    <div className="ea-screen" data-test="wf-form-root">
      <HeroHeader
        title={editing ? (name || 'Workflow') : 'New workflow'}
        actions={
          <>
            <Link to="/workflows" className="ea-btn ea-btn--ghost ea-btn--sm">
              ← Workflows
            </Link>
            {editing && (
              <Link to={`/workflows/${workflowId}/advanced`}
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-test="wf-form-advanced">
                Advanced JSON
              </Link>
            )}
          </>
        }
      />

      {loadError && (
        <ErrorBlock title="Metadata load failed"
                     testId="wf-form-load-error">{loadError}</ErrorBlock>
      )}

      <section className="ea-card ea-form-card">
        <form className="ea-form"
              onSubmit={(e) => { e.preventDefault(); if (canSave) void doSave(); }}>
          <div className="ea-form-section">
            <div className="ea-form-section-head">
              <h2>Workflow settings</h2>
              <p>Name, status, approval rule, and the device that owns
                 steps you don't explicitly route elsewhere.</p>
            </div>
            <div className="ea-form-grid">
              <label className="ea-field">
                <span className="ea-field-label">Name</span>
                <input className="ea-input" type="text" data-test="wf-form-name"
                        value={name} placeholder="e.g. Monthly ANC report"
                        onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="ea-field">
                <span className="ea-field-label">Status</span>
                <select className="ea-input" data-test="wf-form-enabled"
                         value={wfLevel.enabled ? 'ENABLED' : 'DISABLED'}
                         onChange={(e) => setWfLevel({ ...wfLevel,
                           enabled: e.target.value === 'ENABLED' })}>
                  <option value="ENABLED">Enabled</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </label>
              <label className="ea-field">
                <span className="ea-field-label">Approval</span>
                <select className="ea-input" data-test="wf-form-approval"
                         value={wfLevel.requiresApproval ? 'YES' : 'NO'}
                         onChange={(e) => setWfLevel({ ...wfLevel,
                           requiresApproval: e.target.value === 'YES' })}>
                  <option value="NO">No sign-off</option>
                  <option value="YES">Reviewer sign-off before submission</option>
                </select>
              </label>
              <label className="ea-field">
                <span className="ea-field-label">Default device</span>
                <select className="ea-input" data-test="wf-form-default-device"
                         value={wfLevel.defaultDeviceId ?? ''}
                         onChange={(e) => setWfLevel({ ...wfLevel,
                           defaultDeviceId: e.target.value === '' ? null
                             : e.target.value })}>
                  <option value="">— none —</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.displayName ?? d.deviceId.slice(0, 12)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="ea-form-section">
            <div className="ea-form-section-head">
              <h2>DHIS2 target</h2>
              <p>Which DHIS2 object the workflow captures into. Pick a
                 type first, then the specific dataset or program.</p>
            </div>
            <div className="ea-form-grid">
              <label className="ea-field">
                <span className="ea-field-label">Type</span>
                <select className="ea-input" data-test="wf-form-type"
                         value={type ?? ''}
                         disabled={editing}
                         onChange={(e) => {
                           setType(e.target.value as WizardWorkflowType);
                           if (!editing) {
                             setChosenMetadata(null);
                             setBreakables(null);
                             setRows([]);
                             setMetadataSearch('');
                           }
                         }}>
                  <option value="">— pick —</option>
                  <option value="AGGREGATE">Aggregate dataset</option>
                  <option value="EVENT">Event program (no enrolment)</option>
                  <option value="TRACKER">Tracker program (with enrolment)</option>
                </select>
              </label>
              {type && (
                <label className="ea-field">
                  <span className="ea-field-label">
                    {type === 'AGGREGATE' ? 'Dataset' : 'Program'}
                  </span>
                  {chosenMetadata && editing ? (
                    <input className="ea-input"
                            data-test="wf-form-chosen-locked"
                            value={chosenMetadata.displayName}
                            readOnly disabled />
                  ) : filteredOptions == null ? (
                    <span className="ea-field-hint">Loading…</span>
                  ) : (
                    <>
                      {(metadataOptions ?? []).length > 12 && (
                        <input className="ea-input ea-input--sm ea-metadata-filter"
                                type="search"
                                data-test="wf-form-metadata-search"
                                placeholder={`Filter ${(metadataOptions ?? []).length} ${type === 'AGGREGATE' ? 'datasets' : 'programs'}…`}
                                value={metadataSearch}
                                onChange={(e) => setMetadataSearch(e.target.value)} />
                      )}
                      <select className="ea-input"
                               data-test="wf-form-metadata-list"
                               value={chosenMetadata?.id ?? ''}
                               onChange={(e) => {
                                 const o = (metadataOptions ?? [])
                                   .find((x) => x.id === e.target.value);
                                 setChosenMetadata(o ?? null);
                               }}>
                        <option value="">
                          — pick {type === 'AGGREGATE' ? 'dataset' : 'program'} —
                        </option>
                        {filteredOptions
                          .slice()
                          .sort((a, b) => a.displayName.localeCompare(b.displayName))
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.displayName}</option>
                          ))}
                      </select>
                      {filteredOptions.length === 0 && metadataSearch.trim() !== '' && (
                        <span className="ea-field-hint">No matches.</span>
                      )}
                    </>
                  )}
                </label>
              )}
            </div>
          </div>

          {chosenMetadata && (
            <div className="ea-form-section">
              <div className="ea-form-section-head">
                <h2>Capture steps · owner device &amp; role</h2>
                <p>Each ticked section becomes a step. The device + role
                   picked here is the <strong>handover target</strong> —
                   who picks up that step in their “My queue”. Leave the
                   device as <em>Any</em> to pool it to anyone with the
                   role.</p>
              </div>
              {breakables == null ? (
                <LoadingBlock testId="wf-form-breakables-loading" />
              ) : (
                <StepsTable rows={rows} devices={devices}
                             onUpdate={updateRow}
                             onExpand={toggleExpand}
                             onField={updateFieldSelection}
                             onBulkField={bulkSetFieldSelection} />
              )}
            </div>
          )}

          {chosenMetadata && includedRows.length >= 2 && (
            <div className="ea-form-section">
              <div className="ea-form-section-head">
                <h2>Step order (handover sequence)</h2>
                <p>Which step must complete before the next one opens.
                   Default is top-to-bottom: each step waits for the one
                   above it. Add explicit rules only if a step should
                   open out-of-order or wait on a sibling.</p>
              </div>
              <DependencyEditor rows={rows} deps={deps}
                                 setDeps={setDeps}
                                 onTouched={() => setDepsTouched(true)}
                                 depsTouched={depsTouched} />
            </div>
          )}

          {editing && snapshots.length > 0 && (
            <div className="ea-form-section">
              <div className="ea-form-section-head">
                <h2>Metadata pin</h2>
                <p>Freeze this workflow's schema to a specific metadata
                   snapshot so upstream DHIS2 changes don't break it in
                   the field. Default (<em>Follow live mirror</em>)
                   tracks whatever the current snapshot is.</p>
              </div>
              <div className="ea-form-grid">
                <label className="ea-field">
                  <span className="ea-field-label">Snapshot</span>
                  <select className="ea-input" data-test="wf-form-pin"
                           value={pinnedSnapshotId == null ? '' : String(pinnedSnapshotId)}
                           disabled={pinSaving}
                           onChange={(e) => {
                             const next = e.target.value === '' ? null
                               : Number(e.target.value);
                             setPinSaving(true);
                             edgeApi.setWorkflowPin(workflowId, next)
                               .then(() => setPinnedSnapshotId(next))
                               .catch(() => undefined)
                               .finally(() => setPinSaving(false));
                           }}>
                    <option value="">Follow live mirror</option>
                    {snapshots.map((s) => (
                      <option key={s.snapshotId} value={s.snapshotId}
                               disabled={s.status === 'RETIRED'
                                          && s.snapshotId !== pinnedSnapshotId}>
                        #{s.snapshotId}
                        {' · '}{new Date(s.importedAt).toLocaleDateString()}
                        {s.status === 'RETIRED' ? ' (retired)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {saveError && (
            <ErrorBlock title="Save failed"
                         testId="wf-form-save-error">{saveError}</ErrorBlock>
          )}

          <div className="ea-form-footer">
            <Link to="/workflows" className="ea-btn ea-btn--ghost">Cancel</Link>
            <button type="submit"
                     className="ea-btn ea-btn--primary"
                     data-test="wf-form-save"
                     disabled={!canSave || saving}>
              {saving ? 'Saving…' : (editing ? 'Save changes' : 'Create workflow')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StepsTable({ rows, devices, onUpdate, onExpand, onField, onBulkField }: {
    rows: StepRow[];
    devices: edgeApi.EdgeDeviceRow[];
    onUpdate: (ix: number, patch: Partial<StepRow>) => void;
    onExpand: (ix: number) => void;
    onField: (ix: number, id: string,
              next: { included: boolean; requirement: FieldReq }) => void;
    onBulkField: (ix: number, selected: boolean) => void;
}): JSX.Element {
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense ea-wf-steps-table"
             data-test="wf-form-steps">
        <thead>
          <tr>
            <th className="ea-wf-steps-col-include">Include</th>
            <th>Section / stage</th>
            <th className="ea-wf-steps-col-role">Role</th>
            <th className="ea-wf-steps-col-device">Handover to (device)</th>
            <th className="ea-wf-steps-col-fields">Fields</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r, i) => {
            const summary = fieldSummary(r);
            return [
              (
                <tr key={r.breakable.id} data-test={`wf-form-row-${i}`}
                     className={(r.included ? '' : 'is-dim')
                       + (r.breakable.parentId ? ' is-nested' : '')}>
                  <td>
                    <input type="checkbox"
                            data-test={`wf-form-row-${i}-include`}
                            checked={r.included}
                            onChange={(e) => onUpdate(i, { included: e.target.checked })} />
                  </td>
                  <td className={r.breakable.parentId ? 'ea-wf-steps-nested' : undefined}>
                    <div>{r.breakable.parentId ? '↳ ' : ''}{r.breakable.displayName}</div>
                    {summary && (
                      <div className="ea-text-muted ea-wf-steps-summary">{summary}</div>
                    )}
                  </td>
                  <td>
                    <select className="ea-input ea-input--sm"
                             data-test={`wf-form-row-${i}-role`}
                             value={r.ownerRole} disabled={!r.included}
                             onChange={(e) => onUpdate(i,
                               { ownerRole: e.target.value as StepRow['ownerRole'] })}>
                      <option value="OPERATOR">Operator</option>
                      <option value="REVIEWER">Reviewer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td>
                    <select className="ea-input ea-input--sm"
                             data-test={`wf-form-row-${i}-device`}
                             value={r.ownerDeviceId ?? ''}
                             disabled={!r.included}
                             onChange={(e) => onUpdate(i, {
                               ownerDeviceId: e.target.value === '' ? null
                                 : e.target.value,
                             })}>
                      <option value="">Any</option>
                      {devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.displayName ?? d.deviceId.slice(0, 12)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button"
                             className="ea-btn ea-btn--ghost ea-btn--sm"
                             data-test={`wf-form-row-${i}-expand`}
                             disabled={!r.included}
                             onClick={() => onExpand(i)}>
                      {r.expanded ? 'Hide' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ),
              r.expanded && r.included && (
                <tr key={`${r.breakable.id}-fields`}
                     className="ea-wf-steps-fields-row"
                     data-test={`wf-form-row-${i}-fields`}>
                  <td colSpan={5}>
                    {r.fieldCandidates == null ? (
                      <span className="ea-text-muted">Loading…</span>
                    ) : r.fieldCandidates.length === 0 ? (
                      <span className="ea-text-muted">
                        No fields mirrored. Save without selection to capture all.
                      </span>
                    ) : (
                      <>
                        <div className="ea-wf-fields-actions">
                          <button type="button"
                                   className="ea-btn ea-btn--ghost ea-btn--sm"
                                   onClick={() => onBulkField(i, true)}>All</button>
                          <button type="button"
                                   className="ea-btn ea-btn--ghost ea-btn--sm"
                                   onClick={() => onBulkField(i, false)}>None</button>
                        </div>
                        <ul className="ea-wf-fields-grid">
                          {r.fieldCandidates.map((f) => {
                            const sel = r.fieldSelection[f.id];
                            const included = sel?.included ?? false;
                            const req = sel?.requirement
                                         ?? (f.compulsory ? 'REQUIRED' : 'OPTIONAL');
                            return (
                              <li key={f.id}
                                   className="ea-wf-fields-item"
                                   data-test={`wf-form-row-${i}-field-${f.id}`}>
                                <input type="checkbox"
                                        data-test={`wf-form-row-${i}-field-${f.id}-include`}
                                        checked={included}
                                        onChange={(e) => onField(i, f.id,
                                          { included: e.target.checked,
                                            requirement: req as FieldReq })} />
                                <span className="ea-wf-fields-name">{f.displayName}</span>
                                {included && (
                                  <select className="ea-input ea-input--sm"
                                           value={req}
                                           onChange={(e) => onField(i, f.id,
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
                      </>
                    )}
                  </td>
                </tr>
              ),
            ].filter(Boolean);
          })}
        </tbody>
      </table>
    </div>
  );
}

function fieldSummary(row: StepRow): string | null {
  const total = Object.values(row.fieldSelection).filter((s) => s.included).length;
  if (total === 0) return null;
  const req = Object.values(row.fieldSelection)
    .filter((s) => s.included && s.requirement === 'REQUIRED').length;
  return `${total} field${total === 1 ? '' : 's'} · ${req} required`;
}

function DependencyEditor({ rows, deps, setDeps, onTouched, depsTouched }: {
    rows: StepRow[];
    deps: DepRow[];
    setDeps: (next: DepRow[]) => void;
    onTouched: () => void;
    depsTouched: boolean;
}): JSX.Element {
  const picked = rows.filter((r) => r.included);
  function addDep(): void {
    if (picked.length < 2) return;
    setDeps([...deps, {
      fromBreakableId: picked[0].breakable.id,
      toBreakableId:  picked[1].breakable.id,
      kind: 'COMPLETES_BEFORE',
    }]);
    onTouched();
  }
  function updateDep(i: number, patch: Partial<DepRow>): void {
    const copy = [...deps];
    copy[i] = { ...copy[i], ...patch };
    setDeps(copy);
    onTouched();
  }
  function removeDep(i: number): void {
    setDeps(deps.filter((_, j) => j !== i));
    onTouched();
  }
  return (
    <div className="ea-wf-deps">
      {!depsTouched && (
        <p className="ea-field-hint">
          Default: each step waits for the one above it.
        </p>
      )}
      {deps.length > 0 && (
        <ul className="ea-wf-deps-list">
          {deps.map((d, i) => (
            <li key={i} className="ea-wf-deps-item" data-test={`wf-form-dep-${i}`}>
              <select className="ea-input ea-input--sm"
                       value={d.fromBreakableId}
                       onChange={(e) => updateDep(i, { fromBreakableId: e.target.value })}>
                {picked.map((r) => (
                  <option key={r.breakable.id} value={r.breakable.id}>
                    {r.breakable.displayName}
                  </option>
                ))}
              </select>
              <span className="ea-text-muted">completes before</span>
              <select className="ea-input ea-input--sm"
                       value={d.toBreakableId}
                       onChange={(e) => updateDep(i, { toBreakableId: e.target.value })}>
                {picked.map((r) => (
                  <option key={r.breakable.id} value={r.breakable.id}>
                    {r.breakable.displayName}
                  </option>
                ))}
              </select>
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                       onClick={() => removeDep(i)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
               data-test="wf-form-dep-add"
               disabled={picked.length < 2}
               onClick={addDep}>
        + Add dependency
      </button>
    </div>
  );
}
