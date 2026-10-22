package ug.ac.mak.der.web;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import ug.ac.mak.der.dhis2.Dhis2CompatibilityGuard;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

@WebMvcTest(Dhis2CompatibilityController.class)
@AutoConfigureMockMvc(addFilters = false)
class Dhis2CompatibilityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private Dhis2CompatibilityGuard guard;

    @Test
    void okResponseIncludesObservedAndPinnedVersions() throws Exception {
        when(guard.check()).thenReturn(new Dhis2CompatibilityGuard.Result(
                Dhis2CompatibilityGuard.Status.OK,
                new Dhis2Version("2.44-SNAPSHOT", "abc1234", "2026-08-19T23:39:17.000"),
                "2.44-SNAPSHOT"));

        mockMvc.perform(get("/edge-api/v1/dhis2/compatibility"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.observedVersion").value("2.44-SNAPSHOT"))
                .andExpect(jsonPath("$.pinnedVersion").value("2.44-SNAPSHOT"))
                .andExpect(jsonPath("$.revision").value("abc1234"))
                .andExpect(jsonPath("$.buildTime").value("2026-08-19T23:39:17.000"))
                .andExpect(jsonPath("$.message").doesNotExist());
    }

    @Test
    void notConfiguredResponseOmitsObservedVersion() throws Exception {
        when(guard.check()).thenReturn(new Dhis2CompatibilityGuard.Result(
                Dhis2CompatibilityGuard.Status.NOT_CONFIGURED, null, "2.44-SNAPSHOT"));

        mockMvc.perform(get("/edge-api/v1/dhis2/compatibility"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_CONFIGURED"))
                .andExpect(jsonPath("$.observedVersion").doesNotExist())
                .andExpect(jsonPath("$.pinnedVersion").value("2.44-SNAPSHOT"));
    }

    @Test
    void mismatchResponseIs409AndCarriesBothVersions() throws Exception {
        when(guard.check()).thenThrow(
                new Dhis2CompatibilityGuard.Dhis2VersionMismatchException("2.43.1", "2.44-SNAPSHOT"));

        mockMvc.perform(get("/edge-api/v1/dhis2/compatibility"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value("MISMATCH"))
                .andExpect(jsonPath("$.observedVersion").value("2.43.1"))
                .andExpect(jsonPath("$.pinnedVersion").value("2.44-SNAPSHOT"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void unreachableResponseIs503() throws Exception {
        when(guard.check()).thenThrow(
                new Dhis2ReferenceClient.Dhis2UnreachableException("central down", null));

        mockMvc.perform(get("/edge-api/v1/dhis2/compatibility"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("UNREACHABLE"));
    }

    @Test
    void badResponseIs502() throws Exception {
        when(guard.check()).thenThrow(
                new Dhis2ReferenceClient.Dhis2ResponseException("malformed", null));

        mockMvc.perform(get("/edge-api/v1/dhis2/compatibility"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value("BAD_RESPONSE"));
    }

    @Test
    void mismatchAllowedResponseIsOkWithMismatchAllowedStatus() throws Exception {
        when(guard.check()).thenReturn(new Dhis2CompatibilityGuard.Result(
                Dhis2CompatibilityGuard.Status.MISMATCH_ALLOWED,
                new Dhis2Version("2.43.1", null, null),
                "2.44-SNAPSHOT"));

        mockMvc.perform(get("/edge-api/v1/dhis2/compatibility"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MISMATCH_ALLOWED"))
                .andExpect(jsonPath("$.observedVersion").value("2.43.1"));
    }
}
