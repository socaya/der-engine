package ug.ac.mak.der.orgunit;

import java.util.Objects;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

/**
 * Reads + writes the edge-to-orgUnit binding. ADR-0015.
 */
@Service
@ConditionalOnBean(EdgeOrgUnitBindingRepository.class)
public class OrgUnitBindingService {

    private final EdgeOrgUnitBindingRepository repo;

    public OrgUnitBindingService(final EdgeOrgUnitBindingRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    public EdgeOrgUnitBinding current() {
        return repo.read();
    }

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
