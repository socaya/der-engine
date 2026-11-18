import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, NoticeBox, Tag } from '@dhis2/ui';

import { getStoredDeviceId } from '../device/DeviceEnrollment';
import type { EnrolledDevice } from '../api/edgeApi';
import { listDevices } from '../api/edgeApi';
import { count as countQueue } from '../offline/queue';
import {
  JournalReplicator,
  useP2P,
  usePendingOffers,
  type P2PConnectionStatus,
  type PendingOffer,
  type ReplicateOutcome,
} from '../p2p';

/**
 * Device Peers screen — the operator-facing surface for the P2P data
 * channels DER's WebRTC signaling broker (/edge-api/v1/webrtc) + the
 * {@link import('../p2p').useP2P} hook make possible.
 *
 * <p>Layout, top-to-bottom:
 * <ol>
 *   <li>Incoming offers card — surfaces any session where another
 *       device is waiting on this device to answer. Accept opens the
 *       data channel; Dismiss leaves the offer to expire server-side
 *       (the broker drops OFFERED rows older than ~5m).</li>
 *   <li>Active session card — shows the current connection target,
 *       status badge, kind, and a smoke-test send button. Only
 *       rendered when a session is live.</li>
 *   <li>Peers list — every enrolled device on this appliance except
 *       the one running this UI, with a Connect button when idle
 *       and a status indicator when a handshake / session is in
 *       flight.</li>
 * </ol>
 *
 * <p>The hook owns at most one active connection at a time per the
 * single-channel model in {@link import('../p2p').PeerConnectionManager};
 * the UI makes that limit obvious by greying out Connect buttons once
 * a session is live. Future P2P.3 will layer a protocol envelope
 * (seq/ack/retry) on top so the ping smoke-test gets replaced by
 * real journal-sync traffic.</p>
 */
export function DevicePeers(): JSX.Element {
  const localDevice = useMemo(() => getStoredDeviceId(), []);
  const { session, lastMessage, lastError, connect, accept, send, close, manager } =
    useP2P(localDevice);
  const { offers, refresh: refreshOffers } = usePendingOffers(localDevice, 2000);

  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [flushResult, setFlushResult] = useState<ReplicateOutcome[] | null>(null);
  const [flushing, setFlushing] = useState<boolean>(false);

  // Bind one JournalReplicator per manager instance so the receiver-
  // side handler stays registered for the lifetime of the channel,
  // not just while flushAll is in-flight.
  const replicatorRef = useRef<JournalReplicator | null>(null);
  useEffect(() => {
    if (!manager) {
      replicatorRef.current = null;
      return undefined;
    }
    replicatorRef.current = new JournalReplicator(manager);
    return () => { replicatorRef.current = null; };
  }, [manager]);

  // Refresh local queue count on mount + whenever a flush completes
  // so the "N queued" badge next to Flush reflects reality.
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

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const peers = useMemo(
    () => devices.filter((d) => d.deviceId !== localDevice),
    [devices, localDevice],
  );

  const activeTargetDevice = session?.remoteDevice ?? null;
  const connectBusy = session !== null
    && session.status !== 'closed'
    && session.status !== 'failed'
    && session.status !== 'disconnected';

  const handleConnect = async (peer: EnrolledDevice): Promise<void> => {
    setActionError(null);
    try {
      await connect(peer.deviceId, 'data');
    } catch (ex) {
      setActionError(`Connect to ${peer.deviceId.slice(0, 8)}… failed: ${(ex as Error).message}`);
    }
  };

  const handleAccept = async (offer: PendingOffer): Promise<void> => {
    setActionError(null);
    try {
      await accept(offer);
      refreshOffers();
    } catch (ex) {
      setActionError(`Accept offer ${offer.sessionId.slice(0, 8)}… failed: ${(ex as Error).message}`);
    }
  };

  const handlePing = (): void => {
    try {
      send({ type: 'ping', payload: { at: new Date().toISOString() } });
    } catch (ex) {
      setActionError(`Send failed: ${(ex as Error).message}`);
    }
  };

  const handleFlushQueue = async (): Promise<void> => {
    if (!replicatorRef.current) {
      setActionError('Replicator not ready');
      return;
    }
    setActionError(null);
    setFlushing(true);
    try {
      const results = await replicatorRef.current.flushAll();
      setFlushResult(results);
      await refreshQueue();
    } catch (ex) {
      setActionError(`Flush failed: ${(ex as Error).message}`);
    } finally {
      setFlushing(false);
    }
  };

  if (!localDevice) {
    return (
      <div className="der-device-peers">
        <h1>Device peers</h1>
        <NoticeBox warning title="No device enrolled">
          This browser isn’t enrolled as a DER device yet, so it can’t
          open a peer-to-peer session. Complete device enrolment first
          from Session → Enrol this device.
        </NoticeBox>
      </div>
    );
  }

  return (
    <div className="der-device-peers">
      <h1>Device peers</h1>

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
                <Button small primary
                  onClick={() => handleAccept(o)}
                  disabled={connectBusy}
                >
                  Accept
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {session && (
        <Card>
          <h2>Active session</h2>
          <dl className="der-peer-session">
            <dt>Remote device</dt>
            <dd><code>{session.remoteDevice}</code></dd>
            <dt>Session id</dt>
            <dd><code>{session.sessionId.slice(0, 8)}…</code></dd>
            <dt>Role</dt>
            <dd>{session.role}</dd>
            <dt>Channel</dt>
            <dd>{session.kind}</dd>
            <dt>Status</dt>
            <dd>{renderStatusTag(session.status)}</dd>
            <dt>Last change</dt>
            <dd>{session.lastChangeAt}</dd>
          </dl>
          {lastMessage && (
            <p className="der-peer-last-message">
              Last message: <code>{JSON.stringify(lastMessage)}</code>
            </p>
          )}
          {lastError && (
            <NoticeBox warning title={`Channel error in ${lastError.phase}`}>
              {lastError.error.message}
            </NoticeBox>
          )}
          <div className="der-peer-actions">
            <Button small secondary
              disabled={session.status !== 'connected'}
              onClick={handlePing}
            >
              Send ping
            </Button>
            <Button small primary
              loading={flushing}
              disabled={session.status !== 'connected' || queueCount === 0}
              onClick={handleFlushQueue}
            >
              Flush {queueCount} queued
            </Button>
            <Button small destructive onClick={close}>
              Close session
            </Button>
          </div>
          {flushResult && flushResult.length > 0 && (
            <div className="der-peer-flush-summary">
              <h3>Last flush</h3>
              <ul>
                <li>sent: {flushResult.filter((r) => r.kind === 'sent').length}</li>
                <li>failed: {flushResult.filter((r) => r.kind === 'failed').length}</li>
              </ul>
            </div>
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
            const isTarget = p.deviceId === activeTargetDevice;
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
                    {isTarget && session
                      ? renderStatusTag(session.status)
                      : (
                        <Button small primary
                          disabled={connectBusy || p.status !== 'APPROVED'}
                          onClick={() => handleConnect(p)}
                        >
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
