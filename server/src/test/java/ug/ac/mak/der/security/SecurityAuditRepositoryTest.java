package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class SecurityAuditRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-21T00:00:00Z");

    @Test
    void appendsRowWithJsonbDetail() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final SecurityAuditRepository repo = new SecurityAuditRepository(jdbc, new ObjectMapper());
        repo.append(new AuditEvent("E", AuditEvent.Outcome.SUCCESS, null, null, "1.1.1.1", "ua",
                Map.of("k", "v")), NOW);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO der.security_audit"),
                eq("E"), eq((Object) null), eq((Object) null), eq("1.1.1.1"), eq("ua"), eq("SUCCESS"),
                eq("{\"k\":\"v\"}"), any(Timestamp.class));
    }

    @Test
    void translatesJsonSerialisationFailure() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper mapper = mock(ObjectMapper.class);
        when(mapper.writeValueAsString(any(Map.class))).thenThrow(new JsonProcessingException("boom") { });
        final SecurityAuditRepository repo = new SecurityAuditRepository(jdbc, mapper);
        assertThatThrownBy(() -> repo.append(new AuditEvent("E", AuditEvent.Outcome.ERROR, null, null, null, null, null),
                NOW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to serialise");
    }
}
