package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.network.NetworkEntities;
import ug.ac.mak.der.network.NetworkEntities.AccessPointStatus;
import ug.ac.mak.der.network.NetworkEntities.InterfaceState;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;
import ug.ac.mak.der.network.NetworkEntities.NetworkEvent;
import ug.ac.mak.der.network.NetworkEntities.NetworkInterface;
import ug.ac.mak.der.network.NetworkEntities.NetworkPeer;
import ug.ac.mak.der.network.NetworkEntities.NetworkRoute;
import ug.ac.mak.der.network.NetworkEntities.NetworkStatus;
import ug.ac.mak.der.network.NetworkEntities.PolicyRule;
import ug.ac.mak.der.network.NetworkService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** Phase N1-N5 — DER Network Module REST surface.
 *  Mounted at {@code /edge-api/v1/network/*}; sessions enforce auth,
 *  policy enforced in {@link ug.ac.mak.der.security.SecurityConfig}. */
@RestController
@RequestMapping(path = "/edge-api/v1/network", produces = MediaType.APPLICATION_JSON_VALUE)
public class NetworkController {

    private final NetworkService svc;

    public NetworkController(final NetworkService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    /* ─── Status + diagnostics ──────────────────────────────────── */

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(toJson(svc.status()));
    }

    /* ─── Access Point ──────────────────────────────────────────── */

    @GetMapping("/access-point")
    public ResponseEntity<Map<String, Object>> accessPoint() {
        return ResponseEntity.ok(toJson(svc.accessPoint()));
    }

    @PostMapping("/ap/start")
    public ResponseEntity<Map<String, Object>> apStart(final Authentication auth) {
        return ResponseEntity.ok(Map.of("triggered", svc.startAp(actor(auth))));
    }
    @PostMapping("/ap/stop")
    public ResponseEntity<Map<String, Object>> apStop(final Authentication auth) {
        return ResponseEntity.ok(Map.of("triggered", svc.stopAp(actor(auth))));
    }
    @PostMapping("/ap/restart")
    public ResponseEntity<Map<String, Object>> apRestart(final Authentication auth) {
        return ResponseEntity.ok(Map.of("triggered", svc.restartAp(actor(auth))));
    }
    @PostMapping("/ap/rotate-key")
    public ResponseEntity<Map<String, Object>> apRotate(final Authentication auth) {
        return ResponseEntity.ok(Map.of("rotatedAt", svc.rotateApKey(actor(auth)).toString()));
    }
    @GetMapping("/ap/qr")
    public ResponseEntity<Map<String, Object>> apQr() {
        return ResponseEntity.ok(svc.enrolmentQr());
    }

    /* ─── Interfaces + routes ──────────────────────────────────── */

    @GetMapping("/interfaces")
    public ResponseEntity<Map<String, Object>> interfaces() {
        return ResponseEntity.ok(Map.of(
            "interfaces", svc.listInterfaces().stream()
                             .map(NetworkController::toJson).toList()));
    }

    @PostMapping(path = "/interfaces/{name}/state",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> ifaceState(
            final Authentication auth,
            @PathVariable final String name,
            @RequestBody final StateChange body) {
        if (body == null || body.state() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "STATE_REQUIRED", "message", "state=up|down required"));
        }
        final InterfaceState s = InterfaceState.valueOf(body.state());
        final boolean ok = svc.setInterfaceState(name, s, actor(auth));
        return ResponseEntity.ok(Map.of("state", s.name(), "applied", ok));
    }

    @GetMapping("/routes")
    public ResponseEntity<Map<String, Object>> routes() {
        return ResponseEntity.ok(Map.of(
            "routes", svc.listRoutes().stream()
                        .map(NetworkController::toJson).toList()));
    }

    /* ─── Clients ──────────────────────────────────────────────── */

    @GetMapping("/clients")
    public ResponseEntity<Map<String, Object>> clients() {
        return ResponseEntity.ok(Map.of(
            "clients", svc.listClients().stream()
                        .map(NetworkController::toJson).toList()));
    }

    @PostMapping(path = "/enroll", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> enrol(
            final Authentication auth,
            @RequestBody final EnrolBody body) {
        if (body == null || body.deviceId == null || body.ip == null) {
            return ResponseEntity.badRequest().body(err("DEVICE_ID_REQUIRED",
                "deviceId + ip required"));
        }
        final NetworkEntities.ClientLink link = body.link == null
            ? NetworkEntities.ClientLink.wifi
            : NetworkEntities.ClientLink.valueOf(body.link);
        final NetworkService.EnrolResult r = svc.enrolClient(body.deviceId, body.owner,
                                                              body.hostname, body.ip,
                                                              body.mac, link,
                                                              body.devicePublicKey);
        final Map<String, Object> m = new LinkedHashMap<>(toJson(r.client()));
        if (r.attestation() != null) {
            m.put("attestation", r.attestation().blob());
            m.put("attestationFingerprint", r.attestation().fingerprint());
            m.put("attestationIssuedAt", r.attestation().issuedAt().toString());
        }
        return ResponseEntity.status(201).body(m);
    }

    /** Phase N2 — trust-anchor material. Devices call this once at
     *  first contact to pin DER's internal CA public key, then verify
     *  the signed attestation returned by /enroll against it. */
    @GetMapping("/ca")
    public ResponseEntity<Map<String, Object>> ca() {
        return ResponseEntity.ok(svc.trustAnchor());
    }

    /* ─── Phase N2 — enrolment tokens ──────────────────────────── */

    @GetMapping("/enrol-tokens")
    public ResponseEntity<Map<String, Object>> listTokens() {
        return ResponseEntity.ok(Map.of("tokens", svc.listEnrolTokens()));
    }

    @PostMapping(path = "/enrol-tokens", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> issueToken(final Authentication auth,
                                                           @RequestBody(required = false) final TokenBody body) {
        final int ttl = body == null || body.ttlSeconds == null ? 1800 : body.ttlSeconds;
        final String hint = body == null ? null : body.deviceIdHint;
        final String tok = svc.issueEnrolToken(userId(auth), actor(auth), hint, ttl);
        return ResponseEntity.status(201).body(Map.of(
            "token", tok,
            "ttlSeconds", ttl,
            "deviceIdHint", hint == null ? "" : hint));
    }

    /* ─── DHCP lease ingestion (Phase N1) ──────────────────────── */

    @GetMapping("/leases/count")
    public ResponseEntity<Map<String, Object>> leaseCount() {
        return ResponseEntity.ok(Map.of("count", svc.leaseCount()));
    }

    @GetMapping("/leases")
    public ResponseEntity<Map<String, Object>> leases() {
        return ResponseEntity.ok(Map.of("leases", svc.listLeases()));
    }

    @PostMapping(path = "/leases", consumes = MediaType.APPLICATION_JSON_VALUE)
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> ingestLeases(
            final Authentication auth, @RequestBody final Map<String, Object> body) {
        if (body == null || !(body.get("leases") instanceof java.util.List<?> list)) {
            return ResponseEntity.badRequest().body(err("LEASES_REQUIRED", "leases[] required"));
        }
        final int applied = svc.syncLeases(
            (java.util.List<Map<String, Object>>) list);
        return ResponseEntity.ok(Map.of("applied", applied));
    }

    @PostMapping("/devices/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(final Authentication auth,
                                                        @PathVariable final String id) {
        final UUID actor = userId(auth);
        return svc.approveClient(id, actor)
            ? ResponseEntity.ok(Map.of("approved", true))
            : ResponseEntity.status(404).body(err("DEVICE_NOT_FOUND", id));
    }
    @PostMapping("/devices/{id}/revoke")
    public ResponseEntity<Map<String, Object>> revoke(final Authentication auth,
                                                       @PathVariable final String id) {
        return svc.revokeClient(id, userId(auth))
            ? ResponseEntity.ok(Map.of("revoked", true))
            : ResponseEntity.status(404).body(err("DEVICE_NOT_FOUND", id));
    }
    @PostMapping("/devices/{id}/block")
    public ResponseEntity<Map<String, Object>> block(final Authentication auth,
                                                      @PathVariable final String id) {
        return svc.blockClient(id, userId(auth))
            ? ResponseEntity.ok(Map.of("blocked", true))
            : ResponseEntity.status(404).body(err("DEVICE_NOT_FOUND", id));
    }
    @PostMapping("/devices/{id}/unblock")
    public ResponseEntity<Map<String, Object>> unblock(final Authentication auth,
                                                        @PathVariable final String id) {
        return svc.unblockClient(id, userId(auth))
            ? ResponseEntity.ok(Map.of("unblocked", true))
            : ResponseEntity.status(404).body(err("DEVICE_NOT_FOUND", id));
    }

    /* ─── Peers ────────────────────────────────────────────────── */

    @GetMapping("/peers")
    public ResponseEntity<Map<String, Object>> peers() {
        return ResponseEntity.ok(Map.of(
            "peers", svc.listPeers().stream()
                      .map(NetworkController::toJson).toList()));
    }
    @PostMapping(path = "/peers", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> addPeer(final Authentication auth,
                                                        @RequestBody final PeerBody body) {
        if (body == null || body.endpoint == null || body.publicKey == null) {
            return ResponseEntity.badRequest().body(err("PEER_FIELDS_REQUIRED",
                "endpoint + publicKey required"));
        }
        final UUID id = svc.addPeer(
            body.nodeId == null ? body.endpoint : body.nodeId,
            body.siteId, body.endpoint, body.publicKey,
            body.allowedIps == null ? "10.88.0.0/24" : body.allowedIps,
            userId(auth), actor(auth));
        return ResponseEntity.status(201).body(Map.of("id", id.toString()));
    }
    @PostMapping("/peers/{id}/connect")
    public ResponseEntity<Map<String, Object>> peerConnect(final Authentication auth,
                                                             @PathVariable final UUID id) {
        return svc.connectPeer(id, actor(auth))
            ? ResponseEntity.ok(Map.of("connected", true))
            : ResponseEntity.status(404).body(err("PEER_NOT_FOUND", id.toString()));
    }
    @DeleteMapping("/peers/{id}")
    public ResponseEntity<Map<String, Object>> peerDisconnect(final Authentication auth,
                                                                @PathVariable final UUID id) {
        return svc.disconnectPeer(id, actor(auth))
            ? ResponseEntity.ok(Map.of("disconnected", true))
            : ResponseEntity.status(404).body(err("PEER_NOT_FOUND", id.toString()));
    }
    @DeleteMapping("/peers/{id}/remove")
    public ResponseEntity<Map<String, Object>> peerRemove(final Authentication auth,
                                                            @PathVariable final UUID id) {
        return svc.removePeer(id, actor(auth))
            ? ResponseEntity.ok(Map.of("removed", true))
            : ResponseEntity.status(404).body(err("PEER_NOT_FOUND", id.toString()));
    }

    /* ─── Events + policy + settings ───────────────────────────── */

    @GetMapping("/events")
    public ResponseEntity<Map<String, Object>> events(
            @RequestParam(value = "limit", defaultValue = "50") final int limit) {
        return ResponseEntity.ok(Map.of(
            "events", svc.listEvents(limit).stream()
                       .map(NetworkController::toJson).toList()));
    }
    @DeleteMapping("/events")
    public ResponseEntity<Map<String, Object>> clearEvents(final Authentication auth) {
        return ResponseEntity.ok(Map.of("cleared", svc.clearEvents(actor(auth))));
    }

    @GetMapping("/policy")
    public ResponseEntity<Map<String, Object>> policy() {
        return ResponseEntity.ok(Map.of(
            "rules", svc.listRules().stream()
                      .map(NetworkController::toJson).toList()));
    }

    @PostMapping(path = "/policy", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> addRule(final Authentication auth,
                                                        @RequestBody final PolicyBody body) {
        if (body == null || body.sourceZone == null || body.destinationZone == null
                || body.action == null) {
            return ResponseEntity.badRequest().body(err("RULE_FIELDS_REQUIRED",
                "sourceZone + destinationZone + action required"));
        }
        final UUID id = svc.addRule(
            body.position == null ? 500 : body.position,
            body.sourceZone, body.destinationZone,
            NetworkEntities.PolicyAction.valueOf(body.action),
            body.note, userId(auth), actor(auth));
        return ResponseEntity.status(201).body(Map.of("id", id.toString()));
    }

    @PutMapping(path = "/policy/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> editRule(final Authentication auth,
                                                         @PathVariable final UUID id,
                                                         @RequestBody final PolicyBody body) {
        if (body == null || body.action == null) {
            return ResponseEntity.badRequest().body(err("ACTION_REQUIRED", "action required"));
        }
        return svc.editRule(id, NetworkEntities.PolicyAction.valueOf(body.action),
                             body.note, userId(auth), actor(auth))
            ? ResponseEntity.ok(Map.of("updated", true))
            : ResponseEntity.status(404).body(err("RULE_NOT_FOUND", id.toString()));
    }

    @DeleteMapping("/policy/{id}")
    public ResponseEntity<Map<String, Object>> deleteRule(final Authentication auth,
                                                           @PathVariable final UUID id) {
        return svc.deleteRule(id, actor(auth))
            ? ResponseEntity.ok(Map.of("deleted", true))
            : ResponseEntity.status(404).body(err("RULE_NOT_FOUND", id.toString()));
    }

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> settings() {
        return ResponseEntity.ok(Map.of("settings", svc.settings()));
    }
    @PutMapping(path = "/settings/{key}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> putSetting(
            final Authentication auth,
            @PathVariable final String key,
            @RequestBody final SettingBody body) {
        if (body == null || body.value() == null) {
            return ResponseEntity.badRequest().body(err("VALUE_REQUIRED", key));
        }
        svc.putSetting(key, body.value(), actor(auth));
        return ResponseEntity.ok(Map.of("key", key, "value", body.value()));
    }

    /* ─── Helpers ──────────────────────────────────────────────── */

    public record StateChange(String state) { }
    public record SettingBody(String value) { }

    /** Phase N2 — device self-enrol payload. Posted from the device
     *  after it joined DER-EDGE and loaded <code>https://der.local</code>.
     *  {@code devicePublicKey} is an Ed25519 X.509-encoded public key
     *  (Base64); when present, DER signs an attestation with the
     *  internal CA and returns the blob on the enrol response. */
    public static final class EnrolBody {
        public String deviceId;
        public String owner;
        public String hostname;
        public String ip;
        public String mac;
        public String link;
        public String devicePublicKey;
    }

    public static final class PeerBody {
        public String nodeId;
        public String siteId;
        public String endpoint;
        public String publicKey;
        public String allowedIps;
    }

    public static final class PolicyBody {
        public Integer position;
        public String sourceZone;
        public String destinationZone;
        public String action;
        public String note;
    }

    public static final class TokenBody {
        public Integer ttlSeconds;
        public String deviceIdHint;
    }

    private static String actor(final Authentication auth) {
        return auth != null ? auth.getName() : "anonymous";
    }
    private static UUID userId(final Authentication auth) {
        return auth instanceof EdgeUserPrincipal p ? p.userId() : null;
    }
    private static Map<String, Object> err(final String code, final String id) {
        return Map.of("code", code, "message", id + " not found");
    }

    private static Map<String, Object> toJson(final NetworkStatus s) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("state", s.state().name());
        m.put("localApAvailable", s.localApAvailable());
        m.put("localLanAvailable", s.localLanAvailable());
        m.put("internetAvailable", s.internetAvailable());
        m.put("centralDhis2Available", s.centralDhis2Available());
        m.put("dnsAvailable", s.dnsAvailable());
        m.put("gateway", s.gateway());
        m.put("subnet", s.subnet());
        m.put("hostname", s.hostname());
        m.put("lastProbeAt", s.lastProbeAt() == null ? null : s.lastProbeAt().toString());
        m.put("warnings", s.warnings());
        return m;
    }
    private static Map<String, Object> toJson(final AccessPointStatus a) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("running", a.running());
        m.put("enabled", a.enabled());
        m.put("interface", a.interfaceName());
        m.put("ssid", a.ssid());
        m.put("band", a.band());
        m.put("channel", a.channel());
        m.put("security", a.security());
        m.put("clients", a.clients());
        m.put("dhcpActive", a.dhcpActive());
        m.put("gateway", a.gateway());
        m.put("subnet", a.subnet());
        m.put("edgeId", a.edgeId());
        m.put("startedAt", a.startedAt() == null ? null : a.startedAt().toString());
        m.put("networkKeyRotatedAt",
              a.networkKeyRotatedAt() == null ? null : a.networkKeyRotatedAt().toString());
        return m;
    }
    private static Map<String, Object> toJson(final NetworkInterface i) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", i.name());
        m.put("kind", i.kind().name());
        m.put("state", i.state().name());
        m.put("purpose", i.purpose().wire);
        m.put("address", i.address());
        m.put("mac", i.mac());
        m.put("rxBytes", i.rxBytes());
        m.put("txBytes", i.txBytes());
        m.put("linkSpeed", i.linkSpeed());
        m.put("priority", i.priority());
        return m;
    }
    private static Map<String, Object> toJson(final NetworkRoute r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.id().toString());
        m.put("destination", r.destination());
        m.put("gateway", r.gateway());
        m.put("interface", r.interfaceName());
        m.put("metric", r.metric());
        m.put("source", r.source());
        m.put("active", r.active());
        return m;
    }
    private static Map<String, Object> toJson(final NetworkClient c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("deviceId", c.deviceId());
        m.put("derDeviceId", c.derDeviceId() == null ? null : c.derDeviceId().toString());
        m.put("owner", c.owner());
        m.put("hostname", c.hostname());
        m.put("ip", c.ip());
        m.put("mac", c.mac());
        m.put("link", c.link().name());
        m.put("signalDbm", c.signalDbm());
        m.put("trust", c.trust().name());
        m.put("certificateFingerprint", c.certificateFingerprint());
        m.put("bytesTx", c.bytesTx());
        m.put("bytesRx", c.bytesRx());
        m.put("firstSeenAt", c.firstSeenAt() == null ? null : c.firstSeenAt().toString());
        m.put("lastSeenAt",  c.lastSeenAt()  == null ? null : c.lastSeenAt().toString());
        m.put("approvedBy", c.approvedBy() == null ? null : c.approvedBy().toString());
        m.put("approvedAt", c.approvedAt() == null ? null : c.approvedAt().toString());
        m.put("revokedAt",  c.revokedAt()  == null ? null : c.revokedAt().toString());
        return m;
    }
    private static Map<String, Object> toJson(final NetworkPeer p) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id().toString());
        m.put("nodeId", p.nodeId());
        m.put("siteId", p.siteId());
        m.put("endpoint", p.endpoint());
        m.put("publicKey", p.publicKey());
        m.put("allowedIps", p.allowedIps());
        m.put("state", p.state().name());
        m.put("trust", p.trust().name());
        m.put("rxBytes", p.rxBytes());
        m.put("txBytes", p.txBytes());
        m.put("lastHandshake",
              p.lastHandshake() == null ? null : p.lastHandshake().toString());
        m.put("addedAt", p.addedAt() == null ? null : p.addedAt().toString());
        return m;
    }
    private static Map<String, Object> toJson(final NetworkEvent e) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("eventId", e.eventId().toString());
        m.put("eventType", e.eventType());
        m.put("outcome", e.outcome());
        m.put("deviceId", e.deviceId());
        m.put("nodeId", e.nodeId());
        m.put("interfaceName", e.interfaceName());
        m.put("actor", e.actor());
        m.put("reason", e.reason());
        m.put("correlationId", e.correlationId());
        m.put("observedAt", e.observedAt() == null ? null : e.observedAt().toString());
        return m;
    }
    private static Map<String, Object> toJson(final PolicyRule r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.id().toString());
        m.put("position", r.position());
        m.put("sourceZone", r.sourceZone());
        m.put("destinationZone", r.destinationZone());
        m.put("action", r.action().name());
        m.put("note", r.note());
        m.put("updatedAt", r.updatedAt() == null ? null : r.updatedAt().toString());
        return m;
    }

    @SuppressWarnings("unused")
    private static void silenceEnumImport(final NetworkEntities.ClientTrust x) { /* kept for autocomplete */ }
}
