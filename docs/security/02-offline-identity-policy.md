# Local identity, credentials and permission freshness

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Design obligations
Locally authenticate only users whose credentials/identities have been provisioned under an approved, tested strategy. Never store plaintext passwords or export DHIS2 password verifiers without proof that doing so is supported and safe. If native DHIS2 local instance authentication is chosen, document central identity reconciliation and separation of credentials. Unknown users during WAN outage are denied unless a separately approved enrolment mechanism exists.

## Offline permission policy — must be decided before coding
Define offline validity period for permission snapshots, handling of expired sessions, centrally disabled users, high-risk administrative actions, permitted OU scopes, role changes, audit recording and recovery behaviour. Permission snapshots carry issuer/source, fingerprint, issue time, expiry and last successful refresh time. Fail closed for privileged actions without current approval.

## Validation tests
Previously provisioned authorised user succeeds offline; forbidden record denied; user outside OU cannot query directly by URL; unknown user denied; expired privilege denied per policy; central revocation after WAN restoration enforced promptly; login failure never creates success journal entry.
