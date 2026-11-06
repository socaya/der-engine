import {
  Card,
  CheckboxField,
  InputField,
  NoticeBox,
  TextAreaField,
} from '@dhis2/ui';
import type {
  CaptureFormAssembly,
  CaptureFormField,
} from '../api/edgeApi';

export type FieldValue = string | boolean;

export interface CaptureFormRendererProps {
  readonly form: CaptureFormAssembly;
  readonly values: Record<string, FieldValue>;
  readonly onChange: (fieldRef: string, value: FieldValue) => void;
  readonly disabled?: boolean;
}

/**
 * ADR-0036 D-CAP-3 form renderer.
 *
 * Projects a workflow-step form envelope into @dhis2/ui controls so the
 * device-client looks and behaves like a stock DHIS2 capture surface. One
 * input per field keyed by `fieldRef` (= dataElementUid[:coc]) so the
 * caller's value map is the same shape the API consumes on submit.
 *
 * Version compatibility: the server projection already normalises value
 * types across DHIS2 2.41 through 2.44 (ADR-0002 / ADR-0006), so the
 * renderer only needs to switch on the stable DHIS2 valueType vocabulary.
 */
export function CaptureFormRenderer(
  { form, values, onChange, disabled }: CaptureFormRendererProps,
): JSX.Element {
  const readOnly = (f: CaptureFormField): boolean =>
    f.requirement === 'READONLY' || disabled === true || !form.ownership.isMyStep;

  return (
    <div className="der-capture-form" data-test="capture-form">
      <header className="der-capture-form__header">
        <h2 data-test="capture-form-title">{form.displayName}</h2>
        <p data-test="capture-form-binding">
          {form.formType} · {form.bindingKind} · {form.bindingUid}
        </p>
        {!form.ownership.isMyStep && (
          <NoticeBox
            warning
            title="Read-only — step not owned by this user/device"
            dataTest="capture-form-not-owned"
          >
            Inputs are disabled. This step belongs to
            role={form.ownership.ownerRole ?? '—'}, device=
            {form.ownership.ownerDeviceId ?? '—'}.
          </NoticeBox>
        )}
      </header>

      {form.upstreamContext.length > 0 && (
        <UpstreamContextPanel upstream={form.upstreamContext} values={values} />
      )}

      <div className="der-capture-form__sections">
        {form.sections.map((section, idx) => (
          <Card
            key={section.sectionUid ?? `section-${idx}`}
            dataTest={`capture-section-${section.sectionUid ?? idx}`}
          >
            <h3>{section.displayName}</h3>
            <div className="der-capture-form__fields">
              {section.fields.map((f) => (
                <FieldControl
                  key={f.fieldRef}
                  field={f}
                  value={values[f.fieldRef]}
                  readOnly={readOnly(f)}
                  onChange={onChange}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UpstreamContextPanel(
  {
    upstream,
    values,
  }: {
    upstream: CaptureFormAssembly['upstreamContext'];
    values: Record<string, FieldValue>;
  },
): JSX.Element {
  return (
    <Card dataTest="capture-upstream">
      <h3>Upstream context</h3>
      <p>
        Fields contributed by earlier workflow steps. Values are read-only here.
      </p>
      {upstream.map((step) => (
        <div
          key={step.stepId}
          className="der-capture-upstream__step"
          data-test={`capture-upstream-step-${step.stepId}`}
        >
          <h4>{step.stepDisplayName}</h4>
          <dl className="der-capture-upstream__fields">
            {step.fields.map((f) => (
              <div key={f.fieldRef} data-test={`capture-upstream-${f.fieldRef}`}>
                <dt>{labelOf(f)}</dt>
                <dd>{formatValue(values[f.fieldRef])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </Card>
  );
}

function FieldControl(
  {
    field,
    value,
    readOnly,
    onChange,
  }: {
    field: CaptureFormField;
    value: FieldValue | undefined;
    readOnly: boolean;
    onChange: (fieldRef: string, value: FieldValue) => void;
  },
): JSX.Element {
  const label = labelOf(field);
  const dataTest = `capture-field-${field.fieldRef}`;
  const required = field.requirement === 'REQUIRED';
  const asString = typeof value === 'boolean' ? String(value) : (value ?? '');

  const vt = field.valueType;
  if (vt === 'BOOLEAN' || vt === 'TRUE_ONLY') {
    return (
      <CheckboxField
        label={label}
        checked={value === true || value === 'true'}
        disabled={readOnly}
        required={required}
        dataTest={dataTest}
        onChange={({ checked }) => onChange(field.fieldRef, Boolean(checked))}
      />
    );
  }
  if (vt === 'LONG_TEXT') {
    return (
      <TextAreaField
        label={label}
        value={asString}
        disabled={readOnly}
        required={required}
        dataTest={dataTest}
        onChange={({ value: v }) => onChange(field.fieldRef, v ?? '')}
      />
    );
  }
  if (vt === 'NUMBER' || vt === 'INTEGER' || vt === 'INTEGER_POSITIVE'
      || vt === 'INTEGER_NEGATIVE' || vt === 'INTEGER_ZERO_OR_POSITIVE'
      || vt === 'PERCENTAGE' || vt === 'UNIT_INTERVAL') {
    return (
      <InputField
        label={label}
        type="number"
        value={asString}
        disabled={readOnly}
        required={required}
        dataTest={dataTest}
        onChange={({ value: v }) => onChange(field.fieldRef, v ?? '')}
      />
    );
  }
  if (vt === 'DATE') {
    return (
      <InputField
        label={label}
        type="date"
        value={asString}
        disabled={readOnly}
        required={required}
        dataTest={dataTest}
        onChange={({ value: v }) => onChange(field.fieldRef, v ?? '')}
      />
    );
  }
  if (vt === 'DATETIME') {
    return (
      <InputField
        label={label}
        type="datetime-local"
        value={asString}
        disabled={readOnly}
        required={required}
        dataTest={dataTest}
        onChange={({ value: v }) => onChange(field.fieldRef, v ?? '')}
      />
    );
  }
  if (field.optionSetUid) {
    // Option-set backed: without option-set hydration we fall through to
    // a plain text input but mark it so the form still looks DHIS2-native.
    return (
      <InputField
        label={label}
        value={asString}
        disabled={readOnly}
        required={required}
        placeholder="option code"
        dataTest={dataTest}
        onChange={({ value: v }) => onChange(field.fieldRef, v ?? '')}
      />
    );
  }
  return (
    <InputField
      label={label}
      value={asString}
      disabled={readOnly}
      required={required}
      dataTest={dataTest}
      onChange={({ value: v }) => onChange(field.fieldRef, v ?? '')}
    />
  );
}

function labelOf(f: CaptureFormField): string {
  if (f.categoryOptionComboDisplayName) {
    return `${f.dataElementDisplayName} — ${f.categoryOptionComboDisplayName}`;
  }
  return f.dataElementDisplayName;
}

function formatValue(v: FieldValue | undefined): string {
  if (v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}
