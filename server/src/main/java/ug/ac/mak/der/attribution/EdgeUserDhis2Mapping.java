package ug.ac.mak.der.attribution;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * ADR-0032: maps an edge user to a DHIS2 central user so that
 * captured data can be attributed to the actual device user via
 * the DHIS2 {@code storedBy} field on outbound submissions.
 *
 * <p>V088 extends the record with per-mapping service credentials
 * used by the data-push worker:</p>
 * <ul>
 *   <li>{@link #authType()} — {@code TOKEN} (PAT) or {@code BASIC}
 *       (password).  {@code null} means inherit the system default
 *       stored under
 *       {@code admin_setting['dhis2.user_credentials.default_auth_type']}.</li>
 *   <li>{@link #credentialCipher()} — the secret sealed with
 *       {@link ug.ac.mak.der.security.SecretEnvelope}.  Never leaves
 *       the server in cleartext; API responses expose only
 *       {@link #hasCredential()}.</li>
 * </ul>
 */
public record EdgeUserDhis2Mapping(
        UUID edgeUserId,
        String dhis2UserUid,
        String dhis2Username,
        String dhis2DisplayName,
        Instant mappedAt,
        UUID mappedBy,
        Instant lastVerifiedAt,
        AuthType authType,
        String credentialCipher,
        Instant credentialSetAt,
        UUID credentialSetBy) {

    public enum AuthType { TOKEN, BASIC }

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

    /** Legacy 7-arg constructor — keeps existing callers compiling. */
    public EdgeUserDhis2Mapping(final UUID edgeUserId, final String dhis2UserUid,
                                 final String dhis2Username, final String dhis2DisplayName,
                                 final Instant mappedAt, final UUID mappedBy,
                                 final Instant lastVerifiedAt) {
        this(edgeUserId, dhis2UserUid, dhis2Username, dhis2DisplayName,
                mappedAt, mappedBy, lastVerifiedAt,
                null, null, null, null);
    }

    public boolean hasCredential() {
        return credentialCipher != null && !credentialCipher.isBlank();
    }
}
