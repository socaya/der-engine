package ug.ac.mak.der.dhis2emulator;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredDataElement;
import ug.ac.mak.der.metadata.MirroredDataSet;
import ug.ac.mak.der.metadata.MirroredOrganisationUnit;
import ug.ac.mak.der.metadata.MirroredProgram;
import ug.ac.mak.der.metadata.MirroredTrackedEntityType;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.web.TestSecurityConfig;

@WebMvcTest(MetadataListController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class MetadataListControllerTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired MockMvc mockMvc;
    @MockBean MetadataMirrorRepository mirror;

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private JsonNode node(final String uid, final String name) throws Exception {
        return MAPPER.readTree("{\"id\":\"" + uid + "\",\"displayName\":\"" + name + "\"}");
    }

    // -------- organisation units --------

    @Test
    void organisationUnitsListPagedShape() throws Exception {
        when(mirror.findAllOrganisationUnits()).thenReturn(List.of(
                new MirroredOrganisationUnit("a", "A", null, 1, null, node("a", "A")),
                new MirroredOrganisationUnit("b", "B", null, 1, null, node("b", "B"))
        ));
        mockMvc.perform(get("/api/organisationUnits?pageSize=1&page=2").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pager.page").value(2))
                .andExpect(jsonPath("$.pager.pageSize").value(1))
                .andExpect(jsonPath("$.pager.total").value(2))
                .andExpect(jsonPath("$.pager.pageCount").value(2))
                .andExpect(jsonPath("$.organisationUnits[0].id").value("b"));
    }

    @Test
    void organisationUnitsListClampsPageSizeFloorAndCeiling() throws Exception {
        when(mirror.findAllOrganisationUnits()).thenReturn(List.of());
        mockMvc.perform(get("/api/organisationUnits?pageSize=0&page=0").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pager.pageSize").value(1))
                .andExpect(jsonPath("$.pager.page").value(1));
        mockMvc.perform(get("/api/organisationUnits?pageSize=99999&page=1").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pager.pageSize").value(500));
    }

    @Test
    void organisationUnitByUidFound() throws Exception {
        when(mirror.findOrganisationUnit("a"))
                .thenReturn(Optional.of(new MirroredOrganisationUnit("a", "A", null, 1, null, node("a", "A"))));
        mockMvc.perform(get("/api/organisationUnits/a").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("a"));
    }

    @Test
    void organisationUnitByUidMissingIs404() throws Exception {
        when(mirror.findOrganisationUnit(anyString())).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/organisationUnits/zzz").with(as()))
                .andExpect(status().isNotFound());
    }

    @Test
    void organisationUnitAnonymousIs401() throws Exception {
        mockMvc.perform(get("/api/organisationUnits")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/organisationUnits/a")).andExpect(status().isUnauthorized());
    }

    // -------- data elements --------

    @Test
    void dataElementsEndpoints() throws Exception {
        when(mirror.findAllDataElements()).thenReturn(List.of(
                new MirroredDataElement("de", "DE", "NUMBER", "AGGREGATE", node("de", "DE"))));
        when(mirror.findDataElement("de")).thenReturn(Optional.of(
                new MirroredDataElement("de", "DE", "NUMBER", "AGGREGATE", node("de", "DE"))));
        mockMvc.perform(get("/api/dataElements").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataElements[0].id").value("de"));
        mockMvc.perform(get("/api/dataElements/de").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("de"));
        mockMvc.perform(get("/api/dataElements")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/dataElements/x")).andExpect(status().isUnauthorized());
    }

    // -------- data sets --------

    @Test
    void dataSetsEndpoints() throws Exception {
        when(mirror.findAllDataSets()).thenReturn(List.of(
                new MirroredDataSet("ds", "DS", "Monthly", node("ds", "DS"))));
        when(mirror.findDataSet("ds")).thenReturn(Optional.of(
                new MirroredDataSet("ds", "DS", "Monthly", node("ds", "DS"))));
        mockMvc.perform(get("/api/dataSets").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataSets[0].id").value("ds"));
        mockMvc.perform(get("/api/dataSets/ds").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("ds"));
        mockMvc.perform(get("/api/dataSets")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/dataSets/x")).andExpect(status().isUnauthorized());
    }

    // -------- programs --------

    @Test
    void programsEndpoints() throws Exception {
        when(mirror.findAllPrograms()).thenReturn(List.of(
                new MirroredProgram("p", "P", "WITH_REGISTRATION", "tet", node("p", "P"))));
        when(mirror.findProgram("p")).thenReturn(Optional.of(
                new MirroredProgram("p", "P", "WITH_REGISTRATION", "tet", node("p", "P"))));
        mockMvc.perform(get("/api/programs").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.programs[0].id").value("p"));
        mockMvc.perform(get("/api/programs/p").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("p"));
        mockMvc.perform(get("/api/programs")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/programs/x")).andExpect(status().isUnauthorized());
    }

    // -------- tracked entity types --------

    @Test
    void trackedEntityTypesEndpoints() throws Exception {
        when(mirror.findAllTrackedEntityTypes()).thenReturn(List.of(
                new MirroredTrackedEntityType("t", "T", node("t", "T"))));
        when(mirror.findTrackedEntityType("t")).thenReturn(Optional.of(
                new MirroredTrackedEntityType("t", "T", node("t", "T"))));
        mockMvc.perform(get("/api/trackedEntityTypes").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedEntityTypes[0].id").value("t"));
        mockMvc.perform(get("/api/trackedEntityTypes/t").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("t"));
        mockMvc.perform(get("/api/trackedEntityTypes")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/trackedEntityTypes/x")).andExpect(status().isUnauthorized());
    }
}
