/**
 * Per-row edge-vs-central sync indicator used by the Capture tracker +
 * event lists.
 *
 * Addresses the UX audit §5 P1 gap — the Capture lists previously
 * showed DHIS2 lifecycle status (ACTIVE / COMPLETED / …) but not the
 * DER-specific edge-vs-central state, so operators couldn't tell
 * which rows were still waiting to drain. The underlying data comes
 * from the JournalStateController batch endpoint; refs with no
 * journal row render as "Edge only".
 *
 * State → (tone, icon, label) mapping deliberately matches the
 * admin-ui lineage drawer so one vocabulary covers both surfaces.
 */
export interface SyncChipState {
  readonly state?: string;
  readonly attemptCount?: number;
}

export function SyncChip({ sync, dataTest }: {
  sync?: SyncChipState;
  dataTest?: string;
}): JSX.Element {
  const state = sync?.state ?? null;
  const { tone, label, title } = describe(state, sync?.attemptCount ?? 0);
  return (
    <span className={`cap-chip cap-chip--${tone}`}
          data-test={dataTest}
          data-sync-state={state ?? 'EDGE_ONLY'}
          title={title}>
      {label}
    </span>
  );
}

function describe(state: string | null, attemptCount: number):
  { tone: 'ok' | 'warn' | 'danger' | 'muted' | 'neutral';
    label: string;
    title: string } {
  if (state === null) {
    return {
      tone: 'muted',
      label: 'Edge only',
      title: 'Saved locally on this edge. Not yet entered the drain '
        + 'queue — will join on the next operator save or drain tick.',
    };
  }
  if (state === 'CENTRAL_ACCEPTED') {
    return {
      tone: 'ok', label: 'Synced',
      title: 'Central DHIS2 has accepted this row.',
    };
  }
  if (state === 'PENDING' || state === 'IN_FLIGHT') {
    return {
      tone: 'warn',
      label: state === 'IN_FLIGHT' ? 'Syncing' : 'Queued',
      title: state === 'IN_FLIGHT'
        ? 'Drain worker is actively posting this row to Central.'
        : 'In the drain queue; will post on the next drain tick.',
    };
  }
  if (state === 'RETRYABLE') {
    return {
      tone: 'warn', label: `Retry (${attemptCount})`,
      title: `Previous attempts failed (${attemptCount}); the drain `
        + 'worker will try again on the next tick.',
    };
  }
  if (state === 'CENTRAL_REJECTED' || state === 'CONFLICT_REVIEW') {
    return {
      tone: 'danger',
      label: state === 'CONFLICT_REVIEW' ? 'Conflict' : 'Rejected',
      title: state === 'CONFLICT_REVIEW'
        ? 'Central reported a conflict — needs operator resolution.'
        : 'Central rejected this row — needs fixing.',
    };
  }
  if (state === 'UNKNOWN_OUTCOME') {
    return {
      tone: 'warn', label: 'Unknown',
      title: 'Central did not confirm the outcome of the last attempt. '
        + 'The drain will retry.',
    };
  }
  return {
    tone: 'neutral',
    label: state,
    title: `Journal state: ${state}`,
  };
}
