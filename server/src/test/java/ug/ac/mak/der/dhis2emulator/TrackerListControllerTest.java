package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;

class TrackerListControllerTest {

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.DHIS2, "x", false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void listReturnsDhis2ShapedBodyPagedFromRepo() {
        final var repo = mock(TrackedEntityRepository.class);
        when(repo.search(any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of(
                        new TrackedEntityRepository.TrackedEntity(
                                "TEI_ALICE", "nEenWmSyUEp", "OU_1",
                                Map.of("w75KJ2mc4zz", "Alice",
                                        "zDhUuAYrxNC", "Doe"),
                                UUID.randomUUID(),
                                Instant.now(), Instant.now(), 1, null),
                        new TrackedEntityRepository.TrackedEntity(
                                "TEI_BOB", "nEenWmSyUEp", "OU_1",
                                Map.of("w75KJ2mc4zz", "Bob"),
                                UUID.randomUUID(),
                                Instant.now(), Instant.now(), 1, null)));
        final var r = new TrackerListController(repo, new ObjectMapper())
                .list(principal(), "ueBhWkWll5v", "OU_1",
                        "nEenWmSyUEp", 1, 50, null);
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        final var body = r.getBody();
        assertThat(body).isNotNull();
        final var instances = (List<?>) body.get("instances");
        assertThat(instances).hasSize(2);
        final Map<?, ?> first = (Map<?, ?>) instances.get(0);
        assertThat(first.get("trackedEntity")).isEqualTo("TEI_ALICE");
        assertThat(first.get("orgUnit")).isEqualTo("OU_1");
        assertThat(first.get("trackedEntityType")).isEqualTo("nEenWmSyUEp");
        final List<?> attrs = (List<?>) first.get("attributes");
        assertThat(attrs).hasSize(2);
        assertThat(body.get("page")).isEqualTo(1);
        assertThat(body.get("total")).isEqualTo(2);
    }

    @Test
    void listClampsPageSize() {
        final var repo = mock(TrackedEntityRepository.class);
        when(repo.search(any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of());
        final var r = new TrackerListController(repo, new ObjectMapper())
                .list(principal(), null, null, null, 1, 10000, null);
        // Underlying search receives the capped fetch; body honors
        // the requested-but-capped pageSize.
        assertThat(r.getBody().get("pageSize")).isEqualTo(200);
    }

    @Test
    void anonymousRejected() {
        final var r = new TrackerListController(
                mock(TrackedEntityRepository.class), new ObjectMapper())
                .list(null, null, null, null, 1, 50, null);
        assertThat(r.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void emptyRepoReturnsEmptyInstances() {
        final var repo = mock(TrackedEntityRepository.class);
        when(repo.search(any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of());
        final var r = new TrackerListController(repo, new ObjectMapper())
                .list(principal(), "prog", "ou", null, 1, 50, null);
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat((List<?>) r.getBody().get("instances")).isEmpty();
        assertThat(r.getBody().get("total")).isEqualTo(0);
    }
}
