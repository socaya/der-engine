# Device-client integration and record statuses

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

Browser clients use the **edge** hostname regardless of WAN state. Supported DHIS2 app screens must call the version-matched local DHIS2 API; edge-specific admin/status functions use guarded DER management API. Browser local storage is not the shared authoritative repository.

## User-visible statuses
| State | Visible wording | User implication |
|---|---|---|
| Validated, saved in edge DB | Saved locally | Other permitted LAN users may retrieve the record |
| Awaiting exchange | Pending central synchronisation | Do not imply central acceptance |
| Submitted/uncertain | Verification in progress | Do not resubmit the form simply because WAN response is missing |
| Centrally accepted | Synchronised centrally | Verified central result stored |
| Rejected | Central rejected | Show meaningful reason and safe next action |
| Review required | Needs conflict review | Preserve local changes; authorised reviewer decides |
| Edge unreachable | Local server unavailable | Normal shared commits cannot be made until restored |

## Concurrency interaction
A save with stale expected version receives explicit conflict response and fresh record revision if authorised; UI offers reload/compare/retain draft, never silently replaces another user's changes.

## Responsive implementation
Desktop data tables; tablet two-column forms where usable; mobile single-column tasks. Keyboard and assistive technology supported; saving is disabled only when edge unavailable, invalid input or permission denied—not merely when WAN is down. Browser drafts, if provided, are clearly labelled uncommitted.
