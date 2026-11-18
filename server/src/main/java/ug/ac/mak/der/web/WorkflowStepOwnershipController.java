package ug.ac.mak.der.web;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DPP/1 support — lightweight step-ownership lookup for the peer
 * mesh's HELLO handshake. On session open, each device queries this
 * endpoint for its own device id, puts the resulting
 * {@code capture_workflow_step.step_id} list into the DPP
 * {@code ownsSteps} capability, and the peer caches that into the
 * shared route table so later {@code workflow.run-advance} frames
 * can be routed to the right service point without the operator
 * having to know who owns the next step.
 *
 * <p>Separate endpoint instead of extending
 * {@link CaptureWorkflowController} because the DPP lookup is a
 * read-only "which steps does this device own" query with a tight
 * shape — no pagination, no filters, nothing else to accrete.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows/steps",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class WorkflowStepOwnershipController {

    private final JdbcTemplate jdbc;

    public WorkflowStepOwnershipController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /**
     * Returns the {@code step_id}s this device is the configured
     * owner for across every enabled workflow. Body:
     * {@code {deviceId, stepIds: [...]} } — ordered by workflow +
     * ordinal so the peer-side route table is deterministic.
     *
     * @param deviceId the device whose ownership we're querying;
     *                 authenticated session must either belong to
     *                 the owning user or carry the ADMIN role.
     */
    @GetMapping("/owned-by-device/{deviceId}")
    public ResponseEntity<Map<String, Object>> ownedByDevice(
            final Authentication auth,
            @PathVariable("deviceId") final UUID deviceId) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<String> stepIds = jdbc.queryForList(
                "SELECT step_id FROM der.capture_workflow_step "
                        + "WHERE owner_device_id = ? "
                        + "ORDER BY workflow_id, ordinal",
                String.class, deviceId);
        return ResponseEntity.ok(Map.of(
                "deviceId", deviceId.toString(),
                "stepIds", stepIds,
                "count", stepIds.size()));
    }
}
