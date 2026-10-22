package ug.ac.mak.der.web;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import ug.ac.mak.der.security.SecurityAuditVerifier;

@WebMvcTest(SecurityAuditController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SecurityAuditControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean SecurityAuditVerifier verifier;

    @Test
    void verifyOk() throws Exception {
        when(verifier.verify())
                .thenReturn(new SecurityAuditVerifier.Result(true, 100L, null));
        mockMvc.perform(get("/edge-api/v1/security/audit/verify"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.totalRows").value(100))
                .andExpect(jsonPath("$.firstBreakAuditId").doesNotExist())
                .andExpect(jsonPath("$.firstBreakReason").doesNotExist());
    }

    @Test
    void verifyBreak() throws Exception {
        when(verifier.verify()).thenReturn(new SecurityAuditVerifier.Result(
                false, 50L,
                new SecurityAuditVerifier.Break(7L,
                        SecurityAuditVerifier.Reason.ROW_HASH_MISMATCH)));
        mockMvc.perform(get("/edge-api/v1/security/audit/verify"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.firstBreakAuditId").value(7))
                .andExpect(jsonPath("$.firstBreakReason").value("ROW_HASH_MISMATCH"));
    }
}
