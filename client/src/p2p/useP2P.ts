import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PeerConnectionManager, type P2POptions } from './peerConnection';
import { SignalingClient } from './signaling';
import type {
  P2PMessage,
  P2PSession,
  PeerChannelKind,
  PendingOffer,
} from './types';

/** Public React surface over {@link PeerConnectionManager}. One hook
 *  per peer we're connected / connecting to — not shared globally
 *  because a clinic device typically holds at most a handful of
 *  concurrent P2P channels (nurse ↔ receptionist, device ↔ edge-host),
 *  and keeping them discrete makes lifecycle debugging obvious. */
export interface UseP2PResult {
  readonly session: P2PSession | null;
  readonly lastMessage: P2PMessage | null;
  readonly lastError: { error: Error; phase: string } | null;
  readonly connect: (remoteDevice: string, kind?: PeerChannelKind) => Promise<void>;
  readonly accept: (offer: PendingOffer) => Promise<void>;
  readonly send: (msg: P2PMessage) => void;
  readonly close: () => void;
}

export function useP2P(localDeviceId: string | null, opts?: P2POptions): UseP2PResult {
  const mgrRef = useRef<PeerConnectionManager | null>(null);
  const [session, setSession] = useState<P2PSession | null>(null);
  const [lastMessage, setLastMessage] = useState<P2PMessage | null>(null);
  const [lastError, setLastError] = useState<{ error: Error; phase: string } | null>(null);

  useEffect(() => {
    if (!localDeviceId) {
      return undefined;
    }
    const mgr = new PeerConnectionManager(localDeviceId, opts);
    mgrRef.current = mgr;
    const offStatus = mgr.onStatus((s) => setSession({ ...s }));
    const offMessage = mgr.onMessage((m) => setLastMessage(m));
    const offError = mgr.onError((error, phase) => setLastError({ error, phase }));
    return () => {
      offStatus();
      offMessage();
      offError();
      mgr.close();
      mgrRef.current = null;
    };
    // Deliberately exclude `opts` — options are reference-unstable from
    // inline object literals and would re-create the manager every render.
    // Callers should memoise opts if they really need live changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDeviceId]);

  const connect = useCallback(
    async (remoteDevice: string, kind: PeerChannelKind = 'data') => {
      const mgr = mgrRef.current;
      if (!mgr) throw new Error('P2P manager not ready');
      await mgr.connectTo(remoteDevice, kind);
    },
    [],
  );

  const accept = useCallback(async (offer: PendingOffer) => {
    const mgr = mgrRef.current;
    if (!mgr) throw new Error('P2P manager not ready');
    await mgr.acceptOffer(
      offer.sessionId,
      offer.initiatorDevice,
      offer.sdpOffer,
      offer.kind,
    );
  }, []);

  const send = useCallback((msg: P2PMessage) => {
    const mgr = mgrRef.current;
    if (!mgr) throw new Error('P2P manager not ready');
    mgr.send(msg);
  }, []);

  const close = useCallback(() => {
    const mgr = mgrRef.current;
    mgr?.close();
  }, []);

  return useMemo(
    () => ({ session, lastMessage, lastError, connect, accept, send, close }),
    [session, lastMessage, lastError, connect, accept, send, close],
  );
}

/** Lightweight companion hook — polls {@code /pending} periodically so
 *  a responder device can surface incoming offers in the UI without
 *  the user manually hitting Refresh. Cadence defaults to 2s; tune
 *  down to 500ms if the UI shows a "waiting for peer" spinner.
 *
 *  Returns the latest pending list AND an imperative refresh() for
 *  manual triggers (right after dismissing an offer). */
export function usePendingOffers(
  localDeviceId: string | null,
  intervalMs = 2000,
): { offers: PendingOffer[]; refresh: () => void } {
  const [offers, setOffers] = useState<PendingOffer[]>([]);
  const signalingRef = useRef<SignalingClient | null>(null);

  useEffect(() => {
    if (!localDeviceId) return undefined;
    signalingRef.current = new SignalingClient(localDeviceId);
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await signalingRef.current!.pending();
        if (!cancelled) setOffers(next);
      } catch {
        // Offline / unreachable — leave offers list intact; the
        // next tick will recover.
      }
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [localDeviceId, intervalMs]);

  const refresh = useCallback(() => {
    if (!signalingRef.current) return;
    signalingRef.current.pending().then(setOffers).catch(() => undefined);
  }, []);

  return { offers, refresh };
}
