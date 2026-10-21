# Components, responsibilities and clean repository mapping

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

| Repository path | Owns | Must not own |
|---|---|---|
| `server/` | DER provisioning, orchestration, journal processing, conflicts, management API | Reimplementation of all DHIS2 business logic |
| `client/` | Supported DHIS2 workflow entry points, clear local/central status | Direct database writes or central-only normal operation |
| `admin-ui/` | System status, conflict review, configuration, security and evaluation screens | Credential storage in browser or unrestricted control |
| `database/` | DER-owned migrations and schema contracts | Unreviewed mutations of DHIS2 Core tables |
| `deployment/` | NGINX, systemd, provisioning, upgrade and rollback | Secret values committed to Git |
| `tests/` | Contract, integration, fault, performance, UI and security tests | Synthetic passes without real target integrations |
| `docs/` | Proposal-aligned specification and actual verification evidence | AI-specific instructions in distributable academic source |

## Responsibility isolation
Use explicit adapters (`Dhis2ApiClient`, `MetadataReader`, `JournalRepository`, `ConflictPolicy`, `SubmissionVerifier`), keep domain operations separate from HTTP controllers, and prefer immutable operation records. Use DB migrations with deterministic rollback/recovery strategy. Every shared DTO/version field must have compatibility tests. Keep module README files focused on actual maintenance guidance.

## Build and startup order
1. PostgreSQL/credentials/TLS trust. 2. Version-matched DHIS2 Core, tested separately. 3. DER database migrations and coordination service. 4. Frontend static builds. 5. Gateway routing and system health tests. 6. Seed synthetic workflow metadata. 7. WAN fault demonstration. All components are independently observable and restartable.
