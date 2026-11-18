import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, NoticeBox, Tag } from '@dhis2/ui';

import { getStoredDeviceId } from '../device/DeviceEnrollment';
import type { EnrolledDevice } from '../api/edgeApi';
import { listDevices } from '../api/edgeApi';
import { count as countQueue } from '../offline/queue';
import {
  JournalReplicator,
  useP2PMesh,
  usePendingOffers,
  type P2PConnectionStatus,
  type P2PSession,
  type PendingOffer,
  type ReplicateOutcome,
} from '../p2p';

/**
 * Device Peers screen — multi-session edition (P2P.6).
 *
 * <p>Shows the live P2P mesh:
 * <ol>
 *   <li><strong>Incoming offers</strong> — any pending session where
 *       another device is waiting for this device to answer. Accept
 *       opens a new channel (doesn't close existing ones).</li>
 *   <li><strong>Active sessions</strong> — one card per live
 *       connection with status badge, in-flight count, Flush and
 *       Close actions. Auto-flush fires per-session on the first
 *       {@code connected} transition.</li>
 *   <li><strong>Peers</strong> — enrolled devices; the Connect button
 *       is disabled only for the specific peer already in a live
 *       session (not globally, as in P2P.2).</li>
 * </ol>
 */
export function DevicePeers(): JSX.Element {
  const localDevice = useMemo(() => getStoredDeviceId(), []);
  const {
    sessions, lastMessage, lastError,
    connect, accept, send, close, closeAll, mesh,
  } = useP2PMesh(localDevice);
  const { offers, refresh: refreshOffers } = usePendingOffers(localDevice, 2000);

  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [flushResults, setFlushResults] =
    useState<Record<string, ReplicateOutcome[]>>({});
  const [flushingIds, setFlushingIds] = useState<Set<string>>(new Set());

  // One JournalReplicator per session, lazily created on-demand.
  // Receiver handler registers once per manager; we tear them down
  // implicitly when PeerMeshManager.close() drops the manager.
  const replicatorRef = useRef<Map<string, JournalReplicator>>(new Map());
  useEffect(() => {
    if (!mesh) return;
    for (const s of sessions) {
      if (replicatorRef.current.has(s.sessionId)) continue;
      const m = mesh.manager(s.sessionId);
      if (m) replicatorRef.current.set(s.sessionId, new JournalReplicator(m));
    }
    // GC dropped sessions out of the map.
    for (const [id] of replicatorRef.current) {
      if (!sessions.some((s) => s.sessionId === id)) {
        replicatorRef.current.delete(id);
      }
    }
  }, [sessions, mesh]);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      setDevices(await listDevices());
    } catch (ex) {
      setActionError(`Failed to list devices: ${(ex as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadDevices(); }, [loadDevices]);

  const refreshQueue = useCallback(async () => {
    try {
      const n = await countQueue('aggregate')
        + await countQueue('event')
        + await countQueue('tracker');
      setQueueCount(n);
    } catch {
      setQueueCount(0);
    }
  }, []);
  useEffect(() => { refreshQueue(); }, [refreshQueue]);

  // Auto-flush on connect, per-session. Guarded against status
  // flicker (reconnect) by a set of already-flushed session ids.
  const autoFlushedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const s of sessions) {
      if (s.status !== 'connected') continue;
      if (autoFlushedIds.current.has(s.sessionId)) continue;
      autoFlushedIds.current.add(s.sessionId);
      // Fire-and-forget — results surface in flushResults when they land.
      runFlush(s.sessionId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const runFlush = async (sessionId: string): Promise<void> => {
    const replicator = replicatorRef.current.get(sessionId);
    if (!replicator) return;
    setFlushingIds((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
    try {
      const results = await replicator.flushAll();
      setFlushResults((prev) => ({ ...prev, [sessionId]: results }));
      await refreshQueue();
    } catch (ex) {
      setActionError(
        `Flush on session ${sessionId.slice(0, 8)}… failed: ${(ex as Error).message}`);
    } finally {
      setFlushingIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const activeByRemote = useMemo(() => {
    const m = new Map<string, P2PSession>();
    for (const s of sessions) m.set(s.remoteDevice, s);
    return m;
  }, [sessions]);

  const peers = useMemo(
    () => devices.filter((d) => d.deviceId !== localDevice),
    [devices, localDevice],
  );

  const handleConnect = async (peer: EnrolledDevice): Promise<void> => {
    setActionError(null);
    try {
      await connect(peer.deviceId, 'data');
    } catch (ex) {
      setActionError(
        `Connect to ${peer.deviceId.slice(0, 8)}… failed: ${(ex as Error).message}`);
    }
  };

  const handleAccept = async (offer: PendingOffer): Promise<void> => {
    setActionError(null);
    try {
      await accept(offer);
      refreshOffers();
    } catch (ex) {
      setActionError(
        `Accept ${offer.sessionId.slice(0, 8)}… failed: ${(ex as Error).message}`);
    }
  };

  const handlePing = (sessionId: string): void => {
    try {
      send(sessionId, {
        type: 'ping',
        payload: { at: new Date().toISOString() },
      });
    } catch (ex) {
      setActionError(`Ping failed: ${(ex as Error).message}`);
    }
  };

  if (!localDevice) {
    return (
      <div className="der-device-peers">
        <h1>Device peers</h1>
        <NoticeBox warning title="No device enrolled">
          This browser isn’t enrolled as a DER device yet, so it can’t
          open peer-to-peer sessions. Complete device enrolment first
          from Session → Enrol this device.
        </NoticeBox>
      </div>
    );
  }

  return (
    <div className="der-device-peers">
      <div className="der-peer-screen-header">
        <h1>Device peers</h1>
        <span className="der-peer-count-badge">
          {sessions.length} live, {queueCount} queued
        </span>
      </div>

      {actionError && (
        <NoticeBox error title="Action failed">{actionError}</NoticeBox>
      )}

      {offers.length > 0 && (
        <Card>
          <h2>Incoming offers</h2>
          <ul className="der-peer-offers">
            {offers.map((o) => (
              <li key={o.sessionId}>
                <code>{o.initiatorDevice.slice(0, 8)}…</code>
                {' wants to open a '}<strong>{o.kind}</strong>{' channel.'}
                <Button small primary onClick={() => handleAccept(o)}>
                  Accept
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sessions.length > 0 && (
        <Card>
          <div className="der-peer-list-header">
            <h2>Active sessions</h2>
            <Button small destructive onClick={closeAll}>Close all</Button>
          </div>
          <ul className="der-peer-session-list">
            {sessions.map((s) => {
              const isFlushing = flushingIds.has(s.sessionId);
              const results = flushResults[s.sessionId];
              return (
                <li key={s.sessionId} className="der-peer-session-card">
                  <div className="der-peer-session-head">
                    <code>{s.remoteDevice.slice(0, 8)}…</code>
                    {renderStatusTag(s.status)}
                    <span className="der-peer-session-role">{s.role}</span>
                    <span className="der-peer-session-kind">{s.kind}</span>
                  </div>
                  {results && (
                    <div className="der-peer-flush-summary">
                      sent {results.filter((r) => r.kind === 'sent').length},
                      {' '}failed {results.filter((r) => r.kind === 'failed').length}
                    </div>
                  )}
                  <div className="der-peer-actions">
                    <Button small secondary
                      disabled={s.status !== 'connected'}
                      onClick={() => handlePing(s.sessionId)}>
                      Ping
                    </Button>
                    <Button small primary
                      loading={isFlushing}
                      disabled={s.status !== 'connected' || queueCount === 0}
                      onClick={() => runFlush(s.sessionId)}>
                      Flush {queueCount}
                    </Button>
                    <Button small destructive onClick={() => close(s.sessionId)}>
                      Close
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {lastMessage && (
            <p className="der-peer-last-message">
              Last from <code>{lastMessage.sessionId.slice(0, 8)}…</code>:{' '}
              <code>{JSON.stringify(lastMessage.msg)}</code>
            </p>
          )}
          {lastError && (
            <NoticeBox warning title={`Error on ${lastError.sessionId.slice(0, 8)}… (${lastError.phase})`}>
              {lastError.error.message}
            </NoticeBox>
          )}
        </Card>
      )}

      <Card>
        <div className="der-peer-list-header">
          <h2>Peers</h2>
          <Button small secondary onClick={loadDevices} loading={loading}>
            Refresh
          </Button>
        </div>
        {peers.length === 0 && !loading && (
          <p>No other devices enrolled on this appliance.</p>
        )}
        <ul className="der-peer-list">
          {peers.map((p) => {
            const active = activeByRemote.get(p.deviceId);
            return (
              <li key={p.deviceId}>
                <div className="der-peer-row">
                  <div className="der-peer-identity">
                    <code>{p.deviceId.slice(0, 8)}…</code>
                    <Tag className={`der-peer-status der-peer-status-${p.status.toLowerCase()}`}>
                      {p.status}
                    </Tag>
                    {p.userAgent && (
                      <span className="der-peer-ua">{p.userAgent}</span>
                    )}
                  </div>
                  <div className="der-peer-action">
                    {active
                      ? renderStatusTag(active.status)
                      : (
                        <Button small primary
                          disabled={p.status !== 'APPROVED'}
                          onClick={() => handleConnect(p)}>
                          Connect
                        </Button>
                      )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function renderStatusTag(status: P2PConnectionStatus): JSX.Element {
  const toneClass = `der-p2p-tag der-p2p-tag-${status}`;
  return <Tag className={toneClass}>{status}</Tag>;
}
