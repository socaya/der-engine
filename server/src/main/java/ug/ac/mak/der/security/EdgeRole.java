package ug.ac.mak.der.security;

/**
 * Phase 02 role taxonomy. The {@code SYNC_WORKER} role is reserved for the
 * Phase 04 synchronisation worker and MUST NOT be grantable to interactive
 * users (DER-ENG-001 §8.3 Security invariants). Enforcement is in
 * {@link ug.ac.mak.der.security.PhaseGuards} once Phase 04 lands.
 */
public enum EdgeRole {
    ADMIN,
    OPERATOR,
    REVIEWER,
    SYNC_WORKER
}
