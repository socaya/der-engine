import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, LocallyCommittedPill, OfflineBanner } from '../components/ScreenStates';

export interface EventNewProps {
  readonly api?: Pick<typeof edgeApi, 'listEvents' | 'health'>;
  readonly submit?: (body: unknown) => Promise<unknown>;
}

/**
 * DC-09 / DC-14 — create a new event. Delegates POST to the generic
 * `submit` dependency so tests can stub it without wiring the shared
 * ImportSummary fetch helper.
 */
export function EventNew({ api = edgeApi, submit }: EventNewProps = {}): JSX.Element {
  const { program = '', stage = '' } = useParams();
  const [orgUnit, setOrgUnit] = useState('');
  const [programStage, setProgramStage] = useState(stage);
  const [dataElement, setDataElement] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // health badge
  if (typeof window !== 'undefined' && !offline) {
    api.health?.().then((h) => setOffline(!h.dhis2Integrated)).catch(() => undefined);
  }

  async function doSubmit(): Promise<void> {
    setStatus('saving');
    setError(null);
    const body = {
      events: [{
        program,
        programStage,
        orgUnit,
        occurredAt: new Date().toISOString(),
        status: 'ACTIVE',
        dataValues: dataElement && value ? [{ dataElement, value }] : [],
      }],
    };
    try {
      const impl = submit ?? ((payload) =>
        fetch('/api/events', {
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
    <div className="der-event-new">
      <h1 data-test="event-new-heading">New event — {program}</h1>
      {offline && <OfflineBanner testId="event-new-offline" />}
      <label className="der-field"><span>Organisation unit UID</span><input data-test="event-new-orgunit" value={orgUnit} onChange={(e) => { setOrgUnit(e.target.value) }} /></label>
      <label className="der-field"><span>Program stage UID</span><input data-test="event-new-stage" value={programStage} onChange={(e) => { setProgramStage(e.target.value) }} /></label>
      <label className="der-field"><span>Data element UID (optional)</span><input data-test="event-new-de" value={dataElement} onChange={(e) => { setDataElement(e.target.value) }} /></label>
      <label className="der-field"><span>Value</span><input data-test="event-new-value" value={value} onChange={(e) => { setValue(e.target.value) }} /></label>
      <Button primary dataTest="event-new-submit"
              loading={status === 'saving'}
              disabled={!orgUnit || !programStage}
              onClick={() => { doSubmit().catch(() => undefined); }}>
        Save event
      </Button>
      {status === 'saved' && (
        <div data-test="event-new-saved">
          <LocallyCommittedPill testId="event-new-pill" />
        </div>
      )}
      {status === 'error' && error && (
        <ErrorBlock title="Event submit failed" testId="event-new-error">{error}</ErrorBlock>
      )}
    </div>
  );
}
