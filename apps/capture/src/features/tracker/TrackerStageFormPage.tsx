import { useEffect, useState } from 'react';
import type { CaptureApi } from '../../shared/types';
import { TrackerStageEditor } from '../TrackerStageEditor';
import { navTracker } from '../../shared/routing';

/**
 * Tracker stage event form page (NAV-003, NAV-006). Full-page
 * create/edit form for a single stage event. The working list,
 * record detail and timeline live on separate routes.
 *
 * <p>When the route points at an existing event, we resolve its
 * stage UID via {@code getCaptureEventDetail} before mounting
 * the editor. For a new event, the stage is already in the URL.
 * After save / cancel we navigate back to the record detail
 * page so NAV-006 ("after save, navigate to record details")
 * is honoured.</p>
 */
export function TrackerStageFormPage(
  { api, programUid, orgUnitUid, enrollmentId, stageId, eventId,
    onResolveTei }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    enrollmentId: string;
    /** Non-null when creating a new event. */
    stageId: string | null;
    /** Non-null when editing an existing event. */
    eventId: string | null;
    /** The detail page needs a TEI UID to route back to. The
     *  stage form inherits the enrolment; this callback asks the
     *  parent (which knows the enrolment → TEI mapping) to resolve
     *  the TEI, or we fall back to the TrackerListPage. */
    onResolveTei: (enrollmentUid: string) => Promise<string | null>;
  },
): JSX.Element {
  const [resolvedStage, setResolvedStage] = useState<string | null>(
    stageId);
  const [state, setState] =
    useState<'loading' | 'ready' | 'err'>(stageId ? 'ready' : 'loading');
  const [msg, setMsg] = useState<string | null>(null);

  // When editing an existing event, resolve its stage UID before
  // mounting the editor (the editor is handed stageUid up-front).
  useEffect(() => {
    if (stageId) { setResolvedStage(stageId); setState('ready'); return; }
    if (!eventId) { setState('err');
      setMsg('Route is missing both stage and event'); return; }
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const detail = await api.getCaptureEventDetail(eventId);
        if (cancelled) return;
        setResolvedStage(detail.programStageUid);
        setState('ready');
      } catch (err) {
        if (!cancelled) {
          setState('err');
          setMsg((err as Error).message
            ?? 'Could not load the event');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [stageId, eventId]);

  async function goBack(): Promise<void> {
    const tei = await onResolveTei(enrollmentId);
    if (tei) navTracker.detail(programUid, tei);
    else navTracker.list(programUid);
  }

  if (state === 'loading') {
    return (
      <p className="cap-sub" data-test="tr-stageform-loading">
        Loading event…
      </p>
    );
  }
  if (state === 'err' || resolvedStage == null) {
    return (
      <div className="cap-strip cap-strip--err"
           data-test="tr-stageform-err">
        {msg ?? 'Could not open this stage form'}
      </div>
    );
  }
  return (
    <>
      <div className="cap-section-head" data-test="tr-stageform-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-stageform-back"
                title="Back to the tracked-entity detail page (Alt+B)"
                onClick={() => { void goBack(); }}
                style={{ padding: '4px 10px', fontSize: 13 }}>
          ← Back to record
        </button>
        <h2 className="cap-section-head__title">
          {eventId ? 'Edit stage event' : 'New stage event'}
        </h2>
        <span className="cap-section-head__rule" />
      </div>
      <TrackerStageEditor
        api={api}
        programUid={programUid}
        stageUid={resolvedStage}
        enrolmentUid={enrollmentId}
        orgUnitUid={orgUnitUid}
        eventUid={eventId}
        onSaved={() => { void goBack(); }}
        onCancel={() => { void goBack(); }} />
    </>
  );
}
