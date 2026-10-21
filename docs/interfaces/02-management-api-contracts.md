# Edge management API (proposed, DER-owned)

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

These endpoints are **planned application-owned contracts**, not existing DHIS2 URLs. Prefix example `/edge-api/v1`. All requests require appropriate scoped access and explicit error/validation schemas.

| Endpoint | Methods | Semantics |
|---|---|---|
| `/system` | GET | health, build version, edge identity, DHIS2 compatibility status |
| `/connectivity` | GET | LAN service status, central probe, last verified exchange |
| `/bootstrap` | GET, POST | status and guarded site bootstrap |
| `/metadata/status` | GET | fingerprints, dependencies, drift, last refresh |
| `/sync` | GET | queue counts and worker status |
| `/sync/operations` | GET | filterable journal entries; redact sensitive payloads |
| `/sync/operations/{id}` | GET | immutable identity, state, attempts and central result |
| `/sync/control` | POST | pause/resume/retry with role checks and reason |
| `/conflicts` | GET | filtered unresolved/reviewed cases |
| `/conflicts/{id}` | GET | local/central comparison and policy evaluation |
| `/conflicts/{id}/resolve` | POST | concurrency guarded, audit resolution |
| `/audit` | GET | access-controlled security/operational audit |
| `/backups` | GET, POST | backup inventory and approved backup request |
| `/metrics` | GET | operational measurements, restricted as appropriate |

## Common HTTP rules
- Correlation ID required in response; server-generated if absent.
- RFC 7807-style problem detail for invalid/forbidden/conflict results; do not reveal secrets.
- Cursor pagination for journals; stable order and documented UTC timestamps.
- POST administrative changes require authorisation, audit record and idempotency where operations can be replayed.
- Health endpoint distinguishes liveness from readiness; system healthy **does not** imply central connectivity.
- OpenAPI specification should be generated from implemented contracts, compared against this design and included in release evidence.
