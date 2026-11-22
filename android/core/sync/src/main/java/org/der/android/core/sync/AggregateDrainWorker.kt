package org.der.android.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.serialization.json.Json
import org.der.android.core.data.journal.CaptureJournalDao
import org.der.android.core.data.journal.CaptureJournalEntity
import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.DataValueSetDto
import timber.log.Timber

/**
 * Drains pending entries from [CaptureJournalDao] by POSTing each to
 * its edge-api resource. Runs on WorkManager; backoff handled by
 * WorkManager's retry policy.
 *
 * Phase 4 ships support for `api/dataValueSets` only; later phases
 * add event + tracker + journal resources.
 */
@HiltWorker
class AggregateDrainWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val dao: CaptureJournalDao,
    private val api: DerApi,
    private val json: Json,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val pending = dao.byStatus(CaptureJournalEntity.STATUS_PENDING)
        if (pending.isEmpty()) return Result.success()

        var transient = false
        for (entry in pending) {
            runCatching {
                when (entry.resource) {
                    "api/dataValueSets" -> submitDataValueSet(entry)
                    else -> {
                        Timber.w("drain: skipping unknown resource %s", entry.resource)
                        dao.markResult(
                            id = entry.id,
                            status = CaptureJournalEntity.STATUS_FAILED,
                            sentAt = null,
                            error = "unknown resource ${entry.resource}",
                        )
                    }
                }
            }.onFailure { t ->
                Timber.w(t, "drain: transient failure on entry %d", entry.id)
                transient = true
                dao.markResult(
                    id = entry.id,
                    status = CaptureJournalEntity.STATUS_PENDING,
                    sentAt = null,
                    error = t.message ?: t::class.java.simpleName,
                )
            }
        }
        return if (transient) Result.retry() else Result.success()
    }

    private suspend fun submitDataValueSet(entry: CaptureJournalEntity) {
        val payload = json.decodeFromString(DataValueSetDto.serializer(), entry.body)
        val response = api.submitDataValueSet(payload)
        val ok = response.isSuccessful
        if (ok) {
            dao.markResult(
                id = entry.id,
                status = CaptureJournalEntity.STATUS_SENT,
                sentAt = System.currentTimeMillis(),
                error = null,
            )
        } else if (response.code() in 400..499) {
            // Non-retryable client errors — stop bouncing.
            dao.markResult(
                id = entry.id,
                status = CaptureJournalEntity.STATUS_FAILED,
                sentAt = null,
                error = "HTTP ${response.code()}",
            )
        } else {
            // 5xx — let WorkManager retry.
            throw RuntimeException("HTTP ${response.code()}")
        }
    }
}
