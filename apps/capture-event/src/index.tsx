import { useEffect, useState, type FormEvent } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'submitting' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

interface EventRow {
  readonly event?: string;
  readonly occurredAt?: string;
  readonly eventDate?: string;
  readonly program?: string;
  readonly programStage?: string;
}

/**
 * Event-program capture app (C-UI-5c slice 4). Replaces
 * EventNew.tsx + EventList.tsx over the slice-4 rollout. The
 * shell's screens stay in place for this release; operators reach
 * this app via the launcher at `/apps/capture-event`.
 *
 * The slice ships the dispatch path end-to-end: pick a program,
 * list recent events for the bound OU, enter a single-DE event
 * and submit via `useDerApi().submitEvent()`. Program-rule
 * evaluation + stage-level forms + attachments all land in later
 * slice-4 follow-ups.
 */
export default function CaptureEventApp(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi();

  const [program, setProgram] = useState('');
  const [programStage, setProgramStage] = useState('');
  const [dataElement, setDataElement] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [recent, setRecent] = useState<EventRow[]>([]);

  async function reload(): Promise<void> {
    if (!ou.bound || program.trim() === '') return;
    setStatus({ kind: 'loading' });
    try {
      const r = await api.listEvents(program.trim(), ou.orgUnitUid, 20) as {
        events?: EventRow[]; instances?: EventRow[];
      };
      setRecent(r.events ?? r.instances ?? []);
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    }
  }
  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [program]);

  const canSubmit = ou.bound
    && program.trim() !== ''
    && dataElement.trim() !== ''
    && value.trim() !== ''
    && status.kind !== 'submitting';

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus({ kind: 'submitting' });
    try {
      await api.submitEvent({
        program, programStage: programStage || undefined,
        orgUnit: ou.orgUnitUid,
        occurredAt: new Date().toISOString(),
        dataValues: [{ dataElement, value }],
      });
      setStatus({ kind: 'ok',
        message: `Event submitted (${dataElement}=${value}).` });
      setDataElement('');
      setValue('');
      void reload();
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Submission failed' });
    }
  }

  return (
    <ScreenCard
      title="Event-program capture"
      actions={
        <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
          {online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`}
        </StatusPill>
      }
    >
      <p style={{ margin: 0, color: '#6e7a8a', fontSize: 13 }}>
        Signed in as <strong>{auth.displayName}</strong> • Bound OU
        <code style={{ marginInline: 6 }} title={ou.orgUnitPath}>{ou.orgUnitDisplayName || ou.orgUnitUid}</code>
      </p>
      {!ou.bound && (
        <p style={{ marginTop: 12, color: '#8a2525' }}>
          Device is not bound to an organisation unit — ask an admin
          to complete provisioning before capturing events.
        </p>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Program UID
          <input value={program}
                 onChange={(e) => setProgram(e.target.value)}
                 placeholder="e.g. IpHINAT79UW"
                 style={inputStyle} />
        </label>
        <label>Program stage UID (optional)
          <input value={programStage}
                 onChange={(e) => setProgramStage(e.target.value)}
                 style={inputStyle} />
        </label>
        <label>Data element UID
          <input value={dataElement}
                 onChange={(e) => setDataElement(e.target.value)}
                 placeholder="e.g. fbfJHSPpUQD"
                 style={inputStyle} />
        </label>
        <label>Value
          <input value={value}
                 onChange={(e) => setValue(e.target.value)}
                 style={inputStyle} />
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" disabled={!canSubmit} style={primaryBtn}>
            {status.kind === 'submitting' ? 'Submitting…' : 'Submit event'}
          </button>
        </div>
      </form>

      {status.kind === 'ok' && (
        <div style={okStrip} data-test="ce-ok">{status.message}</div>
      )}
      {status.kind === 'error' && (
        <div style={errorStrip} data-test="ce-err">{status.message}</div>
      )}

      <h3 style={{ marginTop: 20, fontSize: 12, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#6e7a8a',
        borderBottom: '1px solid #d7dde5', paddingBottom: 6 }}>
        Recent events {recent.length > 0 && `(${recent.length})`}
      </h3>
      {recent.length === 0 ? (
        <p style={{ color: '#6e7a8a', fontSize: 13 }}>
          {program.trim() === ''
            ? 'Enter a program UID to list recent events.'
            : status.kind === 'loading' ? 'Loading…' : 'No events yet.'}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {recent.map((e, i) => (
            <li key={e.event ?? i}
                style={{ padding: '6px 0',
                  borderBottom: '1px solid #eef0f3',
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 13 }}>
              <code>{e.event ?? '—'}</code>
              <span style={{ color: '#6e7a8a' }}>
                {e.occurredAt ?? e.eventDate ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ScreenCard>
  );
}

const inputStyle = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '6px 8px',
  border: '1px solid #d7dde5', borderRadius: 2,
  fontSize: 13, fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '6px 16px', border: '1px solid #1f4d70',
  background: '#2c6693', color: '#fff',
  borderRadius: 2, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const okStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#e8f4ee', color: '#136436',
  border: '1px solid #b7dcc7', borderRadius: 3,
};

const errorStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#fbeaea', color: '#8a2525',
  border: '1px solid #e0bcbc', borderRadius: 3,
};
