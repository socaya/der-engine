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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.messaging.WebRtcSignallingService;

/** §1 WebRTC signalling broker. Devices exchange SDP + ICE here,
 *  then stream data channels / audio / video peer-to-peer. */
@RestController
@RequestMapping(path = "/edge-api/v1/webrtc", produces = MediaType.APPLICATION_JSON_VALUE)
public class WebRtcController {

    private final WebRtcSignallingService svc;

    public WebRtcController(final WebRtcSignallingService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @PostMapping(path = "/offer", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> offer(@RequestBody final OfferBody body) {
        if (body == null || body.initiatorDevice == null
                || body.responderDevice == null || body.sdpOffer == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "initiatorDevice + responderDevice + sdpOffer required"));
        }
        final UUID id = svc.offer(body.initiatorDevice, body.responderDevice,
                                    body.sdpOffer, body.kind);
        return ResponseEntity.status(201).body(Map.of("sessionId", id.toString()));
    }

    @PostMapping(path = "/{sessionId}/answer", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> answer(@PathVariable final UUID sessionId,
                                                        @RequestBody final AnswerBody body) {
        if (body == null || body.sdpAnswer == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "ANSWER_REQUIRED", "message", "sdpAnswer required"));
        }
        return svc.answer(sessionId, body.sdpAnswer)
            ? ResponseEntity.ok(Map.of("accepted", true))
            : ResponseEntity.status(404).body(Map.of(
                "code", "SESSION_NOT_OPEN", "message", "no OFFERED session with that id"));
    }

    @PostMapping("/{sessionId}/complete")
    public ResponseEntity<Map<String, Object>> complete(@PathVariable final UUID sessionId) {
        return svc.complete(sessionId)
            ? ResponseEntity.ok(Map.of("completed", true))
            : ResponseEntity.status(404).body(Map.of(
                "code", "SESSION_NOT_ANSWERED", "message", "no ANSWERED session"));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable final UUID sessionId) {
        return svc.findSession(sessionId)
            .<ResponseEntity<Map<String, Object>>>map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                "code", "SESSION_NOT_FOUND", "message", "no session")));
    }

    @GetMapping("/pending")
    public ResponseEntity<Map<String, Object>> pending(@RequestParam final String deviceId) {
        return ResponseEntity.ok(Map.of("sessions", svc.pendingFor(deviceId)));
    }

    @GetMapping("/sessions")
    public ResponseEntity<Map<String, Object>> recent(
            @RequestParam(value = "limit", defaultValue = "25") final int limit) {
        return ResponseEntity.ok(Map.of("sessions", svc.recentSessions(limit)));
    }

    @PostMapping(path = "/{sessionId}/ice", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> addIce(@PathVariable final UUID sessionId,
                                                        @RequestBody final IceBody body) {
        if (body == null || body.fromDevice == null || body.candidate == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "CANDIDATE_REQUIRED",
                "message", "fromDevice + candidate required"));
        }
        final long id = svc.addIceCandidate(sessionId, body.fromDevice,
                                             body.candidate, body.sdpMid, body.sdpMLineIndex);
        return ResponseEntity.status(201).body(Map.of("candidateId", id));
    }

    @GetMapping("/{sessionId}/ice")
    public ResponseEntity<Map<String, Object>> listIce(@PathVariable final UUID sessionId,
                                                         @RequestParam final String deviceId,
                                                         @RequestParam(value = "since", defaultValue = "0") final long since) {
        return ResponseEntity.ok(Map.of(
            "candidates", svc.iceCandidatesFor(sessionId, deviceId, since)));
    }

    public static final class OfferBody {
        public String initiatorDevice;
        public String responderDevice;
        public String sdpOffer;
        public String kind;
    }
    public static final class AnswerBody {
        public String sdpAnswer;
    }
    public static final class IceBody {
        public String fromDevice;
        public String candidate;
        public String sdpMid;
        public Integer sdpMLineIndex;
    }
}
