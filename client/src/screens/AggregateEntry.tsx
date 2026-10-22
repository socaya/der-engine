import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { AggregateReadbackRow, ImportSummary } from '../api/edgeApi';
import { ErrorBlock, LoadingBlock, OfflineBanner, LocallyCommittedPill } from '../components/ScreenStates';

export interface AggregateEntryProps {
  readonly api?: Pick<typeof edgeApi, 'readAggregateValues' | 'submitAggregate' | 'health'>;
}

/** DC-07 — Aggregate entry grid for the selected dataset + OU + period. */
export function AggregateEntry({ api = edgeApi }: AggregateEntryProps = {}): JSX.Element {
  const [params] = useSearchParams();
  const dataSet = params.get('dataSet') ?? '';
  const [orgUnit, setOrgUnit] = useState(params.get('orgUnit') ?? '');
  const [period, setPeriod] = useState(params.get('period') ?? '');
  const [rows, setRows] = useState<AggregateReadbackRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.health().then((h) => { if (!cancelled) { setOffline(!h.dhis2Integrated); } })
       .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  async function load(): Promise<void> {
    setError(null);
    setRows(null);
    try {
      const resp = await api.readAggregateValues(orgUnit, period);
      setRows(resp.dataValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit(): Promise<void> {
    setSaving(true);
    try {
      const dataValues = Object.entries(edits).map(([dataElement, value]) => ({
        dataElement, orgUnit, period, value,
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
      <p>Dataset: <span data-test="aggregate-entry-dataset">{dataSet || '(none)'}</span></p>
      {offline && <OfflineBanner testId="aggregate-entry-offline" />}
      <div className="der-aggregate-filters">
        <label className="der-field"><span>Organisation unit UID</span><input data-test="aggregate-entry-orgunit" value={orgUnit} onChange={(e) => { setOrgUnit(e.target.value) }} /></label>
        <label className="der-field"><span>Period (e.g. 2026Q1)</span><input data-test="aggregate-entry-period" value={period} onChange={(e) => { setPeriod(e.target.value) }} /></label>
        <Button
          dataTest="aggregate-entry-load"
          onClick={() => { load().catch(() => undefined); }}
          disabled={!orgUnit || !period}
        >
          Load values
        </Button>
      </div>
      {error && (
        <ErrorBlock title="Aggregate error" testId="aggregate-entry-error">{error}</ErrorBlock>
      )}
      {rows === null && !error && orgUnit && period && (
        <LoadingBlock testId="aggregate-entry-loading" />
      )}
      {rows !== null && (
        <table className="der-aggregate-grid" data-test="aggregate-entry-grid">
          <thead>
            <tr><th>Data element</th><th>Current</th><th>New</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dataElement}>
                <td data-test={`aggregate-row-de-${r.dataElement}`}>{r.dataElement}</td>
                <td data-test={`aggregate-row-current-${r.dataElement}`}>{r.value}</td>
                <td>
                  <input
                    data-test={`aggregate-row-input-${r.dataElement}`}
                    value={edits[r.dataElement] ?? ''}
                    onChange={(e) =>
                      setEdits({ ...edits, [r.dataElement]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {Object.keys(edits).length > 0 && (
        <Button
          primary
          dataTest="aggregate-entry-submit"
          loading={saving}
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
