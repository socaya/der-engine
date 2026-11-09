package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.composites.DomainCompositeRepository;

/** Composite-kind catalogue CRUD (spec §4). Admins register
 *  kinds like LAB_REQUEST / PRESCRIPTION / CARE_EPISODE — or any
 *  other composite semantics the facility needs — and the
 *  capture clients discover them at runtime via the read
 *  endpoint. Kind codes are stable identifiers; display_name +
 *  description + schemas are admin-editable configuration.
 *
 *  Read endpoint is open to any authenticated user so the
 *  capture app can populate its "+ New …" action rows. Write
 *  endpoints are ADMIN-only. */
@RestController
@RequestMapping(path = "/edge-api/v1/domain/composite-kinds",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DomainCompositeKindController {

    private final DomainCompositeRepository repo;

    public DomainCompositeKindController(
            final DomainCompositeRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("kinds",
                repo.listKinds().stream()
                    .map(DomainCompositeKindController::toJson).toList()));
    }

    @PutMapping(path = "/{code}",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> upsert(
            final Authentication authentication,
            @PathVariable("code") final String code,
            @RequestBody final KindRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.displayName() == null
                || body.displayName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "DISPLAY_NAME_REQUIRED",
                    "message", "displayName must not be blank"));
        }
        if (!code.matches("^[A-Z][A-Z0-9_]{0,63}$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "KIND_CODE_INVALID",
                    "message", "kind_code must be uppercase A-Z/0-9/_ "
                        + "starting with a letter, max 64 chars"));
        }
        repo.upsertKind(new DomainCompositeRepository.KindRow(
                code, body.displayName(), body.description(),
                body.headProgramStageUid(),
                body.itemProgramStageUid(),
                body.syncPolicy(),
                body.allowedStatuses()));
        return repo.findKind(code)
                .map(k -> ResponseEntity.ok(toJson(k)))
                .orElseGet(() -> ResponseEntity.status(500).build());
    }

    @DeleteMapping("/{code}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> softDelete(
            final Authentication authentication,
            @PathVariable("code") final String code) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.softDeleteKind(code);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("deleted", true,
                "kindCode", code));
    }

    private static Map<String, Object> toJson(
            final DomainCompositeRepository.KindRow k) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("kindCode", k.kindCode());
        out.put("displayName", k.displayName());
        if (k.description() != null) {
            out.put("description", k.description());
        }
        out.put("headProgramStageUid", k.headProgramStageUid());
        out.put("itemProgramStageUid", k.itemProgramStageUid());
        out.put("syncPolicy",
                k.syncPolicy() == null ? "EDGE_ONLY" : k.syncPolicy());
        // configurationComplete surfaces the admin-wiring status
        // in one place so the capture client can disable the
        // "+ New …" action for unbound kinds without re-deriving
        // the rule.
        out.put("configurationComplete",
                k.headProgramStageUid() != null);
        if (k.allowedStatuses() != null) {
            out.put("allowedStatuses", k.allowedStatuses());
        }
        return out;
    }

    public record KindRequest(
            @JsonProperty("displayName") String displayName,
            @JsonProperty("description") String description,
            @JsonProperty("headProgramStageUid")
                    String headProgramStageUid,
            @JsonProperty("itemProgramStageUid")
                    String itemProgramStageUid,
            @JsonProperty("syncPolicy") String syncPolicy,
            @JsonProperty("allowedStatuses") JsonNode allowedStatuses) { }
}
