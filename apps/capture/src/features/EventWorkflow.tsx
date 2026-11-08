import { useEffect, useRef } from 'react';
import type { CaptureApi } from '../shared/types';
import { EventListPage } from './event/EventListPage';
import { EventDetailPage } from './event/EventDetailPage';
import { EventFormPage } from './event/EventFormPage';
import { EventSheetPage } from './event/EventSheetPage';
import { parseCaptureRoute, navEvent } from '../shared/routing';

/**
 * Event (WITHOUT_REGISTRATION) workflow router. v3 NAV-001..008
 * mandate separate full-page routes for list, detail and form.
 * This component parses the hash and dispatches to the right
 * sub-page — it never renders two of them at once.
 */
export function EventWorkflow(
  { api, programUid, orgUnitUid, orgUnitDisplayName, hashRoute,
    onListCount }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string; orgUnitDisplayName: string;
    hashRoute: string;
    /** Published upwards by EventListPage so the capture host can
     *  render the "N of M events" chip next to the Mode indicator
     *  instead of in a secondary row below the filters. Non-list
     *  routes publish null so the chip disappears. */
    onListCount?: (c: { total: number; filtered: number;
      noun: string } | null) => void;
  },
): JSX.Element {
  // Normalize home / mismatched route to the event list for this
  // program.
  useEffect(() => {
    const route = parseCaptureRoute('#' + hashRoute);
    const current = (route.kind === 'event-list'
      || route.kind === 'event-sheet'
      || route.kind === 'event-detail'
      || route.kind === 'event-form')
        && route.programId === programUid;
    if (!current) navEvent.list(programUid);
  }, [programUid]);

  const route = parseCaptureRoute('#' + hashRoute);

  // Non-list routes clear the host's list-count chip so it
  // doesn't linger when the operator opens a detail or form page.
  const lastKindRef = useRef<string>('');
  useEffect(() => {
    if (route.kind !== 'event-list' && lastKindRef.current !== route.kind) {
      onListCount?.(null);
    }
    lastKindRef.current = route.kind;
  }, [route.kind, onListCount]);

  if (route.kind === 'event-sheet') {
    return (
      <EventSheetPage api={api}
                       programUid={programUid}
                       orgUnitUid={orgUnitUid} />
    );
  }
  if (route.kind === 'event-detail') {
    return (
      <EventDetailPage api={api}
                        programUid={programUid}
                        orgUnitUid={orgUnitUid}
                        orgUnitDisplayName={orgUnitDisplayName}
                        eventId={route.eventId} />
    );
  }
  if (route.kind === 'event-form') {
    return (
      <EventFormPage api={api}
                      programUid={programUid}
                      orgUnitUid={orgUnitUid}
                      eventId={route.eventId} />
    );
  }
  return (
    <EventListPage api={api}
                    programUid={programUid}
                    orgUnitUid={orgUnitUid}
                    onCountChange={onListCount} />
  );
}
