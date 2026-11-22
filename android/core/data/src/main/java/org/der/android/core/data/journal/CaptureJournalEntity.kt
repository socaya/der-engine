package org.der.android.core.data.journal

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One row per queued capture. Mirrors the server journal row shape
 * at a coarse granularity — body is the serialised payload the sync
 * worker will POST, resource names the edge-api path to use. This is
 * the client-side counterpart of the server's `der.journal` table;
 * ADR-0004 (offline-first journal) governs the idempotency contract.
 */
@Entity(tableName = "capture_journal")
data class CaptureJournalEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val resource: String,
    val dataSet: String? = null,
    val orgUnit: String? = null,
    val period: String? = null,
    val body: String,
    val status: String = STATUS_PENDING,
    val attempts: Int = 0,
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val sentAt: Long? = null,
) {
    companion object {
        const val STATUS_PENDING = "PENDING"
        const val STATUS_SENT = "SENT"
        const val STATUS_FAILED = "FAILED"
    }
}
