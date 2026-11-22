package org.der.android.core.domain

enum class ProgramType {
    WITH_REGISTRATION,
    WITHOUT_REGISTRATION;

    companion object {
        fun parse(raw: String?): ProgramType = when (raw?.uppercase()) {
            "WITH_REGISTRATION" -> WITH_REGISTRATION
            else -> WITHOUT_REGISTRATION
        }
    }
}

data class ProgramSummary(
    val id: String,
    val displayName: String,
    val type: ProgramType,
    val trackedEntityTypeId: String? = null,
    val orgUnitIds: List<String> = emptyList(),
)

data class ProgramStage(
    val id: String,
    val displayName: String,
    val dataElements: List<DataElement>,
)

data class TrackedEntityAttribute(
    val id: String,
    val displayName: String,
    val valueType: String? = null,
)

data class Program(
    val id: String,
    val displayName: String,
    val type: ProgramType,
    val trackedEntityTypeId: String?,
    val stages: List<ProgramStage>,
    val attributes: List<TrackedEntityAttribute>,
)

data class TrackedEntity(
    val id: String,
    val orgUnit: String?,
    val attributes: Map<String, String>,
) {
    val label: String
        get() = attributes.values.firstOrNull { it.isNotBlank() } ?: id
}

data class EventRow(
    val event: String,
    val program: String?,
    val programStage: String?,
    val orgUnit: String?,
    val occurredAt: String?,
    val status: String?,
    val enrollment: String?,
)

/** Outcome of a tracker-enrol round-trip (TEI upsert + enrolment). */
sealed interface EnrolResult {
    data class Success(val teiUid: String, val enrollmentUid: String) : EnrolResult
    data class AttributeCollision(
        val attributeUid: String,
        val value: String,
        val existingTeiUid: String,
    ) : EnrolResult
    data class ActiveClash(val conflictingEnrollmentUid: String) : EnrolResult
    data class ServerError(val code: String?, val message: String?) : EnrolResult
    data class NetworkError(val message: String?) : EnrolResult
}
