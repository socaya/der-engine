package ug.ac.mak.der.attribution;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class StrictModeTest {

    @Test
    void lenientAllowsUnmappedUser() {
        final CapturedByResolver r = new CapturedByResolver(
                mock(EdgeUserDhis2MappingRepository.class), false);
        assertThat(r.isStrict()).isFalse();
        assertThat(r.enforcedStoredByFor(UUID.randomUUID())).isEmpty();
    }

    @Test
    void strictRejectsUnmappedUser() {
        final CapturedByResolver r = new CapturedByResolver(
                mock(EdgeUserDhis2MappingRepository.class), true);
        assertThat(r.isStrict()).isTrue();
        final UUID uid = UUID.randomUUID();
        assertThatThrownBy(() -> r.enforcedStoredByFor(uid))
                .isInstanceOf(CapturedByResolver.UserNotMappedException.class)
                .hasMessageContaining("USER_NOT_MAPPED")
                .hasMessageContaining(uid.toString());
    }

    @Test
    void strictAllowsMappedUser() {
        final EdgeUserDhis2MappingRepository repo = mock(EdgeUserDhis2MappingRepository.class);
        final UUID uid = UUID.randomUUID();
        when(repo.findByEdgeUser(uid)).thenReturn(Optional.of(new EdgeUserDhis2Mapping(
                uid, "aBcDeFgHiJk", "nurse.alice", "A",
                Instant.now(), UUID.randomUUID(), null)));
        final CapturedByResolver r = new CapturedByResolver(repo, true);
        assertThat(r.enforcedStoredByFor(uid)).contains("nurse.alice");
    }

    @Test
    void strictPassesWhenEdgeUserIsNull() {
        final CapturedByResolver r = new CapturedByResolver(
                mock(EdgeUserDhis2MappingRepository.class), true);
        assertThat(r.enforcedStoredByFor(null)).isEmpty();
    }

    @Test
    void legacyConstructorIsLenient() {
        final CapturedByResolver r = new CapturedByResolver(
                mock(EdgeUserDhis2MappingRepository.class));
        assertThat(r.isStrict()).isFalse();
    }

    @Test
    void exceptionExposesEdgeUserId() {
        final UUID uid = UUID.randomUUID();
        final CapturedByResolver.UserNotMappedException ex =
                new CapturedByResolver.UserNotMappedException(uid);
        assertThat(ex.edgeUserId()).isEqualTo(uid);
    }
}
