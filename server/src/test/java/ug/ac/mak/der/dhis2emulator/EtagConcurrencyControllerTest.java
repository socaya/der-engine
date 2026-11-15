package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;
import ug.ac.mak.der.workflows.events.EventService;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;

class EtagConcurrencyControllerTest {

    private static final Instant NOW = Instant.parse("2026-11-15T12:00:00Z");

    private EventRepository events;
    private EventService eventService;
    private TrackedEntityRepository teis;
    private OperationJournalRepository journal;
    private EtagConcurrencyController ctl;

    @BeforeEach
    void setUp() {
        events = mock(EventRepository.class);
        eventService = mock(EventService.class);
        teis = mock(TrackedEntityRepository.class);
        journal = mock(OperationJournalRepository.class);
        ctl = new EtagConcurrencyController(events, eventService, teis,
                journal, new ObjectMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    private static Event event(final UUID id, final int version) {
        return new Event(id, null, "PROG", "STAGE", "OU",
                Instant.parse("2026-11-01T00:00:00Z"),
                Event.Status.ACTIVE, "AOC",
                UUID.randomUUID(), version, Map.of("de-1", "42"));
    }

    private static TrackedEntity tei(final String uid, final int version) {
        return new TrackedEntity(uid, "TET", "OU",
                Map.of("attr-1", "name"), UUID.randomUUID(),
                Instant.parse("2026-11-01T00:00:00Z"),
                Instant.parse("2026-11-10T00:00:00Z"), version);
    }

    // ---- ETag matcher ------------------------------------------------

    @Test
    void etagMatchesQuotedVariants() {
        assertThat(EtagConcurrencyController.matches("\"3\"",
                EtagConcurrencyController.etag(3))).isTrue();
        assertThat(EtagConcurrencyController.matches("3",
                EtagConcurrencyController.etag(3))).isTrue();
        assertThat(EtagConcurrencyController.matches("W/\"3\"",
                EtagConcurrencyController.etag(3))).isTrue();
        assertThat(EtagConcurrencyController.matches("*",
                EtagConcurrencyController.etag(3))).isTrue();
        assertThat(EtagConcurrencyController.matches("\"2\"",
                EtagConcurrencyController.etag(3))).isFalse();
        assertThat(EtagConcurrencyController.matches("\"2\",\"3\"",
                EtagConcurrencyController.etag(3))).isTrue();
        assertThat(EtagConcurrencyController.matches(null,
                EtagConcurrencyController.etag(3))).isFalse();
    }

    // ---- events ------------------------------------------------------

    @Test
    void getEventReturnsEtagAndBody() {
        final UUID id = UUID.randomUUID();
        when(events.findById(id)).thenReturn(Optional.of(event(id, 7)));
        final ResponseEntity<Map<String, Object>> res =
                ctl.getEvent(id.toString());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getHeaders().getFirst(HttpHeaders.ETAG)).isEqualTo("\"7\"");
        assertThat(res.getBody()).containsEntry("program", "PROG");
        assertThat(res.getBody()).containsEntry("eventVersion", 7);
    }

    @Test
    void getEventReturns404OnMalformedId() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.getEvent("not-a-uuid");
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void deleteEventWithMatchingIfMatchDeletes() {
        final UUID id = UUID.randomUUID();
        final Event e = event(id, 4);
        when(events.findById(id)).thenReturn(Optional.of(e));
        when(eventService.deleteEvent(id)).thenReturn(true);
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteEventWithIfMatch(id.toString(), "\"4\"", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("deleted", true);
        verify(eventService).deleteEvent(id);
        verify(journal).insert(any());
    }

    @Test
    void deleteEventWithStaleIfMatchReturns412() {
        final UUID id = UUID.randomUUID();
        when(events.findById(id)).thenReturn(Optional.of(event(id, 4)));
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteEventWithIfMatch(id.toString(), "\"3\"", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(412);
        assertThat(res.getBody()).containsEntry("code", "STALE_ETAG");
        assertThat(res.getHeaders().getFirst(HttpHeaders.ETAG)).isEqualTo("\"4\"");
        verify(eventService, never()).deleteEvent(any());
    }

    @Test
    void deleteEventWithWildcardIfMatchDeletes() {
        final UUID id = UUID.randomUUID();
        when(events.findById(id)).thenReturn(Optional.of(event(id, 9)));
        when(eventService.deleteEvent(id)).thenReturn(true);
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteEventWithIfMatch(id.toString(), "*", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(eventService).deleteEvent(id);
    }

    @Test
    void deleteEventRequiresAuth() {
        final UUID id = UUID.randomUUID();
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteEventWithIfMatch(id.toString(), "*", null);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void deleteEventMissingReturns404() {
        final UUID id = UUID.randomUUID();
        when(events.findById(id)).thenReturn(Optional.empty());
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteEventWithIfMatch(id.toString(), "*", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    // ---- tracked entity instances ------------------------------------

    @Test
    void getTeiReturnsEtagAndBody() {
        when(teis.findById("tei-1")).thenReturn(Optional.of(tei("tei-1", 2)));
        final ResponseEntity<Map<String, Object>> res = ctl.getTei("tei-1");
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getHeaders().getFirst(HttpHeaders.ETAG)).isEqualTo("\"2\"");
        assertThat(res.getBody()).containsEntry("trackedEntityInstance", "tei-1");
        assertThat(res.getBody()).containsEntry("teiVersion", 2);
    }

    @Test
    void deleteTeiWithoutIfMatchStillWorks() {
        // Back-compat: callers that don't send If-Match keep the old
        // DHIS2 semantics — delete proceeds unconditionally.
        when(teis.findById("tei-1")).thenReturn(Optional.of(tei("tei-1", 2)));
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteTei("tei-1", null, principal());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(teis).delete(eq("tei-1"));
    }

    @Test
    void deleteTeiWithStaleIfMatchReturns412() {
        when(teis.findById("tei-1")).thenReturn(Optional.of(tei("tei-1", 5)));
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteTei("tei-1", "\"3\"", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(412);
        assertThat(res.getBody()).containsEntry("code", "STALE_ETAG");
        verify(teis, never()).delete(any());
    }

    @Test
    void deleteTeiWithMatchingIfMatchDeletes() {
        when(teis.findById("tei-1")).thenReturn(Optional.of(tei("tei-1", 5)));
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteTei("tei-1", "\"5\"", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(teis).delete(eq("tei-1"));
        verify(journal).insert(any());
    }

    @Test
    void deleteTeiMissingReturns404() {
        when(teis.findById("tei-1")).thenReturn(Optional.empty());
        final ResponseEntity<Map<String, Object>> res =
                ctl.deleteTei("tei-1", "*", principal());
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    // ---- TEI PUT -----------------------------------------------------

    @Test
    void putTeiRequiresAuth() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.putTei("tei-1", null, Map.of("orgUnit", "OU"), null);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void putTeiWithoutBodyIs400() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.putTei("tei-1", null, null, principal());
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertThat(res.getBody()).containsEntry("code", "BODY_REQUIRED");
    }

    @Test
    void putTeiOnMissingReturns404() {
        when(teis.findById("tei-1")).thenReturn(Optional.empty());
        final ResponseEntity<Map<String, Object>> res =
                ctl.putTei("tei-1", null, Map.of("orgUnit", "OU"), principal());
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void putTeiStaleIfMatchReturns412() {
        when(teis.findById("tei-1")).thenReturn(Optional.of(tei("tei-1", 5)));
        final ResponseEntity<Map<String, Object>> res =
                ctl.putTei("tei-1", "\"3\"", Map.of("orgUnit", "OU"), principal());
        assertThat(res.getStatusCode().value()).isEqualTo(412);
        assertThat(res.getBody()).containsEntry("code", "STALE_ETAG");
        verify(teis, never()).upsert(any());
    }

    @Test
    void putTeiImmutableTypeMismatchReturns409() {
        when(teis.findById("tei-1")).thenReturn(Optional.of(tei("tei-1", 5)));
        final ResponseEntity<Map<String, Object>> res = ctl.putTei("tei-1", "*",
                Map.of("trackedEntityType", "OTHER", "orgUnit", "OU"),
                principal());
        assertThat(res.getStatusCode().value()).isEqualTo(409);
        assertThat(res.getBody()).containsEntry("code", "IMMUTABLE_FIELD");
        verify(teis, never()).upsert(any());
    }

    @Test
    void putTeiReplacesAttributesViaArrayFormAndReturnsNewEtag() {
        when(teis.findById("tei-1"))
                .thenReturn(Optional.of(tei("tei-1", 3)))
                // after upsert → version bumped to 4
                .thenReturn(Optional.of(tei("tei-1", 4)));
        final ResponseEntity<Map<String, Object>> res = ctl.putTei("tei-1",
                "\"3\"",
                Map.of("orgUnit", "OU",
                        "attributes", List.of(
                                Map.of("attribute", "attr-1", "value", "new-name"),
                                Map.of("attribute", "attr-2", "value", "second"))),
                principal());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getHeaders().getFirst(org.springframework.http.HttpHeaders.ETAG))
                .isEqualTo("\"4\"");
        // Captured upsert carries merged attributes — the stored
        // attr-1 gets overwritten, a new attr-2 is appended.
        final org.mockito.ArgumentCaptor<TrackedEntity> cap =
                org.mockito.ArgumentCaptor.forClass(TrackedEntity.class);
        verify(teis).upsert(cap.capture());
        assertThat(cap.getValue().attributes())
                .containsEntry("attr-1", "new-name")
                .containsEntry("attr-2", "second");
        verify(journal).insert(any());
    }

    @Test
    void putTeiFlatAttributeMapAlsoAccepted() {
        when(teis.findById("tei-1"))
                .thenReturn(Optional.of(tei("tei-1", 3)))
                .thenReturn(Optional.of(tei("tei-1", 4)));
        ctl.putTei("tei-1", null,
                Map.of("orgUnit", "OU",
                        "attributes", Map.of("attr-1", "flat-form")),
                principal());
        final org.mockito.ArgumentCaptor<TrackedEntity> cap =
                org.mockito.ArgumentCaptor.forClass(TrackedEntity.class);
        verify(teis).upsert(cap.capture());
        assertThat(cap.getValue().attributes()).containsEntry("attr-1", "flat-form");
    }

    @Test
    void putTeiWithoutIfMatchStillWorks() {
        // Back-compat with DHIS2 clients that don't issue If-Match.
        when(teis.findById("tei-1"))
                .thenReturn(Optional.of(tei("tei-1", 3)))
                .thenReturn(Optional.of(tei("tei-1", 4)));
        final ResponseEntity<Map<String, Object>> res = ctl.putTei("tei-1",
                null, Map.of("orgUnit", "OU"), principal());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(teis).upsert(any());
    }
}
