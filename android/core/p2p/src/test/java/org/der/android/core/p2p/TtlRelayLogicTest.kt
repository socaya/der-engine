package org.der.android.core.p2p

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies the TTL-relay invariants independently of the WebRTC
 * transport. The mesh forwards a frame when:
 *   - frame.to is set AND is not us,
 *   - frame.ttl > 0,
 *   - we haven't already seen frame.id this session.
 * The forwarded copy has ttl decremented by 1.
 */
class TtlRelayLogicTest {

    private fun shouldForward(selfId: String, frame: DppFrame, seen: Set<String>): Boolean {
        if (frame.id in seen) return false
        val to = frame.to ?: return false
        if (to == selfId) return false
        return frame.ttl > 0
    }

    @Test fun forwardsWhenTargetNotUsAndTtlLeft() {
        val f = DppFrame(
            type = DppFrameType.FRAME, resource = "workflow",
            action = "run-advance", id = "f1",
            from = "A", to = "C", ttl = 2,
        )
        assertTrue(shouldForward("B", f, emptySet()))
    }

    @Test fun doesNotForwardWhenTargetedAtUs() {
        val f = DppFrame(
            type = DppFrameType.FRAME, resource = "workflow",
            action = "run-advance", id = "f1",
            from = "A", to = "B", ttl = 2,
        )
        assertFalse(shouldForward("B", f, emptySet()))
    }

    @Test fun doesNotForwardWhenTtlZero() {
        val f = DppFrame(
            type = DppFrameType.FRAME, resource = "workflow",
            action = "run-advance", id = "f1",
            from = "A", to = "C", ttl = 0,
        )
        assertFalse(shouldForward("B", f, emptySet()))
    }

    @Test fun deduplicatesSameId() {
        val f = DppFrame(
            type = DppFrameType.FRAME, resource = "workflow",
            action = "run-advance", id = "f1",
            from = "A", to = "C", ttl = 2,
        )
        assertFalse(shouldForward("B", f, setOf("f1")))
    }

    @Test fun ttlDecrementsOnForward() {
        val f = DppFrame(
            type = DppFrameType.FRAME, resource = "workflow",
            action = "run-advance", id = "f1",
            from = "A", to = "C", ttl = 2,
        )
        val next = f.copy(ttl = f.ttl - 1)
        assertEquals(1, next.ttl)
    }
}
