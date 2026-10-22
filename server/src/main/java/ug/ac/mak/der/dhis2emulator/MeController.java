package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER's emulation of {@code GET /api/me}. Projects the resolved
 * {@link EdgeUserPrincipal} into DHIS2's Me shape. Phase 03b fills the
 * mandatory fields the {@code @dhis2/app-runtime} boot path reads
 * ({@code id}, {@code username}, {@code displayName}, {@code authorities},
 * {@code organisationUnits}); scope + preferences come in Phase 03.5 when
 * {@code scope_assignment} starts being populated.
 */
@RestController
@RequestMapping(path = "/api/me", produces = MediaType.APPLICATION_JSON_VALUE)
public class MeController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> me(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final EdgeUser user = principal.user();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", user.userId().toString());
        body.put("username", user.username());
        body.put("displayName", user.displayName());
        body.put("firstName", user.displayName());
        body.put("surname", "");
        body.put("email", "");
        body.put("authorities", toAuthorities(user));
        body.put("organisationUnits", List.<Object>of());
        body.put("dataViewOrganisationUnits", List.<Object>of());
        body.put("teiSearchOrganisationUnits", List.<Object>of());
        body.put("userGroups", List.<Object>of());
        body.put("userRoles", toUserRoles(user));
        body.put("settings", Map.<String, Object>of());
        body.put("derOrigin", user.origin().name());
        return ResponseEntity.ok(body);
    }

    private static List<String> toAuthorities(final EdgeUser user) {
        final List<String> auths = new ArrayList<>();
        for (final var r : user.roles()) {
            // DHIS2 authorities are role strings; mirror the DER ROLE_ scheme.
            auths.add("DER_" + r.name());
        }
        return auths;
    }

    private static List<Map<String, Object>> toUserRoles(final EdgeUser user) {
        final List<Map<String, Object>> roles = new ArrayList<>();
        for (final var r : user.roles()) {
            final Map<String, Object> role = new LinkedHashMap<>();
            role.put("id", "DER-ROLE-" + r.name());
            role.put("displayName", r.name());
            roles.add(role);
        }
        return roles;
    }
}
