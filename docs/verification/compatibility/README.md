# DHIS2 compatibility matrix

> Phase 01 pin: `2.44-SNAPSHOT` (ADR-0002). Deviation from the "2.43.x" guidance is documented in `docs/releases/der-0.2.0.md`.

`supported-matrix.csv` is the authoritative list of DHIS2 Web API routes DER
depends on, with the expected positive/negative response contract per route.

Columns:

| Column | Meaning |
|---|---|
| `route_id` | Stable identifier used by test logs and evidence bundles. |
| `method` | HTTP method. |
| `path` | Path appended to `der.dhis2.central.base-url` (i.e. after `/dhis`). |
| `requires_auth` | When `true` the live probe sends HTTP Basic. |
| `expected_min_status` / `expected_max_status` | Inclusive status range the probe accepts. Equal values mean an exact match. |
| `der_phase` | Phase that first depends on this route. Phase 01 only certifies the `01` rows live; later rows are declared and reserved. |
| `notes` | Reviewer-facing context. |

Live verification is performed by `scripts/verify_dhis2_reference.py`. The
script reads `DER_DHIS2_CENTRAL_URL`, `DER_DHIS2_USER`, `DER_DHIS2_PASSWORD`
from the environment, walks every row, and writes an evidence JSON to
`docs/evaluation/evidence/phase-01/<commit>/compatibility/<timestamp>.json`.

A row that lacks a Phase-01 `der_phase` tag is still probed (so later-phase
regressions surface early) but a failure on it DOES NOT block the Phase 01
gate — only the `der_phase=01` rows do.
