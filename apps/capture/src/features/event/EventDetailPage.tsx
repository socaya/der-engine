import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi } from '../../shared/types';
import type { CaptureFormSection } from '../../shared/model';
import { parseStageForm } from '../../shared/parser';
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

/**
 * Event detail page (NAV-004). Read-only overview of a single
 * event — professionally rendered as a DER-styled form view
 * rather than a raw UID/code dump. Stage + org-unit + option-set
 * codes are resolved to display names; the toolbar fits on one
 * line (Back · title · status · Delete · Edit); the sectioned
 * body mirrors the real form layout so operators recognise the
 * shape from the edit form.
 *
 * The Edit action navigates to the dedicated form route; this
 * page never renders an editable form inline.
 */
export function EventDetailPage(
  { api, programUid, orgUnitUid, orgUnitDisplayName, eventId }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    orgUnitDisplayName: string;
    eventId: string;
  },
): JSX.Element {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [sections, setSections] =
    useState<ReadonlyArray<CaptureFormSection>>([]);
  const [stageName, setStageName] = useState<string | null>(null);
  /** Per-option-set code→displayName lookup so option-set value
   *  cells render "Household outreach" instead of "HO-01". */
  const [optionLabels, setOptionLabels] =
    useState<ReadonlyMap<string, string>>(new Map());
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
        // Fetch stage form + stage list in parallel so we can both
        // (a) render fields by their configured sections and (b)
        // show the stage's human display name in the identity
        // strip instead of the raw UID.
        const [form, stagesRes] = await Promise.all([
          api.getCaptureStageForm(programUid, d.programStageUid)
            .catch(() => null),
          api.listCaptureProgramStages(programUid)
            .catch(() => ({ stages: [] })),
        ]);
        if (cancelled) return;
        if (form) {
          const parsed = parseStageForm(d.programStageUid, form);
          setSections(parsed.sections);
          // Resolve every option-set referenced on this stage to a
          // code→displayName map. Parallelised + cached in the
          // module-level option-set cache shared by FormEngine, so
          // the lookup is cheap and repeat visits hit RAM.
          const osUids = Array.from(new Set(parsed.sections.flatMap(
            (s) => s.fields.map((f) => f.optionSetId)
              .filter((x): x is string => typeof x === 'string'))));
          if (osUids.length > 0) {
            const combined = new Map<string, string>();
            await Promise.all(osUids.map(async (uid) => {
              try {
                const os = await api.getOptionSet(uid);
                for (const o of (os?.options ?? [])) {
                  const code = o.code ?? o.id ?? '';
                  const label = o.displayName ?? o.name ?? code;
                  if (code !== '') {
                    combined.set(uid + '::' + code, label);
                  }
                }
              } catch { /* keep lookups partial on failure */ }
            }));
            if (!cancelled) setOptionLabels(combined);
          }
        }
        const stage = stagesRes.stages.find(
          (s) => s.stageUid === d.programStageUid);
        if (stage) setStageName(stage.displayName);
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

  const totalFilled = useMemo(() => {
    if (detail == null) return 0;
    return Object.values(detail.dataValues)
      .filter((v) => v != null && String(v).trim() !== '').length;
  }, [detail]);
  const totalFields = useMemo(() => sections.reduce(
    (acc, s) => acc + s.fields.length, 0), [sections]);

  if (status === 'loading') {
    return (
      <p className="cap-sub" data-test="ev-detail-loading"
         style={{ marginLeft: 20 }}>
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

  const bound = orgUnitUid === detail.orgUnitUid
    && orgUnitDisplayName !== '';

  return (
    <>
      {/* Single-row toolbar — Back, title, status pill on the
       *  left; Delete + Edit flush right. Section-head flex-wrap
       *  keeps narrow screens graceful. */}
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
        <span className="cap-section-head__count">
          {totalFilled}/{totalFields} filled
        </span>
        <span className="cap-section-head__rule" />
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="ev-detail-delete"
                title="Delete this event from the edge"
                style={{ color: 'var(--der-danger)',
                  borderColor: 'var(--der-danger)' }}
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  if (!confirm('Delete event ' + eventId.slice(0, 8)
                      + '…?\n\nThis removes the event from the '
                      + 'edge immediately; central sync '
                      + 'follows on the next drain.')) {
                    return;
                  }
                  void (async () => {
                    try {
                      await api.deleteEvent(eventId);
                      navEvent.list(programUid);
                    } catch (err) {
                      // eslint-disable-next-line no-alert
                      alert('Delete failed: '
                        + ((err as Error).message
                          ?? 'unknown error'));
                    }
                  })();
                }}>
          Delete
        </button>
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="ev-detail-edit"
                title="Open the event in the edit form"
                onClick={() => navEvent.edit(programUid, eventId)}>
          Edit event
        </button>
      </div>

      {/* Identity strip — key/value metadata. UID stays as a code
       *  chip so operators can copy it; stage + OU use display
       *  names from the mirror. Date formatted for humans. */}
      <div className="cap-identity-strip" data-test="ev-identity-strip">
        <div>
          <strong>Stage</strong>
          <span>{stageName ?? detail.programStageUid}</span>
        </div>
        <div>
          <strong>Occurred</strong>
          <span>{formatOccurredAt(detail.occurredAt)}</span>
        </div>
        <div>
          <strong>Org unit</strong>
          <span>
            {bound ? orgUnitDisplayName : detail.orgUnitUid}
          </span>
        </div>
        <div>
          <strong>UID</strong>
          <code>{detail.eventUid}</code>
        </div>
      </div>

      {/* Sectioned read-only form view — same section layout as
       *  the edit form, but each field renders as a label + value
       *  pair instead of an input. Mirrors DER Modern Form shape
       *  so operators recognise the structure. */}
      {sections.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 20 }}>
          No values recorded on this event.
        </p>
      ) : (
        <div className="cap-form" data-test="ev-detail-sections">
          {sections.map((s, i) => (
            <fieldset key={(s.id ?? s.displayName) + ':' + i}
                      className="cap-form-section">
              {s.displayName && (
                <legend className="cap-form-section__title">
                  <span className="cap-form-section__title-text">
                    {s.displayName}
                  </span>
                </legend>
              )}
              <div className="cap-form-section__grid">
                {s.fields.map((f) => {
                  const raw = detail.dataValues[f.id] ?? '';
                  const display = formatDisplayValue(f, raw,
                    optionLabels);
                  return (
                    <div key={f.fieldRef}
                         className="cap-input cap-readfield"
                         data-test={'cap-field-' + f.id}>
                      <span className="cap-input__label">{f.label}</span>
                      <span className={'cap-readfield__value'
                          + (raw === '' ? ' cap-readfield__value--empty'
                            : '')}>
                        {raw === '' ? '—' : display}
                      </span>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </>
  );
}

/** Format an ISO timestamp for the identity strip — operators
 *  care about the day much more than the exact second. Falls
 *  back to the raw string if it isn't parseable so we never
 *  swallow a malformed server value. */
function formatOccurredAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Resolve a raw dataValue to its human display form:
 *   - option-set backed fields map stored code → displayName;
 *   - BOOLEAN / TRUE_ONLY stored "true" / "false" → "Yes" / "No";
 *   - DATE / DATETIME formatted via locale;
 *   - everything else returned verbatim.
 *
 *  optionLabels is keyed by `${optionSetUid}::${code}` so two
 *  option sets with overlapping codes don't collide. */
function formatDisplayValue(
  field: { valueType: string; optionSetId: string | null },
  raw: string,
  optionLabels: ReadonlyMap<string, string>,
): string {
  if (raw === '') return '';
  if (field.optionSetId) {
    // Checkboxes store comma-separated codes; map each piece.
    if (raw.includes(',')) {
      return raw.split(',').map((c) => c.trim())
        .map((c) => optionLabels.get(field.optionSetId + '::' + c) ?? c)
        .filter((s) => s !== '')
        .join(', ');
    }
    return optionLabels.get(field.optionSetId + '::' + raw) ?? raw;
  }
  if (field.valueType === 'BOOLEAN' || field.valueType === 'TRUE_ONLY') {
    if (raw === 'true') return 'Yes';
    if (raw === 'false') return 'No';
    return raw;
  }
  if (field.valueType === 'DATE' && raw.length >= 10) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined,
        { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  if (field.valueType === 'DATETIME') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString();
    }
  }
  return raw;
}
