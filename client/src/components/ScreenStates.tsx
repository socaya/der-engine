import type { ReactNode } from 'react';
import { CircularLoader, NoticeBox } from '@dhis2/ui';

/**
 * Shared Phase 06 state helpers so every DC screen honours the specification
 * states (initial/loading, empty, data-loaded, error, edge-unavailable,
 * permission-denied) in one place.
 */

export function LoadingBlock({ testId }: { testId: string }): JSX.Element {
  return (
    <div className="der-centered" data-test={testId}>
      <CircularLoader small />
    </div>
  );
}

export function ErrorBlock({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <NoticeBox error title={title} dataTest={testId}>
      {children}
    </NoticeBox>
  );
}

export function EmptyBlock({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <NoticeBox title={title} dataTest={testId}>
      {children}
    </NoticeBox>
  );
}

export function OfflineBanner({ testId }: { testId: string }): JSX.Element {
  return (
    <NoticeBox warning title="DHIS2 central not reachable" dataTest={testId}>
      Local edits remain usable; sync will resume automatically when the edge
      regains WAN access.
    </NoticeBox>
  );
}

export function LocallyCommittedPill({ testId }: { testId: string }): JSX.Element {
  return (
    <span className="der-pill der-pill--local" data-test={testId}>
      Locally committed
    </span>
  );
}

export function PendingCentralPill({ testId }: { testId: string }): JSX.Element {
  return (
    <span className="der-pill der-pill--pending" data-test={testId}>
      Pending central
    </span>
  );
}
