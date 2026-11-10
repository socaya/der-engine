package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

class OptionSetLookupTest {

    private JdbcTemplate jdbc;
    private OptionSetLookup lookup;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        lookup = new OptionSetLookup(jdbc, new ObjectMapper());
    }

    @Test
    void labelsForBlankUidIsEmpty() {
        assertThat(lookup.labelsFor("")).isEmpty();
        assertThat(lookup.labelsFor((String) null)).isEmpty();
    }

    @Test
    void labelsForMissingOptionSetIsEmpty() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS1")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(lookup.labelsFor("OS1")).isEmpty();
    }

    @Test
    void parsesOptionsArray() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS_SEX")))
                .thenReturn("{\"id\":\"OS_SEX\","
                        + "\"options\":["
                        + "{\"code\":\"F\",\"displayName\":\"Female\"},"
                        + "{\"code\":\"M\",\"displayName\":\"Male\"},"
                        + "{\"code\":\"U\",\"name\":\"Unknown\"}"
                        + "]}");
        final Map<String, String> m = lookup.labelsFor("OS_SEX");
        assertThat(m).containsEntry("F", "Female")
                .containsEntry("M", "Male")
                .containsEntry("U", "Unknown");
    }

    @Test
    void skipsOptionsWithoutCode() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS1")))
                .thenReturn("{\"options\":["
                        + "{\"displayName\":\"orphan\"},"
                        + "{\"code\":\"C1\",\"displayName\":\"Label 1\"}"
                        + "]}");
        final Map<String, String> m = lookup.labelsFor("OS1");
        assertThat(m).hasSize(1).containsEntry("C1", "Label 1");
    }

    @Test
    void cacheServesRepeatLookupsFromOneQuery() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS_SEX")))
                .thenReturn("{\"options\":["
                        + "{\"code\":\"F\",\"displayName\":\"Female\"}]}");
        final OptionSetLookup.Cache cache = lookup.cache();
        assertThat(cache.label("OS_SEX", "F")).isEqualTo("Female");
        assertThat(cache.label("OS_SEX", "F")).isEqualTo("Female");
        verify(jdbc).queryForObject(anyString(), eq(String.class),
                eq("OS_SEX"));
    }

    @Test
    void cacheLabelFallsBackToCodeWhenNotMirrored() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS_X")))
                .thenThrow(new EmptyResultDataAccessException(1));
        final OptionSetLookup.Cache cache = lookup.cache();
        assertThat(cache.label("OS_X", "V1")).isEqualTo("V1");
    }

    @Test
    void labelsForMultipleOptionSets() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS1")))
                .thenReturn("{\"options\":["
                        + "{\"code\":\"A\",\"displayName\":\"Alpha\"}]}");
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS2")))
                .thenReturn("{\"options\":["
                        + "{\"code\":\"B\",\"displayName\":\"Beta\"}]}");
        final Map<String, Map<String, String>> out =
                lookup.labelsFor(Set.of("OS1", "OS2"));
        assertThat(out).containsKey("OS1").containsKey("OS2");
        assertThat(out.get("OS1")).containsEntry("A", "Alpha");
        assertThat(out.get("OS2")).containsEntry("B", "Beta");
    }

    @Test
    void malformedPayloadReturnsEmpty() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS1"))).thenReturn("{not json");
        assertThat(lookup.labelsFor("OS1")).isEmpty();
    }

    @Test
    void payloadWithoutOptionsArrayReturnsEmpty() {
        when(jdbc.queryForObject(anyString(), eq(String.class),
                eq("OS1"))).thenReturn("{\"id\":\"OS1\"}");
        assertThat(lookup.labelsFor("OS1")).isEmpty();
    }
}
