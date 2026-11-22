package org.der.android.core.p2p

import kotlinx.serialization.Serializable

/**
 * DER Peer Protocol v1 frame — Kotlin port of
 * `client/src/p2p/derPeerProtocol.ts`. See ADR-0038.
 *
 * The frame is the single envelope every peer-to-peer message rides
 * in; capability negotiation, journal fragments and workflow run
 * advances all travel as `DppFrame` instances serialised to JSON over
 * a WebRTC data channel.
 *
 * Phase 3 ships the frame shape only — Phase 4+ wires the WebRTC
 * transport, mesh discovery and the actual replicators (journal +
 * workflow + metadata) on top.
 */
@Serializable
data class DppFrame(
    val v: Int = DPP_VERSION,
    val type: DppFrameType,
    val resource: String,
    val action: String,
    val id: String,
    val from: String,
    val to: String? = null,
    val ttl: Int = RELAY_DEFAULT_TTL,
    val payload: String? = null,
)

enum class DppFrameType { HELLO, FRAME, ACK, BYE }

const val DPP_VERSION = 1
const val RELAY_DEFAULT_TTL = 3
