package org.der.android.core.domain

data class DataSetSummary(
    val id: String,
    val displayName: String,
    val periodType: String? = null,
    val formType: String? = null,
)

data class DataSet(
    val id: String,
    val displayName: String,
    val periodType: String? = null,
    val dataElements: List<DataElement>,
)

data class DataElement(
    val id: String,
    val displayName: String,
    val valueType: String? = null,
)

data class DataValue(
    val dataElementId: String,
    val value: String,
)

/**
 * A pending capture waiting to be drained. Keeps the pre-serialised
 * body + a human-friendly summary so the Drafts/Queue screen can
 * show the operator what's about to flush without round-tripping
 * through JSON deserialisation.
 */
data class CapturePending(
    val id: Long,
    val resource: String,
    val summary: String,
    val attempts: Int,
    val lastError: String?,
    val createdAt: Long,
)
