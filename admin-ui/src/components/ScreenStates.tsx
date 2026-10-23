import type { ReactNode } from 'react';
import { CircularLoader, NoticeBox } from '@dhis2/ui';

/**
 * Admin-ui standard screen-state primitives, styled with @dhis2/ui so
 * every EA screen renders consistent loading/empty/error/offline
 * cards without bespoke CSS.
 */

export function LoadingBlock({ testId }: { testId: string }): JSX.Element {
  return (
    <div className="ea-centered" data-test={testId} role="status">
      <CircularLoader small />
      <span className="ea-centered-text">Loading…</span>
    </div>
  );
}

export function ErrorBlock({ title, testId, children }:
    { title: string; testId: string; children: ReactNode }): JSX.Element {
  return (
    <div className="ea-notice-wrap" data-test={testId}>
      <NoticeBox error title={title}>
        {children}
      </NoticeBox>
    </div>
  );
}

export function EmptyBlock({ title, testId, children }:
    { title: string; testId: string; children: ReactNode }): JSX.Element {
  return (
    <div className="ea-notice-wrap" data-test={testId}>
      <NoticeBox title={title}>{children}</NoticeBox>
    </div>
  );
}

export function OfflineBanner({ testId }: { testId: string }): JSX.Element {
  return (
    <div className="ea-notice-wrap" data-test={testId}>
      <NoticeBox warning title="DHIS2 central unreachable">
        DHIS2 central is not reachable. Actions here write to the local edge
        store and reconcile when WAN returns.
      </NoticeBox>
    </div>
  );
}
