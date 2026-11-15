# ADR-0037: DHIS2 app signing policy (per-host-kind)

- Status: **ACCEPTED** — shipped across Phases 2a + 5d, formalised here 2026-11-15
- Deciders: socaya
- Related: ADR-0019 (device management — the slice B interceptor that
  enforces approval on `/dhis-web-*/**`), DER-APPS-DHIS2-001 FR-APP-007,
  Phase 2a commit `8d4e6f1c`, Phase 5d commit `119a3beb`

## Context

Phase 2a introduced two host kinds on `installed_app`:

- `DER_ESM` — DER-native ESM bundle. One `bundle.js` artifact.
- `DHIS2_IFRAME` — stock DHIS2 Hub zip. Static tree, no single bundle.

Each row also carries a `trust_level` column (`SIGNED` / `UNSIGNED`).
When Phase 5d relaxed the installer to accept the stock DHIS2 shape
(no `bundle.js`), the question of how to sign came up: DER's Ed25519
key can't meaningfully attest to third-party code the operator just
uploaded, but it has to attest to DER-native bundles so the device-side
verifier (`AppSigningKeyService.verify`) can refuse tampered code.

FR-APP-007 captures the policy — this ADR formalises it so future
contributors don't flatten the semantics by accident.

## Decision

**Ed25519 signing is mandatory on `DER_ESM` apps, forbidden on
`DHIS2_IFRAME` apps, and the `trust_level` column is the single source
of truth for which happened.**

| Host kind      | On install                                       | `trust_level` | Device-side verify |
|----------------|--------------------------------------------------|---------------|--------------------|
| `DER_ESM`      | `AppSigningKeyService.signBundle(bundle.js)`     | `SIGNED`      | **required**       |
| `DHIS2_IFRAME` | signing skipped; `signature_b64` persisted `NULL`| `UNSIGNED`    | **not performed**  |

The `signature_b64` column on `installed_app_version` is nullable
(V125). Null AND `trust_level=UNSIGNED` are equivalent markers of the
iframe install path; a `DER_ESM` row with either field missing is a
schema-shape violation.

## Rationale

- **DER-native code is DER's responsibility.** The whole point of
  signing `bundle.js` is so the client can refuse corruption-in-transit
  or a replaced row in the DB. That contract only makes sense when DER
  authored (or at least audited) the bundle. Enforcing it on `DER_ESM`
  gives the device-side verifier something real to check.
- **Third-party stock bundles are not.** DER didn't write
  `/dhis-web-capture/index.html`. Signing it under DER's key would be
  a false provenance claim — admins seeing `SIGNED` would reasonably
  infer "DER attested to this," which for a stock bundle they just
  uploaded is wrong. `UNSIGNED` makes the provenance explicit; FR-DIAG-001
  surfaces it on `/system/apps`.
- **Central-side signing is separate (FR-SYNC-008).** Phase 5b added a
  pinned-key verifier for bundles fetched from central auto-sync. That
  key is central's, not DER's, and it attests to central's upload. The
  two signing axes are orthogonal — a bundle from central could be
  `SIGNED` under central's key (verified by `CentralSigningVerifier`)
  and persisted as `DHIS2_IFRAME`+`UNSIGNED` at DER (because DER didn't
  re-sign it with the DER key).

## Enforcement surface

Grep anchors so a future reader can locate the policy in code:

- `AppCatalogueController.installZip`
  - `trust_level` chosen per `parsed.hostKind` (Phase 5d).
- `AppCatalogueController.storeZipVersion`
  - `final boolean signable = parsed.hostKind == InstalledApp.HostKind.DER_ESM`
  - If `signable`, `signer.signBundle(…)`; else `signature_b64 = null`.
- `AppCatalogueControllerTest#installZipDhis2IframeShape`
  - Asserts no signing call happens on the iframe path.

## Open items

None blocking. If a future iframe app genuinely needs a DER-side
signature (unusual — would mean DER has audited the bundle contents),
the right path is to re-package it as a `DER_ESM` zip with a
hand-authored `bundle.js` wrapper; the policy itself stays.
