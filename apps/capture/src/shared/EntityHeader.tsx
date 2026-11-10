import type { ReactNode } from 'react';

/**
 * UX-D canonical tracked-entity / subject header.
 *
 * Aligned to the DHIS2 Capture <TrackedEntityHeader> and
 * <EnrollmentHeader> pattern: a dashboard-top identity row carrying
 * the subject's display name, one primary status chip, zero or more
 * context chips (notes count, relationship count, enrolment date,
 * …), and an optional right-aligned action slot. The DOM mirrors
 * `.cap-profile-pane__head` so existing stylesheet rules apply —
 * this is a React-side consolidation, not a visual rework.
 *
 * Clinical use (tracked entity = patient, status = enrolment state)
 * drove the design but the component is intentionally domain-neutral:
 * it serves any tracker program whose dashboard needs a single
 * identity banner — surveillance subjects, inventory assets,
 * referrals, workflow cases. Four Capture surfaces consume it:
 * TrackerDetailPage (profile pane), TrackerDashboard (identity row),
 * TrackerRegisterPage and TrackerEnrolPage (post-save banners).
 *
 * Props:
 *   • `displayName` — DHIS2 displayName of the subject
 *   • `status`      — DHIS2 enrolment / case status label
 *   • `statusTone`  — maps to cap-chip tone (ok / muted / warn / danger)
 *   • `chips`       — pre-rendered chip nodes (counts, badges, dates)
 *   • `actions`     — right-aligned action slot (edit / export / …)
 *
 * The companion {@link EventHeader} covers single-event / stage-event
 * contexts (encounter-level).
 */
export type EntityStatusTone = 'ok' | 'muted' | 'warn' | 'danger';

export interface EntityHeaderProps {
  readonly displayName: string;
  readonly status?: string;
  readonly statusTone?: EntityStatusTone;
  readonly chips?: ReactNode;
  readonly actions?: ReactNode;
  readonly dataTest?: string;
}

export function EntityHeader(
  { displayName, status, statusTone = 'ok', chips, actions,
    dataTest = 'entity-header' }: EntityHeaderProps,
): JSX.Element {
  return (
    <header className="cap-profile-pane__head" data-test={dataTest}>
      <div className="cap-profile-pane__ident">
        <h2 className="cap-profile-pane__name">
          {displayName || 'Tracked entity'}
        </h2>
        <div className="cap-profile-pane__chips">
          {status && (
            <span className={`cap-chip cap-chip--${statusTone}`}
                  data-test={`${dataTest}-status`}>
              {status}
            </span>
          )}
          {chips}
        </div>
      </div>
      {actions && (
        <div className="cap-profile-pane__actions">
          {actions}
        </div>
      )}
    </header>
  );
}
