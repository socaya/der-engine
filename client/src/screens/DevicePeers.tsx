import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, NoticeBox, Tag } from '@dhis2/ui';

import { getStoredDeviceId } from '../device/DeviceEnrollment';
import type { EnrolledDevice } from '../api/edgeApi';
import { listDevices, listCaptureWorkflows, listOwnedStepIds } from '../api/edgeApi';
import { count as countQueue } from '../offline/queue';
import {
  DerPeerProtocol,
  JournalReplicator,
  MetadataSyncReplicator,
  PeerSignalingRelay,
  WorkflowReplicator,
  setActiveMesh,
  useP2PMesh,
  usePendingOffers,
  type DppCapabilities,
  type DppRouteTable,
  type MetadataSyncResult,
  type P2PConnectionStatus,
  type P2PSession,
  type PendingOffer,
  type PushWorkflowResult,
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

  // One JournalReplicator + WorkflowReplicator per session, lazily
  // created on-demand. Both share the same underlying P2PProtocol
  // (constructed inside JournalReplicator; WorkflowReplicator
  // receives it so handlers register on the same envelope decoder).
  // Torn down implicitly when PeerMeshManager.close() drops the
  // manager.
  // One DerPeerProtocol per session, shared across all three
  // replicators so the HELLO/WELCOME handshake only runs once per
  // channel. Local capabilities list every resource this client can
  // receive; ownsSteps is left empty for now — DPP.3 will populate it
  // from GET /edge-api/v1/workflows/steps/owned-by-me.
  const dppRef = useRef<Map<string, DerPeerProtocol>>(new Map());
  const journalRef = useRef<Map<string, JournalReplicator>>(new Map());
  const workflowRef = useRef<Map<string, WorkflowReplicator>>(new Map());
  const metadataRef = useRef<Map<string, MetadataSyncReplicator>>(new Map());
  // A single mesh-wide route table instance — handshakes populate it
  // so workflow handoff relays can find next-step owners across
  // channels.
  const routeTableRef = useRef<DppRouteTable>(new Map());

  // DPP.3: real owned-step list from the server. Populated on mount
  // and reused for every subsequent HELLO. If the fetch fails the
  // array stays empty — HELLO still works, just without mesh-wide
  // routing through this device.
  const [ownsSteps, setOwnsSteps] = useState<string[]>([]);
  useEffect(() => {
    if (!localDevice) return;
    listOwnedStepIds(localDevice)
      .then(setOwnsSteps)
      .catch(() => setOwnsSteps([]));
  }, [localDevice]);

  // DBE.3a — mesh-wide signaling relay. One instance per mounted
  // Peers screen; attaches a control.signal-relay handler to every
  // DPP so SDP + ICE frames forward through the mesh when the HTTP
  // broker is unreachable.
  const signalRelayRef = useRef<PeerSignalingRelay | null>(null);
  useEffect(() => {
    if (!mesh || !localDevice) return;
    signalRelayRef.current = new PeerSignalingRelay(
      mesh, localDevice, () => dppRef.current);
  }, [mesh, localDevice]);

  useEffect(() => {
    if (!mesh || !localDevice) return;
    const local: DppCapabilities = {
      deviceId: localDevice,
      capabilities: ['journal', 'workflow', 'metadata', 'control'],
      ownsSteps,
      // DBE.3a — advertise our current session peers so other
      // devices can use us as a signaling relay when the HTTP
      // broker is down. Updated whenever sessions change.
      connectedPeers: sessions.map((s) => s.remoteDevice),
    };
    for (const s of sessions) {
      if (dppRef.current.has(s.sessionId)) continue;
      const m = mesh.manager(s.sessionId);
      if (!m) continue;
      const dpp = new DerPeerProtocol(m, local, routeTableRef.current);
      // DBE.3a — attach the signaling-relay handler so this DPP
      // can forward control.signal-relay frames through the mesh.
      signalRelayRef.current?.attachTo(dpp);
      // DPP.3 multi-hop: when a RELAY frame lands with a route this
      // peer doesn't own, look up whichever session's peer IS the
      // target and forward through that session's protocol. Silent
      // no-op when the target isn't currently reachable — the caller
      // gets UNKNOWN_ROUTE and queues the frame locally.
      dpp.registerRelayDispatcher(async (frame, ttl) => {
        const targetMgr = mesh.sessionFor(frame.route!);
        if (!targetMgr) return false;
        const nextSessionId = targetMgr.session()?.sessionId;
        if (!nextSessionId) return false;
        const nextDpp = dppRef.current.get(nextSessionId);
        if (!nextDpp || nextDpp === dpp) return false;
        await nextDpp.relay(
          frame.resource!, frame.action!, frame.payload,
          frame.route!, ttl);
        return true;
      });
      dppRef.current.set(s.sessionId, dpp);
      journalRef.current.set(s.sessionId, new JournalReplicator(m, dpp));
      workflowRef.current.set(s.sessionId, new WorkflowReplicator(m, dpp));
      metadataRef.current.set(s.sessionId, new MetadataSyncReplicator(m, dpp));
    }
    // GC dropped sessions out of every map.
    for (const [id] of dppRef.current) {
      if (!sessions.some((s) => s.sessionId === id)) {
        dppRef.current.delete(id);
        journalRef.current.delete(id);
        workflowRef.current.delete(id);
        metadataRef.current.delete(id);
      }
    }

    // DPP.4 — register this mesh with the process-wide bus so the
    // contribution SSE subscriber (and any other callers) can
    // broadcast run-advance frames without reaching into React
    // component state. Unregister on unmount.
    setActiveMesh({
      mesh,
      localDeviceId: localDevice,
      protocolBySession: dppRef.current,
      routeTable: routeTableRef.current,
    });
  }, [sessions, mesh, localDevice, ownsSteps]);
  useEffect(() => () => setActiveMesh(null), []);

  const [metadataResults, setMetadataResults] =
    useState<Record<string, MetadataSyncResult>>({});
  const [syncingMeta, setSyncingMeta] = useState<Set<string>>(new Set());

  const handleSyncMetadata = async (sessionId: string): Promise<void> => {
    const replicator = metadataRef.current.get(sessionId);
    if (!replicator) {
      setActionError('Metadata sync not ready for this session');
      return;
    }
    setActionError(null);
    setSyncingMeta((prev) => {
      const next = new Set(prev); next.add(sessionId); return next;
    });
    try {
      const result = await replicator.push();
      setMetadataResults((prev) => ({ ...prev, [sessionId]: result }));
    } catch (ex) {
      setActionError(
        `Metadata sync ${sessionId.slice(0, 8)}… failed: ${(ex as Error).message}`);
    } finally {
      setSyncingMeta((prev) => {
        const next = new Set(prev); next.delete(sessionId); return next;
      });
    }
  };

  // Local workflows the operator can push to a peer. Loaded once on
  // mount; refresh is cheap but we leave manual-only for now.
  const [workflows, setWorkflows] = useState<
    { workflowId: string; displayName: string }[]
  >([]);
  useEffect(() => {
    listCaptureWorkflows()
      .then((r) => setWorkflows(r.workflows.map((w) => ({
        workflowId: w.workflowId,
        displayName: w.displayName ?? w.workflowId,
      }))))
      .catch(() => setWorkflows([]));
  }, []);
  const [pushResults, setPushResults] =
    useState<Record<string, PushWorkflowResult>>({});

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
    const replicator = journalRef.current.get(sessionId);
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
      return;
    } catch (ex) {
      // DBE.3b — HTTP broker unreachable. Try P-sig: look for a
      // mesh peer that claims a direct session with the target
      // and open a new WebRTC connection through that intermediary.
      const relay = signalRelayRef.current;
      const intermediary = relay?.findIntermediaryFor(
        peer.deviceId, dppRef.current);
      if (!mesh || !relay || !intermediary) {
        setActionError(
          `Connect to ${peer.deviceId.slice(0, 8)}… failed: ${(ex as Error).message}`
          + ' (no mesh relay available)');
        return;
      }
      try {
        await mesh.connectToViaRelay(peer.deviceId, intermediary, relay, 'data');
      } catch (relayEx) {
        setActionError(
          `P-sig connect to ${peer.deviceId.slice(0, 8)}… failed: ${(relayEx as Error).message}`);
      }
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

  const handlePushWorkflow = async (
    sessionId: string,
    workflowId: string,
  ): Promise<void> => {
    const replicator = workflowRef.current.get(sessionId);
    if (!replicator) {
      setActionError('Workflow replicator not ready for this session');
      return;
    }
    setActionError(null);
    try {
      const fromLabel = `device-${(localDevice ?? '').slice(0, 8)}`;
      const result = await replicator.push(workflowId, fromLabel);
      setPushResults((prev) => ({
        ...prev,
        [`${sessionId}:${workflowId}`]: result,
      }));
    } catch (ex) {
      setActionError(
        `Push workflow ${workflowId.slice(0, 8)}… failed: ${(ex as Error).message}`);
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
                    <Button small secondary
                      loading={syncingMeta.has(s.sessionId)}
                      disabled={s.status !== 'connected'}
                      onClick={() => handleSyncMetadata(s.sessionId)}>
                      Sync metadata
                    </Button>
                    {workflows.length > 0 && (
                      <select
                        className="der-peer-workflow-picker"
                        disabled={s.status !== 'connected'}
                        value=""
                        onChange={(ev) => {
                          const workflowId = ev.target.value;
                          if (!workflowId) return;
                          handlePushWorkflow(s.sessionId, workflowId);
                          ev.target.value = '';
                        }}>
                        <option value="">Push workflow…</option>
                        {workflows.map((w) => (
                          <option key={w.workflowId} value={w.workflowId}>
                            {w.displayName}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button small destructive onClick={() => close(s.sessionId)}>
                      Close
                    </Button>
                  </div>
                  {Object.entries(pushResults)
                    .filter(([k]) => k.startsWith(`${s.sessionId}:`))
                    .map(([k, r]) => (
                      <div key={k} className="der-peer-push-summary">
                        workflow {r.workflowId.slice(0, 8)}… → {r.status}
                        {r.error && <span>: {r.error}</span>}
                      </div>
                    ))}
                  {metadataResults[s.sessionId] && (
                    <div className="der-peer-push-summary">
                      metadata → {metadataResults[s.sessionId].status}
                      {' '}({metadataResults[s.sessionId].resources} resources,{' '}
                      {metadataResults[s.sessionId].items} items)
                      {metadataResults[s.sessionId].error && (
                        <span>: {metadataResults[s.sessionId].error}</span>
                      )}
                    </div>
                  )}
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
