package ug.ac.mak.der.workflows.aggregate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient.Dhis2ResponseException;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient.Dhis2UnreachableException;
import ug.ac.mak.der.workflow.SystemWorkflowService;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService.DataValueInput;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService.ImportSummary;
import java.time.LocalDate;

import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventService;
import ug.ac.mak.der.workflows.events.EventService.EventInput;
import ug.ac.mak.der.workflows.events.EventService.EventImportResult;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;

/**
 * §2.3.86 R-C/1.4 — Pull existing aggregate values from Central
 * DHIS2 into DER's local store.
 *
 * <p>A facility going fully local-first wants its operators to see
 * (and continue capturing against) the actual running totals already
 * recorded upstream. This service:</p>
 *
 * <ol>
 *   <li>ensures / creates a {@code CENTRAL_DOWNLOAD} system
 *       workflow run so every pulled row carries lineage,</li>
 *   <li>calls Central's {@code /api/dataValueSets.json?dataSet&orgUnit&period}
 *       using {@link Dhis2ReferenceClient},</li>
 *   <li>feeds each dataValue through {@link AggregateDataValueService}
 *       (same validation + journal + sync-outbox machinery as a local
 *       write), tagged with the system run id.</li>
 * </ol>
 *
 * <p>Pulled rows re-enter the sync pipeline as PENDING; the sync
 * worker treats them as any other local write. Round-tripping them
 * back to Central is harmless (idempotent on the compound key) and
 * confirms the local mirror matches upstream.</p>
 */
@Service
public class CentralDownloadService {

    private static final Logger LOG = LoggerFactory.getLogger(CentralDownloadService.class);

    private final Dhis2ReferenceClient dhis2;
    private final AggregateDataValueService aggregate;
    private final EventService events;
    private final TrackedEntityRepository teis;
    private final EnrollmentRepository enrolments;
    private final TrackerEventRepository trackerEvents;
    private final SystemWorkflowService systemWorkflows;

    public CentralDownloadService(final Dhis2ReferenceClient dhis2,
                                     final AggregateDataValueService aggregate,
                                     final EventService events,
                                     final TrackedEntityRepository teis,
                                     final EnrollmentRepository enrolments,
                                     final TrackerEventRepository trackerEvents,
                                     final SystemWorkflowService systemWorkflows) {
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
        this.aggregate = Objects.requireNonNull(aggregate, "aggregate");
        this.events = Objects.requireNonNull(events, "events");
        this.teis = Objects.requireNonNull(teis, "teis");
        this.enrolments = Objects.requireNonNull(enrolments, "enrolments");
        this.trackerEvents = Objects.requireNonNull(trackerEvents, "trackerEvents");
        this.systemWorkflows = Objects.requireNonNull(systemWorkflows, "systemWorkflows");
    }

    public PullResult pullAggregate(final String dataSetUid,
                                     final String orgUnitUid,
                                     final String periodIso,
                                     final UUID actor,
                                     final String ip,
                                     final String userAgent)
            throws Dhis2UnreachableException, Dhis2ResponseException {
        Objects.requireNonNull(dataSetUid, "dataSetUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(periodIso, "periodIso");
        Objects.requireNonNull(actor, "actor");

        final UUID runId = systemWorkflows.ensureCentralDownloadRun(
                dataSetUid, orgUnitUid, periodIso, actor);

        final String path = "/api/dataValueSets.json"
                + "?dataSet=" + enc(dataSetUid)
                + "&orgUnit=" + enc(orgUnitUid)
                + "&period=" + enc(periodIso);
        final JsonNode body = dhis2.fetchJson(path);
        final JsonNode values = body.get("dataValues");
        if (values == null || !values.isArray() || values.isEmpty()) {
            LOG.info("central download: scope {}/{}/{} returned 0 rows", dataSetUid, orgUnitUid, periodIso);
            return new PullResult(runId, 0, 0, List.of());
        }

        final List<DataValueInput> inputs = new ArrayList<>(values.size());
        for (final Iterator<JsonNode> it = values.elements(); it.hasNext(); ) {
            final JsonNode v = it.next();
            inputs.add(new DataValueInput(
                    textOrNull(v, "dataElement"),
                    textOrNull(v, "orgUnit"),
                    textOrNull(v, "period"),
                    textOrNull(v, "categoryOptionCombo"),
                    textOrNull(v, "attributeOptionCombo"),
                    textOrNull(v, "value"),
                    textOrNull(v, "comment"),
                    dataSetUid,
                    runId
            ));
        }
        final ImportSummary summary = aggregate.submit(inputs, actor, ip, userAgent);
        LOG.info("central download: scope {}/{}/{} runId={} imported={} ignored={}",
                dataSetUid, orgUnitUid, periodIso, runId,
                summary.imported(), summary.ignored());
        return new PullResult(runId, summary.imported(), summary.ignored(),
                summary.conflicts().stream()
                        .map(c -> new PullError(c.key(), c.reason()))
                        .toList());
    }

    /**
     * §2.3.91 R-C/2.1 — pull existing events from Central DHIS2 into
     * DER's local {@code event} table.
     *
     * <p>Uses the DHIS2 2.44 {@code /api/events} endpoint. Each returned
     * event is converted to a DER {@link EventInput} carrying the
     * {@code CENTRAL_DOWNLOAD} system workflow run id, then handed to
     * {@link EventService#submit}. The event's data values are pulled
     * from the event's {@code dataValues} array and flattened to a
     * {@code dataElement → value} map before submission.</p>
     *
     * @param programUid       required DHIS2 program UID
     * @param programStageUid  optional stage filter (null = all stages)
     * @param orgUnitUid       required orgUnit UID
     * @param startDate        optional ISO-8601 date (null = no start bound)
     * @param endDate          optional ISO-8601 date (null = no end bound)
     * @param actor            acting user
     */
    public PullResult pullEvents(final String programUid,
                                   final String programStageUid,
                                   final String orgUnitUid,
                                   final String startDate,
                                   final String endDate,
                                   final UUID actor,
                                   final String ip,
                                   final String userAgent)
            throws Dhis2UnreachableException, Dhis2ResponseException {
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(actor, "actor");

        // Reuse the central-download system workflow run. For events
        // the business key is (program, orgUnit, period) where period
        // = "<start>-<end>" (or "all" if unbounded) so repeated pulls
        // for the same window collapse to one run.
        final String bk = (startDate == null ? "all" : startDate)
                + ":" + (endDate == null ? "all" : endDate);
        final UUID runId = systemWorkflows.ensureCentralDownloadRun(
                programUid, orgUnitUid, bk, actor);

        final StringBuilder path = new StringBuilder("/api/events.json")
                .append("?program=").append(enc(programUid))
                .append("&orgUnit=").append(enc(orgUnitUid))
                .append("&paging=false");
        if (programStageUid != null && !programStageUid.isBlank()) {
            path.append("&programStage=").append(enc(programStageUid));
        }
        if (startDate != null && !startDate.isBlank()) {
            path.append("&startDate=").append(enc(startDate));
        }
        if (endDate != null && !endDate.isBlank()) {
            path.append("&endDate=").append(enc(endDate));
        }

        final JsonNode body = dhis2.fetchJson(path.toString());
        final JsonNode arr = body.get("events");
        if (arr == null || !arr.isArray() || arr.isEmpty()) {
            LOG.info("central download events: scope {}/{} returned 0 rows",
                    programUid, orgUnitUid);
            return new PullResult(runId, 0, 0, List.of());
        }

        final List<EventInput> inputs = new ArrayList<>(arr.size());
        for (final Iterator<JsonNode> it = arr.elements(); it.hasNext(); ) {
            final JsonNode v = it.next();
            final UUID eventId;
            try {
                final String idStr = textOrNull(v, "event");
                eventId = idStr == null ? UUID.randomUUID() : UUID.fromString(idStr);
            } catch (IllegalArgumentException ex) {
                // Non-UUID central event id → generate a local one.
                continue;
            }
            final UUID enrollmentId;
            try {
                final String enrStr = textOrNull(v, "enrollment");
                enrollmentId = enrStr == null ? null : UUID.fromString(enrStr);
            } catch (IllegalArgumentException ex) {
                continue;
            }
            final String occurredStr = textOrNull(v, "occurredAt");
            final Instant occurred;
            try {
                occurred = occurredStr == null ? Instant.now() : Instant.parse(occurredStr);
            } catch (Exception ex) {
                continue;
            }
            final Event.Status status;
            try {
                final String s = textOrNull(v, "status");
                status = s == null ? Event.Status.ACTIVE : Event.Status.valueOf(s);
            } catch (IllegalArgumentException ex) {
                continue;
            }
            final Map<String, String> dvs = new LinkedHashMap<>();
            final JsonNode dvArr = v.get("dataValues");
            if (dvArr != null && dvArr.isArray()) {
                for (final Iterator<JsonNode> dvi = dvArr.elements(); dvi.hasNext(); ) {
                    final JsonNode dv = dvi.next();
                    final String de = textOrNull(dv, "dataElement");
                    if (de == null) {
                        continue;
                    }
                    final String val = textOrNull(dv, "value");
                    dvs.put(de, val == null ? "" : val);
                }
            }
            inputs.add(new EventInput(
                    eventId,
                    enrollmentId,
                    textOrNull(v, "program") == null ? programUid : textOrNull(v, "program"),
                    textOrNull(v, "programStage"),
                    textOrNull(v, "orgUnit") == null ? orgUnitUid : textOrNull(v, "orgUnit"),
                    occurred,
                    status,
                    textOrNull(v, "attributeOptionCombo"),
                    dvs,
                    null,
                    runId));
        }
        final EventImportResult result = events.submit(inputs, actor, ip, userAgent);
        LOG.info("central download events: scope {}/{} runId={} imported={} ignored={}",
                programUid, orgUnitUid, runId,
                result.imported().size(), result.conflicts().size());
        return new PullResult(runId, result.imported().size(),
                result.conflicts().size(),
                result.conflicts().stream()
                        .map(c -> new PullError(c.reference(), c.reason()))
                        .toList());
    }

    /**
     * §2.3.93 R-C/3.1 — pull tracked entity instances + their
     * enrolments + stage events from Central DHIS2 into the local
     * tracker tables.
     *
     * <p>Uses the DHIS2 2.44 {@code /api/trackedEntityInstances}
     * endpoint with {@code includeAllAttributes=true &
     * ou=<orgUnit> & program=<program> & fields=…} so we get the
     * TEI + its enrolments + stage events in one request. Each
     * returned object is cascaded into the three local tables with
     * the CENTRAL_DOWNLOAD system workflow run id.</p>
     *
     * <p>Repository upserts handle conflicts on the DHIS2 UID so
     * re-pulling the same scope is idempotent.</p>
     */
    public TrackerPullResult pullTracker(final String programUid,
                                           final String orgUnitUid,
                                           final UUID actor,
                                           final String ip,
                                           final String userAgent)
            throws Dhis2UnreachableException, Dhis2ResponseException {
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(actor, "actor");

        final UUID runId = systemWorkflows.ensureCentralDownloadRun(
                programUid, orgUnitUid, "tracker", actor);

        final String path = "/api/trackedEntityInstances.json"
                + "?ou=" + enc(orgUnitUid)
                + "&program=" + enc(programUid)
                + "&includeAllAttributes=true"
                + "&fields="
                + enc("trackedEntityInstance,trackedEntityType,orgUnit,"
                    + "attributes[attribute,value],"
                    + "enrollments[enrollment,program,orgUnit,status,"
                    + "enrollmentDate,incidentDate,"
                    + "events[event,programStage,orgUnit,status,"
                    + "eventDate,dataValues[dataElement,value]]]")
                + "&paging=false";
        final JsonNode body = dhis2.fetchJson(path);
        final JsonNode arr = body.get("trackedEntityInstances");
        if (arr == null || !arr.isArray() || arr.isEmpty()) {
            LOG.info("central download tracker: scope {}/{} returned 0 TEIs",
                    programUid, orgUnitUid);
            return new TrackerPullResult(runId, 0, 0, 0, 0, List.of());
        }

        int teiCount = 0;
        int enrolCount = 0;
        int eventCount = 0;
        int errorCount = 0;
        final List<PullError> errs = new ArrayList<>();
        final Instant now = Instant.now();

        for (final Iterator<JsonNode> teiIt = arr.elements(); teiIt.hasNext(); ) {
            final JsonNode t = teiIt.next();
            final String teiUid = textOrNull(t, "trackedEntityInstance");
            final String teType = textOrNull(t, "trackedEntityType");
            final String teiOu = textOrNull(t, "orgUnit");
            if (teiUid == null || teType == null || teiOu == null) {
                errorCount++;
                errs.add(new PullError(teiUid == null ? "<unknown>" : teiUid,
                        "missing tei/type/orgUnit"));
                continue;
            }
            final Map<String, String> attrs = new LinkedHashMap<>();
            final JsonNode attrArr = t.get("attributes");
            if (attrArr != null && attrArr.isArray()) {
                for (final Iterator<JsonNode> ai = attrArr.elements(); ai.hasNext(); ) {
                    final JsonNode a = ai.next();
                    final String ak = textOrNull(a, "attribute");
                    final String av = textOrNull(a, "value");
                    if (ak != null) {
                        attrs.put(ak, av == null ? "" : av);
                    }
                }
            }
            try {
                teis.upsert(new TrackedEntity(teiUid, teType, teiOu,
                        attrs, actor, now, now, 1, runId));
                teiCount++;
            } catch (Exception ex) {
                errorCount++;
                errs.add(new PullError(teiUid, "tei upsert failed: " + ex.getMessage()));
                continue;
            }

            final JsonNode enrArr = t.get("enrollments");
            if (enrArr == null || !enrArr.isArray()) {
                continue;
            }
            for (final Iterator<JsonNode> ei = enrArr.elements(); ei.hasNext(); ) {
                final JsonNode e = ei.next();
                final String enrUid = textOrNull(e, "enrollment");
                final String prog   = textOrNull(e, "program");
                final String enrOu  = textOrNull(e, "orgUnit");
                final String st     = textOrNull(e, "status");
                final String enrDt  = textOrNull(e, "enrollmentDate");
                final String incDt  = textOrNull(e, "incidentDate");
                if (enrUid == null || prog == null || enrOu == null
                        || st == null || enrDt == null) {
                    errorCount++;
                    errs.add(new PullError(enrUid == null ? teiUid : enrUid,
                            "enrolment missing uid/program/orgUnit/status/date"));
                    continue;
                }
                final Enrollment.Status enrStatus;
                try {
                    enrStatus = Enrollment.Status.valueOf(st);
                } catch (IllegalArgumentException ex) {
                    errorCount++;
                    errs.add(new PullError(enrUid, "unknown enrolment status: " + st));
                    continue;
                }
                final LocalDate enrLd;
                final LocalDate incLd;
                try {
                    enrLd = parseDate(enrDt);
                    incLd = incDt == null ? null : parseDate(incDt);
                } catch (Exception ex) {
                    errorCount++;
                    errs.add(new PullError(enrUid, "bad date: " + ex.getMessage()));
                    continue;
                }
                try {
                    enrolments.upsert(new Enrollment(enrUid, teiUid, prog, enrOu,
                            enrStatus, enrLd, incLd, null,
                            actor, now, now, 1, runId));
                    enrolCount++;
                } catch (Exception ex) {
                    errorCount++;
                    errs.add(new PullError(enrUid, "enrolment upsert failed: " + ex.getMessage()));
                    continue;
                }

                final JsonNode evArr = e.get("events");
                if (evArr == null || !evArr.isArray()) {
                    continue;
                }
                for (final Iterator<JsonNode> vi = evArr.elements(); vi.hasNext(); ) {
                    final JsonNode v = vi.next();
                    final String evUid = textOrNull(v, "event");
                    final String stage = textOrNull(v, "programStage");
                    final String evOu  = textOrNull(v, "orgUnit");
                    final String evSt  = textOrNull(v, "status");
                    final String evDt  = textOrNull(v, "eventDate");
                    if (evUid == null || stage == null || evOu == null
                            || evSt == null || evDt == null) {
                        errorCount++;
                        errs.add(new PullError(evUid == null ? enrUid : evUid,
                                "event missing uid/stage/orgUnit/status/date"));
                        continue;
                    }
                    final TrackerEvent.Status evStatus;
                    try {
                        evStatus = TrackerEvent.Status.valueOf(evSt);
                    } catch (IllegalArgumentException ex) {
                        errorCount++;
                        errs.add(new PullError(evUid, "unknown event status: " + evSt));
                        continue;
                    }
                    final LocalDate evLd;
                    try {
                        evLd = parseDate(evDt);
                    } catch (Exception ex) {
                        errorCount++;
                        errs.add(new PullError(evUid, "bad event date: " + ex.getMessage()));
                        continue;
                    }
                    final Map<String, Object> dvs = new LinkedHashMap<>();
                    final JsonNode dvArr = v.get("dataValues");
                    if (dvArr != null && dvArr.isArray()) {
                        for (final Iterator<JsonNode> dvi = dvArr.elements(); dvi.hasNext(); ) {
                            final JsonNode dv = dvi.next();
                            final String de = textOrNull(dv, "dataElement");
                            if (de == null) {
                                continue;
                            }
                            final String val = textOrNull(dv, "value");
                            dvs.put(de, val == null ? "" : val);
                        }
                    }
                    try {
                        trackerEvents.upsert(new TrackerEvent(evUid, enrUid,
                                prog, stage, evOu, evStatus, evLd, dvs,
                                null, actor, now, now, 1, runId));
                        eventCount++;
                    } catch (Exception ex) {
                        errorCount++;
                        errs.add(new PullError(evUid, "event upsert failed: " + ex.getMessage()));
                    }
                }
            }
        }
        LOG.info("central download tracker: runId={} teis={} enrolments={} "
                + "events={} errors={}",
                runId, teiCount, enrolCount, eventCount, errorCount);
        return new TrackerPullResult(runId, teiCount, enrolCount, eventCount,
                errorCount, errs);
    }

    private static LocalDate parseDate(final String s) {
        // DHIS2 payloads often include a time portion; the LocalDate
        // parser only accepts YYYY-MM-DD, so split on 'T' first.
        final int t = s.indexOf('T');
        return LocalDate.parse(t < 0 ? s : s.substring(0, t));
    }

    private static String enc(final String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String textOrNull(final JsonNode node, final String field) {
        final JsonNode f = node.get(field);
        return f == null || f.isNull() ? null : f.asText();
    }

    public record PullResult(UUID runId, int imported, int ignored, List<PullError> errors) { }
    public record PullError(String key, String reason) { }

    /** §2.3.93 R-C/3.1 — counts for the three-level tracker cascade. */
    public record TrackerPullResult(UUID runId, int teis, int enrolments,
                                       int events, int errors,
                                       List<PullError> errorDetails) { }
}
