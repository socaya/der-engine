package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.network.NetworkCaService;
import ug.ac.mak.der.network.PeerLifecycleService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** Phase N5 — peer discovery, invite, health, retry admin surface. */
@RestController
@RequestMapping(path = "/edge-api/v1/peer-lifecycle",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class PeerLifecycleController {

    private final PeerLifecycleService svc;
    private final NetworkCaService ca;

    public PeerLifecycleController(final PeerLifecycleService svc,
                                     final NetworkCaService ca) {
        this.svc = Objects.requireNonNull(svc, "svc");
        this.ca  = Objects.requireNonNull(ca, "ca");
    }

    /* ─── Discovery ─────────────────────────────────────────── */

    @GetMapping("/discovered")
    public ResponseEntity<Map<String, Object>> discovered() {
        return ResponseEntity.ok(Map.of("discovered", svc.listDiscovered()));
    }

    @PostMapping(path = "/discovered/{id}/reviewed",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> markReviewed(
            final Authentication auth,
            @PathVariable final UUID id,
            @RequestBody(required = false) final Map<String, Object> body) {
        final Object pid = body == null ? null : body.get("approvedPeerId");
        final UUID approved = pid == null || pid.toString().isBlank()
            ? null : UUID.fromString(pid.toString());
        return ResponseEntity.ok(Map.of(
            "updated", svc.markReviewed(id, approved)));
    }

    /* ─── Invite tokens ─────────────────────────────────────── */

    @PostMapping(path = "/invites", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> issueInvite(
            final Authentication auth,
            @RequestBody(required = false) final InviteBody body) {
        final UUID uid = auth instanceof EdgeUserPrincipal p ? p.userId() : null;
        final int ttl = body == null || body.ttlSeconds == null ? 86400 : body.ttlSeconds;
        final String note = body == null ? null : body.note;
        final String token = svc.issueInvite(uid, note, ttl);
        return ResponseEntity.status(201).body(Map.of(
            "token", token,
            "ttlSeconds", ttl,
            "edgeFingerprint", ca.fingerprint()));
    }

    @GetMapping("/invites")
    public ResponseEntity<Map<String, Object>> listInvites() {
        return ResponseEntity.ok(Map.of("invites", svc.listInvites()));
    }

    @PostMapping(path = "/invites/redeem", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> redeemInvite(
            @RequestBody final RedeemBody body) {
        if (body == null || body.token == null || body.edgeFingerprint == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "token + edgeFingerprint required"));
        }
        final UUID peerId = body.peerId == null ? null : UUID.fromString(body.peerId);
        return svc.consumeInvite(body.token, body.edgeFingerprint, peerId)
            ? ResponseEntity.ok(Map.of("accepted", true,
                                       "trustAnchor", ca.fingerprint()))
            : ResponseEntity.status(410).body(Map.of(
                "code", "INVITE_INVALID",
                "message", "token missing, expired, or already consumed"));
    }

    /* ─── Health ────────────────────────────────────────────── */

    @GetMapping("/health/{peerId}")
    public ResponseEntity<Map<String, Object>> health(@PathVariable final UUID peerId) {
        return ResponseEntity.ok(svc.healthSummary(peerId));
    }

    /* ─── Retry queue ───────────────────────────────────────── */

    @GetMapping("/retries")
    public ResponseEntity<Map<String, Object>> retries() {
        return ResponseEntity.ok(Map.of("retries", svc.retrySnapshot()));
    }

    /* ─── Bodies ────────────────────────────────────────────── */

    public static final class InviteBody {
        public Integer ttlSeconds;
        public String note;
    }

    public static final class RedeemBody {
        public String token;
        public String edgeFingerprint;
        public String peerId;
    }

}
