package org.der.android.core.sync

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import org.der.android.core.data.journal.CaptureJournalDao
import org.der.android.core.data.journal.CaptureJournalEntity
import org.der.android.core.data.network.CategoryOptionComboDto
import org.der.android.core.data.network.DataSetDto
import org.der.android.core.data.network.DataValueDto
import org.der.android.core.data.network.DataValueSetDto
import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.OptionSetDto
import org.der.android.core.domain.CapturePending
import org.der.android.core.domain.CategoryOptionCombo
import org.der.android.core.domain.DataElement
import org.der.android.core.domain.DataSet
import org.der.android.core.domain.DataSetSection
import org.der.android.core.domain.DataSetSummary
import org.der.android.core.domain.GreyedCell
import org.der.android.core.domain.OptionSet
import org.der.android.core.domain.OptionSetOption
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
     * Fetch every option set referenced by the dataset's data
     * elements in a single pass. Returns a [Map] keyed by option set
     * UID so the form screen can look up the display options in
     * O(1). Values that fail to resolve are simply absent from the
     * map — the form degrades to a text input.
     */
    suspend fun loadOptionSetsFor(dataSet: DataSet): Map<String, OptionSet> {
        val ids = dataSet.dataElements
            .mapNotNull { it.optionSetId }
            .distinct()
        if (ids.isEmpty()) return emptyMap()
        val result = mutableMapOf<String, OptionSet>()
        for (id in ids) {
            runCatching { api.getOptionSet(id) }
                .getOrNull()
                ?.body()
                ?.toDomain()
                ?.let { result[it.id] = it }
        }
        return result
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
        // Keys can be either "dataElementId" or "dataElementId|cocId"
        // to address a specific category-option-combo cell. Split
        // once here so the submit worker still sends a flat
        // dataValueSet.
        val dataValues = values.entries
            .filter { it.value.isNotBlank() }
            .map { (compositeKey, v) ->
                val parts = compositeKey.split("|", limit = 2)
                val deId = parts[0]
                val coc = parts.getOrNull(1)?.takeIf { it.isNotEmpty() }
                DataValueDto(dataElement = deId, value = v, categoryOptionCombo = coc)
            }
        val payload = DataValueSetDto(
            dataSet = dataSet,
            orgUnit = orgUnit,
            period = period,
            dataValues = dataValues,
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

    /** Re-queue a FAILED or SENT row so the next drain will send it
     *  again. Resets lastError + sentAt so the Drafts screen shows
     *  a clean row. */
    suspend fun retry(id: Long) {
        dao.markPendingAgain(id)
        drain.scheduleDrain()
    }

    /** Operator decision to drop a row entirely — journal entry is
     *  removed and will not be retried. */
    suspend fun discard(id: Long) {
        dao.delete(id)
    }

    private fun DataSetDto.toDomain(): DataSet {
        val defaultCocs = categoryCombo?.categoryOptionCombos.orEmpty().map {
            CategoryOptionCombo(it.id, it.displayName ?: it.name ?: it.id)
        }
        val elements = dataSetElements.map {
            val de = it.dataElement
            val perDeCocs = de.categoryCombo?.categoryOptionCombos.orEmpty().map { c ->
                CategoryOptionCombo(c.id, c.displayName ?: c.name ?: c.id)
            }
            DataElement(
                id = de.id,
                displayName = de.formName ?: de.name ?: de.id,
                valueType = de.valueType,
                optionSetId = de.optionSet?.id,
                categoryOptionCombos = perDeCocs.ifEmpty { defaultCocs },
            )
        }
        val domainSections = sections.sortedBy { it.sortOrder ?: 0 }.map { s ->
            DataSetSection(
                id = s.id,
                displayName = s.displayName ?: s.name ?: s.id,
                dataElementIds = s.dataElements.map { it.id },
                greyed = s.greyedFields
                    .mapNotNull { g ->
                        val deId = g.dataElement?.id ?: return@mapNotNull null
                        val cocId = g.categoryOptionCombo?.id ?: return@mapNotNull null
                        GreyedCell(deId, cocId)
                    }
                    .toSet(),
            )
        }
        return DataSet(
            id = id,
            displayName = displayName ?: name ?: id,
            periodType = periodType,
            dataElements = elements,
            sections = domainSections,
            defaultCategoryOptionCombos = defaultCocs,
        )
    }

    private fun OptionSetDto.toDomain(): OptionSet = OptionSet(
        id = id,
        displayName = displayName ?: name ?: id,
        options = options
            .sortedBy { it.sortOrder ?: 0 }
            .mapNotNull { opt ->
                val code = opt.code ?: return@mapNotNull null
                OptionSetOption(code = code, displayName = opt.displayName ?: opt.name ?: code)
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
