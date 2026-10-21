# DER release management and DHIS2 compatibility

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Version identity
Product = `DER`; semantic version in manifests = `X.Y.Z` with prerelease labels; Git tag = `der-X.Y.Z` (example `der-0.1.0`, `der-1.0.0-rc.1`, `der-1.0.0`). Avoid declaring 1.0 until full P0 evidence and integration gates pass.

## Rules
MAJOR breaks published DER interfaces/migration compatibility; MINOR adds backwards-compatible features; PATCH fixes compatible defects. One root version authority feeds Maven build, both frontend manifests, release metadata and UI about screen (automated consistency check). A DHIS2 patch is **independent** of DER product version: report `DER 0.8.0 / DHIS2 2.43.x (tested patch)`. Compatibility claims list exact tested patches and excluded features.

## Release process
Clean build -> linters/static analysis -> tests + coverage -> PostgreSQL migration dry-run -> pinned DHIS2 integration -> isolated WAN tests -> security/concurrency/recovery -> responsive screen tests -> produce SBOM/checksums -> update changelog -> tag signed release -> archive metrics/known limitations. On failure, block release, record defect, fix and rerun affected and regression gates.

## Recommended artefacts
`der-server-X.Y.Z.jar`, frontend compiled bundles, deployment scripts/config examples, migration manifest, compatibility matrix, integration test evidence, `CHANGELOG.md`, known limitations and reproducibility notes. Never publish credentials or synthetic test private keys.
