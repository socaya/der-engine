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
    /** Non-empty when the dataset ships explicit sections; empty
     *  means the client should render a flat list. */
    val sections: List<DataSetSection> = emptyList(),
    /** Default COCs the dataset's categoryCombo exposes. The form
     *  renders each (dataElement, coc) cell unless greyed. */
    val defaultCategoryOptionCombos: List<CategoryOptionCombo> = emptyList(),
) {
    val defaultCoc: CategoryOptionCombo?
        get() = defaultCategoryOptionCombos.firstOrNull { it.isDefault }
            ?: defaultCategoryOptionCombos.firstOrNull()
}

data class DataSetSection(
    val id: String,
    val displayName: String,
    val dataElementIds: List<String>,
    /** Set of (dataElementId, categoryOptionComboId) pairs that must
     *  render disabled per the DHIS2 section definition. */
    val greyed: Set<GreyedCell> = emptySet(),
)

data class GreyedCell(
    val dataElementId: String,
    val categoryOptionComboId: String,
)

data class DataElement(
    val id: String,
    val displayName: String,
    val valueType: String? = null,
    val optionSetId: String? = null,
    val categoryOptionCombos: List<CategoryOptionCombo> = emptyList(),
) {
    val effectiveCocs: List<CategoryOptionCombo>
        get() = categoryOptionCombos.ifEmpty { listOf(CategoryOptionCombo.DEFAULT) }
}

data class CategoryOptionCombo(
    val id: String,
    val displayName: String,
) {
    /** "default" COC in the DHIS2 sense — the single-cell variant. */
    val isDefault: Boolean
        get() = displayName.equals("default", ignoreCase = true)

    companion object {
        val DEFAULT = CategoryOptionCombo(id = "", displayName = "default")
    }
}

data class OptionSet(
    val id: String,
    val displayName: String,
    val options: List<OptionSetOption>,
)

data class OptionSetOption(
    val code: String,
    val displayName: String,
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
