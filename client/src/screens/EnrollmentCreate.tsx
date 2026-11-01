import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import { ErrorBlock, LocallyCommittedPill, OfflineBanner } from '../components/ScreenStates';
import { useRunValidation } from '../hooks/useRunValidation';
import { RunValidationBanner } from '../components/RunValidationBanner';

export interface EnrollmentCreateProps {
  readonly submit?: (body: unknown) => Promise<unknown>;
}

/** DC-13 — create a new enrollment (TEI + enrollment via POST /api/tracker).
 *
 *  §2.3.36 — honours program-rule actions on tracked-entity attributes
 *  when the screen is invoked with {@code ?runId=…}. The attributes
 *  captured on this screen are configurable via
 *  {@code ?attributes=UID1,UID2,UID3} (comma-separated TEI attribute
 *  UIDs). Each attribute becomes an input; HIDEFIELD hides the input,
 *  ASSIGN pre-fills with the suggested value. */
export function EnrollmentCreate({ submit }: EnrollmentCreateProps = {}): JSX.Element {
  const { program = '' } = useParams();
  const [params] = useSearchParams();
  const runId = params.get('runId');
  const attributeUids = useMemo(() => {
    const raw = params.get('attributes');
    if (!raw) return [] as string[];
    return raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
  }, [params]);
  const [orgUnit, setOrgUnit] = useState('');
  const [tet, setTet] = useState('');
  const [enrolledAt, setEnrolledAt] = useState(new Date().toISOString().slice(0, 10));
  const [attributeEdits, setAttributeEdits] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const validation = useRunValidation(runId);

  async function doSubmit(): Promise<void> {
    setStatus('saving'); setError(null);
    // Merge operator edits + ASSIGN suggestions, skip HIDEFIELD.
    const merged: Record<string, string> = {};
    validation.assignedValues.forEach((v, k) => {
      if (!validation.hiddenFields.has(k)) merged[k] = v;
    });
    Object.entries(attributeEdits).forEach(([k, v]) => { merged[k] = v; });
    const attrs = Object.entries(merged)
      .filter(([k, v]) => !validation.hiddenFields.has(k) && v !== '')
      .map(([attribute, value]) => ({ attribute, value }));
    const body = {
      trackedEntities: [{
        trackedEntityType: tet,
        orgUnit,
        attributes: attrs,
        enrollments: [{ program, orgUnit, enrolledAt, status: 'ACTIVE',
                         attributes: attrs }],
      }],
    };
    try {
      const impl = submit ?? ((payload) =>
        fetch('/api/tracker', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
      await impl(body);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="der-enroll">
      <h1 data-test="enroll-heading">Enrol new TEI — {program}</h1>
      <OfflineBanner testId="enroll-offline" />
      {runId && (
        <RunValidationBanner state={validation} testId="enroll-validation" />
      )}
      <label className="der-field">
        <span>Tracked entity type UID</span>
        <input data-test="enroll-tet" value={tet}
                onChange={(e) => { setTet(e.target.value) }} />
      </label>
      <label className="der-field">
        <span>Organisation unit UID</span>
        <input data-test="enroll-orgunit" value={orgUnit}
                onChange={(e) => { setOrgUnit(e.target.value) }} />
      </label>
      <label className="der-field">
        <span>Enrolment date</span>
        <input data-test="enroll-date" value={enrolledAt}
                onChange={(e) => { setEnrolledAt(e.target.value) }} />
      </label>

      {attributeUids.length > 0 && (
        <section className="der-enroll-attrs" data-test="enroll-attrs">
          <h2 style={{ fontSize: 15, margin: '12px 0 6px' }}>Tracked-entity attributes</h2>
          {attributeUids.map((uid) => {
            const hidden = validation.hiddenFields.has(uid);
            if (hidden) {
              return (
                <p key={uid} className="der-field"
                   data-test={`enroll-attr-hidden-${uid}`}
                   style={{ color: '#5a6a85', margin: '4px 0' }}>
                  Attribute '{uid}' hidden by program rule — value won't be submitted.
                </p>
              );
            }
            const suggested = validation.assignedValues.get(uid) ?? null;
            const edited = attributeEdits[uid];
            const effective = edited != null ? edited : (suggested ?? '');
            const autoFilled = edited == null && suggested != null;
            return (
              <label key={uid} className="der-field">
                <span>{uid}</span>
                <input data-test={`enroll-attr-input-${uid}`}
                        value={effective}
                        style={autoFilled
                          ? { background: 'rgba(91,192,222,0.08)' } : undefined}
                        onChange={(e) =>
                          setAttributeEdits({ ...attributeEdits,
                                                [uid]: e.target.value })} />
                {autoFilled && (
                  <span data-test={`enroll-attr-hint-${uid}`}
                         style={{ fontSize: 11, color: '#2a7998' }}>
                    suggested by rule
                  </span>
                )}
              </label>
            );
          })}
        </section>
      )}

      <Button primary dataTest="enroll-submit"
              loading={status === 'saving'}
              disabled={!orgUnit || !tet}
              onClick={() => { doSubmit().catch(() => undefined); }}>
        Enrol
      </Button>
      {status === 'saved' && <LocallyCommittedPill testId="enroll-pill" />}
      {status === 'error' && error && (
        <ErrorBlock title="Enrol failed" testId="enroll-error">{error}</ErrorBlock>
      )}
    </div>
  );
}
