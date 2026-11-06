import { useState, type FormEvent } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

/**
 * Minimal Aggregate data-entry app — the first DER-dispatched app
 * (C-UI-5c slice 3). The shell's AggregateEntry.tsx is unchanged
 * for this slice; operators can reach this app from the launcher
 * at `/apps/data-entry`. Full feature parity (dataset browse,
 * period picker, locking, draft save) is work that lands in later
 * slice-3 follow-ups; this one proves the dispatch path
 * end-to-end: SDK hooks + useDerApi().submitAggregate() through
 * the shell's edgeApi.
 */
export default function DataEntryApp(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi();

  const [dataSet, setDataSet] = useState('');
  const [period, setPeriod] = useState('');
  const [dataElement, setDataElement] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const canSubmit = ou.bound
    && dataSet.trim() !== ''
    && period.trim() !== ''
    && dataElement.trim() !== ''
    && value.trim() !== ''
    && status.kind !== 'submitting';

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus({ kind: 'submitting' });
    try {
      await api.submitAggregate({
        dataSet, period, orgUnit: ou.orgUnitUid,
        dataValues: [{ dataElement, value }],
      });
      setStatus({ kind: 'ok',
        message: `Submitted ${dataElement}=${value} for ${period}.` });
      setDataElement('');
      setValue('');
    } catch (err) {
      setStatus({ kind: 'error',
        message: (err as Error).message ?? 'Submission failed' });
    }
  }

  return (
    <ScreenCard
      title="Aggregate data entry"
      actions={
        <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
          {online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`}
        </StatusPill>
      }
    >
      <p style={{ margin: 0, color: '#6e7a8a', fontSize: 13 }}>
        Signed in as <strong>{auth.displayName}</strong> • Bound OU
        <code style={{ marginInline: 6 }}>{ou.orgUnitPath}</code>
      </p>

      {!ou.bound && (
        <p style={{ marginTop: 12, color: '#8a2525' }}>
          This device is not bound to an organisation unit — ask an admin
          to complete provisioning before submitting.
        </p>
      )}

      {status.kind === 'ok' && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: '#e8f4ee', color: '#136436',
          border: '1px solid #b7dcc7', borderRadius: 3,
        }}>{status.message}</div>
      )}
      {status.kind === 'error' && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: '#fbeaea', color: '#8a2525',
          border: '1px solid #e0bcbc', borderRadius: 3,
        }}>{status.message}</div>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Data set UID
          <input value={dataSet}
                 onChange={(e) => setDataSet(e.target.value)}
                 placeholder="e.g. BfMAe6Itzgt"
                 style={inputStyle} />
        </label>
        <label>Period (ISO)
          <input value={period}
                 onChange={(e) => setPeriod(e.target.value)}
                 placeholder="e.g. 202611"
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
                 inputMode="decimal"
                 style={inputStyle} />
        </label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canSubmit} style={primaryBtn}>
            {status.kind === 'submitting' ? 'Submitting…' : 'Submit value'}
          </button>
        </div>
      </form>
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
