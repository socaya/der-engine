import { Tag } from '@dhis2/ui';

export type SyncStatus =
  | 'LOCALLY_COMMITTED'
  | 'PENDING_CENTRAL'
  | 'CENTRAL_ACCEPTED'
  | 'CENTRAL_REJECTED'
  | 'CONFLICT_REVIEW'
  | 'UNKNOWN';

export interface SyncStatusPillProps {
  readonly status: SyncStatus;
}

/**
 * DC-17 — honest record sync status.
 *
 * DER NEVER renders "Synchronised" at Phase 03b: there is no durable journal
 * yet, so no record can honestly report CENTRAL_ACCEPTED through DER.
 * Phase 04 fills in the states beyond LOCALLY_COMMITTED / UNKNOWN.
 */
export function SyncStatusPill({ status }: SyncStatusPillProps): JSX.Element {
  const label = toLabel(status);
  const positive = status === 'CENTRAL_ACCEPTED';
  const negative = status === 'CENTRAL_REJECTED' || status === 'CONFLICT_REVIEW';
  return <Tag positive={positive} negative={negative} dataTest="sync-status-pill">{label}</Tag>;
}

function toLabel(status: SyncStatus): string {
  switch (status) {
    case 'LOCALLY_COMMITTED':
      return 'Locally committed';
    case 'PENDING_CENTRAL':
      return 'Pending central';
    case 'CENTRAL_ACCEPTED':
      return 'Centrally accepted';
    case 'CENTRAL_REJECTED':
      return 'Centrally rejected';
    case 'CONFLICT_REVIEW':
      return 'Conflict — review required';
    case 'UNKNOWN':
      return 'Unknown';
  }
}
