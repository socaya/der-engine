# Threat model and security controls

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Assets and trust boundaries
Assets: user credentials, local/central record data, journal payloads, integration tokens, audit records, backup encryption keys and application configuration. Trust boundaries: untrusted client device -> LAN TLS gateway -> DHIS2/DER services -> PostgreSQL; DER service -> WAN -> central DHIS2.

## Priority threats and mitigations
| Threat | Control | Test evidence |
|---|---|---|
| Stolen edge device browser session | Short-lived sessions, secure cookies, logout, permission checks | Session expiry and stolen token tests |
| LAN interception/spoofed server | TLS, trust setup, secure local name resolution | Certificate and MITM-negative tests |
| Central revocation while disconnected | Bounded offline validity and documented fail-closed privileged actions | Permission drift scenario |
| Direct API privilege bypass | Endpoint-level RBAC and OU scope checks | Authz matrix, negative API tests |
| Journal manipulation/duplicate import | Immutable operation IDs, DB constraints, audit, safe replay | Integrity and replay tests |
| Worker secret leakage | Vault/file-permission secret management, redaction | Secrets scan and logs review |
| Malicious conflict resolution | Role separation, justification, immutable audit | Review-authorisation tests |
| Disk loss or corrupt backup | Verified backup/restore and encryption as needed | Recoverability drills |
| Unsafe upgrade | Tested migration, compatibility gate and rollback | Release rehearsals |

## Privacy stance
Use synthetic test records. Do not collect real patient information for Plan B experiments. Treat central organisation/user data as sensitive in operational deployments; configure access per organisational/legal policy. Keep service accounts least-privileged; rotate credentials and revoke on decommission.
