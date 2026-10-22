package ug.ac.mak.der.workflows.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgramStage;
import ug.ac.mak.der.rules.RuleContext;
import ug.ac.mak.der.rules.RuleEngine;
import ug.ac.mak.der.rules.RuleEngineResult;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class EventServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);

    private EventService.EventInput newInput(final Event.Status status) {
        return new EventService.EventInput(UUID.randomUUID(), UUID.randomUUID(),
                "prog", "ps", "ou", Instant.parse("2026-10-22T10:00:00Z"), status, null,
                Map.of("de1", "1"));
    }

    private MirroredProgramStage ps() {
        return new MirroredProgramStage("ps", "prog", "visit", false, List.of(),
                mapper.createObjectNode());
    }

    @Test
    void successPathWritesEventAndJournal() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.of(ps()));
        when(rules.evaluate(any(), any(), any(Boolean.class), any())).thenReturn(
                new RuleEngineResult(Map.of(), List.of(), List.of()));
        when(events.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(events.findForEnrollment(any())).thenReturn(List.of());
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(List.of(newInput(Event.Status.ACTIVE)),
                UUID.randomUUID(), "127.0.0.1", "ua");
        assertThat(out.imported()).hasSize(1);
        assertThat(out.conflicts()).isEmpty();
        verify(journal).insert(any());
        verify(audit, org.mockito.Mockito.atLeastOnce()).append(any(), any());
    }

    @Test
    void nullInputRejected() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(java.util.Arrays.asList((EventService.EventInput) null),
                UUID.randomUUID(), "ip", "ua");
        assertThat(out.conflicts()).hasSize(1);
    }

    @Test
    void mirrorMissRejects() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.empty());
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(List.of(newInput(Event.Status.ACTIVE)),
                UUID.randomUUID(), "ip", "ua");
        assertThat(out.conflicts()).hasSize(1);
        assertThat(out.conflicts().get(0).reason()).contains("program stage not in mirror");
    }

    @Test
    void programMismatchRejects() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.of(new MirroredProgramStage(
                "ps", "OTHER", "d", false, List.of(), mapper.createObjectNode())));
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(List.of(newInput(Event.Status.ACTIVE)),
                UUID.randomUUID(), "ip", "ua");
        assertThat(out.conflicts().get(0).reason()).contains("does not belong");
    }

    @Test
    void ruleRejectionBubblesUpAsConflict() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.of(ps()));
        when(events.findForEnrollment(any())).thenReturn(List.of());
        when(rules.evaluate(any(), any(), any(Boolean.class), any())).thenReturn(
                new RuleEngineResult(Map.of(),
                        List.of(new RuleEngineResult.RuleMessage("r1", "de", "boom")),
                        List.of()));
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(List.of(newInput(Event.Status.COMPLETED)),
                UUID.randomUUID(), "ip", "ua");
        assertThat(out.conflicts()).hasSize(1);
        assertThat(out.conflicts().get(0).reason()).contains("boom");
    }

    @Test
    void warningsEmitAudit() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.of(ps()));
        when(events.findForEnrollment(any())).thenReturn(List.of());
        when(events.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(rules.evaluate(any(), any(), any(Boolean.class), any())).thenReturn(
                new RuleEngineResult(Map.of(),
                        List.of(),
                        List.of(new RuleEngineResult.RuleMessage("r1", "de", "near"))));
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(List.of(newInput(Event.Status.ACTIVE)),
                UUID.randomUUID(), "ip", "ua");
        assertThat(out.imported()).hasSize(1);
    }

    @Test
    void assignedValuesAppliedToWrite() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.of(ps()));
        when(events.findForEnrollment(any())).thenReturn(List.of());
        when(events.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final java.util.LinkedHashMap<String, Object> assigned = new java.util.LinkedHashMap<>();
        assigned.put("deComputed", 42);
        assigned.put("deBlank", null);
        when(rules.evaluate(any(), any(), any(Boolean.class), any())).thenReturn(
                new RuleEngineResult(assigned, List.of(), List.of()));
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        final var out = service.submit(List.of(newInput(Event.Status.ACTIVE)),
                UUID.randomUUID(), "ip", "ua");
        assertThat(out.imported()).hasSize(1);
        assertThat(out.imported().get(0).dataValues()).containsEntry("deComputed", "42");
        assertThat(out.imported().get(0).dataValues()).containsEntry("deBlank", "");
    }

    @Test
    void previousEnrollmentEventsPopulateContext() {
        final EventRepository events = mock(EventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final RuleEngine rules = mock(RuleEngine.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(mirror.findProgramStage("ps")).thenReturn(Optional.of(ps()));
        when(events.findForEnrollment(any())).thenReturn(List.of(
                new Event(UUID.randomUUID(), UUID.randomUUID(), "prog", "ps", "ou",
                        Instant.parse("2026-10-01T10:00:00Z"), Event.Status.ACTIVE, null,
                        UUID.randomUUID(), 1, Map.of("de1", "x"))));
        when(events.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(rules.evaluate(any(), any(), any(Boolean.class), any())).thenReturn(
                new RuleEngineResult(Map.of(), List.of(), List.of()));
        final var service = new EventService(events, journal, mirror, rules, audit, mapper, clock);
        service.submit(List.of(newInput(Event.Status.ACTIVE)),
                UUID.randomUUID(), "ip", "ua");
        verify(rules).evaluate(any(), any(RuleContext.class), any(Boolean.class), any());
    }
}
