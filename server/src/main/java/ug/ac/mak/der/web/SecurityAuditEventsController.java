package ug.ac.mak.der.web;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.SecurityAuditRepository.FilterSpec;
import ug.ac.mak.der.security.SecurityAuditRepository.Row;

/**
 * C2 / EA-29: audit event timeline for the admin UI.
 *
 * <p>GET /events supports:
 * <ul>
 *   <li>{@code from} / {@code to} — ISO-8601 instants bounding {@code observed_at}</li>
 *   <li>{@code eventType} — repeatable, OR'd</li>
 *   <li>{@code actorUserId} / {@code subjectUserId} — uids</li>
 *   <li>{@code cursor} — opaque base64 ({@code observedAt|auditId}) from the previous page's {@code nextCursor}</li>
 *   <li>{@code pageSize} — 1..500, default 100</li>
 * </ul>
 * Response: {@code { events: [...], nextCursor: string|null, pageSize }}.</p>
 *
 * <p>GET /events.csv applies the same filters but streams a flat CSV
 * (no cursor; size-capped at 10,000 rows per export).</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/security/audit/events",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class SecurityAuditEventsController {

    /** Hard cap for CSV exports — protects the admin UI from accidentally
     *  downloading the whole audit log on a busy edge. */
    static final int EXPORT_CAP = 10_000;

    private final SecurityAuditRepository repo;

    public SecurityAuditEventsController(final SecurityAuditRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> list(
            final Authentication authentication,
            @RequestParam(value = "from", required = false) final String fromIso,
            @RequestParam(value = "to", required = false) final String toIso,
            @RequestParam(value = "eventType", required = false) final List<String> eventTypes,
            @RequestParam(value = "actorUserId", required = false) final UUID actorUserId,
            @RequestParam(value = "subjectUserId", required = false) final UUID subjectUserId,
            @RequestParam(value = "cursor", required = false) final String cursor,
            @RequestParam(value = "pageSize", defaultValue = "100") final int pageSize) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Instant from;
        final Instant to;
        final Instant cursorAt;
        final Long cursorId;
        try {
            from = parseInstant(fromIso);
            to = parseInstant(toIso);
            final Cursor parsed = parseCursor(cursor);
            cursorAt = parsed == null ? null : parsed.observedAt();
            cursorId = parsed == null ? null : parsed.auditId();
        } catch (DateTimeParseException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "AUDIT_FILTER_INVALID",
                    "message", ex.getMessage() == null ? "bad filter" : ex.getMessage()));
        }
        final FilterSpec spec = new FilterSpec(from, to, eventTypes, actorUserId,
                subjectUserId, cursorAt, cursorId);
        final int capped = Math.min(Math.max(1, pageSize), 500);
        final List<Row> rows = repo.findPage(spec, capped);
        /* nextCursor only when we filled the page — otherwise the
         * client knows it exhausted the result set. */
        final String nextCursor = rows.size() >= capped && !rows.isEmpty()
                ? encodeCursor(rows.get(rows.size() - 1).observedAt(),
                                rows.get(rows.size() - 1).auditId())
                : null;
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("count", rows.size());
        body.put("pageSize", capped);
        body.put("events", rows.stream().map(SecurityAuditEventsController::toJson).toList());
        body.put("nextCursor", nextCursor);
        return ResponseEntity.ok(body);
    }

    @GetMapping(path = "/export.csv", produces = "text/csv")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> exportCsv(
            final Authentication authentication,
            @RequestParam(value = "from", required = false) final String fromIso,
            @RequestParam(value = "to", required = false) final String toIso,
            @RequestParam(value = "eventType", required = false) final List<String> eventTypes,
            @RequestParam(value = "actorUserId", required = false) final UUID actorUserId,
            @RequestParam(value = "subjectUserId", required = false) final UUID subjectUserId) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Instant from;
        final Instant to;
        try {
            from = parseInstant(fromIso);
            to = parseInstant(toIso);
        } catch (DateTimeParseException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(("{\"code\":\"AUDIT_FILTER_INVALID\",\"message\":\""
                            + (ex.getMessage() == null ? "bad filter"
                                : ex.getMessage().replace("\"", "'")) + "\"}")
                            .getBytes(StandardCharsets.UTF_8));
        }
        final FilterSpec spec = new FilterSpec(from, to, eventTypes, actorUserId,
                subjectUserId, null, null);
        final List<Row> rows = repo.findForExport(spec, EXPORT_CAP);
        final StringBuilder csv = new StringBuilder();
        csv.append("audit_id,observed_at,event_type,outcome,actor_user_id,"
                + "subject_user_id,client_ip,user_agent,detail\n");
        for (final Row r : rows) {
            csv.append(r.auditId()).append(',');
            csv.append(r.observedAt()).append(',');
            csv.append(csvField(r.eventType())).append(',');
            csv.append(csvField(r.outcome())).append(',');
            csv.append(r.actorUserId() == null ? "" : r.actorUserId()).append(',');
            csv.append(r.subjectUserId() == null ? "" : r.subjectUserId()).append(',');
            csv.append(csvField(r.clientIp())).append(',');
            csv.append(csvField(r.userAgent())).append(',');
            csv.append(csvField(r.detailJson()));
            csv.append('\n');
        }
        final String filename = "der-audit-events-"
                + Instant.now().toString().replace(':', '-').replace('.', '-')
                + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .header("X-Audit-Export-Count", String.valueOf(rows.size()))
                .header("X-Audit-Export-Cap", String.valueOf(EXPORT_CAP))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static Instant parseInstant(final String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return Instant.parse(s);
    }

    private static String encodeCursor(final Instant observedAt, final long auditId) {
        final String raw = observedAt.toString() + "|" + auditId;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private static Cursor parseCursor(final String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        final String raw;
        try {
            raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("cursor is not valid base64");
        }
        final int sep = raw.indexOf('|');
        if (sep <= 0 || sep == raw.length() - 1) {
            throw new IllegalArgumentException("cursor shape must be <observedAt>|<auditId>");
        }
        final Instant observedAt = Instant.parse(raw.substring(0, sep));
        final long auditId = Long.parseLong(raw.substring(sep + 1));
        return new Cursor(observedAt, auditId);
    }

    private record Cursor(Instant observedAt, long auditId) { }

    private static String csvField(final String value) {
        if (value == null) {
            return "";
        }
        if (value.indexOf(',') < 0 && value.indexOf('"') < 0
                && value.indexOf('\n') < 0 && value.indexOf('\r') < 0) {
            return value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private static Map<String, Object> toJson(final Row r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("auditId", r.auditId());
        m.put("eventType", r.eventType());
        m.put("actorUserId", r.actorUserId() == null ? null : r.actorUserId().toString());
        m.put("subjectUserId", r.subjectUserId() == null ? null : r.subjectUserId().toString());
        m.put("clientIp", r.clientIp());
        m.put("userAgent", r.userAgent());
        m.put("outcome", r.outcome());
        m.put("detail", r.detailJson());
        m.put("observedAt", r.observedAt().toString());
        return m;
    }
}
