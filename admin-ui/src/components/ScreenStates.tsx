import type { ReactNode } from 'react';

/** Admin-ui equivalents of the client ScreenStates helpers (plain HTML). */

export function LoadingBlock({ testId }: { testId: string }): JSX.Element {
  return <div className="ea-centered" data-test={testId} role="status">Loading…</div>;
}

export function ErrorBlock({ title, testId, children }:
    { title: string; testId: string; children: ReactNode }): JSX.Element {
  return (
    <section className="ea-notice ea-notice--error" data-test={testId} role="alert">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

export function EmptyBlock({ title, testId, children }:
    { title: string; testId: string; children: ReactNode }): JSX.Element {
  return (
    <section className="ea-notice" data-test={testId}>
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}

export function OfflineBanner({ testId }: { testId: string }): JSX.Element {
  return (
    <section className="ea-notice ea-notice--warning" data-test={testId}>
      DHIS2 central not reachable; actions here write to the local edge store
      and will reconcile when WAN returns.
    </section>
  );
}
