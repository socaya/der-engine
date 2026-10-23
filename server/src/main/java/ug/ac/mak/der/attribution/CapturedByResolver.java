package ug.ac.mak.der.attribution;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

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

    public CapturedByResolver(final EdgeUserDhis2MappingRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
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
