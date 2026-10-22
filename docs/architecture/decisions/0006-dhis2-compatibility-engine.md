# ADR-0006: Dynamic DHIS2 compatibility engine with cached capability snapshot

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related requirements: FR-04-04, FR-04-10, FR-05-08, FR-12-01, FR-12-02,
  FR-12-03, FR-12-04, NFR-22, NFR-35
- Related ADRs: supersedes ADR-0002 (fixed version pin), aligns with ADR-0004
  (hybrid architecture)

## Context

DER-ENG-001 §3 originally required DER to pin a single DHIS2 patch version at
build time. ADR-0002 did so (2.44-SNAPSHOT). Phase 01's `Dhis2CompatibilityGuard`
fail-closes any `/api/system/info.version` that does not start with the pinned
string.

Three forces broke that model:

1. **Pilot sites run different DHIS2 minors.** The Uganda MoH deployments
   DER is expected to meet in the field include at least 2.41, 2.42, and
   2.44-SNAPSHOT. A rigid pin would require either per-site DER builds or
   a mandatory central-upgrade step before DER deploys.
2. **DHIS2's own release cadence will outlive DER's.** Phase 09 would have
   had to re-pin against the GA patch. Any future minor would require a
   full DER release just to update one `startsWith` check.
3. **Minor-to-minor Web API drift is real but tractable.** `/api/tracker`
   became primary in 2.42 (legacy `/api/events` still answers in 2.44 but is
   deprecated). `TrackerImportReport` superseded `ImportSummary` for tracker
   writes in 2.42+. `/api/categoryOptionCombos` filter semantics changed in
   2.43. Field lists on `/api/dataElements` shifted. These are differences
   DER's emulator code paths must honour per minor, but the set of them is
   finite and known.

A rigid prefix pin ignored the drift silently and refused to boot otherwise.
A fully-dynamic feature-probing engine with no static knowledge would be
non-deterministic and would require a reachable central at every boot — the
opposite of DER's offline-first thesis.

## Decision

Replace `Dhis2CompatibilityGuard`'s prefix-match admission with a **compatibility
engine** that combines **static version profiles** with **dynamic feature
probing** and **cached capability snapshots**.

The engine has three inputs and one output:

1. **Static profiles** — one Java class per supported DHIS2 minor version
   (`V2_41Profile`, `V2_42Profile`, `V2_43Profile`, `V2_44Profile`). Each
   profile declares the capability flags DER knows that minor exhibits in
   its reference configuration. New minors are added as new profile classes
   alongside DER releases that validate them against the running DHIS2.

2. **Dynamic probe** (`Dhis2CapabilityProbe`) — a battery of HTTP probes
   against the configured central: `/api/system/info`, `/api/tracker/*`,
   `/api/trackedEntityInstances`, `/api/categoryOptionCombos`,
   `/api/programRules`, `/api/periodTypes`, `/api/dataValueSets` OPTIONS,
   `/api/metadata` shape digest. Each probe records
   `{endpoint, method, status, durationMs, shapeDigest, notes}`. The probe
   outcomes override specific profile defaults.

3. **Cached snapshot** (`dhis2_capability_snapshot` table from V004) — every
   probe writes a row with the parsed version, chosen profile name, raw
   probe report, resolved capability flags, trigger (`STARTUP`,
   `ADMIN_REFRESH`, `SCHEDULED`, `TEST`), and timing. The most recent row
   is the live snapshot.

The resolved **`CapabilityFlags`** record is the single value every DER code
path consults when it needs to know "which Web API shape does the central
speak today?" — `MetadataSyncService`, controllers in `dhis2emulator`, the
rules engine's period parser, etc.

### Admission policy

- **Hard floor: DHIS2 2.41.** Below 2.41, the engine throws
  `UnsupportedDhis2VersionException` on startup and refuses to serve any
  `/api/*` write. Override: `der.dhis2.compatibility.allow-unsupported=true`
  (dev diagnostic only, logs WARN per request).
- **Above `max-tested-version` (currently 2.44):** engine logs WARN,
  resolves to the max profile with probe overrides. The deviation is
  recorded in the audit log and in `/edge-api/v1/compat`.
- **Unknown minor between min and max:** falls back to the nearest-lower
  profile with WARN. (E.g. a hypothetical `2.44.5-ug-fork` resolves to
  `V2_44` and only probe outcomes decide which specific flags differ.)

### Offline resilience

The engine must come up without a reachable central if DER has run against
that central at least once before.

- **Central reachable at startup:** probe runs, writes new snapshot row,
  resolves profile + flags from fresh data.
- **Central unreachable, prior snapshot exists:** engine WARN-logs
  `DHIS2_PROBE_FAILED`, reuses the most recent snapshot's resolved flags.
  Writes to the local store continue (writes are to DER, not to central).
- **Central unreachable, no prior snapshot:** engine throws
  `Dhis2CompatibilityUnavailableException`. DER's `/edge-api/v1/*` admin
  surface still answers (identity, provisioning), but `/api/*` writes are
  refused with a stable error shape until a snapshot exists.

### Snapshot TTL and refresh

- Default TTL: 168 hours (7 days). After TTL, the next startup re-probes
  even if a snapshot exists.
- Admin-triggered refresh: `POST /edge-api/v1/compat/refresh` (ADMIN role)
  re-probes immediately, writes a new row, and atomically flips the live
  flags.
- `GET /edge-api/v1/compat` returns the live snapshot.
- `GET /edge-api/v1/compat/history?limit=20` returns the audit trail.

### Deprecations

- `der.dhis2.compatibility.pinned-version` → deprecated alias for
  `max-tested-version`. Kept one release, logs WARN that points at this ADR.
- `der.dhis2.compatibility.allow-mismatch` → deprecated alias for
  `allow-unsupported`. Same treatment.
- `GET /edge-api/v1/dhis2/compatibility` (Phase 01) → kept one release with
  `Deprecation:` header; replaced by `GET /edge-api/v1/compat`.

## Consequences

### Positive

- DER boots against any supported DHIS2 minor (2.41 through 2.44 initially;
  one new profile class per future minor).
- Capability resolution is deterministic (static defaults + reproducible
  probe) and auditable (every snapshot is a DB row).
- Offline-first: the engine does not require a reachable central after the
  first successful probe.
- Version-coupled code paths (metadata field lists, event vs tracker API
  routing, ImportSummary vs TrackerImportReport response shape) move
  behind a single `capabilities()` call rather than being scattered.
- Future DHIS2 releases are supported by adding a profile class + probe
  fixture + release note — no breaking changes required.

### Negative

- More code surface than a single prefix-match. Mitigated by profiles being
  tiny (each is a few flags of defaults) and by the engine being a single
  Spring bean.
- Probe timing adds ~1-2 seconds to boot when central is reachable.
  Mitigated by probes running in parallel and by snapshot caching.
- A probe outcome that disagrees with a profile default is an operator
  signal, not a hidden silent override: the raw probe report is persisted
  so an admin can see why a flag flipped.

### Negative — scope boundaries

- The engine deliberately does not implement **capability negotiation at
  runtime** (e.g. detecting mid-session that central was upgraded). Phase 05
  will add scheduled re-probing. Until then, admins run `POST /compat/refresh`
  manually after central upgrades.
- The engine does not detect **custom DHIS2 forks** that answer the probe
  endpoints with non-standard shapes. The probe records
  `shapeDigest` so drift is visible but is not automatically remediated.
  ADR-0005 (custom apps) is where the fork-tolerance conversation continues.

## Alternatives considered

**(A) Keep rigid pin, require per-site rebuild.** Rejected — defeats the
"deploy to any health facility" thesis.

**(B) Pure dynamic probe with no profiles.** Rejected — non-deterministic,
requires reachable central at every boot, no reasonable test strategy
without a battery of recorded live DHIS2 responses.

**(C) Hybrid, chosen above.** Static profile defaults for determinism, probe
overrides for forks and SNAPSHOTs, cache for offline continuity.

**(D) Delegate to DHIS2's own `dhis-service-system` jars.** Rejected — the
upstream library pulls Hibernate and the full DHIS2 server classpath; DER
would absorb its runtime weight and version-coupling of the thing we are
trying to abstract away from.

## Compliance and traceability

- FR-04-04, FR-04-10 — version-aware behaviour at the metadata and write
  layers.
- FR-12-01 … FR-12-04 — compatibility reporting surface.
- NFR-22, NFR-35 — operational observability of the version choice.

Evidence:

- Live probe snapshot bundle written to
  `docs/evaluation/evidence/phase-03/<commit>/compat/` on every alpha.3+
  release.
- Supported minor set tracked in
  `docs/verification/compatibility/supported-matrix.csv`.

## Related work

- ADR-0002 (SUPERSEDED BY 0006).
- ADR-0004 (hybrid architecture — the engine is the thing that lets a
  single DER emulate `/api/*` for multiple DHIS2 minors).
- ADR-0005 PROPOSED (custom apps — the engine's `shapeDigest` is one of the
  inputs to the fork-tolerance discussion continued there).
