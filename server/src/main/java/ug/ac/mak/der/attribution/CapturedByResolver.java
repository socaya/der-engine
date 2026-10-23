package ug.ac.mak.der.attribution;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * ADR-0032: resolves the DHIS2 {@code storedBy} value for a given
 * edge user. Used by {@code JournalPublisher} at enqueue + drain
 * time, and by any controller that needs to tag records with the
 * actual captor (not the service account) before persistence.
 *
 * <p>Resolution order:
 * <ol>
 *   <li>Look up the edge user in {@code edge_user_dhis2_mapping}.</li>
 *   <li>If found, return the DHIS2 username (what {@code storedBy}
 *     accepts).</li>
 *   <li>If not found, return {@link Optional#empty()} — callers decide
 *     whether to proceed with the service account (lenient) or reject
 *     the drain with {@code USER_NOT_MAPPED} (strict).</li>
 * </ol>
 */
@Service
public class CapturedByResolver {

    private final EdgeUserDhis2MappingRepository repo;
    private final boolean strict;

    @Autowired
    public CapturedByResolver(final EdgeUserDhis2MappingRepository repo,
                                @Value("${der.attribution.strict:false}") final boolean strict) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.strict = strict;
    }

    public CapturedByResolver(final EdgeUserDhis2MappingRepository repo) {
        this(repo, false);
    }

    /** ADR-0032: when strict, drains without a mapping must fail. */
    public boolean isStrict() {
        return strict;
    }

    /**
     * Enforcement helper: throws {@link UserNotMappedException} when
     * strict mode is on and no mapping exists; returns the username
     * otherwise (empty when lenient and no mapping).
     */
    public Optional<String> enforcedStoredByFor(final UUID edgeUserId) {
        final Optional<String> mapped = storedByFor(edgeUserId);
        if (mapped.isEmpty() && strict && edgeUserId != null) {
            throw new UserNotMappedException(edgeUserId);
        }
        return mapped;
    }

    public static final class UserNotMappedException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final UUID edgeUserId;

        public UserNotMappedException(final UUID edgeUserId) {
            super("USER_NOT_MAPPED: edge user " + edgeUserId
                    + " has no DHIS2 mapping; strict attribution rejects drain");
            this.edgeUserId = edgeUserId;
        }

        public UUID edgeUserId() {
            return edgeUserId;
        }
    }

    public Optional<String> storedByFor(final UUID edgeUserId) {
        if (edgeUserId == null) {
            return Optional.empty();
        }
        return repo.findByEdgeUser(edgeUserId)
                .map(EdgeUserDhis2Mapping::dhis2Username);
    }

    public Optional<String> capturedByUidFor(final UUID edgeUserId) {
        if (edgeUserId == null) {
            return Optional.empty();
        }
        return repo.findByEdgeUser(edgeUserId)
                .map(EdgeUserDhis2Mapping::dhis2UserUid);
    }

    public Optional<EdgeUserDhis2Mapping> currentMappingFor(final UUID edgeUserId) {
        if (edgeUserId == null) {
            return Optional.empty();
        }
        return repo.findByEdgeUser(edgeUserId);
    }
}
