# DHIS2 2.44 reference oracles — NFR-08 API parity

These files capture the shape (not the content) of DHIS2 central
2.44's responses on the endpoints DER emulates for a stock custom
app's bootstrap. NFR-08 — "for declared deterministic equivalent
operations, edge and reference responses/record effects match
defined oracles" — is asserted by
`scripts/evaluation/nfr08_api_parity.py`: it probes DER with the
same request shape and verifies DER's body carries at least the
oracle's required-key set with type-compatible values.

## How this works

Each oracle JSON file has the shape:

```json
{
  "endpoint": "/api/me",
  "method": "GET",
  "centralVersion": "2.44-SNAPSHOT",
  "capturedAt": "2026-11-16T18:00:00Z",
  "shape": {
    "requiredKeys": ["id", "username", "name", "displayName",
                        "organisationUnits"],
    "requiredArrayKeys": {
      "organisationUnits": ["id", "path", "programs"]
    },
    "typedKeys": {
      "id": "string",
      "name": "string"
    }
  }
}
```

The oracle is a **shape contract**, not a byte-identical snapshot.
Central's actual payload includes ids, timestamps, and per-user
state that will never match an edge appliance's. Two things are
pinned:

- `requiredKeys` — a key MUST exist in DER's response, at the
  same JSON path central returns it.
- `requiredArrayKeys` — if DER's response has an array under
  `<path>`, every element MUST carry these keys. Pins the inner
  shape without requiring equal length.
- `typedKeys` — the value at `<path>` MUST be of the given JSON
  type. `"string"`, `"number"`, `"boolean"`, `"object"`,
  `"array"`.

Anything DER returns beyond the oracle is fine. That's the NFR-08
posture: an edge appliance is allowed to carry extra fields (DER-
specific telemetry on `/api/me`, for example) without breaking a
stock DHIS2 app that only reads the canonical shape.

## Refreshing an oracle

```
curl -s https://play.dhis2.org/2.44.0/api/<endpoint> | \
  python3 scripts/evaluation/fixtures/oracles/_refresh.py \
    --endpoint <endpoint> --out <endpoint>.json
```

The refresh tool is intentionally minimal — it snapshots only the
keys / types, never values. (That rule prevents a leaked PII-shaped
oracle from landing in the repo.) When central changes its shape
on a minor-version bump, the pilot-side runbook (`docs/releases/`)
flags which oracles need re-capture.
