import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, LocallyCommittedPill, OfflineBanner } from '../components/ScreenStates';
import { useRunValidation } from '../hooks/useRunValidation';
import { RunValidationBanner } from '../components/RunValidationBanner';

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
  const [params] = useSearchParams();
  const runId = params.get('runId');
  const [orgUnit, setOrgUnit] = useState('');
  const [programStage, setProgramStage] = useState(stage);
  const [dataElement, setDataElement] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // §2.3.34 — program-rule actions. When run-scoped we hide the DE
  // row if the server marked it hidden and auto-fill with ASSIGN.
  const validation = useRunValidation(runId);
  const deHidden = dataElement !== '' && validation.hiddenFields.has(dataElement);
  const deAssigned = dataElement !== ''
    ? validation.assignedValues.get(dataElement) ?? null
    : null;
  const effectiveValue = value !== '' ? value : (deAssigned ?? '');

  // health badge
  if (typeof window !== 'undefined' && !offline) {
    api.health?.().then((h) => setOffline(!h.dhis2Integrated)).catch(() => undefined);
  }

  async function doSubmit(): Promise<void> {
    setStatus('saving');
    setError(null);
    const dvs: { dataElement: string; value: string }[] = [];
    if (dataElement && !deHidden) {
      dvs.push({ dataElement, value: effectiveValue });
    }
    const body = {
      events: [{
        program,
        programStage,
        orgUnit,
        occurredAt: new Date().toISOString(),
        status: 'ACTIVE',
        dataValues: dvs,
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
      {runId && (
        <RunValidationBanner state={validation} testId="event-new-validation" />
      )}
      <label className="der-field"><span>Organisation unit UID</span><input data-test="event-new-orgunit" value={orgUnit} onChange={(e) => { setOrgUnit(e.target.value) }} /></label>
      <label className="der-field"><span>Program stage UID</span><input data-test="event-new-stage" value={programStage} onChange={(e) => { setProgramStage(e.target.value) }} /></label>
      <label className="der-field"><span>Data element UID (optional)</span><input data-test="event-new-de" value={dataElement} onChange={(e) => { setDataElement(e.target.value) }} /></label>
      {deHidden ? (
        <p className="der-field" data-test="event-new-de-hidden"
            style={{ color: '#5a6a85' }}>
          Field &apos;{dataElement}&apos; hidden by program rule — value won&apos;t be submitted.
        </p>
      ) : (
        <label className="der-field">
          <span>Value</span>
          <input data-test="event-new-value" value={effectiveValue}
                  style={deAssigned != null && value === ''
                    ? { background: 'rgba(91,192,222,0.08)' } : undefined}
                  onChange={(e) => { setValue(e.target.value) }} />
          {deAssigned != null && value === '' && (
            <span data-test="event-new-value-hint" style={{ fontSize: 11, color: '#2a7998' }}>
              suggested by rule
            </span>
          )}
        </label>
      )}
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
