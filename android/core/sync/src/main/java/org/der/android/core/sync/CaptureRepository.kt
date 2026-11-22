package org.der.android.core.sync

import kotlinx.serialization.json.Json
import org.der.android.core.data.journal.CaptureJournalDao
import org.der.android.core.data.journal.CaptureJournalEntity
import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.EnrollmentUpsertDto
import org.der.android.core.data.network.ProgramDto
import org.der.android.core.data.network.TrackedEntityDto
import org.der.android.core.data.network.TrackedEntityUpsertDto
import org.der.android.core.data.network.TrackerEventDto
import org.der.android.core.domain.DataElement
import org.der.android.core.domain.EnrolResult
import org.der.android.core.domain.Program
import org.der.android.core.domain.ProgramStage
import org.der.android.core.domain.ProgramSummary
import org.der.android.core.domain.ProgramType
import org.der.android.core.domain.TrackedEntity
import org.der.android.core.domain.TrackedEntityAttribute
import java.io.IOException
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DER Capture — tracker + event programs. Offline-first via the
 * shared capture journal; the drain worker POSTs events to
 * `edge-api/v1/tracker/events`. Rule engine, option sets, section
 * forms etc. land in a later phase.
 */
@Singleton
class CaptureRepository @Inject constructor(
    private val api: DerApi,
    private val dao: CaptureJournalDao,
    private val drain: AggregateDrainScheduler,
    private val json: Json,
) {

    suspend fun listPrograms(orgUnit: String? = null): List<ProgramSummary> {
        val response = api.listPrograms()
        val body = response.body() ?: return emptyList()
        val all = body.programs.map { p ->
            ProgramSummary(
                id = p.id,
                displayName = p.displayName ?: p.name ?: p.id,
                type = ProgramType.parse(p.programType),
                trackedEntityTypeId = p.trackedEntityType?.id,
                orgUnitIds = p.organisationUnits.map { it.id },
            )
        }
        if (orgUnit.isNullOrBlank()) return all
        return all.filter { it.orgUnitIds.isEmpty() || orgUnit in it.orgUnitIds }
    }

    suspend fun getProgram(id: String): Program? {
        val response = api.getProgram(id)
        val body = response.body() ?: return null
        return body.toDomain()
    }

    /**
     * Enrol a brand-new TEI into a tracker program. Two sequential
     * writes: first the tracked-entity row (attributes), then the
     * enrolment row (TEI × program × OU × date). We POST both
     * directly rather than queueing because the server returns
     * attribute-collision 409s that are more useful inline than on a
     * background drain.
     */
    suspend fun enrolTrackedEntity(
        program: Program,
        orgUnit: String,
        attributes: Map<String, String>,
        enrollmentDate: LocalDate = LocalDate.now(),
    ): EnrolResult {
        val trackedEntityType = program.trackedEntityTypeId
            ?: return EnrolResult.ServerError(
                code = "TRACKER_PROGRAM_MISSING_TET",
                message = "This program has no trackedEntityType configured.",
            )
        val teiUid = generateDhis2Uid()
        return try {
            val teiResp = api.upsertTrackedEntity(
                TrackedEntityUpsertDto(
                    teiUid = teiUid,
                    trackedEntityType = trackedEntityType,
                    orgUnit = orgUnit,
                    attributes = attributes.filterValues { it.isNotBlank() },
                ),
            )
            val teiBody = teiResp.body()
            if (!teiResp.isSuccessful) {
                return when (teiResp.code()) {
                    409 -> EnrolResult.AttributeCollision(
                        attributeUid = teiBody?.attributeUid.orEmpty(),
                        value = teiBody?.value.orEmpty(),
                        existingTeiUid = teiBody?.existingTeiUid.orEmpty(),
                    )
                    else -> EnrolResult.ServerError(teiBody?.code, teiBody?.message)
                }
            }

            val enrollmentUid = generateDhis2Uid()
            val enrolResp = api.upsertEnrollment(
                EnrollmentUpsertDto(
                    enrollmentUid = enrollmentUid,
                    teiUid = teiBody?.teiUid ?: teiUid,
                    programUid = program.id,
                    orgUnitUid = orgUnit,
                    enrollmentDate = enrollmentDate.toString(),
                ),
            )
            val enrolBody = enrolResp.body()
            if (!enrolResp.isSuccessful) {
                return when (enrolResp.code()) {
                    409 -> EnrolResult.ActiveClash(
                        conflictingEnrollmentUid = enrolBody?.conflictingEnrollmentUid.orEmpty(),
                    )
                    else -> EnrolResult.ServerError(enrolBody?.code, enrolBody?.message)
                }
            }
            EnrolResult.Success(
                teiUid = teiBody?.teiUid ?: teiUid,
                enrollmentUid = enrolBody?.enrollmentUid ?: enrollmentUid,
            )
        } catch (io: IOException) {
            EnrolResult.NetworkError(io.message)
        } catch (t: Throwable) {
            EnrolResult.ServerError(code = null, message = t.message)
        }
    }

    suspend fun searchTrackedEntities(
        program: String,
        orgUnit: String,
        pageSize: Int = 50,
    ): List<TrackedEntity> {
        val response = api.searchTrackedEntities(program, orgUnit, pageSize)
        val body = response.body() ?: return emptyList()
        return body.trackedEntities.map { it.toDomain() }
    }

    suspend fun getTrackedEntity(teiUid: String): TrackedEntity? {
        val response = api.getTrackedEntity(teiUid)
        val body = response.body() ?: return null
        return TrackedEntity(
            id = body.teiUid ?: body.trackedEntity ?: teiUid,
            orgUnit = body.orgUnit,
            attributes = body.attributes,
        )
    }

    suspend fun listEvents(
        program: String,
        orgUnit: String,
        pageSize: Int = 100,
    ): List<org.der.android.core.domain.EventRow> {
        val response = api.listEvents(program, orgUnit, pageSize)
        val body = response.body() ?: return emptyList()
        return body.rows.mapNotNull { dto ->
            org.der.android.core.domain.EventRow(
                event = dto.event ?: return@mapNotNull null,
                program = dto.program,
                programStage = dto.programStage,
                orgUnit = dto.orgUnit,
                occurredAt = dto.occurredAt,
                status = dto.status,
                enrollment = dto.enrollment,
            )
        }
    }

    /**
     * Queue a tracker-event submission. The event UID is generated
     * client-side so the local Drafts screen can reference the row
     * before the drain POSTs it. Matches the DHIS2 11-char UID shape.
     */
    suspend fun enqueueEvent(
        programUid: String,
        programStageUid: String,
        orgUnitUid: String,
        occurredDate: String,
        values: Map<String, String>,
        enrollmentUid: String? = null,
    ): Long {
        val event = TrackerEventDto(
            eventUid = generateDhis2Uid(),
            enrollmentUid = enrollmentUid,
            programUid = programUid,
            programStageUid = programStageUid,
            orgUnitUid = orgUnitUid,
            occurredDate = occurredDate,
            dataValues = values.filterValues { it.isNotBlank() },
        )
        val body = json.encodeToString(TrackerEventDto.serializer(), event)
        val id = dao.insert(
            CaptureJournalEntity(
                resource = RESOURCE_TRACKER_EVENT,
                dataSet = programUid,
                orgUnit = orgUnitUid,
                period = occurredDate,
                body = body,
            ),
        )
        drain.scheduleDrain()
        return id
    }

    private fun ProgramDto.toDomain(): Program = Program(
        id = id,
        displayName = displayName ?: name ?: id,
        type = ProgramType.parse(programType),
        trackedEntityTypeId = trackedEntityType?.id,
        stages = programStages.map { s ->
            ProgramStage(
                id = s.id,
                displayName = s.displayName ?: s.name ?: s.id,
                dataElements = s.programStageDataElements.map { psde ->
                    DataElement(
                        id = psde.dataElement.id,
                        displayName = psde.dataElement.formName
                            ?: psde.dataElement.name
                            ?: psde.dataElement.id,
                        valueType = psde.dataElement.valueType,
                    )
                },
            )
        },
        attributes = programTrackedEntityAttributes.map { ptea ->
            TrackedEntityAttribute(
                id = ptea.trackedEntityAttribute.id,
                displayName = ptea.trackedEntityAttribute.formName
                    ?: ptea.trackedEntityAttribute.name
                    ?: ptea.trackedEntityAttribute.id,
                valueType = ptea.trackedEntityAttribute.valueType,
            )
        },
    )

    private fun TrackedEntityDto.toDomain(): TrackedEntity = TrackedEntity(
        id = trackedEntity ?: "",
        orgUnit = orgUnit,
        attributes = attributes
            .filter { it.value != null }
            .associate { it.attribute to (it.value ?: "") },
    )

    companion object {
        const val RESOURCE_TRACKER_EVENT = "edge-api/v1/tracker/events"
    }
}

/**
 * DHIS2 11-char UID — one leading letter + 10 alphanumerics. Kept
 * package-private so other repositories can reuse the generator if
 * they start producing UIDs client-side.
 */
internal fun generateDhis2Uid(): String {
    val alpha = ('a'..'z') + ('A'..'Z')
    val alnum = alpha + ('0'..'9')
    return buildString(11) {
        append(alpha.random())
        repeat(10) { append(alnum.random()) }
    }
}
