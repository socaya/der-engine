package org.der.android.core.data.journal

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CaptureJournalDao {

    @Insert
    suspend fun insert(entity: CaptureJournalEntity): Long

    @Query("SELECT * FROM capture_journal ORDER BY createdAt DESC LIMIT 100")
    fun observeRecent(): Flow<List<CaptureJournalEntity>>

    @Query("SELECT * FROM capture_journal WHERE status = :status ORDER BY createdAt ASC")
    suspend fun byStatus(status: String = CaptureJournalEntity.STATUS_PENDING): List<CaptureJournalEntity>

    @Query("""
        UPDATE capture_journal
           SET status = :status, sentAt = :sentAt, attempts = attempts + 1,
               lastError = :error
         WHERE id = :id
    """)
    suspend fun markResult(id: Long, status: String, sentAt: Long?, error: String?)

    @Query("SELECT COUNT(*) FROM capture_journal WHERE status = :status")
    suspend fun countByStatus(status: String = CaptureJournalEntity.STATUS_PENDING): Int

    @Query("SELECT COUNT(*) FROM capture_journal WHERE status = :status")
    fun observeCountByStatus(status: String = CaptureJournalEntity.STATUS_PENDING): Flow<Int>
}
