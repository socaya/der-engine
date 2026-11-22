package org.der.android.core.sync

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import org.der.android.core.data.journal.CaptureJournalDao
import org.der.android.core.data.journal.CaptureJournalEntity
import org.der.android.core.data.network.DataSetDto
import org.der.android.core.data.network.DataValueDto
import org.der.android.core.data.network.DataValueSetDto
import org.der.android.core.data.network.DerApi
import org.der.android.core.domain.CapturePending
import org.der.android.core.domain.DataElement
import org.der.android.core.domain.DataSet
import org.der.android.core.domain.DataSetSummary
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orchestrates DER Data Entry on the Android client: list datasets,
 * load one dataset's metadata, enqueue a submission into the local
 * capture journal and drive the WorkManager drain.
 *
 * Offline-first: submissions always land in the journal first, then
 * the drain worker POSTs each pending row to `/api/dataValueSets`.
 * This matches the web client's `submitAggregate` behaviour but
 * inverts the order — web tries the HTTP first; Android queues first
 * because WorkManager handles retries/backoff for us and because
 * background WAN is more volatile than desktop WAN.
 */
@Singleton
class AggregateRepository @Inject constructor(
    private val api: DerApi,
    private val dao: CaptureJournalDao,
    private val drain: AggregateDrainScheduler,
    private val json: Json,
) {

    suspend fun listDataSets(orgUnit: String? = null): List<DataSetSummary> {
        val response = api.listDataSets(orgUnit = orgUnit)
        val body = response.body() ?: return emptyList()
        return body.dataSets.map {
            DataSetSummary(
                id = it.id,
                displayName = it.displayName ?: it.name ?: it.id,
                periodType = it.periodType,
                formType = it.formType,
            )
        }
    }

    suspend fun getDataSet(id: String): DataSet? {
        val response = api.getDataSet(id)
        val body = response.body() ?: return null
        return body.toDomain()
    }

    /**
     * Enqueue a dataValueSet submission for the given dataset + OU +
     * period. The journal row is immediately visible via
     * [observePending]; the WorkManager chain triggered by
     * [AggregateDrainScheduler] will POST it to the edge.
     */
    suspend fun enqueueSubmission(
        dataSet: String,
        orgUnit: String,
        period: String,
        values: Map<String, String>,
    ): Long {
        val payload = DataValueSetDto(
            dataSet = dataSet,
            orgUnit = orgUnit,
            period = period,
            dataValues = values.entries
                .filter { it.value.isNotBlank() }
                .map { (de, v) -> DataValueDto(dataElement = de, value = v) },
        )
        val body = json.encodeToString(DataValueSetDto.serializer(), payload)
        val id = dao.insert(
            CaptureJournalEntity(
                resource = "api/dataValueSets",
                dataSet = dataSet,
                orgUnit = orgUnit,
                period = period,
                body = body,
            ),
        )
        drain.scheduleDrain()
        return id
    }

    fun observePending(): Flow<List<CapturePending>> =
        dao.observeRecent().map { rows ->
            rows.map { it.toPending() }
        }

    fun observePendingCount(): Flow<Int> = dao.observeCountByStatus()

    private fun DataSetDto.toDomain(): DataSet = DataSet(
        id = id,
        displayName = displayName ?: name ?: id,
        periodType = periodType,
        dataElements = dataSetElements.map {
            DataElement(
                id = it.dataElement.id,
                displayName = it.dataElement.formName
                    ?: it.dataElement.name
                    ?: it.dataElement.id,
                valueType = it.dataElement.valueType,
            )
        },
    )

    private fun CaptureJournalEntity.toPending(): CapturePending = CapturePending(
        id = id,
        resource = resource,
        summary = buildString {
            append(dataSet ?: resource)
            orgUnit?.let { append(" · $it") }
            period?.let { append(" · $it") }
            append(" · $status")
        },
        attempts = attempts,
        lastError = lastError,
        createdAt = createdAt,
    )
}
