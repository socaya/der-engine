import type { ReactNode } from 'react';
import { CircularLoader } from '@dhis2/ui';
import { UiIcon } from './UiIcon';

/**
 * Admin-ui standard screen-state primitives — quiet, DER-native
 * tone-coloured blocks. Replaces the earlier `@dhis2/ui NoticeBox`
 * surface that fought with the rest of the DER chrome.
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
    <section className="ea-state-block ea-state-block--danger" data-test={testId}
             role="alert">
      <div className="ea-state-block-icon" aria-hidden="true">
        <UiIcon icon="attention" size={20} />
      </div>
      <div className="ea-state-block-body">
        <h2 className="ea-state-block-title">{title}</h2>
        <div className="ea-state-block-content">{children}</div>
      </div>
    </section>
  );
}

export function EmptyBlock({ title, testId, children }:
    { title: string; testId: string; children: ReactNode }): JSX.Element {
  return (
    <section className="ea-state-block ea-state-block--muted" data-test={testId}>
      <div className="ea-state-block-icon" aria-hidden="true">
        <UiIcon icon="overview" size={20} />
      </div>
      <div className="ea-state-block-body">
        <h2 className="ea-state-block-title">{title}</h2>
        <div className="ea-state-block-content">{children}</div>
      </div>
    </section>
  );
}

export function OfflineBanner({ testId }: { testId: string }): JSX.Element {
  return (
    <section className="ea-state-block ea-state-block--warning" data-test={testId}
             role="status">
      <div className="ea-state-block-icon" aria-hidden="true">
        <UiIcon icon="compat" size={20} />
      </div>
      <div className="ea-state-block-body">
        <h2 className="ea-state-block-title">DHIS2 central unreachable</h2>
        <div className="ea-state-block-content">
          DHIS2 central is not reachable. Actions here write to the local edge
          store and reconcile when WAN returns.
        </div>
      </div>
    </section>
  );
}
