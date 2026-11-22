package org.der.android.core.data.journal

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

@Dao
interface TeiCacheDao {

    @Upsert
    suspend fun upsertAll(rows: List<TeiCacheEntity>)

    @Query("""
        SELECT * FROM tei_cache
         WHERE programUid = :programUid AND orgUnit = :orgUnit
         ORDER BY cachedAt DESC
    """)
    suspend fun forProgramAndOu(programUid: String, orgUnit: String): List<TeiCacheEntity>

    @Query("DELETE FROM tei_cache WHERE cachedAt < :olderThan")
    suspend fun deleteOlderThan(olderThan: Long): Int
}
