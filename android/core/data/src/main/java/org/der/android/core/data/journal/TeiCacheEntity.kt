package org.der.android.core.data.journal

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Local cache of TEI search rows. One row per (programUid, teiUid)
 * tuple; each row stores the attribute JSON the search endpoint
 * returned so TrackerSearch can fall back to cache when the edge
 * is unreachable.
 */
@Entity(
    tableName = "tei_cache",
    indices = [Index(value = ["programUid", "orgUnit"])],
)
data class TeiCacheEntity(
    @PrimaryKey val id: String,          // "<programUid>:<teiUid>"
    val programUid: String,
    val teiUid: String,
    val orgUnit: String?,
    val attributesJson: String,          // serialised Map<String, String>
    val cachedAt: Long = System.currentTimeMillis(),
)
