package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class SchemasControllerTest {

    private final SchemasController ctl = new SchemasController();

    private static MockHttpServletRequest req() {
        final MockHttpServletRequest r = new MockHttpServletRequest("GET",
                "/api/schemas");
        r.setScheme("http");
        r.setServerName("localhost");
        r.setServerPort(8085);
        return r;
    }

    @Test
    @SuppressWarnings("unchecked")
    void listReturnsAllMirroredSchemas() {
        final ResponseEntity<Map<String, Object>> res = ctl.list(req());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        final List<Map<String, Object>> schemas =
                (List<Map<String, Object>>) res.getBody().get("schemas");
        // The FR calls out dataElement + program + organisationUnit +
        // categoryCombo as the floor. All four must be present.
        final List<String> singulars = schemas.stream()
                .map(s -> (String) s.get("singular")).toList();
        assertThat(singulars).contains("dataElement", "program",
                "organisationUnit", "categoryCombo");
        // DER's registry currently lists 10 types — tracks the real
        // metadata surface served by MetadataListController.
        assertThat(schemas).hasSize(10);
    }

    @Test
    @SuppressWarnings("unchecked")
    void singleSchemaReturnsPropertiesAndHref() {
        final ResponseEntity<Map<String, Object>> res = ctl.one("dataElement", req());
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        final Map<String, Object> m = res.getBody();
        assertThat(m).containsEntry("singular", "dataElement");
        assertThat(m).containsEntry("plural", "dataElements");
        assertThat(m.get("klass")).isEqualTo("org.hisp.dhis.dataelement.DataElement");
        assertThat((String) m.get("href"))
                .isEqualTo("http://localhost:8085/api/schemas/dataElement");
        // Identifiable base ought to be there — id, name, created, etc.
        final List<Map<String, Object>> props =
                (List<Map<String, Object>>) m.get("properties");
        final List<String> names = props.stream()
                .map(p -> (String) p.get("name")).toList();
        assertThat(names).contains("id", "name", "displayName", "created",
                "lastUpdated", "valueType", "categoryCombo");
        // id maps to the uid column.
        final Map<String, Object> id = props.stream()
                .filter(p -> "id".equals(p.get("name"))).findFirst().orElseThrow();
        assertThat(id).containsEntry("fieldName", "uid");
        assertThat(id).containsEntry("unique", true);
        assertThat(id).containsEntry("required", true);
    }

    @Test
    void unmirroredSchemaReturnsFrEmu007Envelope() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.one("dataApprovalWorkflow", req());
        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(res.getBody()).containsEntry("code", "EMULATOR_NOT_IMPLEMENTED");
        assertThat(res.getBody()).containsEntry("endpoint",
                "/api/schemas/dataApprovalWorkflow");
    }

    @Test
    void propertyPortableValueTypesPresent() {
        // Spot-check that references + collections render with the
        // right propertyType so apps can distinguish them from scalars.
        final ResponseEntity<Map<String, Object>> res = ctl.one("program", req());
        @SuppressWarnings("unchecked")
        final List<Map<String, Object>> props =
                (List<Map<String, Object>>) res.getBody().get("properties");
        assertThat(props.stream()
                .filter(p -> "trackedEntityType".equals(p.get("name")))
                .findFirst().orElseThrow())
                .containsEntry("propertyType", "REFERENCE");
        assertThat(props.stream()
                .filter(p -> "programStages".equals(p.get("name")))
                .findFirst().orElseThrow())
                .containsEntry("propertyType", "COLLECTION");
    }

    @Test
    void hrefRespectsHttpsScheme() {
        final MockHttpServletRequest r = new MockHttpServletRequest(
                "GET", "/api/schemas");
        r.setScheme("https");
        r.setServerName("der.example.org");
        r.setServerPort(443);
        final ResponseEntity<Map<String, Object>> res = ctl.one("program", r);
        assertThat((String) res.getBody().get("href"))
                .isEqualTo("https://der.example.org/api/schemas/program");
    }

    @Test
    void displayNameIsHumanised() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.one("trackedEntityAttribute", req());
        assertThat(res.getBody()).containsEntry("displayName",
                "Tracked entity attribute");
    }
}
