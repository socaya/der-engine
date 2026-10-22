package ug.ac.mak.der.web;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.ActivityService;

/**
 * Phase 03 recent-activity feed for DC-04 "Recent work". Returns rows the
 * current user is the actor of, drawn from {@code security_audit}.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/activity", produces = MediaType.APPLICATION_JSON_VALUE)
public class ActivityController {

    private final ActivityService activity;

    public ActivityController(final ActivityService activity) {
        this.activity = activity;
    }

    @GetMapping("/recent")
    public ResponseEntity<RecentActivityResponse> recent(
            final Authentication authentication,
            @RequestParam(name = "limit", defaultValue = "20") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Entry> entries = activity.recentForUser(principal.userId(), limit).stream()
                .map(Entry::of)
                .toList();
        return ResponseEntity.ok(new RecentActivityResponse(entries));
    }

    public record RecentActivityResponse(@JsonProperty("entries") List<Entry> entries) { }

    public record Entry(
            @JsonProperty("auditId") long auditId,
            @JsonProperty("eventType") String eventType,
            @JsonProperty("outcome") String outcome,
            @JsonProperty("observedAt") String observedAt
    ) {
        static Entry of(final ActivityService.ActivityEntry e) {
            return new Entry(e.auditId(), e.eventType(), e.outcome(), e.observedAt().toString());
        }
    }
}
