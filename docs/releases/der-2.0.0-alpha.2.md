# DER 2.0.0-alpha.2 — Initiative 3 option B/C design spike

> **Scope:** Docs-only. ADR-0031 compares option B (direct TLS mesh)
> and option C (local MQTT broker) against option A (shipped in
> 1.4.0). Picks option B as the next buildout; defers option C.
> Implementation lands in a dedicated 2.1.0 train.

**Release label:** `der-2.0.0-alpha.2`
**Git tag:** `der-2.0.0-alpha.2`

## New

- ADR-0031 — topology spike. Direct TLS mesh wins; MQTT shelved.

## Non-goals

- Any code change. Alpha.2 is a design document.
- 2.1.0 implementation scope (lives in that train's ADRs).

## Test state

- No code change; existing test counts unchanged.
