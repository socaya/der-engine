import { useDataQuery } from '@dhis2/app-runtime';
import {
  CircularLoader,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumnHeader,
  DataTableHead,
  DataTableRow,
  NoticeBox,
} from '@dhis2/ui';
import { SyncStatusPill } from '../components/SyncStatusPill';

/**
 * Generic read-only metadata browser for the five mirrored DHIS2 entity types.
 *
 * Uses @dhis2/app-runtime's useDataQuery; the DataProvider's baseUrl is empty,
 * so the Data Engine issues GET /api/<resource>, which DER's emulator serves.
 *
 * Phase 03c scope: a single page (first 500 rows) with per-row SyncStatusPill.
 * Full pagination/filtering lands in Phase 03.5 along with writes.
 */

export type MetadataResource =
  | 'organisationUnits'
  | 'dataElements'
  | 'dataSets'
  | 'programs'
  | 'trackedEntityTypes';

export interface MetadataBrowserProps {
  readonly resource: MetadataResource;
  readonly title: string;
  readonly extraColumns?: ReadonlyArray<{ header: string; field: string }>;
}

interface Pager {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export function MetadataBrowser({ resource, title, extraColumns = [] }: MetadataBrowserProps): JSX.Element {
  const query = {
    page: {
      resource,
      params: () => ({ page: 1, pageSize: 500 }),
    },
  };

  const { loading, error, data } = useDataQuery<{ page: Record<string, unknown> }>(query);

  if (loading) {
    return <div className="der-centered"><CircularLoader /></div>;
  }
  if (error) {
    return (
      <NoticeBox error title={`Could not load ${title}`} dataTest="browser-error">
        {error.message}
      </NoticeBox>
    );
  }

  const envelope = data?.page ?? {};
  const pager = (envelope.pager as Pager | undefined) ?? { page: 1, pageSize: 500, total: 0, pageCount: 0 };
  const items = (envelope[resource] as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div className="der-metadata-browser">
      <h1 data-test={`browser-${resource}-heading`}>{title}</h1>
      <p>
        Served from the DER edge mirror. {pager.total} total; showing the first {items.length}.
        Freshness depends on the last metadata sync.
      </p>
      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableColumnHeader>ID</DataTableColumnHeader>
            <DataTableColumnHeader>Display name</DataTableColumnHeader>
            {extraColumns.map((c) => (
              <DataTableColumnHeader key={c.field}>{c.header}</DataTableColumnHeader>
            ))}
            <DataTableColumnHeader>Sync status</DataTableColumnHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {items.length === 0 ? (
            <DataTableRow>
              <DataTableCell colSpan={String(3 + extraColumns.length)}>
                No rows. Trigger metadata sync from the Launcher if you expect data here.
              </DataTableCell>
            </DataTableRow>
          ) : (
            items.map((row) => (
              <DataTableRow key={String(row.id ?? Math.random())} dataTest={`browser-row-${String(row.id)}`}>
                <DataTableCell>{String(row.id ?? '')}</DataTableCell>
                <DataTableCell>{String(row.displayName ?? row.name ?? '')}</DataTableCell>
                {extraColumns.map((c) => (
                  <DataTableCell key={c.field}>{String(row[c.field] ?? '')}</DataTableCell>
                ))}
                <DataTableCell>
                  <SyncStatusPill status="LOCALLY_COMMITTED" />
                </DataTableCell>
              </DataTableRow>
            ))
          )}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
