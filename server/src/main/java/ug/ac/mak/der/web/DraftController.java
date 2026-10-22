package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.drafts.Draft;
import ug.ac.mak.der.workflows.drafts.DraftRepository;

/** DC-17 server surface — the signed-in user's drafts. */
@RestController
@RequestMapping(path = "/edge-api/v1/drafts", produces = MediaType.APPLICATION_JSON_VALUE)
public class DraftController {

    private final DraftRepository drafts;

    public DraftController(final DraftRepository drafts) {
        this.drafts = Objects.requireNonNull(drafts, "drafts");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Draft> rows = drafts.findByOwner(principal.userId());
        return ResponseEntity.ok(Map.of("drafts", rows.stream().map(DraftController::toJson).toList()));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @RequestBody final SaveRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.kind() == null || body.kind().isBlank()
                || body.title() == null || body.title().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "kind + title required"));
        }
        final Draft existing = body.draftId() == null ? null
                : drafts.findById(body.draftId()).filter(d -> d.ownerId().equals(principal.userId()))
                        .orElse(null);
        final Draft toSave = existing == null
                ? DraftRepository.create(principal.userId(), body.kind(), body.title(),
                        body.payload())
                : new Draft(existing.draftId(), existing.ownerId(), body.kind(), body.title(),
                        body.payload(), existing.createdAt(), existing.updatedAt());
        return ResponseEntity.ok(toJson(drafts.upsert(toSave)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(final Authentication authentication,
                                         @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<Draft> row = drafts.findById(id);
        if (row.isEmpty() || !row.get().ownerId().equals(principal.userId())) {
            return ResponseEntity.notFound().build();
        }
        drafts.delete(id, principal.userId());
        return ResponseEntity.noContent().build();
    }

    private static Map<String, Object> toJson(final Draft d) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("draftId", d.draftId().toString());
        m.put("kind", d.kind());
        m.put("title", d.title());
        m.put("payload", d.payload());
        m.put("updatedAt", d.updatedAt().toString());
        return m;
    }

    public record SaveRequest(
            @JsonProperty("draftId") UUID draftId,
            @JsonProperty("kind") String kind,
            @JsonProperty("title") String title,
            @JsonProperty("payload") JsonNode payload
    ) { }
}
