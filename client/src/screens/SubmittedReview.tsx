import { useEffect, useState } from 'react';
import { DataTable, DataTableBody, DataTableCell, DataTableColumnHeader, DataTableHead, DataTableRow } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { ActivityEntry } from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock, OfflineBanner, LocallyCommittedPill, PendingCentralPill } from '../components/ScreenStates';

export interface SubmittedReviewProps {
  readonly api?: Pick<typeof edgeApi, 'recentActivity' | 'health'>;
}

/** DC-16 — Submitted-work review: cross-check what was accepted locally vs pending central. */
export function SubmittedReview({ api = edgeApi }: SubmittedReviewProps = {}): JSX.Element {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await api.health();
        if (!cancelled) setOffline(!h.dhis2Integrated);
        const r = await api.recentActivity(50);
        if (!cancelled) {
          setRows(r.entries.filter((e) =>
            e.eventType.endsWith('_WRITE_SUCCESS') || e.eventType.endsWith('_WRITE_REJECTED')));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  if (error) return <ErrorBlock title="Review failed" testId="review-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="review-loading" />;

  return (
    <div className="der-review">
      <h1 data-test="review-heading">Submitted work</h1>
      {offline && <OfflineBanner testId="review-offline" />}
      {rows.length === 0 ? (
        <EmptyBlock title="Nothing submitted yet" testId="review-empty">
          Your recent writes will appear here once committed locally.
        </EmptyBlock>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>When</DataTableColumnHeader>
              <DataTableColumnHeader>Event</DataTableColumnHeader>
              <DataTableColumnHeader>Outcome</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((r) => (
              <DataTableRow key={r.auditId}>
                <DataTableCell>{r.observedAt}</DataTableCell>
                <DataTableCell>
                  <span data-test={`review-row-type-${r.auditId}`}>{r.eventType}</span>
                </DataTableCell>
                <DataTableCell>
                  {r.outcome === 'SUCCESS'
                    ? <LocallyCommittedPill testId={`review-row-local-${r.auditId}`} />
                    : <span data-test={`review-row-outcome-${r.auditId}`}>{r.outcome}</span>}
                  <PendingCentralPill testId={`review-row-pending-${r.auditId}`} />
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
