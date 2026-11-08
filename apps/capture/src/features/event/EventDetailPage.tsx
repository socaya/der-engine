import { useEffect, useState } from 'react';
import type { CaptureApi } from '../../shared/types';
import { navEvent } from '../../shared/routing';

interface EventDetail {
  eventUid: string;
  enrollmentUid: string | null;
  programUid: string;
  programStageUid: string;
  orgUnitUid: string;
  occurredAt: string;
  status: string | null;
  dataValues: Record<string, string>;
}

interface StageFieldLabel {
  dataElement: string;
  label: string;
}

/**
 * Event detail page (NAV-004). Read-only overview of a single
 * event — UID, stage, status, occurred-at, values, OU. The Edit
 * action navigates to the dedicated form route; this page never
 * renders an editable form inline.
 */
export function EventDetailPage(
  { api, programUid, eventId }: {
    api: CaptureApi;
    programUid: string;
    eventId: string;
  },
): JSX.Element {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [labels, setLabels] =
    useState<ReadonlyArray<StageFieldLabel>>([]);
  const [status, setStatus] =
    useState<'loading' | 'idle' | 'err'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const d = await api.getCaptureEventDetail(eventId);
        if (cancelled) return;
        setDetail(d);
        // Pull the stage form so we can label values with display
        // names instead of raw data-element UIDs.
        try {
          const form = await api.getCaptureStageForm(
            programUid, d.programStageUid);
          if (cancelled) return;
          const labelList: StageFieldLabel[] = [];
          for (const s of form.sections) {
            for (const f of s.fields) {
              labelList.push({ dataElement: f.dataElementUid,
                label: f.dataElementDisplayName ?? f.dataElementUid });
            }
          }
          setLabels(labelList);
        } catch { /* labels are optional */ }
        setStatus('idle');
      } catch (err) {
        if (!cancelled) {
          setStatus('err');
          setMsg((err as Error).message ?? 'Failed to load event');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, programUid]);

  if (status === 'loading') {
    return (
      <p className="cap-sub" data-test="ev-detail-loading">
        Loading event…
      </p>
    );
  }
  if (status === 'err' || detail == null) {
    return (
      <div className="cap-strip cap-strip--err"
           data-test="ev-detail-err">
        {msg ?? 'Could not load this event'}
      </div>
    );
  }

  const labelByUid = new Map(labels.map((l) => [l.dataElement, l.label]));
  const values = Object.entries(detail.dataValues)
    .filter(([, v]) => v !== '' && v != null)
    .sort((a, b) => (labelByUid.get(a[0]) ?? a[0])
      .localeCompare(labelByUid.get(b[0]) ?? b[0]));

  return (
    <>
      <div className="cap-section-head" data-test="ev-detail-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="ev-detail-back"
                title="Back to the events working list (Alt+B)"
                onClick={() => navEvent.list(programUid)}
                style={{ padding: '4px 10px', fontSize: 12 }}>
          ← Back to list
        </button>
        <h2 className="cap-section-head__title">Event</h2>
        {detail.status && (
          <span className={'cap-status cap-status--'
              + (detail.status === 'COMPLETED' ? 'ok' : 'active')}
                data-test="ev-detail-status">
            {detail.status === 'COMPLETED' ? 'Completed' : 'Active'}
          </span>
        )}
        <span className="cap-section-head__rule" />
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="ev-detail-edit"
                title="Open the event in the edit form"
                onClick={() => navEvent.edit(programUid, eventId)}>
          Edit event
        </button>
      </div>

      <div className="cap-identity-strip" data-test="ev-identity-strip">
        <div>
          <span className="cap-toolbar__field-label">Event UID</span>
          <code className="cap-toolbar__ou-code">{detail.eventUid}</code>
        </div>
        <div>
          <span className="cap-toolbar__field-label">Stage</span>
          <code className="cap-toolbar__ou-code">{detail.programStageUid}</code>
        </div>
        <div>
          <span className="cap-toolbar__field-label">Occurred at</span>
          <span style={{ marginLeft: 8, color: '#4a5768',
            fontSize: 13 }}>{detail.occurredAt}</span>
        </div>
        <div>
          <span className="cap-toolbar__field-label">Org unit</span>
          <code className="cap-toolbar__ou-code">{detail.orgUnitUid}</code>
        </div>
      </div>

      <div className="cap-section-head">
        <h2 className="cap-section-head__title">Values</h2>
        <span className="cap-section-head__count">
          {values.length === 0 ? 'none'
            : values.length + ' field'
              + (values.length === 1 ? '' : 's')}
        </span>
        <span className="cap-section-head__rule" />
      </div>
      {values.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 14 }}>
          No values recorded on this event.
        </p>
      ) : (
        <dl className="cap-info__dl" data-test="ev-detail-values"
            style={{ marginLeft: 14 }}>
          {values.map(([uid, v]) => (
            <div key={uid}>
              <dt>{labelByUid.get(uid) ?? uid}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
