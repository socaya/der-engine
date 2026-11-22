package org.der.android.core.p2p

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.RtpReceiver
import org.webrtc.SessionDescription
import timber.log.Timber
import java.nio.ByteBuffer

/**
 * One PeerConnection + one reliable DER-DPP/1 DataChannel to a single
 * remote peer. Thin wrapper that exposes:
 *   - [state]  flow of the native ICE state
 *   - [frames] flow of DPP/1 wire bytes received on the channel
 *   - [send]   send a DppFrame as UTF-8 JSON over the channel
 *   - [onIceCandidateGenerated] callback for the orchestrator to
 *      relay to the signalling broker
 *
 * Phase 3.5 scope: data-channel only, reliable, in-order. Audio/video
 * tracks come later.
 */
class PeerSession(
    private val factory: PeerConnectionFactoryProvider,
    private val remoteDeviceId: String,
    private val isInitiator: Boolean,
    private val onIceCandidateGenerated: (IceCandidate) -> Unit,
) {

    private val _state = MutableStateFlow(PeerConnection.IceConnectionState.NEW)
    val state: Flow<PeerConnection.IceConnectionState> = _state.asStateFlow()

    private val inbound = Channel<ByteArray>(capacity = Channel.BUFFERED)
    val frames: Flow<ByteArray> = inbound.receiveAsFlow()

    private val channelReady = CompletableDeferred<DataChannel>()

    private val observer = object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState?) { }
        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
            newState?.let { _state.value = it }
        }
        override fun onIceConnectionReceivingChange(receiving: Boolean) { }
        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) { }
        override fun onIceCandidate(candidate: IceCandidate?) {
            candidate?.let(onIceCandidateGenerated)
        }
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) { }
        override fun onAddStream(stream: MediaStream?) { }
        override fun onRemoveStream(stream: MediaStream?) { }
        override fun onDataChannel(channel: DataChannel?) {
            // Remote-opened channel (responder path).
            channel?.let { wireChannel(it) }
        }
        override fun onRenegotiationNeeded() { }
        override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) { }
    }

    private val pc: PeerConnection = requireNotNull(
        factory.factory().createPeerConnection(factory.rtcConfig(), observer),
    ) { "PeerConnectionFactory returned null — WebRTC not initialised" }

    init {
        if (isInitiator) {
            // Initiator creates the DataChannel; responder picks it up
            // via onDataChannel above.
            val init = DataChannel.Init().apply {
                ordered = true
                negotiated = false
                protocol = "dpp/1"
            }
            val local = pc.createDataChannel("der-dpp", init)
            wireChannel(local)
        }
    }

    private fun wireChannel(ch: DataChannel) {
        ch.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previous: Long) { }
            override fun onStateChange() {
                if (ch.state() == DataChannel.State.OPEN) {
                    if (!channelReady.isCompleted) channelReady.complete(ch)
                }
            }
            override fun onMessage(buffer: DataChannel.Buffer?) {
                buffer ?: return
                val data = buffer.data
                val bytes = ByteArray(data.remaining()).also { data.get(it) }
                val sent = inbound.trySend(bytes)
                if (sent.isFailure) {
                    Timber.w("DPP inbound channel full; dropping frame from %s", remoteDeviceId)
                }
            }
        })
    }

    suspend fun createOffer(): SessionDescription? =
        suspendSdp { pc.createOffer(it, MediaConstraints()) }

    suspend fun createAnswer(): SessionDescription? =
        suspendSdp { pc.createAnswer(it, MediaConstraints()) }

    suspend fun setLocalDescription(sdp: SessionDescription): Boolean =
        suspendSetSdp { pc.setLocalDescription(it, sdp) }

    suspend fun setRemoteDescription(sdp: SessionDescription): Boolean =
        suspendSetSdp { pc.setRemoteDescription(it, sdp) }

    fun addIce(candidate: IceCandidate): Boolean = pc.addIceCandidate(candidate)

    /**
     * Send one DPP/1 frame on the channel. Suspends until the channel
     * is OPEN (ie. ICE finished + DC handshake). Returns `false` only
     * if the channel refused the send after opening.
     */
    suspend fun send(bytes: ByteArray): Boolean {
        val ch = channelReady.await()
        val buf = DataChannel.Buffer(ByteBuffer.wrap(bytes), /* binary = */ false)
        return ch.send(buf)
    }

    fun close() {
        pc.close()
        pc.dispose()
        inbound.close()
    }

    private suspend fun suspendSdp(
        block: (org.webrtc.SdpObserver) -> Unit,
    ): SessionDescription? {
        val done = CompletableDeferred<SessionDescription?>()
        block(object : org.webrtc.SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) { done.complete(sdp) }
            override fun onSetSuccess() { }
            override fun onCreateFailure(error: String?) { done.complete(null) }
            override fun onSetFailure(error: String?) { done.complete(null) }
        })
        return done.await()
    }

    private suspend fun suspendSetSdp(
        block: (org.webrtc.SdpObserver) -> Unit,
    ): Boolean {
        val done = CompletableDeferred<Boolean>()
        block(object : org.webrtc.SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) { }
            override fun onSetSuccess() { done.complete(true) }
            override fun onCreateFailure(error: String?) { done.complete(false) }
            override fun onSetFailure(error: String?) { done.complete(false) }
        })
        return done.await()
    }
}
