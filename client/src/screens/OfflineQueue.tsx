import { useCallback, useEffect, useState } from 'react';
import { ScreenCard, StatusPill } from '../shell/ScreenCard';
import { listAll, remove, type QueueEntry } from '../offline/queue';
import { drainOfflineQueue } from '../offline/replay';
import { useOnlineStatus } from '../offline/useOnlineStatus';

/**
 * ADR-0037 C-UI-5f slice 24 — operator-facing view of the offline
 * capture queue. Reached via the "N queued" chip in the topbar.
 *
 * Shows one row per pending entry: kind, URL, insertion time,
 * retry attempts, and the last error reported by a drain pass.
 * Operators can hit "Drain now" to force a replay or discard an
 * individual entry (useful when a specific payload is permanently
 * poisoned — e.g. the central removed the dataSet it references).
 *
 * Auto-refreshes every 2 s so entries that drain in the
 * background disappear without the operator reloading.
 */
export function OfflineQueue(): JSX.Element {
  const online = useOnlineStatus();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [draining, setDraining] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try { setEntries(await listAll()); }
    catch { /* queue briefly unavailable (upgrade in progress) */ }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, 2000);
    return () => { window.clearInterval(id); };
  }, [refresh]);

  const onDrain = useCallback(async (): Promise<void> => {
    setDraining(true);
    setStatus(null);
    try {
      const n = await drainOfflineQueue();
      setStatus(`Drained ${n} entr${n === 1 ? 'y' : 'ies'}.`);
      await refresh();
    } catch (err) {
      setStatus(`Drain failed: ${(err as Error).message}`);
    } finally { setDraining(false); }
  }, [refresh]);

  const onDiscard = useCallback(async (id: number): Promise<void> => {
    if (!window.confirm(
      'Discard this queued submission?\n\nThe captured value will not be sent '
      + 'to DHIS2. This cannot be undone.')) return;
    await remove(id);
    await refresh();
  }, [refresh]);

  return (
    <ScreenCard
      title="Offline queue"
      actions={
        <StatusPill tone={online ? 'success' : 'warning'}>
          {online ? 'online' : 'offline'}
        </StatusPill>
      }
    >
      <p style={{ marginTop: 0, color: '#6e7a8a', fontSize: 13 }}>
        Submissions that couldn&apos;t reach the edge in time are
        parked here in FIFO order. They replay automatically as soon
        as the browser reports online again — or hit <b>Drain now</b>
        to force a pass.
      </p>

      <div style={actionsRow}>
        <button type="button"
                data-test="queue-drain"
                onClick={() => { void onDrain(); }}
                disabled={draining || entries.length === 0}
                style={primaryBtn}>
          {draining ? 'Draining…' : 'Drain now'}
        </button>
        {status && (
          <span style={{ color: '#404b5a', fontSize: 13 }}
                data-test="queue-status">{status}</span>
        )}
      </div>

      {entries.length === 0 ? (
        <p style={emptyState} data-test="queue-empty">
          The queue is empty — every submission has synced.
        </p>
      ) : (
        <table style={table} data-test="queue-table">
          <thead>
            <tr>
              <th style={th}>Kind</th>
              <th style={th}>URL</th>
              <th style={th}>Created</th>
              <th style={th}>Attempts</th>
              <th style={th}>Last error</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} data-test="queue-row">
                <td style={td}>{e.kind}</td>
                <td style={td}><code>{e.method} {e.url}</code></td>
                <td style={td}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={td}>{e.attempts}</td>
                <td style={td}>
                  {e.lastError ?? <span style={{ color: '#9aa3b0' }}>—</span>}
                </td>
                <td style={td}>
                  <button type="button"
                          onClick={() => { void onDiscard(e.id); }}
                          style={linkBtn}
                          data-test="queue-discard">
                    Discard
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ScreenCard>
  );
}

const actionsRow = {
  display: 'flex', alignItems: 'center', gap: 12,
  margin: '16px 0',
} as const;

const primaryBtn = {
  padding: '6px 16px', border: '1px solid #1f4d70',
  background: '#2c6693', color: '#fff',
  borderRadius: 2, fontSize: 13, fontWeight: 500, cursor: 'pointer',
} as const;

const linkBtn = {
  padding: 0, border: 'none', background: 'transparent',
  color: '#a93232', fontSize: 13, cursor: 'pointer',
  textDecoration: 'underline',
} as const;

const emptyState = {
  marginTop: 24, padding: '32px 16px', textAlign: 'center' as const,
  color: '#6e7a8a', fontSize: 14,
  background: '#fff', border: '1px dashed #d7dde5', borderRadius: 3,
};

const table = {
  width: '100%', borderCollapse: 'collapse' as const,
  fontSize: 13, marginTop: 8,
};

const th = {
  textAlign: 'left' as const,
  padding: '8px 10px',
  borderBottom: '1px solid #d7dde5',
  color: '#404b5a', fontWeight: 500,
  letterSpacing: '0.02em', textTransform: 'uppercase' as const,
  fontSize: 11,
};

const td = {
  padding: '8px 10px',
  borderBottom: '1px solid #eef0f3',
  verticalAlign: 'top' as const,
  color: '#212934',
};
