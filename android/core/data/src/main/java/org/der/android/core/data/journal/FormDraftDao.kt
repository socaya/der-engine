package org.der.android.core.data.journal

import androidx.room.Dao
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert

@Dao
interface FormDraftDao {

    @Upsert(entity = FormDraftEntity::class)
    suspend fun upsert(draft: FormDraftEntity)

    @Query("SELECT * FROM form_draft WHERE `key` = :key")
    suspend fun findByKey(key: String): FormDraftEntity?

    @Query("DELETE FROM form_draft WHERE `key` = :key")
    suspend fun deleteByKey(key: String)

    @Query("DELETE FROM form_draft")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM form_draft")
    suspend fun count(): Int
}
