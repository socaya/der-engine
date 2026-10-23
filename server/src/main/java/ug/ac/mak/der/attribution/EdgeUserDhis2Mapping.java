package ug.ac.mak.der.attribution;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * ADR-0032: maps an edge user to a DHIS2 central user so that
 * captured data can be attributed to the actual device user via
 * the DHIS2 {@code storedBy} field on outbound submissions.
 */
public record EdgeUserDhis2Mapping(
        UUID edgeUserId,
        String dhis2UserUid,
        String dhis2Username,
        String dhis2DisplayName,
        Instant mappedAt,
        UUID mappedBy,
        Instant lastVerifiedAt) {

    public EdgeUserDhis2Mapping {
        Objects.requireNonNull(edgeUserId, "edgeUserId");
        Objects.requireNonNull(dhis2UserUid, "dhis2UserUid");
        Objects.requireNonNull(dhis2Username, "dhis2Username");
        Objects.requireNonNull(mappedAt, "mappedAt");
        Objects.requireNonNull(mappedBy, "mappedBy");
        if (!dhis2UserUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException(
                    "dhis2UserUid must be 11-char DHIS2 UID format");
        }
    }
}
