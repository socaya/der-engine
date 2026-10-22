import { useEffect, useState } from 'react';
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
import * as edgeApi from '../api/edgeApi';
import type { ActivityEntry } from '../api/edgeApi';

export interface RecentWorkProps {
  readonly api?: Pick<typeof edgeApi, 'recentActivity'>;
}

/**
 * DC-04 Recent work. Reads /edge-api/v1/activity/recent and renders the
 * user's own audit-logged actions. The optional {@link RecentWorkProps.api}
 * dependency injection makes testing without live fetch straightforward.
 */
export function RecentWork({ api = edgeApi }: RecentWorkProps = {}): JSX.Element {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.recentActivity(20);
        if (!cancelled) {
          setEntries(result.entries);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })().catch(() => {
      /* promise swallow by inner try */
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error) {
    return <NoticeBox error title="Could not load recent work" dataTest="recent-error">{error}</NoticeBox>;
  }
  if (entries === null) {
    return <div className="der-centered"><CircularLoader small /></div>;
  }

  return (
    <div className="der-recent-work">
      <h1 data-test="recent-heading">Recent work</h1>
      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableColumnHeader>Audit id</DataTableColumnHeader>
            <DataTableColumnHeader>Event</DataTableColumnHeader>
            <DataTableColumnHeader>Outcome</DataTableColumnHeader>
            <DataTableColumnHeader>Observed at</DataTableColumnHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {entries.length === 0 ? (
            <DataTableRow>
              <DataTableCell colSpan="4">No activity recorded yet.</DataTableCell>
            </DataTableRow>
          ) : (
            entries.map((e) => (
              <DataTableRow key={e.auditId} dataTest={`recent-row-${e.auditId}`}>
                <DataTableCell>{e.auditId}</DataTableCell>
                <DataTableCell>{e.eventType}</DataTableCell>
                <DataTableCell>{e.outcome}</DataTableCell>
                <DataTableCell>{e.observedAt}</DataTableCell>
              </DataTableRow>
            ))
          )}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
