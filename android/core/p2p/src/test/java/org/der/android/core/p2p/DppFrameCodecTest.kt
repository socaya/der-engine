package org.der.android.core.p2p

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * DPP/1 wire codec invariants — the very contract that lets an
 * Android client exchange frames with a web client on the same
 * clinic LAN. Breaking this test breaks mesh interop.
 */
class DppFrameCodecTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    @Test fun roundTrip() {
        val original = DppFrame(
            type = DppFrameType.FRAME,
            resource = "workflow",
            action = "run-advance",
            id = "f-1",
            from = "device-A",
            to = "device-B",
            ttl = 2,
            payload = "{\"stepId\":7}",
        )
        val wire = json.encodeToString(DppFrame.serializer(), original)
        val decoded = json.decodeFromString(DppFrame.serializer(), wire)
        assertEquals(original, decoded)
    }

    @Test fun defaultsOmittedOnWireButRestoredOnDecode() {
        val f = DppFrame(
            type = DppFrameType.HELLO,
            resource = "mesh",
            action = "hello",
            id = "h-1",
            from = "device-A",
        )
        val wire = json.encodeToString(DppFrame.serializer(), f)
        val decoded = json.decodeFromString(DppFrame.serializer(), wire)
        assertEquals(DPP_VERSION, decoded.v)
        assertEquals(RELAY_DEFAULT_TTL, decoded.ttl)
    }

    @Test fun unknownFieldsAccepted() {
        val raw = """
            {"v":1,"type":"FRAME","resource":"workflow","action":"run-advance",
             "id":"f-2","from":"A","to":"B","ttl":1,"payload":null,
             "futureField":"should not break"}
        """.trimIndent()
        val decoded = json.decodeFromString(DppFrame.serializer(), raw)
        assertEquals("f-2", decoded.id)
    }
}
