package org.der.android.core.p2p

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Abstract contract for the Android peer-mesh. Phase 3 ships the
 * interface only; Phase 4+ wires a WebRTC implementation backed by
 * the DER edge server's signalling endpoints at
 * `/edge-api/v1/workflows/peers/`.
 *
 * The shape intentionally mirrors `client/src/p2p/useP2PMesh.ts` so
 * both clients share the same operator model.
 */
interface PeerMesh {

    data class Peer(
        val deviceId: String,
        val displayName: String? = null,
        val reachable: Boolean = false,
        val trust: Trust = Trust.UNVERIFIED,
    ) {
        enum class Trust { TRUSTED, UNVERIFIED, BLOCKED }
    }

    /** Observable snapshot of currently-known peers. */
    val peers: Flow<List<Peer>>

    /** Every DPP/1 frame received from any remote peer. Shared
     *  across all observers; frames are not replayed. */
    val incoming: Flow<DppFrame>

    /** Start signalling, offer/answer with every peer, maintain
     *  the data-channel pool. Idempotent. */
    suspend fun start()

    /** Tear down every peer connection; stop the signalling socket. */
    suspend fun stop()

    /** Send a DPP/1 frame to a specific peer (or broadcast when
     *  [DppFrame.to] is null). Resolves when the frame is acked by
     *  the remote peer or expires via TTL. */
    suspend fun send(frame: DppFrame)
}

/**
 * Null implementation used until the real WebRTC-backed mesh lands
 * in Phase 4. Keeps the UI compilable and lets ViewModels wire up
 * against the interface today.
 */
class NullPeerMesh : PeerMesh {
    private val _peers = MutableStateFlow<List<PeerMesh.Peer>>(emptyList())
    private val _incoming = kotlinx.coroutines.flow.MutableSharedFlow<DppFrame>()
    override val peers: Flow<List<PeerMesh.Peer>> = _peers.asStateFlow()
    override val incoming: Flow<DppFrame> = _incoming
    override suspend fun start() { /* no-op until Phase 4 */ }
    override suspend fun stop() { /* no-op until Phase 4 */ }
    override suspend fun send(frame: DppFrame) { /* no-op until Phase 4 */ }
}
