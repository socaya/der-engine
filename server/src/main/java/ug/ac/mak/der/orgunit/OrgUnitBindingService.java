package ug.ac.mak.der.orgunit;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

/**
 * Reads + writes the edge-to-orgUnit binding. ADR-0015.
 */
@Service
@ConditionalOnBean(EdgeOrgUnitBindingRepository.class)
public class OrgUnitBindingService {

    private final EdgeOrgUnitBindingRepository repo;
    private final ObjectProvider<ScopeAssignmentRepository> scopesProvider;

    @Autowired
    public OrgUnitBindingService(final EdgeOrgUnitBindingRepository repo,
                                   final ObjectProvider<ScopeAssignmentRepository> scopesProvider) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.scopesProvider = scopesProvider;
    }

    /** Pre-FR-OU-005 convenience constructor — Phase 1+2 tests use
     *  this. Behaves as if no per-user scope override exists. */
    public OrgUnitBindingService(final EdgeOrgUnitBindingRepository repo) {
        this(repo, null);
    }

    public EdgeOrgUnitBinding current() {
        return repo.read();
    }

    /**
     * DER-APPS-DHIS2-001 FR-OU-005 — compute the effective OU scope
     * for a given user. Returns the per-user ORG_UNIT scope when it
     * exists AND falls under the current bound subtree; otherwise
     * falls back to the device-wide bound OU.
     *
     * <p>The three outcomes carry different semantics for
     * {@code /api/me}:
     * <ul>
     *   <li>{@link EffectiveScope.State#SCOPE_ASSIGNED} — user has a
     *     valid per-user scope narrower than the facility.</li>
     *   <li>{@link EffectiveScope.State#SCOPE_FALLS_OUTSIDE} — user
     *     has an assignment but it's no longer under the bound
     *     facility (e.g. device was rebound). {@code binding} wins;
     *     /api/me emits {@code SCOPE_ASSIGNMENT_OUT_OF_BOUND}.</li>
     *   <li>{@link EffectiveScope.State#NO_ASSIGNMENT} — just the
     *     device-wide bound OU.</li>
     * </ul>
     *
     * <p>When the edge is unbound the returned scope has the
     * {@link EffectiveScope#binding()} field empty and
     * {@link EffectiveScope.State#UNBOUND} state — caller handles.</p>
     */
    public EffectiveScope effectiveScopeFor(final UUID userId) {
        final EdgeOrgUnitBinding binding = repo.read();
        if (binding == null || !binding.isBound()) {
            return new EffectiveScope(EffectiveScope.State.UNBOUND,
                    EdgeOrgUnitBinding.empty(), null, null);
        }
        if (userId == null) {
            return new EffectiveScope(EffectiveScope.State.NO_ASSIGNMENT,
                    binding, null, null);
        }
        final ScopeAssignmentRepository scopes =
                scopesProvider == null ? null : scopesProvider.getIfAvailable();
        if (scopes == null) {
            return new EffectiveScope(EffectiveScope.State.NO_ASSIGNMENT,
                    binding, null, null);
        }
        final Optional<ScopeAssignmentRepository.Row> row =
                scopes.findOrgUnitScope(userId);
        if (row.isEmpty()) {
            return new EffectiveScope(EffectiveScope.State.NO_ASSIGNMENT,
                    binding, null, null);
        }
        final String scopeOuId = row.get().scopeRef();
        final String scopePath = repo.resolveOrgUnitPath(scopeOuId);
        if (scopePath == null
                || !repo.isUnderBoundSubtree(binding, scopePath)) {
            return new EffectiveScope(
                    EffectiveScope.State.SCOPE_FALLS_OUTSIDE,
                    binding, scopeOuId, null);
        }
        final String scopeDisplay = repo.resolveOrgUnitDisplayName(scopeOuId);
        return new EffectiveScope(EffectiveScope.State.SCOPE_ASSIGNED,
                binding, scopeOuId,
                new NarrowedOu(scopeOuId, scopeDisplay, scopePath));
    }

    /** Scope outcome for {@link #effectiveScopeFor}. */
    public record EffectiveScope(State state,
                                  EdgeOrgUnitBinding binding,
                                  String assignedOrgUnitId,
                                  NarrowedOu narrowedOu) {
        public enum State { UNBOUND, NO_ASSIGNMENT, SCOPE_ASSIGNED, SCOPE_FALLS_OUTSIDE }
    }

    /** Narrower-than-bound OU details for /api/me projection. */
    public record NarrowedOu(String orgUnitId, String displayName, String path) { }

    /**
     * Binds the edge to the given orgUnit, resolving displayName + path
     * from the metadata mirror. Returns the newly-written binding.
     *
     * <p>Pre-rebind data is not purged — the admin surface at EA-01
     * surfaces counts for operator triage before enabling writes under
     * the new OU. ADR-0015 §non-goals.</p>
     *
     * @throws IllegalArgumentException if {@code orgUnitId} is not in
     *     the mirror (central must sync the OU first).
     */
    public EdgeOrgUnitBinding bind(final String orgUnitId, final UUID actingUser) {
        if (orgUnitId == null || orgUnitId.isBlank()) {
            throw new IllegalArgumentException("orgUnitId required");
        }
        final String path = repo.resolveOrgUnitPath(orgUnitId);
        if (path == null) {
            throw new IllegalArgumentException(
                    "orgUnit " + orgUnitId + " is not in the local metadata mirror; "
                    + "run metadata sync against central first");
        }
        final String displayName = repo.resolveOrgUnitDisplayName(orgUnitId);
        final EdgeOrgUnitBinding b = EdgeOrgUnitBinding.bound(orgUnitId, displayName, path, actingUser);
        repo.write(b);
        return b;
    }

    /**
     * Returns {@code true} if the given candidate orgUnit (by id) is in
     * scope for the current binding (same OU, or a descendant up to the
     * configured max depth). Returns {@code false} if the edge is
     * unbound.
     */
    public boolean isInScope(final String candidateOrgUnitId, final int maxDepth) {
        if (candidateOrgUnitId == null || candidateOrgUnitId.isBlank()) {
            return false;
        }
        final EdgeOrgUnitBinding binding = repo.read();
        if (!binding.isBound()) {
            return false;
        }
        final String candidatePath = repo.resolveOrgUnitPath(candidateOrgUnitId);
        if (candidatePath == null) {
            return false;
        }
        if (!repo.isUnderBoundSubtree(binding, candidatePath)) {
            return false;
        }
        return relativeDepth(binding.orgUnitPath(), candidatePath) <= maxDepth;
    }

    static int relativeDepth(final String boundPath, final String candidatePath) {
        if (boundPath == null || candidatePath == null) {
            return Integer.MAX_VALUE;
        }
        if (!candidatePath.startsWith(boundPath)) {
            return Integer.MAX_VALUE;
        }
        if (candidatePath.equals(boundPath)) {
            return 0;
        }
        final String tail = candidatePath.substring(boundPath.length());
        int depth = 0;
        for (int i = 0; i < tail.length(); i++) {
            if (tail.charAt(i) == '/') {
                depth++;
            }
        }
        return depth;
    }
}
