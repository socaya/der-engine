# DER — System documentation index

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

This is the authoritative design documentation package for the academic DER prototype. It belongs in the repository under `docs/`; filenames and links are relative to that folder. Read the [project charter](project/01-project-charter.md), [scope baseline](project/02-scope-and-change-control.md), [architecture](architecture/01-system-architecture.md), then the [full FR catalogue](requirements/functional-requirements.md) and [NFR catalogue](requirements/non-functional-requirements.md).

| Area | Documents | Why it matters |
|---|---|---|
| Project | Charter, scope, glossary, decisions | Keeps implementation aligned with the proposal |
| Requirements | Complete FR/NFR catalogues, mappings, use cases | Defines exactly what must be built and tested |
| Architecture | Components, state machine, data design, compatibility | Resolves boundaries and distributed-systems semantics |
| Interfaces | APIs, metadata and identity contracts | Prevents implicit assumptions about DHIS2 2.43+ |
| UI | Design system and 54 individual screen specifications | Provides implementation-level client/admin requirements |
| Security | Threat model, access policies | Protects data in disconnected operation |
| Operations | Install, monitor, backup, recovery, upgrade | Makes runtime operable on real edge hardware |
| Tests | Scenarios, traceability, experiments, release gates | Produces reproducible Plan B evidence |
| Delivery | Milestones, versioning, readiness | Controls staged implementation |

**Source precedence:** 1. Approved academic proposal and any supervisor-approved amendments; 2. confirmed 176-FR / 35-NFR requirements baseline; 3. approved architecture decisions; 4. this documentation package; 5. implementation. In a conflict, stop and request a documented decision rather than silently expanding scope.

**Readiness definitions:** `specified` describes intended behaviour, `implemented` means code exists, `verified` means evidence-backed tests pass, `released` means a tagged build is packaged. This package is **specified**, not verified.
