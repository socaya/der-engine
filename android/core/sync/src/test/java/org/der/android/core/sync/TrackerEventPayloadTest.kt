package org.der.android.core.sync

import kotlinx.serialization.json.Json
import org.der.android.core.data.network.TrackerEventDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks the tracker-event wire envelope the drain worker POSTs to
 * `/edge-api/v1/tracker/events`. If the server renames a field, this
 * test should fail in the same change — before any device hits
 * production.
 */
class TrackerEventPayloadTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    @Test fun envelopeCarriesEverythingTheServerExpects() {
        val payload = TrackerEventDto(
            eventUid = "Abcdefghijk",
            programUid = "PROG-1",
            programStageUid = "STAGE-1",
            orgUnitUid = "OU-1",
            occurredDate = "2026-11-22",
            dataValues = mapOf("DE-1" to "9", "DE-2" to "hi"),
        )
        val wire = json.encodeToString(TrackerEventDto.serializer(), payload)
        assertTrue(wire.contains("\"eventUid\":\"Abcdefghijk\""))
        assertTrue(wire.contains("\"programUid\":\"PROG-1\""))
        assertTrue(wire.contains("\"programStageUid\":\"STAGE-1\""))
        assertTrue(wire.contains("\"orgUnitUid\":\"OU-1\""))
        assertTrue(wire.contains("\"occurredDate\":\"2026-11-22\""))
        assertTrue(wire.contains("\"DE-1\":\"9\""))

        val decoded = json.decodeFromString(TrackerEventDto.serializer(), wire)
        assertEquals("ACTIVE", decoded.status)
        assertEquals(2, decoded.dataValues.size)
    }

    @Test fun eventUidGeneratorMatchesDhis2UidShape() {
        val uid = generateDhis2Uid()
        assertEquals(11, uid.length)
        assertTrue("first char must be a letter: $uid", uid[0].isLetter())
        assertTrue("remainder must be alnum: $uid",
            uid.drop(1).all { it.isLetterOrDigit() })
    }
}
