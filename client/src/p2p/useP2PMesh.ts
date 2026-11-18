import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PeerMeshManager } from './mesh';
import type { P2POptions } from './peerConnection';
import type {
  P2PMessage,
  P2PSession,
  PeerChannelKind,
  PendingOffer,
} from './types';

/**
 * Multi-session companion to {@link useP2P}. Owns one
 * {@link PeerMeshManager} per mount; exposes the list of live
 * sessions + imperative handles for connect / accept / send / close.
 *
 * <p>Design note: we deliberately pick <strong>remoteDevice</strong>
 * as the UI-level key even though {@link PeerMeshManager} indexes
 * by sessionId. The UI's natural model is "one row per peer with a
 * Connect/Reconnect button"; sessionId changes on reconnect but the
 * peer identity doesn't. The hook exposes both so callers can pick
 * whichever fits the component shape they're building.</p>
 */
export interface UseP2PMeshResult {
  readonly sessions: readonly P2PSession[];
  readonly lastMessage: { sessionId: string; msg: P2PMessage } | null;
  readonly lastError: { sessionId: string; error: Error; phase: string } | null;
  readonly connect: (remoteDevice: string, kind?: PeerChannelKind) => Promise<string>;
  readonly accept: (offer: PendingOffer) => Promise<string>;
  readonly send: (sessionId: string, msg: P2PMessage) => void;
  readonly close: (sessionId: string) => void;
  readonly closeAll: () => void;
  readonly mesh: PeerMeshManager | null;
}

export function useP2PMesh(
  localDeviceId: string | null,
  opts?: P2POptions,
): UseP2PMeshResult {
  const meshRef = useRef<PeerMeshManager | null>(null);
  const [sessions, setSessions] = useState<readonly P2PSession[]>([]);
  const [lastMessage, setLastMessage] =
    useState<{ sessionId: string; msg: P2PMessage } | null>(null);
  const [lastError, setLastError] =
    useState<{ sessionId: string; error: Error; phase: string } | null>(null);

  useEffect(() => {
    if (!localDeviceId) {
      return undefined;
    }
    const mesh = new PeerMeshManager(localDeviceId, opts);
    meshRef.current = mesh;
    const refresh = (): void => setSessions(mesh.sessions());

    const offStatus = mesh.onStatus(() => refresh());
    const offMessage = mesh.onMessage((sessionId, msg) => {
      setLastMessage({ sessionId, msg });
    });
    const offError = mesh.onError((sessionId, error, phase) => {
      setLastError({ sessionId, error, phase });
    });
    return () => {
      offStatus();
      offMessage();
      offError();
      mesh.closeAll();
      meshRef.current = null;
    };
    // opts intentionally excluded — see useP2P for the rationale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDeviceId]);

  const connect = useCallback(
    async (remoteDevice: string, kind: PeerChannelKind = 'data') => {
      const mesh = meshRef.current;
      if (!mesh) throw new Error('P2P mesh not ready');
      const sessionId = await mesh.connectTo(remoteDevice, kind);
      setSessions(mesh.sessions());
      return sessionId;
    },
    [],
  );

  const accept = useCallback(async (offer: PendingOffer) => {
    const mesh = meshRef.current;
    if (!mesh) throw new Error('P2P mesh not ready');
    const sessionId = await mesh.acceptOffer(offer);
    setSessions(mesh.sessions());
    return sessionId;
  }, []);

  const send = useCallback((sessionId: string, msg: P2PMessage) => {
    const mesh = meshRef.current;
    if (!mesh) throw new Error('P2P mesh not ready');
    mesh.send(sessionId, msg);
  }, []);

  const close = useCallback((sessionId: string) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.close(sessionId);
    setSessions(mesh.sessions());
  }, []);

  const closeAll = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.closeAll();
    setSessions([]);
  }, []);

  return useMemo(
    () => ({
      sessions, lastMessage, lastError,
      connect, accept, send, close, closeAll,
      mesh: meshRef.current,
    }),
    [sessions, lastMessage, lastError, connect, accept, send, close, closeAll],
  );
}
