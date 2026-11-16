package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredTrackedEntityAttribute;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;

class TeiUniquenessCheckerTest {

    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");
    private static final JsonNode EMPTY = JsonNodeFactory.instance.objectNode();

    private static MirroredTrackedEntityAttribute attr(final String uid,
                                                         final boolean unique) {
        return new MirroredTrackedEntityAttribute(
                uid, uid, "TEXT", unique, EMPTY);
    }

    private static TrackedEntity tei(final String uid,
                                       final Map<String, String> attrs) {
        return new TrackedEntity(uid, "TET", "OU", attrs,
                UUID.randomUUID(), NOW, NOW, 1);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<ExtendedMirrorRepository> provider(
            final ExtendedMirrorRepository mirror) {
        final ObjectProvider<ExtendedMirrorRepository> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(mirror);
        return p;
    }

    private TeiUniquenessChecker build(final TrackedEntityRepository teis,
                                         final ExtendedMirrorRepository mirror) {
        return new TeiUniquenessChecker(teis, provider(mirror));
    }

    @Test
    void nullOrEmptyAttrsShortCircuits() {
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        final var checker = build(teis, mirror);
        assertThat(checker.check("t-1", null).passed()).isTrue();
        assertThat(checker.check("t-1", Map.of()).passed()).isTrue();
        verify(teis, org.mockito.Mockito.never()).search(any(), any(), any(), anyInt());
    }

    @Test
    void noUniqueAttrsInMirrorMeansNoEnforcement() {
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                attr("attr-A", false), attr("attr-B", false)));
        final var checker = build(teis, mirror);
        final var result = checker.check("t-1", Map.of("attr-A", "foo"));
        assertThat(result.passed()).isTrue();
        verify(teis, org.mockito.Mockito.never()).search(any(), any(), any(), anyInt());
    }

    @Test
    void noLocalCollisionPasses() {
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                attr("nid", true)));
        when(teis.search(any(), any(),
                eq(Map.of("nid", "12345")), anyInt())).thenReturn(List.of());
        final var result = build(teis, mirror)
                .check("t-1", Map.of("nid", "12345"));
        assertThat(result.passed()).isTrue();
    }

    @Test
    void existingDifferentTeiWithSameValueIsCollision() {
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                attr("nid", true)));
        when(teis.search(any(), any(),
                eq(Map.of("nid", "12345")), anyInt())).thenReturn(List.of(
                        tei("t-OTHER", Map.of("nid", "12345"))));
        final var result = build(teis, mirror)
                .check("t-NEW", Map.of("nid", "12345"));
        assertThat(result.passed()).isFalse();
        assertThat(result.collisions()).hasSize(1);
        assertThat(result.collisions().get(0).attributeUid()).isEqualTo("nid");
        assertThat(result.collisions().get(0).existingTeiUid()).isEqualTo("t-OTHER");
    }

    @Test
    void selfMatchIsNotACollision() {
        // Updating a TEI with its own existing unique-attr value
        // must pass — we're writing the same row.
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                attr("nid", true)));
        when(teis.search(any(), any(),
                eq(Map.of("nid", "12345")), anyInt())).thenReturn(List.of(
                        tei("t-SELF", Map.of("nid", "12345"))));
        final var result = build(teis, mirror)
                .check("t-SELF", Map.of("nid", "12345"));
        assertThat(result.passed()).isTrue();
    }

    @Test
    void nonUniqueAttrsAreNotChecked() {
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                attr("nid", true), attr("name", false)));
        final var result = build(teis, mirror)
                .check("t-1", Map.of("name", "duplicate-name"));
        assertThat(result.passed()).isTrue();
        verify(teis, org.mockito.Mockito.never()).search(any(), any(),
                eq(Map.of("name", "duplicate-name")), anyInt());
    }

    @Test
    void blankValueDoesNotTriggerSearch() {
        // A blank unique-attr value isn't a real identity claim —
        // DHIS2 central treats missing-vs-blank the same way.
        final var teis = mock(TrackedEntityRepository.class);
        final var mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                attr("nid", true)));
        final var m = new java.util.HashMap<String, String>();
        m.put("nid", "");
        final var result = build(teis, mirror).check("t-1", m);
        assertThat(result.passed()).isTrue();
        verify(teis, org.mockito.Mockito.never()).search(any(), any(), any(), anyInt());
    }

    @Test
    void missingMirrorProviderDegradesSafely() {
        final var teis = mock(TrackedEntityRepository.class);
        final var checker = new TeiUniquenessChecker(teis, null);
        final var result = checker.check("t-1", Map.of("nid", "12345"));
        assertThat(result.passed()).isTrue();
    }
}
