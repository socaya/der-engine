import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow,
} from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { MetadataListItem } from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

export interface AggregateDatasetPickerProps {
  readonly api?: Pick<typeof edgeApi, 'metadataList' | 'health'>;
}

/**
 * DC-06 — Aggregate entry dataset picker. Enumerates the DER mirror's
 * aggregate datasets so the operator can start a reporting pass. Honours
 * the required UI states per `docs/ui/screens/DC-06.md`.
 */
export function AggregateDatasetPicker(
  { api = edgeApi }: AggregateDatasetPickerProps = {},
): JSX.Element {
  const [datasets, setDatasets] = useState<MetadataListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await api.health();
        if (!cancelled && health.dhis2Integrated === false) {
          setOffline(true);
        }
        const resp = await api.metadataList('dataSets');
        if (cancelled) {
          return;
        }
        const items = (resp.dataSets ?? resp.items ?? []) as MetadataListItem[];
        setDatasets(items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error) {
    return (
      <ErrorBlock title="Could not load datasets" testId="aggregate-datasets-error">
        {error}
      </ErrorBlock>
    );
  }
  if (datasets === null) {
    return <LoadingBlock testId="aggregate-datasets-loading" />;
  }
  return (
    <div className="der-aggregate-datasets">
      <h1 data-test="aggregate-datasets-heading">Aggregate reporting</h1>
      <p>Select a dataset to open the entry grid.</p>
      {offline && <OfflineBanner testId="aggregate-datasets-offline" />}
      {datasets.length === 0 ? (
        <EmptyBlock
          title="No datasets available"
          testId="aggregate-datasets-empty"
        >
          Run a metadata sync (admin) to populate datasets.
        </EmptyBlock>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>Dataset</DataTableColumnHeader>
              <DataTableColumnHeader>Action</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {datasets.map((ds) => (
              <DataTableRow key={ds.id}>
                <DataTableCell>
                  <span data-test={`aggregate-dataset-${ds.id}`}>{ds.displayName}</span>
                </DataTableCell>
                <DataTableCell>
                  <Link
                    to={`/aggregate/entry?dataSet=${ds.id}`}
                    data-test={`aggregate-dataset-open-${ds.id}`}
                  >
                    Open
                  </Link>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
