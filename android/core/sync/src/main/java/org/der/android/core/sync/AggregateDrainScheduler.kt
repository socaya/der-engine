package org.der.android.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Entry point to kick off the capture drain. Keeps the ViewModels
 * free of a direct WorkManager dependency — they just call
 * [scheduleDrain] after enqueueing to the journal.
 */
@Singleton
class AggregateDrainScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    fun scheduleDrain() {
        val request = OneTimeWorkRequestBuilder<AggregateDrainWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_WORK_NAME,
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request,
        )
    }

    companion object {
        const val UNIQUE_WORK_NAME = "der-aggregate-drain"
    }
}
