import type { CaptureWorkflowStep, EdgeDeviceRow, OwnerRole,
                SectionKind, StepKind } from '../../api/edgeApi';

/** All section kinds known on the server (V045 → V054). */
const SECTION_KINDS: readonly SectionKind[] = [
  'DATASET_SECTION',
  'DATASET_ELEMENT',
  'DATA_ELEMENT_GROUP',
  'COC_SPLIT',
  'PERIOD_SCOPE',
  'PROGRAM_STAGE',
  'PROGRAM_STAGE_SECTION',
  'PROGRAM_SECTION',
  'TEI_ATTRIBUTE_GROUP',
  'TEI_TYPE_ATTRIBUTES',
  'ENROLLMENT_FORM',
  'RELATIONSHIP',
  'EVENT_INSTANCE',
  'ATTRIBUTE_OPTION_COMBO',
  'ORG_UNIT_SCOPE',
  'AD_HOC',
] as const;

const OWNER_ROLES: readonly OwnerRole[] = ['ADMIN', 'OPERATOR', 'REVIEWER'] as const;
const STEP_KINDS: readonly StepKind[] = ['CAPTURE', 'REVIEW', 'APPROVE', 'DISPATCH'] as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };
type EditableStep = Mutable<CaptureWorkflowStep>;

interface Props {
  steps: readonly CaptureWorkflowStep[];
  devices: readonly EdgeDeviceRow[];
  onChange(steps: EditableStep[]): void;
}

export function StepsEditor({ steps, devices, onChange }: Props): JSX.Element {
  const next: EditableStep[] = steps.map((s) => ({
    ...s,
    fields: [...s.fields],
  }));

  function update(ix: number, patch: Partial<EditableStep>): void {
    const copy = [...next];
    copy[ix] = { ...copy[ix], ...patch };
    onChange(copy);
  }

  function remove(ix: number): void {
    const copy = next.filter((_, i) => i !== ix);
    onChange(copy);
  }

  function addStep(): void {
    const copy = [...next];
    // Mint a UUID client-side so dependency rows can reference it
    // immediately — avoids placeholder-resolution round-trips on save.
    copy.push({
      stepId: crypto.randomUUID(),
      ordinal: copy.length,
      displayName: `Step ${copy.length + 1}`,
      ownerRole: 'OPERATOR',
      stepKind: 'CAPTURE',
      sectionKind: 'AD_HOC',
      sectionRef: null,
      fields: [],
    });
    onChange(copy);
  }

  return (
    <div className="ea-cwf-steps" data-test="cwf02-steps-editor">
      {next.length === 0 && (
        <p className="ea-text-muted" style={{ padding: '8px 0', fontSize: 13 }}>
          No steps yet. Add one to assign a slice of this workflow to a device.
        </p>
      )}
      {next.map((s, i) => (
        <section key={i} className="ea-cwf-step-card"
                 data-test={`cwf02-step-${i}`}
                 style={{ border: '1px solid var(--der-border, #ddd)',
                           borderRadius: 6, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center',
                         justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 14 }}>Step {s.ordinal}</strong>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                    data-test={`cwf02-step-${i}-remove`}
                    onClick={() => remove(i)}>Remove</button>
          </div>

          <Row label="Ordinal">
            <input type="number" value={s.ordinal} min={0}
                   style={{ width: 80 }}
                   data-test={`cwf02-step-${i}-ordinal`}
                   onChange={(e) => update(i, { ordinal: Number(e.target.value) })} />
          </Row>

          <Row label="Display name">
            <input type="text" value={s.displayName}
                   data-test={`cwf02-step-${i}-name`}
                   onChange={(e) => update(i, { displayName: e.target.value })} />
          </Row>

          <Row label="Owner role">
            <select value={s.ownerRole}
                    data-test={`cwf02-step-${i}-role`}
                    onChange={(e) => update(i, { ownerRole: e.target.value as OwnerRole })}>
              {OWNER_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Row>

          <Row label="Assigned device">
            <select value={s.ownerDeviceId ?? ''}
                    data-test={`cwf02-step-${i}-device`}
                    onChange={(e) => update(i,
                      { ownerDeviceId: e.target.value === '' ? null : e.target.value })}>
              <option value="">— inherit workflow default —</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.displayName ?? d.deviceId.slice(0, 12)}
                  {d.formFactor && d.formFactor !== 'UNKNOWN'
                    ? ` · ${d.formFactor.toLowerCase()}` : ''}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Step kind">
            <select value={s.stepKind}
                    data-test={`cwf02-step-${i}-stepkind`}
                    onChange={(e) => update(i, { stepKind: e.target.value as StepKind })}>
              {STEP_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Row>

          <Row label="Section kind">
            <select value={s.sectionKind ?? 'AD_HOC'}
                    data-test={`cwf02-step-${i}-sectionkind`}
                    onChange={(e) => update(i,
                      { sectionKind: e.target.value as SectionKind })}>
              {SECTION_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Row>

          <Row label="Section ref (DHIS2 UID)">
            <input type="text" value={s.sectionRef ?? ''}
                   placeholder="e.g. section UID (null for AD_HOC)"
                   data-test={`cwf02-step-${i}-sectionref`}
                   onChange={(e) => update(i,
                     { sectionRef: e.target.value === '' ? null : e.target.value })} />
          </Row>
        </section>
      ))}
      <button type="button" className="ea-btn ea-btn--sm"
              data-test="cwf02-step-add"
              onClick={addStep}>
        + Add step
      </button>
    </div>
  );
}

function Row({ label, children }:
                { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '160px 1fr',
                     gap: 8, alignItems: 'center', marginTop: 6,
                     fontSize: 13 }}>
      <span style={{ color: 'var(--der-ink-500)' }}>{label}</span>
      <span>{children}</span>
    </label>
  );
}
