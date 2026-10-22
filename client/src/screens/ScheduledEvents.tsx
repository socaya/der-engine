import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow } from '@dhis2/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

export interface ScheduledEventRow {
  readonly event: string;
  readonly program: string;
  readonly programStage: string;
  readonly orgUnit: string;
  readonly dueAt: string;
  readonly status: string;
}

export interface ScheduledEventsProps {
  readonly load?: () => Promise<readonly ScheduledEventRow[]>;
}

/** DC-15 — scheduled / due-today events. */
export function ScheduledEvents({ load }: ScheduledEventsProps = {}): JSX.Element {
  const [rows, setRows] = useState<readonly ScheduledEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const impl = load ?? (() => Promise.resolve([] as const));
    impl()
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [load]);

  if (error) {
    return <ErrorBlock title="Scheduled events failed" testId="scheduled-error">{error}</ErrorBlock>;
  }
  if (rows === null) {
    return <LoadingBlock testId="scheduled-loading" />;
  }
  return (
    <div className="der-scheduled">
      <h1 data-test="scheduled-heading">Scheduled events</h1>
      <OfflineBanner testId="scheduled-offline" />
      {rows.length === 0 ? (
        <EmptyBlock title="Nothing due" testId="scheduled-empty">
          No scheduled events due at this edge today.
        </EmptyBlock>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>Event</DataTableColumnHeader>
              <DataTableColumnHeader>Due</DataTableColumnHeader>
              <DataTableColumnHeader>Program</DataTableColumnHeader>
              <DataTableColumnHeader>Status</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((r) => (
              <DataTableRow key={r.event}>
                <DataTableCell>
                  <Link
                    to={`/tracker/${r.program}/stage/${r.programStage}/new`}
                    data-test={`scheduled-event-${r.event}`}
                  >
                    {r.event.slice(0, 8)}…
                  </Link>
                </DataTableCell>
                <DataTableCell>{r.dueAt}</DataTableCell>
                <DataTableCell>{r.program}</DataTableCell>
                <DataTableCell>{r.status}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
