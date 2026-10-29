package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.network.PeerMeshService;

/** §1 Peer mesh — topology, adjacency, CRDT catch-up. */
@RestController
@RequestMapping(path = "/edge-api/v1/peer-mesh", produces = MediaType.APPLICATION_JSON_VALUE)
public class PeerMeshController {

    private final PeerMeshService svc;

    public PeerMeshController(final PeerMeshService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping("/topology")
    public ResponseEntity<Map<String, Object>> topology() {
        return ResponseEntity.ok(svc.topology());
    }

    @GetMapping("/adjacency")
    public ResponseEntity<Map<String, Object>> adjacency() {
        return ResponseEntity.ok(Map.of("adjacency", svc.listAdjacency()));
    }

    @PostMapping(path = "/adjacency", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> announceAdjacency(
            @RequestBody final AdjacencyBody body) {
        if (body == null || body.localPeerId == null || body.reachableEdge == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "localPeerId + reachableEdge required"));
        }
        svc.announceAdjacency(UUID.fromString(body.localPeerId),
                                body.reachableEdge,
                                body.hops == null ? 1 : body.hops);
        return ResponseEntity.ok(Map.of("announced", true));
    }

    @GetMapping("/route/{targetEdge}")
    public ResponseEntity<Map<String, Object>> route(@PathVariable final String targetEdge) {
        final var p = svc.resolveRoute(targetEdge);
        if (p.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                "code", "NO_ROUTE",
                "message", "no route to " + targetEdge));
        }
        return ResponseEntity.ok(Map.of(
            "peerId",   p.get().id().toString(),
            "nodeId",   p.get().nodeId(),
            "endpoint", p.get().endpoint()));
    }

    /* ─── CRDT vector-clock catch-up ─────────────────────────── */

    @GetMapping("/crdt/{docId}/clock")
    public ResponseEntity<Map<String, Object>> clock(@PathVariable final String docId) {
        return ResponseEntity.ok(svc.vectorClock(docId));
    }

    @PostMapping(path = "/crdt/{docId}/catchup", consumes = MediaType.APPLICATION_JSON_VALUE)
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> catchup(@PathVariable final String docId,
                                                        @RequestBody(required = false)
                                                        final Map<String, Object> body) {
        final Map<String, Long> clock = body == null ? Map.of()
            : ((Map<String, Number>) body.getOrDefault("clock", Map.of()))
                .entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                    Map.Entry::getKey,
                    e -> e.getValue().longValue()));
        return ResponseEntity.ok(Map.of("ops", svc.catchupOps(docId, clock)));
    }

    /* ─── Signed invite verify (self-serve for a receiving edge) */

    @PostMapping(path = "/invite/verify", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> verifyInvite(@RequestBody final VerifyBody body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "BODY_REQUIRED", "message", "verify body required"));
        }
        return svc.verifyInvite(body.payload, body.signature, body.issuerPublicKeyBase64)
            .<ResponseEntity<Map<String, Object>>>map(p -> ResponseEntity.ok(Map.of(
                "verified", true, "payload", p)))
            .orElseGet(() -> ResponseEntity.status(400).body(Map.of(
                "verified", false, "code", "SIGNATURE_MISMATCH")));
    }

    public static final class AdjacencyBody {
        public String localPeerId;
        public String reachableEdge;
        public Integer hops;
    }
    public static final class VerifyBody {
        public String payload;
        public String signature;
        public String issuerPublicKeyBase64;
    }

}
