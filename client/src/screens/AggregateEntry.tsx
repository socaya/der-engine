import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  NoticeBox,
  SingleSelectField,
  SingleSelectOption,
} from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type {
  CaptureFormAssembly,
  DataSetMeta,
  ImportSummary,
} from '../api/edgeApi';
import {
  ErrorBlock,
  LoadingBlock,
  OfflineBanner,
  LocallyCommittedPill,
} from '../components/ScreenStates';
import {
  CaptureFormRenderer,
  type FieldValue,
} from '../components/CaptureFormRenderer';
import { hasBlockingErrors, validateForm } from '../forms/validation';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';
import {
  generatePeriods,
  isSupportedPeriodType,
  type PeriodOption,
  type PeriodType,
} from '../periods/periodTypes';

export interface AggregateEntryProps {
  readonly api?: Pick<
    typeof edgeApi,
    'submitAggregate'
    | 'health'
    | 'getDataSetMeta'
    | 'getCaptureDataSetForm'
    | 'getCaptureDataSetData'
  >;
}

/**
 * DC-07 — Aggregate data entry.
 *
 * Renders a real DHIS2-style data-set form by consuming the ADR-0036
 * D-CAP-3 envelope from GET /edge-api/v1/capture/datasets/{uid}/form.
 * Sections, field labels, value types and category-option-combo
 * disaggregations all come from the server projection; the operator
 * sees the same shape as a stock DHIS2 Data Entry form.
 *
 * - orgUnit is the bound OU (ADR-0015), locked.
 * - period is picked from server-provided periodType. Picking a period
 *   auto-loads any previously-captured values from
 *   /edge-api/v1/capture/datasets/{uid}/data?orgUnit=…&period=….
 * - Submit packs the current field values into DHIS2's dataValueSets
 *   shape and POSTs /api/dataValueSets.
 */
export function AggregateEntry(
  { api = edgeApi }: AggregateEntryProps = {},
): JSX.Element {
  const [params] = useSearchParams();
  const dataSet = params.get('dataSet') ?? '';
  const binding = useOrgUnitBinding();
  const boundOrgUnit = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding.orgUnitId ?? ''
    : '';
  const boundOrgUnitName = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding.orgUnitDisplayName ?? boundOrgUnit
    : '';

  const [meta, setMeta] = useState<DataSetMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [form, setForm] = useState<CaptureFormAssembly | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [period, setPeriod] = useState(params.get('period') ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mount: health, dataset metadata (for periodType), form envelope.
  useEffect(() => {
    let cancelled = false;
    api.health().then((h) => { if (!cancelled) setOffline(!h.dhis2Integrated); })
       .catch(() => undefined);
    if (dataSet) {
      api.getDataSetMeta(dataSet).then((m) => {
        if (!cancelled) setMeta(m);
      }).catch((err) => {
        if (!cancelled) setMetaError(
          err instanceof Error ? err.message : String(err));
      });
      api.getCaptureDataSetForm(dataSet).then((f) => {
        if (!cancelled) setForm(f);
      }).catch((err) => {
        if (!cancelled) setFormError(
          err instanceof Error ? err.message : String(err));
      });
    }
    return () => { cancelled = true; };
  }, [api, dataSet]);

  const periodType = meta?.periodType ?? null;
  const periodOptions: PeriodOption[] = isSupportedPeriodType(periodType)
    ? generatePeriods(periodType as PeriodType, 12)
    : [];

  // Auto-load prefill when a period is picked.
  const loadPrefill = useCallback(async (): Promise<void> => {
    if (!boundOrgUnit || !period || !dataSet) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.getCaptureDataSetData(dataSet, boundOrgUnit, period);
      const seed: Record<string, FieldValue> = {};
      for (const [k, v] of Object.entries(data.cells)) seed[k] = v;
      setValues(seed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, boundOrgUnit, period, dataSet]);

  useEffect(() => { loadPrefill().catch(() => undefined); }, [loadPrefill]);

  function updateField(fieldRef: string, value: FieldValue): void {
    setValues((prev) => ({ ...prev, [fieldRef]: value }));
  }

  function stringify(v: FieldValue): string {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return v;
  }

  async function submit(): Promise<void> {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      // DHIS2 dataValueSets envelope — dataSet is required by DER
      // (DataValueSetsController §2.3.84). orgUnit + period live on
      // the envelope so per-row fields inherit; each row only carries
      // its own dataElement, value, and CoC if disaggregated.
      const dataValues = form.sections.flatMap((section) =>
        section.fields
          .filter((f) => f.requirement !== 'READONLY'
                       && values[f.fieldRef] !== undefined
                       && values[f.fieldRef] !== '')
          .map((f) => {
            const dv: { dataElement: string; value: string; categoryOptionCombo?: string } = {
              dataElement: f.dataElementUid,
              value: stringify(values[f.fieldRef]!),
            };
            if (f.categoryOptionComboUid) {
              dv.categoryOptionCombo = f.categoryOptionComboUid;
            }
            return dv;
          }),
      );
      const r = await api.submitAggregate({
        dataSet,
        orgUnit: boundOrgUnit,
        period,
        dataValues,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="der-aggregate-entry">
      <h1 data-test="aggregate-entry-heading">Aggregate entry</h1>
      <p>
        Dataset: <span data-test="aggregate-entry-dataset">{dataSet || '(none)'}</span>
        {meta?.displayName ? <> — <strong>{meta.displayName}</strong></> : null}
      </p>
      {offline && <OfflineBanner testId="aggregate-entry-offline" />}
      {!boundOrgUnit && (
        <NoticeBox error title="This edge is not bound to an organisation unit"
                   dataTest="aggregate-entry-unbound">
          An admin must bind this edge to an organisation unit on the DER
          server before capture can proceed.
        </NoticeBox>
      )}
      {metaError && (
        <ErrorBlock title="Could not load data-set metadata"
                     testId="aggregate-entry-meta-error">
          {metaError}
        </ErrorBlock>
      )}
      {formError && (
        <ErrorBlock title="Could not load data-set form"
                     testId="aggregate-entry-form-error">
          {formError}
        </ErrorBlock>
      )}

      <div className="der-aggregate-filters">
        <div className="der-field" data-test="aggregate-entry-orgunit">
          <span>Organisation unit</span>
          <strong>{boundOrgUnitName || '—'}</strong>
          {boundOrgUnit && <code>{boundOrgUnit}</code>}
        </div>
        {periodOptions.length > 0 ? (
          <SingleSelectField
            label={`Period (${periodType})`}
            selected={period}
            dataTest="aggregate-entry-period"
            onChange={({ selected }) => setPeriod(selected)}
          >
            {periodOptions.map((p) => (
              <SingleSelectOption
                key={p.id}
                value={p.id}
                label={p.label}
                dataTest={`aggregate-entry-period-${p.id}`}
              />
            ))}
          </SingleSelectField>
        ) : (
          periodType && (
            <NoticeBox warning
                        title={`Unsupported period type: ${periodType}`}
                        dataTest="aggregate-entry-period-unsupported">
              DER does not yet generate a picker for this period type.
            </NoticeBox>
          )
        )}
      </div>

      {error && (
        <ErrorBlock title="Aggregate error" testId="aggregate-entry-error">
          {error}
        </ErrorBlock>
      )}
      {loading && (
        <LoadingBlock testId="aggregate-entry-loading" />
      )}

      {form && boundOrgUnit && period && !loading && (() => {
        const issues = validateForm(form, values);
        const blocking = hasBlockingErrors(issues);
        const errorCount = Array.from(issues.values())
          .filter((i) => i.severity === 'ERROR').length;
        return (
          <>
            {errorCount > 0 && (
              <NoticeBox error
                          title={`${errorCount} field${errorCount === 1 ? '' : 's'} need attention`}
                          dataTest="aggregate-entry-validation">
                Resolve the highlighted fields before saving.
              </NoticeBox>
            )}
            <CaptureFormRenderer
              form={form}
              values={values}
              onChange={updateField}
              disabled={saving}
              issues={issues}
            />
            <div className="der-aggregate-actions">
              <Button
                primary
                dataTest="aggregate-entry-submit"
                loading={saving}
                disabled={saving || blocking}
                onClick={() => { submit().catch(() => undefined); }}
              >
                Save
              </Button>
            </div>
          </>
        );
      })()}

      {result && (
        <div data-test="aggregate-entry-result" className="der-import-summary">
          <strong>Status: {result.status}</strong>
          <LocallyCommittedPill testId="aggregate-entry-pill" />
          {(result.conflicts ?? []).length > 0 && (
            <ul data-test="aggregate-entry-conflicts">
              {(result.conflicts ?? []).map((c, i) => (
                <li key={i}>{c.object}: {c.value}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
