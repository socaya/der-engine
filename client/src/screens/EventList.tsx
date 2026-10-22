import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { EventRow } from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner } from '../components/ScreenStates';

export interface EventListProps {
  readonly api?: Pick<typeof edgeApi, 'listEvents' | 'listTrackerEvents' | 'health'>;
  readonly trackerShape?: boolean;
}

/**
 * DC-10 / DC-12 — list events for a program at an orgUnit. Supports both
 * legacy /api/events and modern /api/tracker/events shapes per the active
 * CapabilityFlags.
 */
export function EventList({ api = edgeApi, trackerShape = false }: EventListProps = {}): JSX.Element {
  const { program = '' } = useParams();
  const [orgUnit, setOrgUnit] = useState('');
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.health().then((h) => { if (!cancelled) setOffline(!h.dhis2Integrated); })
       .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  async function load(): Promise<void> {
    setError(null); setRows(null);
    try {
      const resp = trackerShape
        ? await api.listTrackerEvents(program, orgUnit)
        : await api.listEvents(program, orgUnit);
      const r = resp as { events?: EventRow[]; instances?: EventRow[] };
      setRows((r.events ?? r.instances ?? []) as EventRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="der-event-list">
      <h1 data-test="events-heading">Events — {program}</h1>
      {offline && <OfflineBanner testId="events-offline" />}
      <div className="der-event-filters">
        <label className="der-field"><span>Organisation unit UID</span><input data-test="events-orgunit" value={orgUnit} onChange={(e) => { setOrgUnit(e.target.value) }} /></label>
        <Button
          dataTest="events-load"
          onClick={() => { load().catch(() => undefined); }}
          disabled={!orgUnit}
        >
          Load
        </Button>
        <Link to={`/programs/${program}/events/new`} data-test="events-new">New event</Link>
      </div>
      {error && <ErrorBlock title="Events error" testId="events-error">{error}</ErrorBlock>}
      {rows === null && !error && orgUnit && <LoadingBlock testId="events-loading" />}
      {rows !== null && rows.length === 0 && (
        <EmptyBlock title="No events" testId="events-empty">
          No events recorded locally for this program + orgUnit.
        </EmptyBlock>
      )}
      {rows !== null && rows.length > 0 && (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>Event</DataTableColumnHeader>
              <DataTableColumnHeader>Occurred</DataTableColumnHeader>
              <DataTableColumnHeader>Status</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((r) => (
              <DataTableRow key={r.event}>
                <DataTableCell>
                  <span data-test={`event-${r.event}`}>{r.event.slice(0, 8)}…</span>
                </DataTableCell>
                <DataTableCell>{r.occurredAt}</DataTableCell>
                <DataTableCell>{r.status}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
