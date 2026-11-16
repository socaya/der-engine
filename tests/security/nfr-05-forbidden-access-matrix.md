# NFR-05 — Forbidden-access matrix

**ID:** nfr-05-forbidden-access-matrix
**Status:** PINNED
**Evidence class:** gate-step Python script + evidence JSON
**Covered requirement:** NFR-05 "100% of predefined forbidden
access attempts are rejected across UI and direct API paths."

## Preconditions

- DER appliance reachable at `DER_URL` (default
  `http://localhost:8085`).
- One ADMIN user + one OPERATOR user with known passwords.
  Script supplies credentials via env vars; no SQL seeding.

## Fixture

- `scripts/evaluation/forbidden_access_matrix.py` — walks the
  (role × path × method) grid against a running DER, emits
  evidence JSON, exits non-zero on any violation.
- Pinned matrix in the script carries ~12 paths each tested at
  three role levels (anon / operator / admin) = **36 probes**
  per run.

## Expectation contract

Every probe row carries one of three expected outcomes:

| Expected | HTTP | Meaning |
|---|---|---|
| `allow` | 2xx (or 4xx NON-401/403) | Authority admitted the request. Handler-side rejection on content counts as allow — NFR-05 is about authority, not payload. |
| `unauthorised` | 401 | No session; server refuses before authority check. |
| `forbidden` | 403 | Session present but role lacks the required authority. |

The three cases map to Spring Security's
`hasAuthority(...)` / `authenticated()` / `permitAll()` rules
and the role_authority DB grants shipped in V017.

## Invariants pinned

1. **No silent downgrades.** Any admin-ops path (e.g.
   `/admin/ops/users/scope`, `/admin/ops/decommission`,
   `/restore/request`) that an operator reaches without 403 is
   a violation — flagged with exit code 1 and listed in stderr.
2. **Pattern-matcher completeness.** During pin discovery we
   found that Spring's `/<prefix>/**` does NOT match the bare
   `/<prefix>` itself, so a POST to `/edge-api/v1/sync/metadata`
   would fall through to the broader `/sync/**` rule. The
   SecurityConfig was tightened to list both forms (bare path +
   `/**`) for the metadata / data / drift sync branches.
3. **Role catalogue hygiene.** OPERATOR legitimately holds
   `der.sync.metadata.run` by design (facility staff resync
   metadata without admin), so the matrix pins
   `operator=allow` for that path. Any future change to the
   role_authority grants must update the matrix in lockstep —
   drift between the two surfaces causes the script to fail.

## Evidence pointer

Executable at `scripts/evaluation/forbidden_access_matrix.py`.
Each run writes `--out` with:

```json
{
  "nfr": "NFR-05",
  "baseUrl": "http://localhost:8085",
  "rows": [ { "method": "GET", "path": "...", "role": "operator",
              "expected": "forbidden", "got": "forbidden",
              "status": 403, "ok": true }, ... ],
  "violations": [],
  "summary": { "probed": 36, "passed": 36, "violations": 0 }
}
```

Pilot acceptance archives the JSON under
`docs/evaluation/evidence/<phase>/<commit>/nfr-05.json`.

## Reset instructions

None required — the script is read-only on the server (every POST
targets admin-ops endpoints that either reject with 403/401
without side-effects or admit the write; the matrix doesn't post
to the hot write paths).

## Cross-references

- `SecurityConfig` — authority wiring.
- `AuthorityCatalog` — authority definitions.
- `role_authority` table (V017) — role → authority grants.
- NFR-06 companion (transport + credential + log + storage) —
  layered atop the authority surface this script pins.
