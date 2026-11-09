import { useEffect, useRef } from 'react';
import type { CaptureApi } from '../shared/types';
import { TrackerListPage } from './tracker/TrackerListPage';
import { TrackerDetailPage } from './tracker/TrackerDetailPage';
import { TrackerRegisterPage } from './tracker/TrackerRegisterPage';
import { TrackerEnrolPage } from './tracker/TrackerEnrolPage';
import { TrackerStageFormPage } from './tracker/TrackerStageFormPage';
import { TrackerRelationshipWizardPage }
  from './tracker/TrackerRelationshipWizardPage';
import { parseCaptureRoute, navTracker } from '../shared/routing';

/**
 * Tracker (WITH_REGISTRATION) workflow router. v3 NAV-001..008
 * mandate that list, detail and form are separate full-page
 * routes, so this component is a thin hash-route dispatcher — it
 * never renders two of those at the same time.
 *
 * <p>The sub-pages themselves are the full implementations:
 * {@link TrackerListPage}, {@link TrackerDetailPage},
 * {@link TrackerRegisterPage}, {@link TrackerStageFormPage}.</p>
 */
export function TrackerWorkflow(
  { api, programUid, orgUnitUid, hashRoute, onListCount }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string; orgUnitDisplayName: string;
    hashRoute: string;
    /** Published upwards by TrackerListPage so the capture host
     *  can render the "N of M TEIs" chip next to the Mode chip
     *  instead of in a secondary row below the filters. Non-list
     *  routes publish null so the chip disappears. */
    onListCount?: (c: { total: number; filtered: number;
      noun: string } | null) => void;
  },
): JSX.Element {
  // If the operator just picked a program but the hash is empty
  // (home), normalize to the tracker working list. One-shot per
  // program change so a deliberate deep link isn't overridden.
  useEffect(() => {
    const route = parseCaptureRoute('#' + hashRoute);
    const current = (route.kind === 'tracker-list'
      || route.kind === 'tracker-detail'
      || route.kind === 'tracker-register'
      || route.kind === 'tracker-enrol'
      || route.kind === 'tracker-stage-form')
        && route.programId === programUid;
    if (!current) navTracker.list(programUid);
  }, [programUid]);

  const route = parseCaptureRoute('#' + hashRoute);

  // Non-list routes clear the host's list-count chip so the
  // "1 TEI" chip from the list doesn't linger over the detail
  // / register / enrol / stage-form pages.
  const lastKindRef = useRef<string>('');
  useEffect(() => {
    if (route.kind !== 'tracker-list'
        && lastKindRef.current !== route.kind) {
      onListCount?.(null);
    }
    lastKindRef.current = route.kind;
  }, [route.kind, onListCount]);

  async function resolveTeiForEnrolment(
    enrollmentUid: string,
  ): Promise<string | null> {
    try {
      // Walk the current enrolment list for this program/OU to map
      // enrolment → TEI. Cheap because the list is usually small
      // per facility and the metadata mirror caches it.
      const list = await api.listTrackerEntities(programUid, orgUnitUid, 500);
      const rows = list.trackedEntities ?? list.instances ?? [];
      for (const r of rows) {
        const teiUid = r.trackedEntity ?? r.trackedEntityInstance;
        if (!teiUid) continue;
        const enrs = await api.listCaptureTeiEnrollments(teiUid, programUid);
        if (enrs.enrollments.some(
          (e) => e.enrollmentUid === enrollmentUid)) {
          return teiUid;
        }
      }
    } catch { /* fall through to null */ }
    return null;
  }

  if (route.kind === 'tracker-detail') {
    return (
      <TrackerDetailPage api={api}
                          programUid={programUid}
                          orgUnitUid={orgUnitUid}
                          teiId={route.teiId} />
    );
  }
  if (route.kind === 'tracker-relationship-form') {
    return (
      <TrackerRelationshipWizardPage api={api}
                                       programUid={programUid}
                                       orgUnitUid={orgUnitUid}
                                       teiId={route.teiId}
                                       preFromKind={route.fromKind}
                                       preFromUid={route.fromUid}
                                       preTypeUid={route.preType} />
    );
  }
  if (route.kind === 'tracker-register') {
    return (
      <TrackerRegisterPage api={api}
                            programUid={programUid}
                            orgUnitUid={orgUnitUid} />
    );
  }
  if (route.kind === 'tracker-enrol') {
    return (
      <TrackerEnrolPage api={api}
                         programUid={programUid}
                         orgUnitUid={orgUnitUid}
                         teiId={route.teiId} />
    );
  }
  if (route.kind === 'tracker-stage-form') {
    return (
      <TrackerStageFormPage api={api}
                             programUid={programUid}
                             orgUnitUid={orgUnitUid}
                             enrollmentId={route.enrollmentId}
                             stageId={route.stageId}
                             eventId={route.eventId}
                             onResolveTei={resolveTeiForEnrolment} />
    );
  }
  // Default to the working list for tracker-list OR when we're
  // in the middle of a navigation transition (route still points
  // at a different program).
  return (
    <TrackerListPage api={api}
                      programUid={programUid}
                      orgUnitUid={orgUnitUid}
                      onCountChange={onListCount} />
  );
}
