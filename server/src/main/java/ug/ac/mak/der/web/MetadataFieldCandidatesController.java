package ug.ac.mak.der.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * §2.3.22 — Field candidates for a workflow breakable (dataset
 * section, program stage, event program). The wizard calls this to
 * populate its per-step field-level selector so operators pick which
 * data elements the step captures + mark them REQUIRED / OPTIONAL
 * without ever seeing a UID.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/metadata/field-candidates",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataFieldCandidatesController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public MetadataFieldCandidatesController(final JdbcTemplate jdbc, final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam("kind") final String kind,
            @RequestParam("ref") final String ref) {
        if (kind == null || ref == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "KIND_REF_REQUIRED",
                "message", "kind + ref query params are required"));
        }
        final List<Map<String, Object>> fields = switch (kind) {
            case "PROGRAM_STAGE" -> stageFields(ref);
            case "PROGRAM_STAGE_SECTION" -> programStageSectionFields(ref);
            case "EVENT_INSTANCE" -> eventFields(ref);
            case "DATASET_SECTION" -> datasetSectionFields(ref);
            default -> List.of();
        };
        return ResponseEntity.ok(Map.of(
            "kind", kind, "ref", ref, "fields", fields));
    }

    /** Program stage → data elements with their compulsory flag.
     *  Joined through {@code metadata_program_stage_data_element}. */
    private List<Map<String, Object>> stageFields(final String stageUid) {
        return jdbc.query(
                "SELECT de.dhis2_uid, de.display_name, psde.compulsory, psde.sort_order "
                        + "FROM der.metadata_program_stage_data_element psde "
                        + "JOIN der.metadata_data_element de "
                        + "  ON de.dhis2_uid = psde.data_element_uid "
                        + "WHERE psde.program_stage_uid = ? "
                        + "ORDER BY COALESCE(psde.sort_order, 0), de.display_name",
                (rs, i) -> row(rs.getString(1), rs.getString(2), rs.getBoolean(3)),
                stageUid);
    }

    /** Event program → data elements. The DHIS2 model gives an event
     *  program a single implicit stage; look it up by program UID. */
    private List<Map<String, Object>> eventFields(final String programUid) {
        final List<String> stageUids = jdbc.queryForList(
                "SELECT dhis2_uid FROM der.metadata_program_stage "
                        + "WHERE program_uid = ? ORDER BY display_name",
                String.class, programUid);
        if (stageUids.isEmpty()) {
            return List.of();
        }
        return stageFields(stageUids.get(0));
    }

    /** Program-stage-section → walks the mirrored catalog payload for
     *  this section and extracts its {@code dataElements[]}. We fall
     *  back to the parent stage's data elements if the section itself
     *  does not carry an explicit element list. */
    private List<Map<String, Object>> programStageSectionFields(final String sectionUid) {
        final List<String> payloads = jdbc.queryForList(
                "SELECT payload::text FROM der.metadata_catalog_item "
                        + "WHERE resource = 'programStageSections' AND dhis2_uid = ?",
                String.class, sectionUid);
        if (payloads.isEmpty()) {
            return List.of();
        }
        final JsonNode root;
        try {
            root = mapper.readTree(payloads.get(0));
        } catch (JsonProcessingException ex) {
            return List.of();
        }
        final List<Map<String, Object>> out = new ArrayList<>();
        final JsonNode des = root.get("dataElements");
        if (des != null && des.isArray()) {
            for (final JsonNode de : des) {
                final String uid = de.path("id").asText(null);
                if (uid == null) {
                    continue;
                }
                final String name = de.path("displayName").asText(
                        de.path("name").asText(uid));
                out.add(row(uid, name, false));
            }
        }
        // Fallback: section without an explicit element list → inherit
        // the parent stage's elements so operators have something to pick.
        if (out.isEmpty()) {
            final String parentStageUid = root.path("programStage").path("id").asText(null);
            if (parentStageUid != null) {
                return stageFields(parentStageUid);
            }
        }
        return out;
    }

    /** Dataset section → walks the dataset payload's
     *  {@code sections[].dataElements[]} JSON and extracts the fields
     *  for the requested section UID. */
    private List<Map<String, Object>> datasetSectionFields(final String sectionUid) {
        final List<String> datasetPayloads = jdbc.queryForList(
                "SELECT payload::text FROM der.metadata_data_set",
                String.class);
        for (final String p : datasetPayloads) {
            final JsonNode root;
            try {
                root = mapper.readTree(p);
            } catch (JsonProcessingException ex) {
                continue;
            }
            final JsonNode sections = root.get("sections");
            if (sections == null || !sections.isArray()) {
                continue;
            }
            for (final JsonNode s : sections) {
                if (!sectionUid.equals(s.path("id").asText())) {
                    continue;
                }
                final List<Map<String, Object>> out = new ArrayList<>();
                final JsonNode des = s.get("dataElements");
                if (des != null && des.isArray()) {
                    for (final JsonNode de : des) {
                        final String uid = de.path("id").asText(null);
                        final String name = de.path("displayName").asText(
                                de.path("name").asText(uid));
                        if (uid != null) {
                            out.add(row(uid, name, false));
                        }
                    }
                }
                return out;
            }
        }
        return List.of();
    }

    private Map<String, Object> row(final String id, final String displayName, final boolean compulsory) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("displayName", displayName);
        m.put("compulsory", compulsory);
        return m;
    }
}
