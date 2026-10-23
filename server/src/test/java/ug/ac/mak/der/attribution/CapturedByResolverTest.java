package ug.ac.mak.der.attribution;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class CapturedByResolverTest {

    @Test
    void returnsEmptyForNullEdgeUser() {
        final CapturedByResolver r = new CapturedByResolver(
                mock(EdgeUserDhis2MappingRepository.class));
        assertThat(r.storedByFor(null)).isEmpty();
        assertThat(r.capturedByUidFor(null)).isEmpty();
        assertThat(r.currentMappingFor(null)).isEmpty();
    }

    @Test
    void returnsMappingWhenPresent() {
        final EdgeUserDhis2MappingRepository repo = mock(EdgeUserDhis2MappingRepository.class);
        final UUID u = UUID.randomUUID();
        final EdgeUserDhis2Mapping m = new EdgeUserDhis2Mapping(
                u, "aBcDeFgHiJk", "nurse.alice", "Alice Nurse",
                Instant.now(), UUID.randomUUID(), null);
        when(repo.findByEdgeUser(u)).thenReturn(Optional.of(m));
        final CapturedByResolver r = new CapturedByResolver(repo);
        assertThat(r.storedByFor(u)).contains("nurse.alice");
        assertThat(r.capturedByUidFor(u)).contains("aBcDeFgHiJk");
        assertThat(r.currentMappingFor(u)).contains(m);
    }

    @Test
    void returnsEmptyWhenNoMapping() {
        final EdgeUserDhis2MappingRepository repo = mock(EdgeUserDhis2MappingRepository.class);
        final UUID u = UUID.randomUUID();
        when(repo.findByEdgeUser(u)).thenReturn(Optional.empty());
        final CapturedByResolver r = new CapturedByResolver(repo);
        assertThat(r.storedByFor(u)).isEmpty();
        assertThat(r.capturedByUidFor(u)).isEmpty();
        assertThat(r.currentMappingFor(u)).isEmpty();
    }
}
