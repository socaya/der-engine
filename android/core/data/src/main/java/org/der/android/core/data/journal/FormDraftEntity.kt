package org.der.android.core.data.journal

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One auto-saved form draft per form instance. Keyed by a caller-
 * computed id so each screen owns its own key-space without a
 * schema migration (eg. "event:{programId}:{eventUid ?: "new"}",
 * "aggregate:{dataSetId}:{orgUnit}:{period}"). The [body] is the
 * screen's serialised in-progress state.
 *
 * Drafts are deleted on successful save so they don't shadow the
 * server-side authoritative row the next time the same form opens.
 */
@Entity(tableName = "form_draft")
data class FormDraftEntity(
    @PrimaryKey val key: String,
    val body: String,
    val updatedAt: Long = System.currentTimeMillis(),
)
