package org.der.android.core.p2p

import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.WebRtcAnswerDto
import org.der.android.core.data.network.WebRtcIceCandidateDto
import org.der.android.core.data.network.WebRtcIceDto
import org.der.android.core.data.network.WebRtcOfferDto
import org.der.android.core.data.network.WebRtcSessionDto
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper over [DerApi] that limits its exposed surface to the
 * subset of the `/edge-api/v1/webrtc/` endpoints that the peer mesh
 * actually needs. Gives the mesh a seam to swap signalling transport
 * later (e.g. SSE push) without touching PeerConnection code.
 */
@Singleton
class SignallingClient @Inject constructor(private val api: DerApi) {

    suspend fun offer(
        initiator: String, responder: String, sdpOffer: String, kind: String = "data",
    ): String? {
        val response = api.offerSession(WebRtcOfferDto(initiator, responder, sdpOffer, kind))
        return response.body()?.sessionId
    }

    suspend fun answer(sessionId: String, sdpAnswer: String): Boolean =
        api.answerSession(sessionId, WebRtcAnswerDto(sdpAnswer)).isSuccessful

    suspend fun complete(sessionId: String): Boolean =
        api.completeSession(sessionId).isSuccessful

    suspend fun pending(deviceId: String): List<WebRtcSessionDto> =
        api.pendingSessions(deviceId).body()?.sessions.orEmpty()

    suspend fun getSession(sessionId: String): WebRtcSessionDto? =
        api.getSession(sessionId).body()

    suspend fun postIce(
        sessionId: String, from: String, candidate: String,
        sdpMid: String? = null, sdpMLineIndex: Int? = null,
    ): Long? {
        val response = api.postIceCandidate(
            sessionId,
            WebRtcIceDto(from, candidate, sdpMid, sdpMLineIndex),
        )
        return response.body()?.candidateId
    }

    suspend fun pollIce(
        sessionId: String, deviceId: String, since: Long = 0L,
    ): List<WebRtcIceCandidateDto> =
        api.pollIceCandidates(sessionId, deviceId, since).body()?.candidates.orEmpty()
}
