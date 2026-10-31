import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import * as md from './wizardMetadata';
import type {
  Breakable, MetadataOption, WizardWorkflowType,
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
  api?: Pick<typeof edgeApi, 'saveWorkflow' | 'listDevices'>;
}

type Stage = 1 | 2 | 3;

interface StepRow {
  breakable: Breakable;
  included: boolean;
  ownerDeviceId: string | null;
  ownerRole: 'OPERATOR' | 'REVIEWER' | 'ADMIN';
}

export function WorkflowWizard({ api = edgeApi }: WorkflowWizardProps = {}): JSX.Element {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>(1);

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

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load devices once — needed on step 3.
  useEffect(() => {
    api.listDevices().then((d) => setDevices(d.devices ?? [])).catch(() => undefined);
  }, [api]);

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

  // Load breakables when entering step 3.
  useEffect(() => {
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
          included: true,
          ownerDeviceId: null,
          ownerRole: 'OPERATOR',
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
        displayName: name.trim(),
        type,
        metadata: chosenMetadata,
        steps: includedRows.map((r) => ({
          breakable: r.breakable,
          ownerDeviceId: r.ownerDeviceId,
          ownerRole: r.ownerRole,
        })),
      });
      const saved = await api.saveWorkflow(payload);
      navigate(`/workflows/${saved.workflowId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ea-screen ea-wizard" data-test="wiz-root">
      <h1 data-test="wiz-heading">New capture workflow</h1>

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

          {breakables == null && <LoadingBlock testId="wiz-breakables-loading" />}
          {breakables && (
            <table className="ea-wizard-rows" data-test="wiz-rows">
              <thead>
                <tr>
                  <th scope="col">Include</th>
                  <th scope="col">
                    {typeLabel(type) === 'dataset' ? 'Section' : 'Stage'}
                  </th>
                  <th scope="col">Role</th>
                  <th scope="col">Device</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.breakable.id} data-test={`wiz-row-${i}`}
                       className={r.included ? '' : 'is-dim'}>
                    <td>
                      <input type="checkbox"
                              data-test={`wiz-row-${i}-include`}
                              checked={r.included}
                              onChange={(e) => updateRow(i, { included: e.target.checked })} />
                    </td>
                    <td>{r.breakable.displayName}</td>
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
                ))}
              </tbody>
            </table>
          )}

          {saveError && <ErrorBlock title="Save failed"
                                     testId="wiz-save-error">{saveError}</ErrorBlock>}

          <WizardFooter
            onBack={() => setStage(2)}
            onSave={{ onClick: doSave, disabled: !canSave || saving, saving }}
          />
        </section>
      )}
    </div>
  );

  function updateRow(ix: number, patch: Partial<StepRow>): void {
    const copy = [...rows];
    copy[ix] = { ...copy[ix], ...patch };
    setRows(copy);
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
    onSave?: { onClick: () => void; disabled: boolean; saving: boolean };
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
          {onSave.saving ? 'Saving…' : 'Create workflow'}
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
