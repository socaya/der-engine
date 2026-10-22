package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.device.DeviceService;
import ug.ac.mak.der.device.EdgeDevice;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(DeviceController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class DeviceControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean DeviceService svc;

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "a", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private EdgeDevice device(final UUID id, final EdgeDevice.Status s) {
        return new EdgeDevice(id, null, "h", NOW, null, null, NOW, "ua", null, s);
    }

    @Test
    void enrolUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/devices/enroll")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void enrolMissingId() throws Exception {
        mockMvc.perform(post("/edge-api/v1/devices/enroll").with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void enrolOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(svc.enrol(any(UUID.class), any(UUID.class), anyString()))
                .thenReturn(new DeviceService.EnrolResult(
                        device(id, EdgeDevice.Status.PENDING), "token-xyz"));
        mockMvc.perform(post("/edge-api/v1/devices/enroll").with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"" + id + "\",\"userAgent\":\"chrome\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.enrolmentToken").value("token-xyz"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void list() throws Exception {
        when(svc.list()).thenReturn(List.of(device(UUID.randomUUID(),
                EdgeDevice.Status.APPROVED)));
        mockMvc.perform(get("/edge-api/v1/devices").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devices[0].status").value("APPROVED"));
    }

    @Test
    void getNotFound() throws Exception {
        when(svc.get(any())).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/devices/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(svc.get(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.PENDING)));
        mockMvc.perform(get("/edge-api/v1/devices/" + id).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceId").value(id.toString()));
    }

    @Test
    void approveUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/approve"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void approveOk() throws Exception {
        when(svc.approve(any(), any())).thenReturn(DeviceService.Outcome.OK);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("OK"));
    }

    @Test
    void approveNotFound() throws Exception {
        when(svc.approve(any(), any())).thenReturn(DeviceService.Outcome.NOT_FOUND);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void approveRevokedIsTerminal() throws Exception {
        when(svc.approve(any(), any())).thenReturn(DeviceService.Outcome.REVOKED_IS_TERMINAL);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DEVICE_REVOKED"));
    }

    @Test
    void suspendOk() throws Exception {
        when(svc.suspend(any(), any())).thenReturn(DeviceService.Outcome.OK);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/suspend")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }

    @Test
    void revokeOk() throws Exception {
        when(svc.revoke(any(), any())).thenReturn(DeviceService.Outcome.OK);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/revoke")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }

    @Test
    void heartbeatUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/heartbeat"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void heartbeatOk() throws Exception {
        when(svc.heartbeat(any())).thenReturn(DeviceService.HeartbeatOutcome.OK);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/heartbeat")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void heartbeatNotFound() throws Exception {
        when(svc.heartbeat(any())).thenReturn(DeviceService.HeartbeatOutcome.NOT_FOUND);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/heartbeat")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound());
    }

    @Test
    void heartbeatRevoked() throws Exception {
        when(svc.heartbeat(any())).thenReturn(DeviceService.HeartbeatOutcome.REVOKED);
        mockMvc.perform(post("/edge-api/v1/devices/" + UUID.randomUUID() + "/heartbeat")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DEVICE_REVOKED"));
    }

    @Test
    void deleteNotFound() throws Exception {
        when(svc.delete(any())).thenReturn(0);
        mockMvc.perform(delete("/edge-api/v1/devices/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteOk() throws Exception {
        when(svc.delete(any())).thenReturn(1);
        mockMvc.perform(delete("/edge-api/v1/devices/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNoContent());
    }
}
