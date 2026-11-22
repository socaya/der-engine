package org.der.android.core.p2p

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Lazily-initialised singleton that owns the WebRTC
 * [PeerConnectionFactory] and the shared [EglBase] context used by
 * every [PeerSession]. Spinning this up is expensive — one
 * [PeerConnectionFactory.initialize] call per process — so the
 * provider caches it behind a double-checked lock.
 *
 * Phase 3.5 targets data-channel-only WebRTC; audio/video encoders
 * come later. We still build the default video codec factories so a
 * future phase can enable camera track negotiation without pulling in
 * a second initialisation path.
 */
@Singleton
class PeerConnectionFactoryProvider @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val lock = Any()
    private var _factory: PeerConnectionFactory? = null
    private var _egl: EglBase? = null
    private var initialised = false

    fun factory(): PeerConnectionFactory = synchronized(lock) {
        _factory ?: run {
            if (!initialised) {
                PeerConnectionFactory.initialize(
                    PeerConnectionFactory.InitializationOptions.builder(context)
                        .setEnableInternalTracer(false)
                        .createInitializationOptions(),
                )
                initialised = true
            }
            val egl = EglBase.create()
            val built = PeerConnectionFactory.builder()
                .setOptions(PeerConnectionFactory.Options().apply {
                    // Clinic LAN tends to be single-subnet; disabling the
                    // network ignore list is fine and avoids surprising
                    // ICE filtering on carrier-managed devices.
                    networkIgnoreMask = 0
                })
                .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, true))
                .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
                .createPeerConnectionFactory()
            _factory = built
            _egl = egl
            built
        }
    }

    fun eglBase(): EglBase = synchronized(lock) {
        _egl ?: run { factory(); _egl!! }
    }

    /**
     * The RTCConfiguration shared across every [PeerSession]. Clinic
     * LAN typically has no STUN/TURN; we still allow a standard public
     * STUN as a fallback for future multi-site scenarios.
     */
    fun rtcConfig(): PeerConnection.RTCConfiguration {
        val servers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302")
                .createIceServer(),
        )
        return PeerConnection.RTCConfiguration(servers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            iceTransportsType = PeerConnection.IceTransportsType.ALL
            keyType = PeerConnection.KeyType.ECDSA
        }
    }
}
