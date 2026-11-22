package org.der.android.core.sync

import org.der.android.core.data.journal.FormDraftDao
import org.der.android.core.data.journal.FormDraftEntity
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Pluggable form-draft storage. Each screen computes its own key
 * (eg. `"event:{programId}:{eventUid ?: "new"}"`) and persists a
 * serialised snapshot via [save]. Drafts are deleted on successful
 * save so they don't shadow the authoritative server row the next
 * time the same form opens.
 */
@Singleton
class FormDraftRepository @Inject constructor(private val dao: FormDraftDao) {

    suspend fun save(key: String, body: String) {
        if (key.isBlank()) return
        dao.upsert(FormDraftEntity(key = key, body = body))
    }

    suspend fun load(key: String): String? =
        dao.findByKey(key)?.body

    suspend fun clear(key: String) {
        dao.deleteByKey(key)
    }

    suspend fun clearAll(): Int {
        val before = dao.count()
        dao.deleteAll()
        return before
    }
}
