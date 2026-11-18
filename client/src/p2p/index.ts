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
