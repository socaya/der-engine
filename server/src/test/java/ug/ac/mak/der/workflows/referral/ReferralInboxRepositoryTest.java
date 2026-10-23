package ug.ac.mak.der.workflows.referral;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ReferralInboxRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private ReferralInboxEntry entry() {
        return new ReferralInboxEntry(UUID.randomUUID(),
                ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE,
                "src-ref", "ou-dest", "{}", NOW,
                ReferralInboxEntry.Status.PENDING, null, null);
    }

    @Test
    void insertIfAbsentIssuesOnConflict() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(), any(),
                any(), any())).thenReturn(1);
        assertThat(new ReferralInboxRepository(jdbc).insertIfAbsent(entry())).isEqualTo(1);
        verify(jdbc).update(contains("ON CONFLICT (kind, source_ref) DO NOTHING"),
                any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void insertIfAbsentRejectsNull() {
        assertThatThrownBy(() -> new ReferralInboxRepository(mock(JdbcTemplate.class))
                .insertIfAbsent(null))
                .isInstanceOf(NullPointerException.class);
    }

    @SuppressWarnings("unchecked")
    @Test
    void findPendingDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(100)))
                .thenReturn(List.of(entry()));
        assertThat(new ReferralInboxRepository(jdbc).findPending(100)).hasSize(1);
    }

    @SuppressWarnings("unchecked")
    @Test
    void findPendingCapsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(500))).thenReturn(List.of());
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1))).thenReturn(List.of());
        new ReferralInboxRepository(jdbc).findPending(999_999);
        new ReferralInboxRepository(jdbc).findPending(0);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(500));
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(1));
    }

    @Test
    void markResolvedWritesUpdate() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), anyString(), any(), any(Timestamp.class), any(UUID.class)))
                .thenReturn(1);
        final UUID id = UUID.randomUUID();
        assertThat(new ReferralInboxRepository(jdbc).markResolved(
                id, ReferralInboxEntry.Status.ACCEPTED, UUID.randomUUID(), NOW)).isEqualTo(1);
    }

    @Test
    void markResolvedRejectsPendingStatus() {
        assertThatThrownBy(() -> new ReferralInboxRepository(mock(JdbcTemplate.class))
                .markResolved(UUID.randomUUID(), ReferralInboxEntry.Status.PENDING,
                        UUID.randomUUID(), NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void markResolvedRejectsNullInboxId() {
        assertThatThrownBy(() -> new ReferralInboxRepository(mock(JdbcTemplate.class))
                .markResolved(null, ReferralInboxEntry.Status.ACCEPTED,
                        UUID.randomUUID(), NOW))
                .isInstanceOf(NullPointerException.class);
    }
}
