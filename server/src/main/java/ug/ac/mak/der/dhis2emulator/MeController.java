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

import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgram;
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
    private final MetadataMirrorRepository mirror;

    public MeController(final ObjectProvider<OrgUnitBindingService> bindingProvider,
                            final MetadataMirrorRepository mirror) {
        this.bindingProvider = bindingProvider;
        this.mirror = mirror;
    }

    private List<Map<String, String>> programRefs() {
        final List<Map<String, String>> refs = new ArrayList<>();
        for (final MirroredProgram p : mirror.findAllPrograms()) {
            refs.add(Map.of("id", p.dhis2Uid()));
        }
        return refs;
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
        // DHIS2 central's /api/me returns a combined {@code name}
        // alongside {@code displayName}. @dhis2/ui's HeaderBar
        // text-avatar component reads {@code name} and calls
        // {@code name.split(' ')} unguarded, so a missing field
        // crashes the avatar render inside embedded DHIS2 apps
        // (eregisters 1.1.12, Capture 101.x). Mirror the field so
        // the avatar renders the user's initials without hitting
        // {@code Cannot read properties of undefined (reading
        // 'split')}.
        body.put("name", user.displayName());
        body.put("firstName", user.displayName());
        body.put("surname", "");
        body.put("email", "");
        body.put("authorities", toAuthorities(user));

        final OrgUnitBindingService svc = bindingProvider.getIfAvailable();
        final OrgUnitBindingService.EffectiveScope scope = svc == null
                ? null : svc.effectiveScopeFor(user.userId());
        final List<Map<String, Object>> ous = ouList(scope);
        // DHIS2 central ships each OU on /api/me with a {@code
        // programs: [{id}]} array listing the programs accessible
        // under that unit. eregisters' route guard
        // {@code require-programs.ts} walks every OU and reads
        // {@code unit.programs.length === 0}; an unset
        // {@code programs} throws {@code Cannot read properties of
        // undefined (reading 'length')} before the sync machine
        // can even boot. Attach the full mirrored-program list
        // (shallow id refs) to every OU so the guard sees non-empty.
        final List<Map<String, String>> programRefs = programRefs();
        for (final Map<String, Object> ou : ous) {
            ou.put("programs", programRefs);
        }
        body.put("organisationUnits", ous);
        body.put("dataViewOrganisationUnits", ous);
        body.put("teiSearchOrganisationUnits", ous);
        body.put("userGroups", List.<Object>of());
        body.put("userRoles", toUserRoles(user));
        body.put("settings", Map.<String, Object>of());
        body.put("derOrigin", user.origin().name());
        collectWarnings(svc, scope, body);
        return ResponseEntity.ok(body);
    }

    /**
     * FR-OU-005 — the OU array projection honours per-user scope
     * assignments. Order of precedence:
     * <ol>
     *   <li>Narrowed OU from a valid per-user assignment.</li>
     *   <li>Device-wide bound OU.</li>
     *   <li>Empty (edge unbound).</li>
     * </ol>
     */
    private static List<Map<String, Object>> ouList(
            final OrgUnitBindingService.EffectiveScope scope) {
        if (scope == null || scope.state()
                == OrgUnitBindingService.EffectiveScope.State.UNBOUND) {
            return List.of();
        }
        final Map<String, Object> ou = new LinkedHashMap<>();
        if (scope.state() == OrgUnitBindingService.EffectiveScope.State.SCOPE_ASSIGNED
                && scope.narrowedOu() != null) {
            ou.put("id", scope.narrowedOu().orgUnitId());
            ou.put("displayName", scope.narrowedOu().displayName());
            ou.put("path", scope.narrowedOu().path());
        } else {
            final EdgeOrgUnitBinding b = scope.binding();
            ou.put("id", b.orgUnitId());
            ou.put("displayName", b.orgUnitDisplayName());
            ou.put("path", b.orgUnitPath());
        }
        return List.of(ou);
    }

    /** Aggregate /api/me warnings: NO_OU_BOUND when unbound, plus
     *  SCOPE_ASSIGNMENT_OUT_OF_BOUND when the user has a stale
     *  per-user scope outside the current bound subtree. */
    private static void collectWarnings(final OrgUnitBindingService svc,
                                          final OrgUnitBindingService.EffectiveScope scope,
                                          final Map<String, Object> body) {
        if (svc == null) {
            return;
        }
        if (scope == null
                || scope.state() == OrgUnitBindingService.EffectiveScope.State.UNBOUND) {
            body.put("warnings", List.of("NO_OU_BOUND"));
            return;
        }
        if (scope.state()
                == OrgUnitBindingService.EffectiveScope.State.SCOPE_FALLS_OUTSIDE) {
            body.put("warnings", List.of("SCOPE_ASSIGNMENT_OUT_OF_BOUND"));
        }
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
