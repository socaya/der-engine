import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { MetadataListItem } from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

export interface ProgramPickerProps {
  readonly api?: Pick<typeof edgeApi, 'metadataList' | 'health'>;
}

/** DC-08 — Program picker. Routes to event-only or tracker flow based on programType. */
export function ProgramPicker({ api = edgeApi }: ProgramPickerProps = {}): JSX.Element {
  const [items, setItems] = useState<MetadataListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await api.health();
        if (!cancelled) {
          setOffline(!h.dhis2Integrated);
        }
        const resp = await api.metadataList('programs');
        if (!cancelled) {
          setItems((resp.programs ?? resp.items ?? []) as MetadataListItem[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  if (error) {
    return <ErrorBlock title="Could not load programs" testId="programs-error">{error}</ErrorBlock>;
  }
  if (items === null) {
    return <LoadingBlock testId="programs-loading" />;
  }
  return (
    <div className="der-programs">
      <h1 data-test="programs-heading">Programs</h1>
      {offline && <OfflineBanner testId="programs-offline" />}
      {items.length === 0 ? (
        <EmptyBlock title="No programs available" testId="programs-empty">
          Run a metadata sync (admin) to populate the mirror.
        </EmptyBlock>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>Program</DataTableColumnHeader>
              <DataTableColumnHeader>Type</DataTableColumnHeader>
              <DataTableColumnHeader>Open</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {items.map((p) => {
              const type = String(p.programType ?? 'UNKNOWN');
              const trackerFlow = type === 'WITH_REGISTRATION';
              return (
                <DataTableRow key={p.id}>
                  <DataTableCell>
                    <span data-test={`program-${p.id}`}>{p.displayName}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <span data-test={`program-type-${p.id}`}>{type}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      to={trackerFlow ? `/tracker/${p.id}/search` : `/programs/${p.id}/events`}
                      data-test={`program-open-${p.id}`}
                    >
                      {trackerFlow ? 'Tracker' : 'Events'}
                    </Link>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
