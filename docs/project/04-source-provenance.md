# Provenance, source mapping and precedence

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

This documentation is based on the supplied Plan B proposal source `MDCSE_Concise_IEEE_Final/Plan_B_Proposal.tex`, the confirmed FR/NFR registers (`Functional_Requirements_Register.csv`, `Nonfunctional_Requirements_Register.csv`), the clean repository `der/` screen inventory, and the subsequent decision to target DHIS2 2.43+. The older proposal discusses examples from previous DHIS2 releases; all API references here require fresh patch-specific verification.

**Source status:** Proposal is a user-developed academic baseline; no supervisor approval state can be inferred. Requirement CSVs and screen inventories are planning baselines; their completeness, implementation status and correctness require verification. Added architecture solutions, routes, table names and deployment advice are design proposals, not evidence of executed software.

## Alignment rule
Every proposed module must trace to at least one of OBJ-1..OBJ-4 and an FR/NFR/test. New ideas beyond the three selected workflow families and a single shared LAN edge belong in an extension backlog. Do not broaden title, objectives or deliverables silently.
