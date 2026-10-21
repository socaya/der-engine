# DHIS2 2.43+ compatibility contract

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Release policy
Pin exact DHIS2 2.43.x patch for initial implementation; record version, official documentation snapshot, Java/Tomcat/PostgreSQL support matrix, deployment hashes and APIs observed in a live reference installation. `2.43+` is a *testing roadmap*, not an unconditional compatibility claim.

## API discovery and verification checklist
- Login/session or supported server-side integration authentication; permission/OU scope.
- System information/version/readiness and relevant metadata listing/filters.
- Aggregate data sets, data-value operations and import response semantics.
- Event and Tracker create/read/update, asynchronous import jobs and relationship handling.
- Metadata reads, checksums, updates, program rules, options, enrollment dependencies.
- Pagination, change detection, conditional reads, errors, retries, stable identifiers and unknown transport outcomes.

## Compatibility matrix required per tested DHIS2 patch
For each operation record HTTP method, URL, content schema, response states, import strategy, error mapping, authorization, metadata assumptions, observation date, unit test and integration test link. No invented endpoint names should be presented as proven APIs.

## DHIS2 upgrade protocol
Provision a separate test environment, run compatibility contract + offline/online E2E + import outcome + failure injection tests, inspect metadata/schema changes, record approved version range. Never upgrade central and edge simultaneously without rollback and reconciliation strategy.

## External reference documents
- Official DHIS2 documentation: https://docs.dhis2.org/
- Developer portal: https://developers.dhis2.org/
These are reference starting points; verify the **exact patch-specific behaviour** using an executable installation.
