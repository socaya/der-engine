package ug.ac.mak.der.workflows.aggregate;

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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredDataElement;
import ug.ac.mak.der.metadata.MirroredOrganisationUnit;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

class AggregateDataValueServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private final ObjectMapper mapper = new ObjectMapper();

    private MetadataMirrorRepository metadataWith(final String valueType) {
        final MetadataMirrorRepository m = mock(MetadataMirrorRepository.class);
        final ObjectNode payload = mapper.createObjectNode();
        when(m.findDataElement("de")).thenReturn(Optional.of(
                new MirroredDataElement("de", "DE", valueType, "AGGREGATE", payload)));
        when(m.findOrganisationUnit("ou")).thenReturn(Optional.of(
                new MirroredOrganisationUnit("ou", "OU", null, 1, null, payload)));
        return m;
    }

    private AggregateDataValueService service(final AggregateDataValueRepository values,
                                                final OperationJournalRepository journal,
                                                final MetadataMirrorRepository metadata,
                                                final SecurityAuditRepository audit) {
        return new AggregateDataValueService(values, journal, metadata, audit, mapper, CLOCK,
                new ug.ac.mak.der.approval.ApprovalRequirements(false, false, false));
    }

    private AggregateDataValueService.DataValueInput validInput(final String value) {
        return new AggregateDataValueService.DataValueInput(
                "de", "ou", "2026Q1", "coc", "aoc", value, "note");
    }

    @Test
    void happyPathWritesValueAndJournal() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final AggregateDataValueService svc = service(values, journal, metadataWith("NUMBER"), audit);
        final AggregateDataValueService.ImportSummary summary = svc.submit(
                List.of(validInput("42.0")), UUID.randomUUID(), "1.1.1.1", "ua");

        assertThat(summary.imported()).isEqualTo(1);
        assertThat(summary.ignored()).isZero();
        verify(values).upsert(any(AggregateDataValue.class));
        verify(journal).insert(any(OperationJournalEntry.class));
        verify(audit).append(any(AuditEvent.class), eq(NOW));
    }

    @Test
    void referralTagStoredOnJournalEntry() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final AggregateDataValueService svc = service(values, journal, metadataWith("NUMBER"), audit);
        svc.submit(List.of(validInput("1")), UUID.randomUUID(), null, null, "  ou-dest  ");
        final org.mockito.ArgumentCaptor<OperationJournalEntry> cap =
                org.mockito.ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(cap.capture());
        assertThat(cap.getValue().nextHopOrgUnitUid()).isEqualTo("ou-dest");
    }

    @Test
    void referralTagNullWhenBlank() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final AggregateDataValueService svc = service(values, journal, metadataWith("NUMBER"), audit);
        svc.submit(List.of(validInput("1")), UUID.randomUUID(), null, null, "   ");
        final org.mockito.ArgumentCaptor<OperationJournalEntry> cap =
                org.mockito.ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(cap.capture());
        assertThat(cap.getValue().nextHopOrgUnitUid()).isNull();
    }

    @Test
    void rejectsMissingFields() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final AggregateDataValueService svc = service(values, journal, metadataWith("NUMBER"), audit);

        final List<AggregateDataValueService.DataValueInput> bad = java.util.Arrays.asList(
                null,
                new AggregateDataValueService.DataValueInput("", "ou", "2026Q1", "c", "a", "1", null),
                new AggregateDataValueService.DataValueInput(null, "ou", "2026Q1", "c", "a", "1", null),
                new AggregateDataValueService.DataValueInput("de", "", "2026Q1", "c", "a", "1", null),
                new AggregateDataValueService.DataValueInput("de", null, "2026Q1", "c", "a", "1", null),
                new AggregateDataValueService.DataValueInput("de", "ou", "", "c", "a", "1", null),
                new AggregateDataValueService.DataValueInput("de", "ou", null, "c", "a", "1", null),
                new AggregateDataValueService.DataValueInput("de", "ou", "2026Q1", "c", "a", "", null),
                new AggregateDataValueService.DataValueInput("de", "ou", "2026Q1", "c", "a", null, null)
        );

        final var summary = svc.submit(bad, UUID.randomUUID(), null, null);
        assertThat(summary.imported()).isZero();
        assertThat(summary.ignored()).isEqualTo(bad.size());
        verify(values, never()).upsert(any());
    }

    @Test
    void happyPathWithNullComment() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final AggregateDataValueService svc = service(values, journal, metadataWith("NUMBER"), audit);
        final var noComment = new AggregateDataValueService.DataValueInput(
                "de", "ou", "2026Q1", "coc", "aoc", "1", null);
        final var summary = svc.submit(java.util.List.of(noComment), UUID.randomUUID(), null, null);
        assertThat(summary.imported()).isEqualTo(1);
    }

    @Test
    void rejectsWhenDataElementIsNotMirrored() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final MetadataMirrorRepository metadata = mock(MetadataMirrorRepository.class);
        when(metadata.findDataElement("de")).thenReturn(Optional.empty());

        final var svc = service(values, journal, metadata, audit);
        final var summary = svc.submit(List.of(validInput("1")), UUID.randomUUID(), null, null);
        assertThat(summary.ignored()).isEqualTo(1);
        assertThat(summary.conflicts().get(0).reason()).contains("dataElement");
    }

    @Test
    void rejectsWhenOrgUnitIsNotMirrored() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final MetadataMirrorRepository metadata = mock(MetadataMirrorRepository.class);
        final ObjectNode payload = mapper.createObjectNode();
        when(metadata.findDataElement("de")).thenReturn(Optional.of(
                new MirroredDataElement("de", "DE", "NUMBER", "AGGREGATE", payload)));
        when(metadata.findOrganisationUnit("ou")).thenReturn(Optional.empty());

        final var svc = service(values, journal, metadata, audit);
        final var summary = svc.submit(List.of(validInput("1")), UUID.randomUUID(), null, null);
        assertThat(summary.ignored()).isEqualTo(1);
        assertThat(summary.conflicts().get(0).reason()).contains("orgUnit");
    }

    @Test
    void rejectsIncorrectValueType() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);

        final var svc = service(values, journal, metadataWith("NUMBER"), audit);
        final var summary = svc.submit(List.of(validInput("not-a-number")), UUID.randomUUID(), null, null);
        assertThat(summary.ignored()).isEqualTo(1);
        assertThat(summary.conflicts().get(0).reason()).contains("not numeric");
    }

    @Test
    void mixedBatchReportsPerRow() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);

        final var svc = service(values, journal, metadataWith("INTEGER"), audit);
        final var summary = svc.submit(List.of(
                validInput("1"),
                validInput("oops")
        ), UUID.randomUUID(), null, null);
        assertThat(summary.imported()).isEqualTo(1);
        assertThat(summary.ignored()).isEqualTo(1);
    }

    @Test
    void inputCompoundKeyUsesDefaultsWhenCombosNull() {
        final var input = new AggregateDataValueService.DataValueInput(
                "de", "ou", "2026Q1", null, null, "1", null);
        assertThat(input.compoundKey())
                .isEqualTo("de|ou|2026Q1|" + AggregateDataValue.DEFAULT_COC
                        + '|' + AggregateDataValue.DEFAULT_COC);
    }

    @Test
    void typeCheckCovers() {
        assertThat(AggregateDataValueService.typeCheck(null, "x")).isNull();
        assertThat(AggregateDataValueService.typeCheck("NUMBER", "3.14")).isNull();
        assertThat(AggregateDataValueService.typeCheck("NUMBER", "nope")).contains("not numeric");
        assertThat(AggregateDataValueService.typeCheck("INTEGER", "42")).isNull();
        assertThat(AggregateDataValueService.typeCheck("INTEGER", "nope")).contains("not an integer");
        assertThat(AggregateDataValueService.typeCheck("INTEGER_POSITIVE", "0")).contains("positive");
        assertThat(AggregateDataValueService.typeCheck("INTEGER_POSITIVE", "5")).isNull();
        assertThat(AggregateDataValueService.typeCheck("INTEGER_ZERO_OR_POSITIVE", "-1")).contains("zero or positive");
        assertThat(AggregateDataValueService.typeCheck("INTEGER_ZERO_OR_POSITIVE", "0")).isNull();
        assertThat(AggregateDataValueService.typeCheck("INTEGER_NEGATIVE", "0")).contains("negative");
        assertThat(AggregateDataValueService.typeCheck("INTEGER_NEGATIVE", "-1")).isNull();
        assertThat(AggregateDataValueService.typeCheck("UNIT_INTERVAL", "0.5")).isNull();
        assertThat(AggregateDataValueService.typeCheck("PERCENTAGE", "50")).isNull();
        assertThat(AggregateDataValueService.typeCheck("BOOLEAN", "true")).isNull();
        assertThat(AggregateDataValueService.typeCheck("BOOLEAN", "FALSE")).isNull();
        assertThat(AggregateDataValueService.typeCheck("BOOLEAN", "0")).isNull();
        assertThat(AggregateDataValueService.typeCheck("BOOLEAN", "1")).isNull();
        assertThat(AggregateDataValueService.typeCheck("BOOLEAN", "maybe")).contains("not a boolean");
        assertThat(AggregateDataValueService.typeCheck("WEIRD_UNKNOWN", "anything")).isNull();
    }

    @Test
    void rejectsNullDependencies() {
        final var v = mock(AggregateDataValueRepository.class);
        final var j = mock(OperationJournalRepository.class);
        final var m = mock(MetadataMirrorRepository.class);
        final var a = mock(SecurityAuditRepository.class);
        final var approvals = new ug.ac.mak.der.approval.ApprovalRequirements(false, false, false);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(null, j, m, a, mapper, CLOCK, approvals))
                .isInstanceOf(NullPointerException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(v, null, m, a, mapper, CLOCK, approvals))
                .isInstanceOf(NullPointerException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(v, j, null, a, mapper, CLOCK, approvals))
                .isInstanceOf(NullPointerException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(v, j, m, null, mapper, CLOCK, approvals))
                .isInstanceOf(NullPointerException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(v, j, m, a, null, CLOCK, approvals))
                .isInstanceOf(NullPointerException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(v, j, m, a, mapper, null, approvals))
                .isInstanceOf(NullPointerException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new AggregateDataValueService(v, j, m, a, mapper, CLOCK, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void marksRequiresApprovalWhenConfigured() {
        final AggregateDataValueRepository values = mock(AggregateDataValueRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final MetadataMirrorRepository metadata = metadataWith("INTEGER");
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        final AggregateDataValueService svc = new AggregateDataValueService(
                values, journal, metadata, audit, mapper, CLOCK,
                new ug.ac.mak.der.approval.ApprovalRequirements(true, false, false));
        svc.submit(java.util.List.of(validInput("1")), java.util.UUID.randomUUID(), "ip", "ua");
        verify(journal).markRequiresApproval(any(java.util.UUID.class));
    }
}
