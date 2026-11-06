import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
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
import { validateForm } from '../forms/validation';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import { drainOfflineQueue } from '../offline/replay';
import { count as countQueue } from '../offline/queue';
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
  const [loading, setLoading] = useState(false);
  // §2.3.127 auto-save-on-blur. `dirty` tracks fieldRefs edited since
  // the last save; a debounced effect flushes them to the server.
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [saveState, setSaveState] =
      useState<'idle' | 'dirty' | 'saving' | 'saved' | 'queued' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const online = useOnlineStatus();

  // Refresh the queued-count badge whenever we transition online or
  // after an auto-save tick finishes. The hook is cheap — IndexedDB
  // count over a small keyed set.
  useEffect(() => {
    let cancelled = false;
    countQueue('aggregate').then((n) => {
      if (!cancelled) setQueuedCount(n);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [online, saveState]);

  // When the browser flips back online, drain the offline queue. The
  // drain is per-entry FIFO — a failure stops the loop so the next
  // online tick retries without blocking the UI. Always refresh the
  // queued-count badge at the end regardless of drain outcome so the
  // user sees the live number.
  useEffect(() => {
    if (!online) return;
    drainOfflineQueue().finally(() => {
      countQueue('aggregate').then(setQueuedCount).catch(() => undefined);
    });
  }, [online]);
  // Hold the latest values + form in refs so the debounced flush reads
  // fresh snapshots without re-creating the timer on every keystroke.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const formRef = useRef(form);
  formRef.current = form;

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
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(fieldRef);
      return next;
    });
    setSaveState('dirty');
  }

  function stringify(v: FieldValue): string {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return v;
  }

  const flushDirty = useCallback(async (dirtySet: ReadonlySet<string>) => {
    const activeForm = formRef.current;
    const latestValues = valuesRef.current;
    if (!activeForm || dirtySet.size === 0) return;
    setSaveState('saving');
    setError(null);
    try {
      const dataValues = activeForm.sections.flatMap((section) =>
        section.fields
          .filter((f) => f.requirement !== 'READONLY'
                       && dirtySet.has(f.fieldRef)
                       && latestValues[f.fieldRef] !== undefined
                       && latestValues[f.fieldRef] !== '')
          .map((f) => {
            const dv: { dataElement: string; value: string; categoryOptionCombo?: string } = {
              dataElement: f.dataElementUid,
              value: stringify(latestValues[f.fieldRef]!),
            };
            if (f.categoryOptionComboUid) {
              dv.categoryOptionCombo = f.categoryOptionComboUid;
            }
            return dv;
          }),
      );
      if (dataValues.length === 0) {
        setSaveState('saved');
        return;
      }
      const r = await api.submitAggregate({
        dataSet,
        orgUnit: boundOrgUnit,
        period,
        dataValues,
      });
      setResult(r);
      setLastSavedAt(new Date().toISOString());
      setSaveState(r.status === 'OFFLINE_QUEUED' ? 'queued' : 'saved');
      setDirty(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState('error');
    }
  }, [api, dataSet, boundOrgUnit, period]);

  // Debounced auto-save — waits 1.5 s after the last edit before
  // flushing the dirty set.  Operator can keep typing without
  // triggering a POST per keystroke; central never sees hot spam.
  useEffect(() => {
    if (saveState !== 'dirty') return;
    if (dirty.size === 0) return;
    if (!boundOrgUnit || !period) return;
    const timer = window.setTimeout(() => {
      flushDirty(dirty).catch(() => undefined);
    }, 1500);
    return () => { window.clearTimeout(timer); };
  }, [saveState, dirty, boundOrgUnit, period, flushDirty]);

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
        const errorCount = Array.from(issues.values())
          .filter((i) => i.severity === 'ERROR').length;
        return (
          <>
            {errorCount > 0 && (
              <NoticeBox error
                          title={`${errorCount} field${errorCount === 1 ? '' : 's'} need attention`}
                          dataTest="aggregate-entry-validation">
                Resolve the highlighted fields — auto-save holds them until the
                validation clears.
              </NoticeBox>
            )}
            <div className="der-aggregate-savebar"
                 data-test="aggregate-entry-savestate"
                 data-state={saveState}
                 data-online={online}
                 style={{ fontSize: 12, color: '#5a6a85',
                          margin: '4px 0 12px' }}>
              {!online && (
                <span data-test="aggregate-entry-offline-flag"
                       style={{ color: '#a33', marginRight: 8 }}>
                  Offline —
                </span>
              )}
              {saveState === 'idle' && 'Changes auto-save as you leave each field.'}
              {saveState === 'dirty' && 'Unsaved changes — saving shortly…'}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && (
                <>Saved{lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleTimeString()}` : ''}.</>
              )}
              {saveState === 'queued' && (
                <>Queued locally — will sync when the edge comes back online.</>
              )}
              {saveState === 'error' && 'Save failed — see error below.'}
              {queuedCount > 0 && (
                <span data-test="aggregate-entry-queued-count"
                       style={{ marginLeft: 8, color: '#555' }}>
                  ({queuedCount} queued offline)
                </span>
              )}
            </div>
            <CaptureFormRenderer
              form={form}
              values={values}
              onChange={updateField}
              disabled={saveState === 'saving'}
              issues={issues}
            />
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
