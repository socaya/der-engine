import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SyncStatusPill, type SyncStatus } from './SyncStatusPill';

const expected: Record<SyncStatus, string> = {
  LOCALLY_COMMITTED: 'Locally committed',
  PENDING_CENTRAL: 'Pending central',
  CENTRAL_ACCEPTED: 'Centrally accepted',
  CENTRAL_REJECTED: 'Centrally rejected',
  CONFLICT_REVIEW: 'Conflict — review required',
  UNKNOWN: 'Unknown',
};

describe('SyncStatusPill', () => {
  it.each(Object.entries(expected) as Array<[SyncStatus, string]>)(
    'renders %s as "%s"',
    (status, label) => {
      render(<SyncStatusPill status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it('never renders a bare "Synchronised" string at any phase', () => {
    // Explicitly ensure the never-rendered word is actually never rendered —
    // Phase 03 cannot report "Synchronised" because there is no journal yet.
    for (const status of Object.keys(expected) as SyncStatus[]) {
      const { unmount } = render(<SyncStatusPill status={status} />);
      expect(screen.queryByText(/^Synchronised$/)).toBeNull();
      unmount();
    }
  });
});
