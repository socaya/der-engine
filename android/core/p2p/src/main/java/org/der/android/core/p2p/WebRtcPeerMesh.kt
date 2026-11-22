package org.der.android.core.p2p

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import org.der.android.core.data.device.DeviceIdentity
import org.webrtc.IceCandidate
import org.webrtc.SessionDescription
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Production [PeerMesh] implementation — one PeerConnection per
 * remote device, DPP/1 frames over a single reliable data channel.
 *
 * Signalling runs over DER's REST broker (`/edge-api/v1/webrtc/`,
 * ADR WebRtcController). Every few seconds the mesh polls for
 * pending offers aimed at this device and for ICE candidates on each
 * active session. When the operator wants to send a frame to a peer
 * we don't have a session with yet, we originate an offer and wait
 * for the answer+ICE to flow back.
 *
 * Phase 3.5 scope: point-to-point data-channel only. The DPP/1 TTL
 * relay routing and the per-resource replicators (journal / workflow
 * / metadata) land in subsequent phases on top of this transport.
 */
@Singleton
class WebRtcPeerMesh @Inject constructor(
    private val factory: PeerConnectionFactoryProvider,
    private val signalling: SignallingClient,
    private val identity: DeviceIdentity,
    private val nsd: NsdPeerDiscovery,
    private val json: Json,
) : PeerMesh {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val sessionsLock = Mutex()
    private val sessions = mutableMapOf<String, Entry>()
    private val _peers = MutableStateFlow<List<PeerMesh.Peer>>(emptyList())
    override val peers: Flow<List<PeerMesh.Peer>> = _peers.asStateFlow()

    private val _incoming = MutableSharedFlow<DppFrame>(replay = 0, extraBufferCapacity = 64)
    /** Frames received from any remote peer. */
    override val incoming: Flow<DppFrame> = _incoming.asSharedFlow()

    private data class Entry(
        val sessionId: String,
        val peerDeviceId: String,
        val session: PeerSession,
        var iceSince: Long = 0L,
        var consumerJob: Job? = null,
    )

    private var pollJob: Job? = null
    private var started = false

    override suspend fun start() {
        if (started) return
        started = true
        val selfId = identity.deviceId().toString()
        // Advertise + start discovering on the local LAN alongside
        // the server signalling broker.
        nsd.start(selfDeviceId = selfId)
        // Fold NSD peers into the published peer list so the Peers
        // screen shows LAN-visible devices even before a WebRTC
        // session is established.
        scope.launch {
            nsd.peers.collect { discovered ->
                _peers.update { current ->
                    val connected = current.filter { it.reachable }
                    val lanOnly = discovered
                        .filter { peer -> connected.none { it.deviceId.endsWith(peer.name.removePrefix("der-")) } }
                        .map {
                            PeerMesh.Peer(
                                deviceId = it.name,
                                displayName = it.host ?: it.name,
                                reachable = false,
                                trust = PeerMesh.Peer.Trust.UNVERIFIED,
                            )
                        }
                    connected + lanOnly
                }
            }
        }
        pollJob = scope.launch { pollLoop() }
    }

    override suspend fun stop() {
        nsd.stop()
        pollJob?.cancel()
        pollJob = null
        sessionsLock.withLock {
            sessions.values.forEach { it.session.close(); it.consumerJob?.cancel() }
            sessions.clear()
        }
        _peers.value = emptyList()
        started = false
    }

    override suspend fun send(frame: DppFrame) {
        val target = frame.to ?: return  // Phase 3.5 — no broadcast until TTL relay lands.
        val entry = ensureSession(target)
        if (entry != null) {
            val bytes = json.encodeToString(DppFrame.serializer(), frame).toByteArray()
            entry.session.send(bytes)
        } else {
            Timber.w("send() to %s failed — could not establish session", target)
        }
    }

    // ── polling loop ────────────────────────────────────────────────

    private suspend fun pollLoop() {
        val selfId = identity.deviceId().toString()
        while (true) {
            runCatching {
                val pending = signalling.pending(selfId)
                for (s in pending) {
                    val offer = s.sdpOffer
                    if (s.state.uppercase() == "OFFERED" && offer != null) {
                        handleIncomingOffer(selfId, s.sessionId, s.initiatorDevice, offer)
                    }
                }
                // Drain ICE candidates for active sessions.
                sessionsLock.withLock { sessions.values.toList() }.forEach { entry ->
                    val fresh = signalling.pollIce(entry.sessionId, selfId, entry.iceSince)
                    for (c in fresh) {
                        if (c.fromDevice == selfId) continue
                        entry.session.addIce(
                            IceCandidate(c.sdpMid.orEmpty(), c.sdpMLineIndex ?: 0, c.candidate),
                        )
                        entry.iceSince = maxOf(entry.iceSince, c.candidateId)
                    }
                }
            }.onFailure { Timber.w(it, "signalling poll cycle failed") }
            delay(3_000L)
        }
    }

    private suspend fun handleIncomingOffer(
        selfId: String, sessionId: String, initiator: String, offerSdp: String,
    ) {
        val already = sessionsLock.withLock { sessions[initiator]?.sessionId == sessionId }
        if (already) return

        val session = buildSession(
            sessionId = sessionId,
            peerDeviceId = initiator,
            isInitiator = false,
            selfId = selfId,
        )

        if (!session.setRemoteDescription(SessionDescription(SessionDescription.Type.OFFER, offerSdp))) {
            Timber.w("setRemoteDescription failed on incoming offer from %s", initiator)
            session.close()
            return
        }
        val answer = session.createAnswer() ?: run {
            session.close(); return
        }
        if (!session.setLocalDescription(answer)) {
            session.close(); return
        }
        if (!signalling.answer(sessionId, answer.description)) {
            session.close(); return
        }
        registerSession(sessionId, initiator, session)
    }

    // ── outbound path ───────────────────────────────────────────────

    private suspend fun ensureSession(peerDeviceId: String): Entry? {
        sessionsLock.withLock { sessions[peerDeviceId] }?.let { return it }

        val selfId = identity.deviceId().toString()
        val session = buildSession(
            sessionId = "pending",
            peerDeviceId = peerDeviceId,
            isInitiator = true,
            selfId = selfId,
        )

        val offer = session.createOffer() ?: run { session.close(); return null }
        if (!session.setLocalDescription(offer)) { session.close(); return null }
        val sessionId = signalling.offer(selfId, peerDeviceId, offer.description)
            ?: run { session.close(); return null }

        // Wait briefly for the remote answer. Phase 3.5 keeps this a
        // bounded poll rather than a long-lived subscription.
        val answered = waitForAnswer(sessionId, session)
        if (!answered) { session.close(); return null }

        return registerSession(sessionId, peerDeviceId, session)
    }

    private suspend fun waitForAnswer(sessionId: String, session: PeerSession): Boolean {
        repeat(10) {
            val row = signalling.getSession(sessionId) ?: return false
            if (row.state.uppercase() == "ANSWERED" && row.sdpAnswer != null) {
                return session.setRemoteDescription(
                    SessionDescription(SessionDescription.Type.ANSWER, row.sdpAnswer),
                )
            }
            delay(1_500L)
        }
        return false
    }

    private fun buildSession(
        sessionId: String,
        peerDeviceId: String,
        isInitiator: Boolean,
        selfId: String,
    ): PeerSession = PeerSession(
        factory = factory,
        remoteDeviceId = peerDeviceId,
        isInitiator = isInitiator,
        onIceCandidateGenerated = { candidate ->
            if (sessionId != "pending") {
                scope.launch {
                    signalling.postIce(
                        sessionId = sessionId,
                        from = selfId,
                        candidate = candidate.sdp,
                        sdpMid = candidate.sdpMid,
                        sdpMLineIndex = candidate.sdpMLineIndex,
                    )
                }
            }
        },
    )

    private suspend fun registerSession(
        sessionId: String, peerDeviceId: String, session: PeerSession,
    ): Entry {
        val entry = Entry(sessionId, peerDeviceId, session)
        sessionsLock.withLock { sessions[peerDeviceId] = entry }
        entry.consumerJob = scope.launch {
            session.frames.collect { raw ->
                runCatching {
                    val frame = json.decodeFromString(DppFrame.serializer(), String(raw))
                    onFrameReceived(frame)
                }.onFailure { Timber.w(it, "dropping malformed DPP frame from %s", peerDeviceId) }
            }
        }
        _peers.update { current ->
            val without = current.filterNot { it.deviceId == peerDeviceId }
            without + PeerMesh.Peer(
                deviceId = peerDeviceId,
                reachable = true,
                trust = PeerMesh.Peer.Trust.UNVERIFIED,
            )
        }
        return entry
    }

    /**
     * Receive side:
     *   1. drop duplicates (same frame.id seen recently),
     *   2. emit for local consumption,
     *   3. if the frame isn't for this device AND still has TTL,
     *      forward a decremented copy to all other peers.
     *
     * DPP/1's TTL is a small integer (default 3) that bounds the
     * blast radius — the mesh never hairpins because we always
     * dedupe by frame id before forwarding.
     */
    private suspend fun onFrameReceived(frame: DppFrame) {
        if (!markSeen(frame.id)) return
        _incoming.emit(frame)
        val selfId = identity.deviceId().toString()
        val targeted = frame.to
        if (targeted != null && targeted != selfId && frame.ttl > 0) {
            val forwarded = frame.copy(ttl = frame.ttl - 1)
            runCatching { send(forwarded) }
                .onFailure { Timber.w(it, "TTL relay forward failed for %s", frame.id) }
        }
    }

    /**
     * Bounded, thread-safe dedupe set. Returns `true` when the id is
     * newly seen (first time through). Caller treats a return of
     * `false` as "already observed — drop".
     */
    private val seenFrameIds = linkedSetOf<String>()
    private val seenLock = Any()
    private fun markSeen(id: String): Boolean = synchronized(seenLock) {
        if (id in seenFrameIds) return@synchronized false
        seenFrameIds.add(id)
        if (seenFrameIds.size > MAX_SEEN_FRAMES) {
            val oldest = seenFrameIds.iterator().next()
            seenFrameIds.remove(oldest)
        }
        true
    }

    companion object {
        private const val MAX_SEEN_FRAMES = 512
    }

    @Suppress("unused")
    protected fun finalize() {
        scope.cancel()
    }
}
