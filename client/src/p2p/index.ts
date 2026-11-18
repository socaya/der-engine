/** Public barrel for the DER client P2P module.
 *  Import from `src/p2p` so call-sites don't bind to individual files
 *  (keeps future refactors invisible to consumers). */

export { SignalingClient } from './signaling';
export { PeerConnectionManager } from './peerConnection';
export type { P2POptions, P2PStatusListener, P2PMessageListener, P2PErrorListener }
  from './peerConnection';
export { useP2P, usePendingOffers } from './useP2P';
export type { UseP2PResult } from './useP2P';
export { SignalingError } from './types';
export type {
  P2PConnectionStatus,
  P2PMessage,
  P2PSession,
  PeerChannelKind,
  PeerSessionState,
  PeerSessionSummary,
  PendingOffer,
  RemoteIceCandidate,
} from './types';

// Replicators — all use DPP/1 (ADR-0038).
export { JournalReplicator } from './journalReplicator';
export type { ReplicateOutcome } from './journalReplicator';
export { WorkflowReplicator } from './workflowReplicator';
export type { PushWorkflowResult } from './workflowReplicator';
export { MetadataSyncReplicator } from './metadataSyncReplicator';
export type { MetadataSyncResult } from './metadataSyncReplicator';

// Mesh (multi-session composition).
export { PeerMeshManager } from './mesh';
export type {
  MeshMessageListener, MeshStatusListener, MeshErrorListener,
} from './mesh';
export { useP2PMesh } from './useP2PMesh';
export type { UseP2PMeshResult } from './useP2PMesh';

// DPP/1 — DER Peer Protocol.
export {
  DerPeerProtocol, DppError, DPP_VERSION, RELAY_DEFAULT_TTL,
} from './derPeerProtocol';
export type {
  DppCapabilities, DppFrame, DppFrameType, DppHandler,
  DppHandlerContext, DppResource, DppRouteTable,
} from './derPeerProtocol';
export { WorkflowHandoff } from './workflowHandoff';
export type { RunAdvancePayload, HandoffResult } from './workflowHandoff';
export { PeerSignalingRelay } from './peerSignaling';
export type {
  SignalRelayKind, SignalRelayPayload, SignalRelayLocalHandler,
} from './peerSignaling';

// DPP.4 process-wide bus + SSE subscriber for auto-fire run-advance.
export { setActiveMesh, activeMesh, broadcastRunAdvance } from './bus';
export type { MeshRegistration } from './bus';
export { startContributionSubscriber, stopContributionSubscriber }
  from './contributionSseSubscriber';
