import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { UiIcon } from '../../components/UiIcon';
import * as md from './wizardMetadata';
import type {
  Breakable, FieldCandidate, MetadataOption, WizardWorkflowType,
} from './wizardMetadata';

type FieldReq = 'REQUIRED' | 'OPTIONAL' | 'READONLY' | 'HIDDEN';
type OwnerRole = 'OPERATOR' | 'REVIEWER' | 'ADMIN';

interface FieldSel {
  included: boolean;
  requirement: FieldReq;
  /** V066 — per-field handover overrides. Null → inherit from the step. */
  ownerRole?: OwnerRole | null;
  ownerDeviceId?: string | null;
}

interface StepRow {
  breakable: Breakable;
  included: boolean;
  ownerDeviceId: string | null;
  ownerRole: 'OPERATOR' | 'REVIEWER' | 'ADMIN';
  fieldCandidates: FieldCandidate[] | null;
  fieldSelection: Record<string, FieldSel>;
  expanded: boolean;
}

interface WorkflowLevel {
  enabled: boolean;
  requiresApproval: boolean;
  defaultDeviceId: string | null;
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
  const [snapshots, setSnapshots] = useState<edgeApi.MetadataSnapshot[]>([]);
  const [pinnedSnapshotId, setPinnedSnapshotId] = useState<number | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingIx, setDraggingIx] = useState<number | null>(null);
  const [dragOverIx, setDragOverIx] = useState<number | null>(null);
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
        let bs: Breakable[];
        try {
          if (detected.type === 'AGGREGATE') {
            bs = await md.listDataSetSections(w.boundMetadataId);
          } else {
            bs = await md.listProgramStages(w.boundMetadataId);
            if (bs.length === 0 && detected.type === 'EVENT') {
              bs = [{ id: w.boundMetadataId, displayName: 'Whole event',
                       sectionKind: 'EVENT_INSTANCE' as const }];
            }
          }
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
          const selection: Record<string, FieldSel> = {};
          existing?.fields?.forEach((f) => {
            selection[f.fieldRef] = {
              included: true,
              requirement: coerceReq(f.requirement),
              ownerRole: (f.ownerRole as OwnerRole | null) ?? null,
              ownerDeviceId: f.ownerDeviceId ?? null,
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
            const selection: Record<string, FieldSel> = {};
            s.fields?.forEach((f) => {
              selection[f.fieldRef] = {
                included: true,
                requirement: coerceReq(f.requirement),
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
      : md.listProgramStages(chosenMetadata.id)
          .then((bs) => bs.length > 0 ? bs : (type === 'EVENT'
            ? [{ id: chosenMetadata.id, displayName: 'Whole event',
                 sectionKind: 'EVENT_INSTANCE' as const }]
            : []));
    loader
      .then((bs) => {
        setBreakables(bs);
        const seeded = bs.map((b) => ({
          breakable: b,
          included: bs.length <= 6,
          ownerDeviceId: null,
          ownerRole: 'OPERATOR' as const,
          fieldCandidates: null,
          fieldSelection: {},
          expanded: false,
        }));
        setRows(seeded);
        seeded.forEach((r, i) => {
          if (r.included) prefetchAllFields(i);
        });
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [editing, type, chosenMetadata]);



  const includedRows = rows.filter((r) => r.included);
  const canSave = name.trim() !== '' && chosenMetadata != null
                && includedRows.length > 0;

  function updateRow(ix: number, patch: Partial<StepRow>): void {
    setRows((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix], ...patch };
      if (patch.included === true) {
        const b = copy[ix].breakable;
        // Mutually-exclusive parent/child selection: picking a whole
        // parent clears any ticked children; picking a child clears
        // the parent. Applies to PROGRAM_STAGE ↔ PROGRAM_STAGE_SECTION
        // and to ENROLLMENT_FORM ↔ PROGRAM_SECTION.
        const parentKinds = ['PROGRAM_STAGE', 'ENROLLMENT_FORM'] as const;
        const childKinds  = ['PROGRAM_STAGE_SECTION', 'PROGRAM_SECTION'] as const;
        if ((parentKinds as readonly string[]).includes(b.sectionKind)) {
          for (let j = 0; j < copy.length; j++) {
            if (copy[j].breakable.parentId === b.id && copy[j].included) {
              copy[j] = { ...copy[j], included: false };
            }
          }
        } else if ((childKinds as readonly string[]).includes(b.sectionKind)
                    && b.parentId) {
          for (let j = 0; j < copy.length; j++) {
            if (copy[j].breakable.id === b.parentId && copy[j].included) {
              copy[j] = { ...copy[j], included: false };
            }
          }
        }
      }
      return copy;
    });
    // Eagerly load + auto-select all fields when a step is first ticked,
    // so saving without opening the Fields editor still captures the
    // full set. User can narrow later via Edit.
    if (patch.included === true) {
      prefetchAllFields(ix);
    }
  }
  function prefetchAllFields(ix: number): void {
    setRows((prev) => {
      if (prev[ix].fieldCandidates != null) return prev;
      md.listFieldCandidates(prev[ix].breakable)
        .then((fields) => setRows((p) => {
          const next = [...p];
          const existingSel = next[ix].fieldSelection;
          const seeded: Record<string, FieldSel> = {};
          fields.forEach((f) => {
            seeded[f.id] = existingSel[f.id] ?? {
              included: true,
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
      return prev;
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
            const seeded: Record<string, FieldSel> = {};
            fields.forEach((f) => {
              seeded[f.id] = existingSel[f.id] ?? {
                included: true,
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
                                 next: FieldSel): void {
    setRows((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix],
                    fieldSelection: { ...copy[ix].fieldSelection, [fieldId]: next } };
      return copy;
    });
  }
  function moveStepTo(sourceIx: number, targetIx: number): void {
    if (sourceIx === targetIx) return;
    setRows((prev) => {
      // Only reorder top-level rows (parentId == null). Children
      // (stage sections / enrolment sections) move with their parent
      // block so sections never get orphaned above/below an
      // unrelated parent.
      const groups: { head: number; size: number }[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].breakable.parentId == null) {
          groups.push({ head: i, size: 1 });
        } else if (groups.length > 0) {
          groups[groups.length - 1].size += 1;
        }
      }
      const srcG = groups.findIndex((g) => g.head === sourceIx);
      const dstG = groups.findIndex((g) => g.head === targetIx);
      if (srcG < 0 || dstG < 0 || srcG === dstG) return prev;
      // Pull the source group out, then insert at the new slot.
      const extracted = prev.slice(groups[srcG].head,
                                     groups[srcG].head + groups[srcG].size);
      const withoutSrc = [
        ...prev.slice(0, groups[srcG].head),
        ...prev.slice(groups[srcG].head + groups[srcG].size),
      ];
      // Recompute dst group head in the pulled array.
      const dstHead = srcG < dstG
        ? groups[dstG].head - groups[srcG].size
        : groups[dstG].head;
      return [
        ...withoutSrc.slice(0, dstHead),
        ...extracted,
        ...withoutSrc.slice(dstHead),
      ];
    });
  }
  function bulkSetFieldSelection(ix: number, selected: boolean): void {
    setRows((prev) => {
      const copy = [...prev];
      const row = copy[ix];
      const candidates = row.fieldCandidates ?? [];
      const next: Record<string, FieldSel> = {};
      candidates.forEach((f) => {
        const existing = row.fieldSelection[f.id];
        next[f.id] = {
          ...existing,
          included: selected,
          requirement: existing?.requirement
            ?? (f.compulsory ? 'REQUIRED' : 'OPTIONAL'),
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
            .map(([fieldRef, s]) => ({
              fieldRef, requirement: s.requirement,
              ownerRole: s.ownerRole ?? null,
              ownerDeviceId: s.ownerDeviceId ?? null,
            })),
        })),
        explicitDependencies: undefined,
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
      <PageHeader
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

      <section className="ea-card ea-form-card ea-form-card--wide ea-form-card--flat">
        <form className="ea-form ea-form--flat"
              onSubmit={(e) => { e.preventDefault(); if (canSave) void doSave(); }}>

          <div className="ea-form-section">
            <div className="ea-form-section-head">
              <h2>Settings</h2>
              <p>Name, status and the default role/device for steps you
                 don&apos;t explicitly route elsewhere.</p>
            </div>
            <div className="ea-form-grid">
              <label className="ea-field">
                <span className="ea-field-label">Name</span>
                <input className="ea-input" type="text" data-test="wf-form-name"
                        value={name} placeholder="Workflow name"
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
              <p>What this workflow captures. Pick a type, then the dataset
                 or program to bind.</p>
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
                  ) : (
                    <MetadataCombo
                      kind={type}
                      options={metadataOptions}
                      search={metadataSearch}
                      onSearch={setMetadataSearch}
                      value={chosenMetadata}
                      onPick={setChosenMetadata} />
                  )}
                </label>
              )}
            </div>
          </div>

          {chosenMetadata && (
            <div className="ea-form-section">
              <div className="ea-form-section-head">
                <h2>Service points</h2>
                <p>Tick each service point the workflow should cover.
                   Set the role expected to capture it and the device
                   that should see it in <em>My queue</em>. Use ↑ / ↓
                   to put the steps in the order they happen.</p>
              </div>
              {breakables == null ? (
                <LoadingBlock testId="wf-form-breakables-loading" />
              ) : (
                <StepsTable rows={rows} devices={devices}
                             onUpdate={updateRow}
                             onExpand={toggleExpand}
                             onField={updateFieldSelection}
                             onBulkField={bulkSetFieldSelection}
                             draggingIx={draggingIx}
                             dragOverIx={dragOverIx}
                             onDragStart={setDraggingIx}
                             onDragEnd={() => {
                               setDraggingIx(null);
                               setDragOverIx(null);
                             }}
                             onDragOver={setDragOverIx}
                             onDrop={(targetIx) => {
                               if (draggingIx != null) moveStepTo(draggingIx, targetIx);
                               setDraggingIx(null);
                               setDragOverIx(null);
                             }} />
              )}
            </div>
          )}

          {chosenMetadata && includedRows.length >= 1 && (
            <div className="ea-form-section">
              <div className="ea-form-section-head">
                <h2>Handover</h2>
                <p>How work flows between the ticked service points.
                   Each step opens once the one immediately above
                   completes — reorder with the ↑ / ↓ controls in the
                   Service points table.</p>
              </div>
              <HandoverFlowPreview rows={includedRows} devices={devices} />
            </div>
          )}

          {editing && snapshots.length > 0 && (
            <div className="ea-form-section">
              <div className="ea-form-section-head">
                <h2>Metadata pin</h2>
                <p>Freeze this workflow to a specific metadata snapshot
                   so upstream DHIS2 changes can&apos;t break it in the
                   field. Leave on <em>Follow live mirror</em> to track
                   the current snapshot.</p>
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

function StepsTable({ rows, devices, onUpdate, onExpand, onField, onBulkField,
                      draggingIx, dragOverIx,
                      onDragStart, onDragEnd, onDragOver, onDrop }: {
    rows: StepRow[];
    devices: edgeApi.EdgeDeviceRow[];
    onUpdate: (ix: number, patch: Partial<StepRow>) => void;
    onExpand: (ix: number) => void;
    onField: (ix: number, id: string,
              next: FieldSel) => void;
    onBulkField: (ix: number, selected: boolean) => void;
    draggingIx: number | null;
    dragOverIx: number | null;
    onDragStart: (ix: number) => void;
    onDragEnd: () => void;
    onDragOver: (ix: number) => void;
    onDrop: (ix: number) => void;
}): JSX.Element {
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense ea-wf-steps-table"
             data-test="wf-form-steps">
        <thead>
          <tr>
            <th className="ea-wf-steps-col-include">#</th>
            <th>Service point</th>
            <th className="ea-wf-steps-col-role">Role</th>
            <th className="ea-wf-steps-col-device">Handover to (device)</th>
            <th className="ea-wf-steps-col-order"></th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            // Index rows for quick parent → children lookup.
            const topIxs: number[] = [];
            const childIxsByParentId = new Map<string, number[]>();
            rows.forEach((r, i) => {
              if (r.breakable.parentId == null) {
                topIxs.push(i);
              } else {
                const p = childIxsByParentId.get(r.breakable.parentId) ?? [];
                p.push(i);
                childIxsByParentId.set(r.breakable.parentId, p);
              }
            });
            let ordinal = 0;
            const out: JSX.Element[] = [];
            for (const i of topIxs) {
              const r = rows[i];
              if (r.included) ordinal += 1;
              const stepNumber = r.included ? ordinal : null;
              const childIxs = childIxsByParentId.get(r.breakable.id) ?? [];
              const hasChildren = childIxs.length > 0;
              // Whole-parent capture: ticking a parent clears its
              // section children and hides them from the Steps table.
              // Show a "N sections hidden" tag on the parent so the
              // operator sees why the sections aren't listed. Unticking
              // the parent brings the sections back.
              const hideChildren = r.included && hasChildren;
              out.push(renderRow({
                row: r, ix: i, stepNumber, hasChildren,
                hiddenChildrenCount: hideChildren ? childIxs.length : 0,
                isChild: false,
                draggingIx, dragOverIx,
                onDragStart, onDragEnd, onDragOver, onDrop,
                onUpdate, onExpand,
                devices,
              }));
              if (r.expanded) {
                // Only render children when the parent isn't itself
                // selected as a whole-step capture.
                if (!hideChildren) {
                  for (const ci of childIxs) {
                    const c = rows[ci];
                    out.push(renderRow({
                      row: c, ix: ci, stepNumber: null,
                      hasChildren: false,
                      hiddenChildrenCount: 0,
                      isChild: true,
                      draggingIx, dragOverIx,
                      onDragStart, onDragEnd, onDragOver, onDrop,
                      onUpdate, onExpand,
                      devices,
                    }));
                    if (c.expanded) {
                      out.push(renderFieldsPanel({
                        row: c, ix: ci, devices, onField, onBulkField,
                      }));
                    }
                  }
                }
                // Field panel for the parent: leaf → always, or
                // parent ticked (whole-parent capture) → show the
                // field table so operator can refine the field set.
                if (!hasChildren || r.included) {
                  out.push(renderFieldsPanel({
                    row: r, ix: i, devices, onField, onBulkField,
                  }));
                }
              }
            }
            return out;
          })()}
        </tbody>
      </table>
    </div>
  );
}

function MetadataCombo({ kind, options, search, onSearch, value, onPick }: {
  kind: WizardWorkflowType;
  options: MetadataOption[] | null;
  search: string;
  onSearch: (s: string) => void;
  value: MetadataOption | null;
  onPick: (o: MetadataOption | null) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [activeIx, setActiveIx] = useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    if (options == null) return [];
    const q = search.trim().toLowerCase();
    const sorted = options.slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (q === '') return sorted;
    return sorted.filter((o) => o.displayName.toLowerCase().includes(q));
  }, [options, search]);

  const label = kind === 'AGGREGATE' ? 'dataset' : 'program';
  const inputValue = open ? search : (value?.displayName ?? '');

  function pick(o: MetadataOption): void {
    onPick(o);
    onSearch('');
    setOpen(false);
  }
  function clear(): void {
    onPick(null);
    onSearch('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div ref={wrapRef} className="ea-metadata-combo" data-test="wf-form-metadata-combo">
      <div className="ea-metadata-combo-input">
        <input ref={inputRef}
               className="ea-input"
               type="text"
               role="combobox"
               aria-expanded={open}
               aria-autocomplete="list"
               data-test="wf-form-metadata-search"
               placeholder={options == null ? 'Loading…'
                 : `Search ${options.length} ${label}${options.length === 1 ? '' : 's'}…`}
               value={inputValue}
               disabled={options == null}
               onFocus={() => setOpen(true)}
               onChange={(e) => { onSearch(e.target.value); setOpen(true);
                                  setActiveIx(0); }}
               onKeyDown={(e) => {
                 if (!open) {
                   if (e.key === 'ArrowDown' || e.key === 'Enter') {
                     setOpen(true); e.preventDefault();
                   }
                   return;
                 }
                 if (e.key === 'ArrowDown') {
                   setActiveIx((i) => Math.min(filtered.length - 1, i + 1));
                   e.preventDefault();
                 } else if (e.key === 'ArrowUp') {
                   setActiveIx((i) => Math.max(0, i - 1));
                   e.preventDefault();
                 } else if (e.key === 'Enter') {
                   if (filtered[activeIx]) pick(filtered[activeIx]);
                   e.preventDefault();
                 } else if (e.key === 'Escape') {
                   setOpen(false); e.preventDefault();
                 }
               }} />
        {value != null && !open && (
          <button type="button"
                   className="ea-metadata-combo-clear"
                   aria-label="Clear selection"
                   title="Clear selection"
                   onClick={clear}>×</button>
        )}
      </div>
      {open && options != null && (
        <ul className="ea-metadata-combo-list"
             role="listbox"
             data-test="wf-form-metadata-list">
          {filtered.length === 0 ? (
            <li className="ea-metadata-combo-empty">No matches.</li>
          ) : filtered.slice(0, 200).map((o, i) => (
            <li key={o.id}
                 role="option"
                 aria-selected={i === activeIx}
                 className={'ea-metadata-combo-opt'
                   + (i === activeIx ? ' is-active' : '')
                   + (o.id === value?.id ? ' is-chosen' : '')}
                 onMouseEnter={() => setActiveIx(i)}
                 onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              {o.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HandoverFlowPreview({ rows, devices }: {
    rows: StepRow[];
    devices: edgeApi.EdgeDeviceRow[];
}): JSX.Element {
  const deviceById = new Map(devices.map((d) => [d.deviceId,
    d.displayName ?? d.deviceId.slice(0, 8)]));
  return (
    <ol className="ea-wf-flow" data-test="wf-form-flow">
      {rows.map((r, i) => (
        <li key={r.breakable.id} className="ea-wf-flow-step">
          <div className="ea-wf-flow-step-num">{i + 1}</div>
          <div className="ea-wf-flow-step-body">
            <div className="ea-wf-flow-step-title">
              <span className={'ea-wf-steps-kind-icon ea-wf-steps-kind-icon--'
                               + kindTone(r.breakable.sectionKind)}
                    aria-label={kindLabel(r.breakable.sectionKind)}
                    title={kindLabel(r.breakable.sectionKind)}>
                <UiIcon icon={kindIcon(r.breakable.sectionKind)} size={14} />
              </span>
              <span>{r.breakable.displayName}</span>
            </div>
            <div className="ea-wf-flow-step-meta">
              <span className="ea-chip ea-chip--neutral">{r.ownerRole}</span>
              {(r.breakable.sectionKind === 'PROGRAM_STAGE'
                || r.breakable.sectionKind === 'PROGRAM_STAGE_SECTION')
                && r.breakable.repeatable && (
                <span className="ea-wf-steps-repeat-icon"
                      aria-label="Repeatable stage"
                      title="Captured multiple times per enrolment">
                  <UiIcon icon="refresh" size={14} />
                </span>
              )}
              <span className="ea-text-muted">
                → {r.ownerDeviceId == null
                   ? 'Any device'
                   : deviceById.get(r.ownerDeviceId) ?? r.ownerDeviceId.slice(0, 8)}
              </span>
            </div>
          </div>
          {i < rows.length - 1 && <span className="ea-wf-flow-arrow">→</span>}
        </li>
      ))}
    </ol>
  );
}

function renderRow(args: {
  row: StepRow; ix: number;
  stepNumber: number | null;
  hasChildren: boolean;
  hiddenChildrenCount: number;
  isChild: boolean;
  draggingIx: number | null;
  dragOverIx: number | null;
  onDragStart: (ix: number) => void;
  onDragEnd: () => void;
  onDragOver: (ix: number) => void;
  onDrop: (ix: number) => void;
  onUpdate: (ix: number, patch: Partial<StepRow>) => void;
  onExpand: (ix: number) => void;
  devices: edgeApi.EdgeDeviceRow[];
}): JSX.Element {
  const { row, ix, stepNumber, hasChildren, hiddenChildrenCount, isChild,
          draggingIx, dragOverIx,
          onDragStart, onDragEnd, onDragOver, onDrop,
          onUpdate, onExpand, devices } = args;
  void onDragEnd; // handled on the drag handle itself.
  const summary = fieldSummary(row);
  const childCount = hasChildren ? '' : null;
  const isDragging = draggingIx === ix;
  const isDropTarget = !isChild && dragOverIx === ix && draggingIx !== null
                       && draggingIx !== ix;
  return (
    <tr key={row.breakable.id} data-test={`wf-form-row-${ix}`}
         className={(row.included ? '' : 'is-dim')
           + (isChild ? ' is-nested' : '')
           + (row.expanded ? ' is-expanded' : '')
           + (isDragging ? ' is-dragging' : '')
           + (isDropTarget ? ' is-drop-target' : '')}
         onDragOver={!isChild ? (e) => {
           e.preventDefault();
           e.dataTransfer.dropEffect = 'move';
           onDragOver(ix);
         } : undefined}
         onDrop={!isChild ? (e) => {
           e.preventDefault();
           onDrop(ix);
         } : undefined}>
      <td className="ea-wf-steps-numcell">
        <input type="checkbox"
                data-test={`wf-form-row-${ix}-include`}
                checked={row.included}
                onChange={(e) => onUpdate(ix, { included: e.target.checked })} />
        <span className="ea-wf-steps-ord-num">
          {stepNumber == null ? '' : stepNumber}
        </span>
      </td>
      <td>
        <button type="button"
                 className="ea-wf-steps-sp-expand"
                 data-test={`wf-form-row-${ix}-expand`}
                 aria-expanded={row.expanded}
                 aria-label={row.expanded ? 'Collapse' : 'Expand'}
                 onClick={() => onExpand(ix)}>
          <span className="ea-wf-steps-sp-chevron"
                aria-hidden="true">{row.expanded ? '▾' : '▸'}</span>
          <span className={'ea-wf-steps-kind-icon ea-wf-steps-kind-icon--'
                           + kindTone(row.breakable.sectionKind)}
                aria-label={kindLabel(row.breakable.sectionKind)}
                title={kindLabel(row.breakable.sectionKind)}>
            <UiIcon icon={kindIcon(row.breakable.sectionKind)} size={16} />
          </span>
          <span className="ea-wf-steps-sp-text">
            <span className="ea-wf-steps-sp-name">{row.breakable.displayName}</span>
            {summary && (
              <span className="ea-text-muted ea-wf-steps-summary"> · {summary}</span>
            )}
            {hiddenChildrenCount > 0 && (
              <span className="ea-chip ea-chip--info ea-wf-steps-hidden-tag"
                     data-test={`wf-form-row-${ix}-hidden-sections`}
                     title={`Whole-${kindLabel(row.breakable.sectionKind).toLowerCase()} capture — ${hiddenChildrenCount} section${hiddenChildrenCount === 1 ? '' : 's'} hidden. Untick Include to switch to section-level capture.`}>
                {hiddenChildrenCount} section{hiddenChildrenCount === 1 ? '' : 's'} hidden
              </span>
            )}
            {childCount}
          </span>
          {(row.breakable.sectionKind === 'PROGRAM_STAGE'
            || row.breakable.sectionKind === 'PROGRAM_STAGE_SECTION') && (
            <span className="ea-wf-steps-repeat-icon"
                  aria-label={row.breakable.repeatable
                    ? 'Repeatable stage'
                    : 'Captured once'}
                  title={row.breakable.repeatable
                    ? 'Captured multiple times per enrolment'
                    : 'Captured once per enrolment'}>
              <UiIcon icon={row.breakable.repeatable
                            ? 'refresh' : 'event'} size={14} />
            </span>
          )}
        </button>
      </td>
      <td>
        <select className="ea-input ea-input--sm"
                 data-test={`wf-form-row-${ix}-role`}
                 value={row.ownerRole} disabled={!row.included}
                 onChange={(e) => onUpdate(ix,
                   { ownerRole: e.target.value as StepRow['ownerRole'] })}>
          <option value="OPERATOR">Operator</option>
          <option value="REVIEWER">Reviewer</option>
          <option value="ADMIN">Admin</option>
        </select>
      </td>
      <td>
        <select className="ea-input ea-input--sm"
                 data-test={`wf-form-row-${ix}-device`}
                 value={row.ownerDeviceId ?? ''}
                 disabled={!row.included}
                 onChange={(e) => onUpdate(ix, {
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
      <td className="ea-wf-steps-ord">
        {!isChild && (
          <span className="ea-wf-steps-drag-handle"
                 title="Drag to reorder"
                 aria-label="Drag to reorder"
                 data-test={`wf-form-row-${ix}-drag`}
                 draggable
                 onDragStart={(e) => {
                   e.dataTransfer.setData('text/plain', String(ix));
                   e.dataTransfer.effectAllowed = 'move';
                   onDragStart(ix);
                 }}
                 onDragEnd={() => onDragEnd()}>⋮⋮</span>
        )}
      </td>
    </tr>
  );
}

function renderFieldsPanel(args: {
  row: StepRow; ix: number;
  devices: edgeApi.EdgeDeviceRow[];
  onField: (ix: number, id: string,
            next: FieldSel) => void;
  onBulkField: (ix: number, selected: boolean) => void;
}): JSX.Element {
  const { row: r, ix: i, devices, onField, onBulkField } = args;
  return (
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
              <span className="ea-text-muted ea-wf-fields-count">
                {r.fieldCandidates.length} field{r.fieldCandidates.length === 1 ? '' : 's'}
                {' · '}
                {Object.values(r.fieldSelection)
                  .filter((s) => s.included).length} included
              </span>
              <div className="ea-wf-fields-bulk">
                <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={() => onBulkField(i, true)}>Include all</button>
                <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={() => onBulkField(i, false)}>Clear</button>
              </div>
            </div>
            <table className="ea-table ea-table--dense ea-wf-fields-table">
              <thead>
                <tr>
                  <th className="ea-wf-fields-col-include">Include</th>
                  <th>Field</th>
                  <th className="ea-wf-fields-col-req">Behaviour</th>
                  <th className="ea-wf-fields-col-role">Role</th>
                  <th className="ea-wf-fields-col-dev">Handover to (device)</th>
                </tr>
              </thead>
              <tbody>
                {r.fieldCandidates.map((f) => {
                  const sel = r.fieldSelection[f.id];
                  const included = sel?.included ?? false;
                  const req: FieldReq = sel?.requirement
                               ?? (f.compulsory ? 'REQUIRED' : 'OPTIONAL');
                  return (
                    <tr key={f.id}
                         className={included ? '' : 'is-dim'}
                         data-test={`wf-form-row-${i}-field-${f.id}`}>
                      <td className="ea-wf-fields-col-include">
                        <input type="checkbox"
                                data-test={`wf-form-row-${i}-field-${f.id}-include`}
                                checked={included}
                                onChange={(e) => onField(i, f.id,
                                  { included: e.target.checked, requirement: req })} />
                      </td>
                      <td>
                        <span className="ea-wf-fields-name">{f.displayName}</span>
                        {f.compulsory && (
                          <span className="ea-wf-fields-mandatory"
                                title="Mandatory upstream in DHIS2"
                                aria-label="Mandatory upstream in DHIS2">*</span>
                        )}
                      </td>
                      <td>
                        <select className="ea-input ea-input--sm"
                                 data-test={`wf-form-row-${i}-field-${f.id}-req`}
                                 value={req}
                                 disabled={!included}
                                 onChange={(e) => onField(i, f.id,
                                   { ...sel, included: true,
                                     requirement: e.target.value as FieldReq })}>
                          <option value="REQUIRED">Required</option>
                          <option value="OPTIONAL">Optional</option>
                          <option value="READONLY">Read-only</option>
                          <option value="HIDDEN">Hidden</option>
                        </select>
                      </td>
                      <td>
                        <select className="ea-input ea-input--sm"
                                 data-test={`wf-form-row-${i}-field-${f.id}-role`}
                                 value={sel?.ownerRole ?? ''}
                                 disabled={!included}
                                 onChange={(e) => onField(i, f.id,
                                   { ...sel, included: true, requirement: req,
                                     ownerRole: e.target.value === ''
                                       ? null : e.target.value as OwnerRole })}>
                          <option value="">Inherit</option>
                          <option value="OPERATOR">Operator</option>
                          <option value="REVIEWER">Reviewer</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td>
                        <select className="ea-input ea-input--sm"
                                 data-test={`wf-form-row-${i}-field-${f.id}-device`}
                                 value={sel?.ownerDeviceId ?? ''}
                                 disabled={!included}
                                 onChange={(e) => onField(i, f.id,
                                   { ...sel, included: true, requirement: req,
                                     ownerDeviceId: e.target.value === ''
                                       ? null : e.target.value })}>
                          <option value="">Inherit</option>
                          {devices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.displayName ?? d.deviceId.slice(0, 12)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </td>
    </tr>
  );
}

function coerceReq(v: string | undefined): FieldReq {
  if (v === 'REQUIRED' || v === 'OPTIONAL'
      || v === 'READONLY' || v === 'HIDDEN') return v;
  return 'OPTIONAL';
}

function kindLabel(k: Breakable['sectionKind']): string {
  switch (k) {
    case 'PROGRAM_STAGE':         return 'Program stage';
    case 'PROGRAM_STAGE_SECTION': return 'Stage section';
    case 'DATASET_SECTION':       return 'Dataset section';
    case 'EVENT_INSTANCE':        return 'Event';
    case 'ENROLLMENT_FORM':       return 'Enrolment';
    case 'PROGRAM_SECTION':       return 'Enrolment section';
    default:                      return k;
  }
}

function kindIcon(k: Breakable['sectionKind']):
    'tracker-event' | 'program-stage-section' | 'aggregate'
    | 'event' | 'enrollment' | 'program-section' {
  switch (k) {
    case 'PROGRAM_STAGE':         return 'tracker-event';
    case 'PROGRAM_STAGE_SECTION': return 'program-stage-section';
    case 'DATASET_SECTION':       return 'aggregate';
    case 'EVENT_INSTANCE':        return 'event';
    case 'ENROLLMENT_FORM':       return 'enrollment';
    case 'PROGRAM_SECTION':       return 'program-section';
    default:                      return 'event';
  }
}

function kindTone(k: Breakable['sectionKind']): string {
  switch (k) {
    case 'PROGRAM_STAGE':         return 'info';
    case 'PROGRAM_STAGE_SECTION': return 'neutral';
    case 'DATASET_SECTION':       return 'info';
    case 'EVENT_INSTANCE':        return 'info';
    default:                      return 'neutral';
  }
}

function fieldSummary(row: StepRow): string | null {
  const total = Object.values(row.fieldSelection).filter((s) => s.included).length;
  if (total === 0) return null;
  const req = Object.values(row.fieldSelection)
    .filter((s) => s.included && s.requirement === 'REQUIRED').length;
  return `${total} field${total === 1 ? '' : 's'}, ${req} required`;
}

