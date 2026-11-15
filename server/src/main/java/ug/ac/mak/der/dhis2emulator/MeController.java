package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER's emulation of {@code GET /api/me}. Projects the resolved
 * {@link EdgeUserPrincipal} into DHIS2's Me shape.
 *
 * <p>DHIS2 app support (DER-APPS-DHIS2-001, FR-OU-001 / FR-OU-002):
 * when an OU binding exists, {@code organisationUnits},
 * {@code dataViewOrganisationUnits} and {@code teiSearchOrganisationUnits}
 * are populated with the bound OU so a DHIS2 app booting against DER
 * defaults to it without any OU-picker friction. When the appliance is
 * unbound, those arrays stay empty and the response carries
 * {@code warnings: ["NO_OU_BOUND"]}.</p>
 */
@RestController
@RequestMapping(path = "/api/me", produces = MediaType.APPLICATION_JSON_VALUE)
public class MeController {

    private final ObjectProvider<OrgUnitBindingService> bindingProvider;

    public MeController(final ObjectProvider<OrgUnitBindingService> bindingProvider) {
        this.bindingProvider = bindingProvider;
    }

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

        final OrgUnitBindingService svc = bindingProvider.getIfAvailable();
        final EdgeOrgUnitBinding binding = svc == null ? null : svc.current();
        final List<Map<String, Object>> ous = ouList(binding);
        body.put("organisationUnits", ous);
        body.put("dataViewOrganisationUnits", ous);
        body.put("teiSearchOrganisationUnits", ous);
        body.put("userGroups", List.<Object>of());
        body.put("userRoles", toUserRoles(user));
        body.put("settings", Map.<String, Object>of());
        body.put("derOrigin", user.origin().name());
        // FR-OU-002 — surface unbound state explicitly so DHIS2 apps that
        // honour the warning can show a message rather than silently
        // rendering an empty picker.
        if (svc != null && (binding == null || !binding.isBound())) {
            body.put("warnings", List.of("NO_OU_BOUND"));
        }
        return ResponseEntity.ok(body);
    }

    private static List<Map<String, Object>> ouList(final EdgeOrgUnitBinding binding) {
        if (binding == null || !binding.isBound()) {
            return List.of();
        }
        final Map<String, Object> ou = new LinkedHashMap<>();
        ou.put("id", binding.orgUnitId());
        ou.put("displayName", binding.orgUnitDisplayName());
        ou.put("path", binding.orgUnitPath());
        return List.of(ou);
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
