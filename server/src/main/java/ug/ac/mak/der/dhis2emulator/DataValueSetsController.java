package ug.ac.mak.der.dhis2emulator;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService.DataValueInput;

/**
 * DER's emulation of {@code POST /api/dataValueSets}.
 *
 * <p>Accepts the DHIS2 2.44 {@code dataValueSets} JSON envelope — a top-level
 * {@code dataValues} array where each element carries the full compound key
 * plus a value and optional comment. Values optionally share a dataset-level
 * {@code dataSet / orgUnit / period} default that per-row fields can
 * override; the controller flattens that into per-row inputs before passing
 * to {@link AggregateDataValueService}.</p>
 *
 * <p>Response shape is DHIS2 2.44's {@code ImportSummary} with
 * {@code status / imported / updated / ignored / importOptions / conflicts}
 * so stock DHIS2 clients receive what they expect.</p>
 */
@RestController
@RequestMapping(path = "/api/dataValueSets", produces = MediaType.APPLICATION_JSON_VALUE)
public class DataValueSetsController {

    private final AggregateDataValueService service;
    private final AggregateDataValueRepository values;
    private final Clock clock;

    public DataValueSetsController(final AggregateDataValueService service,
                                    final AggregateDataValueRepository values,
                                    final Clock clock) {
        this.service = service;
        this.values = values;
        this.clock = clock;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get(final Authentication authentication,
                                                    @RequestParam(name = "orgUnit", required = false) final String orgUnit,
                                                    @RequestParam(name = "period", required = false) final String period,
                                                    @RequestParam(name = "limit", defaultValue = "500") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<AggregateDataValue> rows = values.findByFilter(orgUnit, period, limit);
        final List<Map<String, Object>> dataValues = new java.util.ArrayList<>(rows.size());
        for (final AggregateDataValue v : rows) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("dataElement", v.dataElementUid());
            m.put("orgUnit", v.orgUnitUid());
            m.put("period", v.periodIso());
            m.put("categoryOptionCombo", v.categoryOptionComboUid());
            m.put("attributeOptionCombo", v.attributeOptionComboUid());
            m.put("value", v.valueText());
            m.put("stored_by", v.submittedBy().toString());
            m.put("lastUpdated", v.submittedAt().toString());
            dataValues.add(m);
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("dataValues", dataValues);
        body.put("derServerDate", Instant.now(clock).toString());
        return ResponseEntity.ok(body);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> post(@RequestBody final DataValueSetsRequest body,
                                                     final Authentication authentication,
                                                     final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        // Spring guarantees body != null for required @RequestBody; a missing or
        // malformed body produces 400 before this method is invoked.
        if (body.dataValues() == null || body.dataValues().isEmpty()) {
            return ResponseEntity.badRequest().body(summary(0, 0, List.of(
                    Map.of("object", "root", "value", "dataValues array is required"))));
        }
        final String defaultCoc = body.categoryOptionCombo() == null
                ? AggregateDataValue.DEFAULT_COC : body.categoryOptionCombo();
        final String defaultAoc = body.attributeOptionCombo() == null
                ? AggregateDataValue.DEFAULT_COC : body.attributeOptionCombo();
        final List<DataValueInput> inputs = new ArrayList<>(body.dataValues().size());
        for (final DataValueRow row : body.dataValues()) {
            inputs.add(new DataValueInput(
                    row.dataElement(),
                    row.orgUnit() != null ? row.orgUnit() : body.orgUnit(),
                    row.period() != null ? row.period() : body.period(),
                    row.categoryOptionCombo() != null ? row.categoryOptionCombo() : defaultCoc,
                    row.attributeOptionCombo() != null ? row.attributeOptionCombo() : defaultAoc,
                    row.value(),
                    row.comment()
            ));
        }
        final AggregateDataValueService.ImportSummary result = service.submit(
                inputs, principal.userId(),
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                http.getHeader("X-DER-Referral-Next-Hop")
        );

        final Instant now = Instant.now(clock);
        return ResponseEntity.ok(summary(result.imported(), result.ignored(),
                result.conflicts().stream()
                        .map(c -> {
                            final Map<String, Object> m = new LinkedHashMap<>();
                            m.put("object", c.key());
                            m.put("value", c.reason());
                            return m;
                        })
                        .toList(), now));
    }

    private static Map<String, Object> summary(final int imported, final int ignored,
                                                final List<Map<String, Object>> conflicts) {
        return summary(imported, ignored, conflicts, Instant.now());
    }

    private static Map<String, Object> summary(final int imported, final int ignored,
                                                final List<Map<String, Object>> conflicts,
                                                final Instant now) {
        final Map<String, Object> importCount = new LinkedHashMap<>();
        importCount.put("imported", imported);
        importCount.put("updated", 0);
        importCount.put("ignored", ignored);
        importCount.put("deleted", 0);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", conflicts.isEmpty() ? "SUCCESS" : "WARNING");
        body.put("importCount", importCount);
        body.put("conflicts", conflicts);
        body.put("dataSetComplete", false);
        body.put("responseType", "ImportSummary");
        body.put("derServerDate", now.toString());
        return body;
    }

    public record DataValueSetsRequest(
            @JsonProperty("dataSet") String dataSet,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("period") String period,
            @JsonProperty("categoryOptionCombo") String categoryOptionCombo,
            @JsonProperty("attributeOptionCombo") String attributeOptionCombo,
            @JsonProperty("dataValues") List<DataValueRow> dataValues
    ) { }

    public record DataValueRow(
            @JsonProperty("dataElement") String dataElement,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("period") String period,
            @JsonProperty("categoryOptionCombo") String categoryOptionCombo,
            @JsonProperty("attributeOptionCombo") String attributeOptionCombo,
            @JsonProperty("value") String value,
            @JsonProperty("comment") String comment
    ) { }
}
