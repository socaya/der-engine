package org.der.android.core.sync

import kotlinx.serialization.json.Json
import org.der.android.core.data.network.DataValueDto
import org.der.android.core.data.network.DataValueSetDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks the DHIS2 dataValueSets envelope the client POSTs. If this
 * test starts failing, the Android client has drifted from the
 * server's DataValueSetsController contract — the web client will
 * stop accepting the same payload at the same moment.
 */
class DataValueSetPayloadTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    @Test fun envelopeCarriesDataSetOrgUnitPeriodAndValues() {
        val payload = DataValueSetDto(
            dataSet = "DS-1",
            orgUnit = "OU-1",
            period = "202611",
            dataValues = listOf(
                DataValueDto(dataElement = "DE-1", value = "42"),
                DataValueDto(dataElement = "DE-2", value = "7"),
            ),
        )
        val wire = json.encodeToString(DataValueSetDto.serializer(), payload)
        assertTrue(wire.contains("\"dataSet\":\"DS-1\""))
        assertTrue(wire.contains("\"orgUnit\":\"OU-1\""))
        assertTrue(wire.contains("\"period\":\"202611\""))
        assertTrue(wire.contains("\"dataElement\":\"DE-1\""))
        assertTrue(wire.contains("\"value\":\"42\""))

        val decoded = json.decodeFromString(DataValueSetDto.serializer(), wire)
        assertEquals("DS-1", decoded.dataSet)
        assertEquals(2, decoded.dataValues.size)
    }

    @Test fun nullOptionalsAreOmitted() {
        val payload = DataValueSetDto(
            dataSet = "DS-1", orgUnit = "OU-1", period = "202611",
            dataValues = listOf(DataValueDto("DE-1", "9")),
        )
        val wire = json.encodeToString(DataValueSetDto.serializer(), payload)
        assertTrue("completeDate should not appear when null: $wire",
            !wire.contains("completeDate"))
        assertTrue("categoryOptionCombo should not appear when null: $wire",
            !wire.contains("categoryOptionCombo"))
    }
}
