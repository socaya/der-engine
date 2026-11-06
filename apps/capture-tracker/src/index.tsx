import { useEffect, useState, type FormEvent } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'enrolling' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

interface TeiRow {
  readonly trackedEntity?: string;
  readonly trackedEntityInstance?: string;
  readonly displayName?: string;
  readonly lastUpdated?: string;
  readonly orgUnit?: string;
}

/**
 * Tracker capture app (C-UI-5c slice 5). Replaces TrackerSearch +
 * EnrollmentCreate + TrackerDashboard over the slice-5 rollout.
 * The shell screens stay in place for this release; operators
 * reach this app via the launcher at `/apps/capture-tracker`.
 *
 * Slice-5 ships the dispatch path end-to-end: pick a program,
 * list TEIs for the bound OU via `useDerApi().listTrackerEntities`,
 * and enrol a new TEI with a single attribute via
 * `useDerApi().enrolTei`. Program-rule evaluation + multi-attribute
 * TEI editing + stage-event enrolment-dashboard land in later
 * slice-5 follow-ups.
 */
export default function CaptureTrackerApp(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi();

  const [program, setProgram] = useState('');
  const [rows, setRows] = useState<TeiRow[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [enrolOpen, setEnrolOpen] = useState(false);
  const [tet, setTet] = useState('');
  const [attribute, setAttribute] = useState('');
  const [value, setValue] = useState('');

  async function reload(): Promise<void> {
    if (!ou.bound || program.trim() === '') { setRows([]); return; }
    setStatus({ kind: 'loading' });
    try {
      const r = await api.listTrackerEntities(program.trim(), ou.orgUnitUid, 50) as {
        instances?: TeiRow[]; trackedEntities?: TeiRow[];
      };
      setRows(r.trackedEntities ?? r.instances ?? []);
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Search failed' });
    }
  }
  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [program]);

  const canEnrol = ou.bound
    && program.trim() !== ''
    && tet.trim() !== ''
    && attribute.trim() !== ''
    && value.trim() !== ''
    && status.kind !== 'enrolling';

  async function onEnrol(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus({ kind: 'enrolling' });
    try {
      await api.enrolTei({
        program: program.trim(),
        orgUnit: ou.orgUnitUid,
        trackedEntityType: tet.trim(),
        attributes: [{ attribute: attribute.trim(), value: value.trim() }],
      });
      setStatus({ kind: 'ok',
        message: `Enrolled TEI (${attribute}=${value}).` });
      setAttribute('');
      setValue('');
      setEnrolOpen(false);
      void reload();
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Enrol failed' });
    }
  }

  return (
    <ScreenCard
      title="Tracker capture"
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
          Device is not bound to an organisation unit — ask an admin
          to complete provisioning before searching or enrolling.
        </p>
      )}

      <div style={{ marginTop: 16, display: 'grid',
        gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <label>Program UID
          <input value={program}
                 onChange={(e) => setProgram(e.target.value)}
                 placeholder="e.g. IpHINAT79UW"
                 style={inputStyle} />
        </label>
        <button type="button"
                onClick={() => { void reload(); }}
                disabled={!ou.bound || program.trim() === ''}
                style={primaryBtn}>
          {status.kind === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </div>

      {status.kind === 'ok' && (
        <div style={okStrip} data-test="ct-ok">{status.message}</div>
      )}
      {status.kind === 'error' && (
        <div style={errorStrip} data-test="ct-err">{status.message}</div>
      )}

      <h3 style={sectionHeading}>
        Tracked entities {rows.length > 0 && `(${rows.length})`}
      </h3>
      {rows.length === 0 ? (
        <p style={{ color: '#6e7a8a', fontSize: 13 }}>
          {program.trim() === ''
            ? 'Enter a program UID to search tracked entities.'
            : status.kind === 'loading' ? 'Loading…' : 'No tracked entities yet.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse',
          fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left',
              borderBottom: '1px solid #d7dde5', color: '#6e7a8a' }}>
              <th style={{ padding: '6px 4px' }}>TEI UID</th>
              <th style={{ padding: '6px 4px' }}>Display name</th>
              <th style={{ padding: '6px 4px' }}>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const uid = r.trackedEntity ?? r.trackedEntityInstance ?? '—';
              return (
                <tr key={uid + i}
                    style={{ borderBottom: '1px solid #eef0f3' }}>
                  <td style={{ padding: '6px 4px' }}>
                    <code>{uid}</code>
                  </td>
                  <td style={{ padding: '6px 4px' }}>
                    {r.displayName ?? '—'}
                  </td>
                  <td style={{ padding: '6px 4px', color: '#6e7a8a' }}>
                    {r.lastUpdated ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h3 style={sectionHeading}>Enrol new TEI</h3>
      {!enrolOpen ? (
        <button type="button"
                onClick={() => setEnrolOpen(true)}
                disabled={!ou.bound || program.trim() === ''}
                style={primaryBtn}>
          Enrol new TEI
        </button>
      ) : (
        <form onSubmit={onEnrol} style={{ marginTop: 8, display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>Tracked-entity type UID
            <input value={tet}
                   onChange={(e) => setTet(e.target.value)}
                   placeholder="e.g. nEenWmSyUEp"
                   style={inputStyle} />
          </label>
          <label>First attribute UID
            <input value={attribute}
                   onChange={(e) => setAttribute(e.target.value)}
                   placeholder="e.g. w75KJ2mc4zz"
                   style={inputStyle} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>Value
            <input value={value}
                   onChange={(e) => setValue(e.target.value)}
                   style={inputStyle} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
            <button type="submit" disabled={!canEnrol} style={primaryBtn}>
              {status.kind === 'enrolling' ? 'Enrolling…' : 'Enrol'}
            </button>
            <button type="button"
                    onClick={() => setEnrolOpen(false)}
                    style={secondaryBtn}>
              Cancel
            </button>
          </div>
        </form>
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

const secondaryBtn = {
  padding: '6px 16px', border: '1px solid #d7dde5',
  background: '#fff', color: '#2c3e50',
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

const sectionHeading = {
  marginTop: 20, fontSize: 12, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', color: '#6e7a8a',
  borderBottom: '1px solid #d7dde5', paddingBottom: 6,
};
