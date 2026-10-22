import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import { ErrorBlock, LocallyCommittedPill, OfflineBanner } from '../components/ScreenStates';

export interface EnrollmentCreateProps {
  readonly submit?: (body: unknown) => Promise<unknown>;
}

/** DC-13 — create a new enrollment (TEI + enrollment via POST /api/tracker). */
export function EnrollmentCreate({ submit }: EnrollmentCreateProps = {}): JSX.Element {
  const { program = '' } = useParams();
  const [orgUnit, setOrgUnit] = useState('');
  const [tet, setTet] = useState('');
  const [enrolledAt, setEnrolledAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function doSubmit(): Promise<void> {
    setStatus('saving'); setError(null);
    const body = {
      trackedEntities: [{
        trackedEntityType: tet,
        orgUnit,
        enrollments: [{ program, orgUnit, enrolledAt, status: 'ACTIVE' }],
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
      <label className="der-field"><span>Tracked entity type UID</span><input data-test="enroll-tet" value={tet} onChange={(e) => { setTet(e.target.value) }} /></label>
      <label className="der-field"><span>Organisation unit UID</span><input data-test="enroll-orgunit" value={orgUnit} onChange={(e) => { setOrgUnit(e.target.value) }} /></label>
      <label className="der-field"><span>Enrolment date</span><input data-test="enroll-date" value={enrolledAt} onChange={(e) => { setEnrolledAt(e.target.value) }} /></label>
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
