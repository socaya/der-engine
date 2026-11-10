import type { ReactNode } from 'react';

/**
 * UX-D canonical per-event header.
 *
 * Aligned to the DHIS2 Capture <WidgetEvent> + <EventHeader> pattern:
 * one row per event / stage-event / single-event-program entry with
 * the event title, an inline status chip (ACTIVE / COMPLETED /
 * SCHEDULED / SKIPPED), optional meta slot (occurred-at, program,
 * org unit), and a right-aligned action slot.
 *
 * Supersedes the ad-hoc `.cap-section-head` + inline status markup
 * in TrackerStageEditor and EventFormPage. One header contract
 * across tracker-stage and event-only flows keeps status tone,
 * occurred-at formatting, and the action slot aligned.
 *
 * Clinical use (encounter header) framed the naming of the fields
 * but the component is domain-neutral: any DHIS2 event (program-
 * stage or event-only program) renders with this header.
 *
 * Props:
 *   • `title`      — stage name or event title
 *   • `status`     — DHIS2 event status ("ACTIVE", "COMPLETED", …)
 *   • `statusTone` — chip tone; independent of status label
 *   • `meta`       — right-of-title meta nodes (program, OU, date)
 *   • `actions`    — right-aligned action slot (save / cancel / print)
 */
export type EventStatusTone = 'ok' | 'muted' | 'warn' | 'danger' | 'info';

export interface EventHeaderProps {
  readonly title: string;
  readonly status?: string;
  readonly statusTone?: EventStatusTone;
  /** Leading slot — typically a Back button rendered before the
   *  title. Some flows (EventFormPage) need a leading navigation
   *  affordance; most flows don't. */
  readonly leading?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly dataTest?: string;
}

export function EventHeader(
  { title, status, statusTone = 'ok', leading, meta, actions,
    dataTest = 'event-header' }: EventHeaderProps,
): JSX.Element {
  return (
    <header className="cap-section-head" data-test={dataTest}>
      {leading}
      <h2 className="cap-section-head__title">
        <span>{title}</span>
        {status && (
          <span className={`cap-chip cap-chip--${statusTone}`}
                data-test={`${dataTest}-status`}
                style={{ marginLeft: 10, fontSize: 12,
                          fontWeight: 500 }}>
            {status}
          </span>
        )}
      </h2>
      {meta && (
        <div className="cap-section-head__meta"
             style={{ display: 'flex', gap: 14, flexWrap: 'wrap',
                       alignItems: 'center', fontSize: 13,
                       color: 'var(--der-text-muted)' }}>
          {meta}
        </div>
      )}
      {actions && (
        <div className="cap-section-head__actions"
             style={{ marginLeft: 'auto', display: 'flex', gap: 8,
                       flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
