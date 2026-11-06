import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  NoticeBox,
  SingleSelectField,
  SingleSelectOption,
} from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type {
  AggregateReadbackRow,
  DataSetMeta,
  ImportSummary,
} from '../api/edgeApi';
import {
  ErrorBlock,
  LoadingBlock,
  OfflineBanner,
  LocallyCommittedPill,
} from '../components/ScreenStates';
import { useRunValidation } from '../hooks/useRunValidation';
import { RunValidationBanner } from '../components/RunValidationBanner';
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
    'readAggregateValues' | 'submitAggregate' | 'health' | 'getDataSetMeta'
  >;
}

/**
 * DC-07 — Aggregate entry grid.
 *
 * orgUnit is sourced from the DER server's bound OU (ADR-0015); the
 * operator cannot override it on the client — the server rejects
 * writes against other OUs anyway.
 *
 * period is picked from a list generated for the dataset's periodType,
 * which is read from the DER mirror via GET /api/dataSets/{uid}. The
 * operator does not type a period id by hand.
 */
export function AggregateEntry(
  { api = edgeApi }: AggregateEntryProps = {},
): JSX.Element {
  const [params] = useSearchParams();
  const dataSet = params.get('dataSet') ?? '';
  const runId = params.get('runId');
  const binding = useOrgUnitBinding();
  const boundOrgUnit = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding.orgUnitId ?? ''
    : '';
  const boundOrgUnitName = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding.orgUnitDisplayName ?? boundOrgUnit
    : '';

  const [meta, setMeta] = useState<DataSetMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [period, setPeriod] = useState(params.get('period') ?? '');
  const [rows, setRows] = useState<AggregateReadbackRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);

  const validation = useRunValidation(runId);

  useEffect(() => {
    let cancelled = false;
    api.health().then((h) => { if (!cancelled) { setOffline(!h.dhis2Integrated); } })
       .catch(() => undefined);
    if (dataSet) {
      api.getDataSetMeta(dataSet).then((m) => {
        if (!cancelled) setMeta(m);
      }).catch((err) => {
        if (!cancelled) setMetaError(
          err instanceof Error ? err.message : String(err));
      });
    }
    return () => { cancelled = true; };
  }, [api, dataSet]);

  const periodType = meta?.periodType ?? null;
  const periodOptions: PeriodOption[] = isSupportedPeriodType(periodType)
    ? generatePeriods(periodType as PeriodType, 12)
    : [];

  async function load(): Promise<void> {
    setError(null);
    setRows(null);
    try {
      const resp = await api.readAggregateValues(boundOrgUnit, period);
      setRows(resp.dataValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit(): Promise<void> {
    setSaving(true);
    try {
      const merged: Record<string, string> = {};
      validation.assignedValues.forEach((v, k) => {
        if (!validation.hiddenFields.has(k)) merged[k] = v;
      });
      Object.entries(edits).forEach(([k, v]) => { merged[k] = v; });
      const dataValues = Object.entries(merged)
        .filter(([k]) => !validation.hiddenFields.has(k))
        .map(([dataElement, value]) => ({
          dataElement, orgUnit: boundOrgUnit, period, value,
        }));
      const r = await api.submitAggregate({ dataValues });
      setResult(r);
      setEdits({});
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
      {runId && (
        <RunValidationBanner state={validation}
                              testId="aggregate-entry-validation" />
      )}
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
        <Button
          dataTest="aggregate-entry-load"
          onClick={() => { load().catch(() => undefined); }}
          disabled={!boundOrgUnit || !period}
        >
          Load values
        </Button>
      </div>

      {error && (
        <ErrorBlock title="Aggregate error" testId="aggregate-entry-error">{error}</ErrorBlock>
      )}
      {rows === null && !error && boundOrgUnit && period && (
        <LoadingBlock testId="aggregate-entry-loading" />
      )}
      {rows !== null && (
        <table className="der-aggregate-grid" data-test="aggregate-entry-grid">
          <thead>
            <tr><th>Data element</th><th>Current</th><th>New</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hidden = validation.hiddenFields.has(r.dataElement);
              if (hidden) {
                return (
                  <tr key={r.dataElement} data-test={`aggregate-row-hidden-${r.dataElement}`}
                       style={{ opacity: 0.4 }}>
                    <td data-test={`aggregate-row-de-${r.dataElement}`}>
                      {r.dataElement}
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#5a6a85' }}>
                        hidden by rule
                      </span>
                    </td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                );
              }
              const suggested = validation.assignedValues.get(r.dataElement);
              const edited = edits[r.dataElement];
              const value = edited != null ? edited : (suggested ?? '');
              const isAutoFilled = edited == null && suggested != null;
              return (
                <tr key={r.dataElement}
                     data-test={isAutoFilled
                       ? `aggregate-row-autofilled-${r.dataElement}`
                       : undefined}>
                  <td data-test={`aggregate-row-de-${r.dataElement}`}>{r.dataElement}</td>
                  <td data-test={`aggregate-row-current-${r.dataElement}`}>{r.value}</td>
                  <td>
                    <input
                      data-test={`aggregate-row-input-${r.dataElement}`}
                      value={value}
                      style={isAutoFilled
                        ? { background: 'rgba(91,192,222,0.08)' } : undefined}
                      onChange={(e) =>
                        setEdits({ ...edits, [r.dataElement]: e.target.value })}
                    />
                    {isAutoFilled && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#2a7998' }}
                             data-test={`aggregate-row-assign-hint-${r.dataElement}`}>
                        suggested by rule
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {(Object.keys(edits).length > 0 || validation.assignedValues.size > 0) && (
        <Button
          primary
          dataTest="aggregate-entry-submit"
          loading={saving}
          disabled={!boundOrgUnit || !period}
          onClick={() => { submit().catch(() => undefined); }}
        >
          Save
        </Button>
      )}
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
