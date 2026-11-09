package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.composites.DomainComposite;
import ug.ac.mak.der.workflows.composites.DomainCompositeItem;
import ug.ac.mak.der.workflows.composites.DomainCompositeRepository;

/** CRUD for composite DER_DOMAIN entities (spec §4). Operators
 *  create / update / soft-delete composites anchored on tracker
 *  events; the kind + schema come from the admin-curated
 *  catalogue (DomainCompositeKindController). Composites are
 *  DER-only — nothing here enqueues a journal entry. */
@RestController
@RequestMapping(path = "/edge-api/v1/domain/composites",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DomainCompositeController {

    private final DomainCompositeRepository repo;
    private final ObjectMapper json;
    private final Clock clock;

    public DomainCompositeController(
            final DomainCompositeRepository repo,
            final ObjectMapper json, final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.json = Objects.requireNonNull(json, "json");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication authentication,
            @RequestParam("anchorEventUid") final String anchorEventUid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (anchorEventUid == null || anchorEventUid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ANCHOR_REQUIRED",
                    "message", "anchorEventUid query param required"));
        }
        return ResponseEntity.ok(Map.of("composites",
                repo.findByAnchorEvent(anchorEventUid).stream()
                    .map(DomainCompositeController::toJson).toList()));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> get(
            final Authentication authentication,
            @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return repo.findById(uid)
                .map(c -> ResponseEntity.ok(toJson(c)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(
            final Authentication authentication,
            @RequestBody final CreateRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.compositeUid() == null
                || body.kindCode() == null
                || body.anchorEventUid() == null
                || body.anchorEnrollmentUid() == null
                || body.anchorTeiUid() == null
                || body.orgUnitUid() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "COMPOSITE_INVALID",
                    "message", "uid, kindCode, anchors + orgUnit required"));
        }
        // Kind must exist in the admin catalogue — otherwise the
        // FK would fail with a less-friendly error.
        if (repo.findKind(body.kindCode()).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "KIND_UNKNOWN",
                    "message", "kindCode " + body.kindCode()
                        + " is not registered in the catalogue"));
        }
        final Instant now = Instant.now(clock);
        final List<DomainCompositeItem> items = new ArrayList<>();
        if (body.items() != null) {
            int lineNo = 0;
            for (final ItemBody ib : body.items()) {
                if (ib == null || ib.itemUid() == null) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "ITEM_INVALID",
                            "message", "each item requires itemUid"));
                }
                items.add(new DomainCompositeItem(
                        ib.itemUid(), body.compositeUid(), lineNo++,
                        ib.itemPayload() == null
                            ? json.createObjectNode()
                            : ib.itemPayload(),
                        now, now));
            }
        }
        final DomainComposite c;
        try {
            c = new DomainComposite(body.compositeUid(), body.kindCode(),
                    body.anchorEventUid(), body.anchorEnrollmentUid(),
                    body.anchorTeiUid(), body.orgUnitUid(),
                    body.status() == null ? "DRAFT" : body.status(),
                    body.headPayload() == null
                        ? json.createObjectNode() : body.headPayload(),
                    items, principal.userId(), now, now, null, 1);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "COMPOSITE_INVALID",
                    "message", ex.getMessage()));
        }
        repo.insert(c);
        return ResponseEntity.ok(toJson(repo.findById(
                c.compositeUid()).orElse(c)));
    }

    @PutMapping(path = "/{uid}/head",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateHead(
            final Authentication authentication,
            @PathVariable("uid") final String uid,
            @RequestBody final UpdateHeadRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<DomainComposite> existing = repo.findById(uid);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String newStatus = body != null && body.status() != null
                ? body.status() : existing.get().status();
        final JsonNode newHead = body != null
                && body.headPayload() != null
                ? body.headPayload() : existing.get().headPayload();
        repo.updateHead(uid, newStatus, newHead, Instant.now(clock));
        return repo.findById(uid)
                .map(c -> ResponseEntity.ok(toJson(c)))
                .orElseGet(() -> ResponseEntity.status(500).build());
    }

    @PutMapping(path = "/{uid}/items",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> replaceItems(
            final Authentication authentication,
            @PathVariable("uid") final String uid,
            @RequestBody final ReplaceItemsRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (repo.findById(uid).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Instant now = Instant.now(clock);
        final List<DomainCompositeItem> items = new ArrayList<>();
        if (body != null && body.items() != null) {
            int lineNo = 0;
            for (final ItemBody ib : body.items()) {
                if (ib == null || ib.itemUid() == null) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "ITEM_INVALID",
                            "message", "each item requires itemUid"));
                }
                items.add(new DomainCompositeItem(
                        ib.itemUid(), uid, lineNo++,
                        ib.itemPayload() == null
                            ? json.createObjectNode()
                            : ib.itemPayload(),
                        now, now));
            }
        }
        repo.replaceItems(uid, items, now);
        return repo.findById(uid)
                .map(c -> ResponseEntity.ok(toJson(c)))
                .orElseGet(() -> ResponseEntity.status(500).build());
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> softDelete(
            final Authentication authentication,
            @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.softDelete(uid, Instant.now(clock));
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("deleted", true,
                "compositeUid", uid));
    }

    private static Map<String, Object> toJson(final DomainComposite c) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("compositeUid", c.compositeUid());
        out.put("kindCode", c.kindCode());
        out.put("anchorEventUid", c.anchorEventUid());
        out.put("anchorEnrollmentUid", c.anchorEnrollmentUid());
        out.put("anchorTeiUid", c.anchorTeiUid());
        out.put("orgUnitUid", c.orgUnitUid());
        out.put("status", c.status());
        out.put("headPayload", c.headPayload());
        out.put("items", c.items().stream().map(it -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("itemUid", it.itemUid());
            m.put("lineNo", it.lineNo());
            m.put("itemPayload", it.itemPayload());
            m.put("updatedAt", it.updatedAt().toString());
            return m;
        }).toList());
        out.put("createdBy", c.createdBy().toString());
        out.put("createdAt", c.createdAt().toString());
        out.put("updatedAt", c.updatedAt().toString());
        out.put("version", c.version());
        return out;
    }

    public record CreateRequest(
            @JsonProperty("compositeUid") String compositeUid,
            @JsonProperty("kindCode") String kindCode,
            @JsonProperty("anchorEventUid") String anchorEventUid,
            @JsonProperty("anchorEnrollmentUid") String anchorEnrollmentUid,
            @JsonProperty("anchorTeiUid") String anchorTeiUid,
            @JsonProperty("orgUnitUid") String orgUnitUid,
            @JsonProperty("status") String status,
            @JsonProperty("headPayload") JsonNode headPayload,
            @JsonProperty("items") List<ItemBody> items) { }

    public record UpdateHeadRequest(
            @JsonProperty("status") String status,
            @JsonProperty("headPayload") JsonNode headPayload) { }

    public record ReplaceItemsRequest(
            @JsonProperty("items") List<ItemBody> items) { }

    public record ItemBody(
            @JsonProperty("itemUid") String itemUid,
            @JsonProperty("itemPayload") JsonNode itemPayload) { }

}
