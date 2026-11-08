import { useEffect } from 'react';
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
  { api, programUid, orgUnitUid, orgUnitDisplayName, hashRoute }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string; orgUnitDisplayName: string;
    hashRoute: string;
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
                    orgUnitUid={orgUnitUid} />
  );
}
