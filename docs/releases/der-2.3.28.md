# der-2.3.28 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.27`

## Headline

**Row-versioning in the metadata mirror — real per-UID snapshot diff.**
Prior releases' snapshot pinning + diff could only expose counter
deltas because the mirror upsert-overwrote. A new
`metadata_entity_version` table captures one row per
(snapshot, resource, uid) with a fingerprint, so operators can now
answer "which programs changed between snapshot #45 and #48".

## 1. Schema — V060

```sql
CREATE TABLE der.metadata_entity_version (
    snapshot_id  BIGINT NOT NULL REFERENCES metadata_snapshot ON DELETE CASCADE,
    resource     TEXT   NOT NULL,
    dhis2_uid    TEXT   NOT NULL,
    fingerprint  TEXT   NOT NULL,
    PRIMARY KEY (snapshot_id, resource, dhis2_uid)
);
CREATE INDEX idx_metadata_entity_version_lookup
    ON metadata_entity_version (resource, dhis2_uid, snapshot_id DESC);
CREATE INDEX idx_metadata_entity_version_snapshot
    ON metadata_entity_version (snapshot_id, resource);
```

Rows are kept forever (DER's metadata is small — one row per UID per
sync × ~400 rules × hundreds of elements × dozens of snapshots is still
well under a few MB).

## 2. Writer path

`MetadataSyncService` grew a `JdbcTemplate` dep + `writeEntityVersions`
hook called after every successful sync. Nine resources covered:

```
organisationUnits · dataElements · dataSets · programs
trackedEntityTypes · programStages · trackedEntityAttributes
programRules · categoryOptionCombos
```

Fingerprint is the entity's `lastUpdated` when present (DHIS2 bumps it
on every edit) else a 16-char SHA-256 prefix of the payload JSON.
`ON CONFLICT DO NOTHING` so an idempotent re-sync is cheap.

## 3. API — `GET /{a}/diff/{b}/{resource}`

```json
GET /edge-api/v1/metadata/snapshots/45/diff/48/programs
→ 200
{
  "a": 45, "b": 48, "resource": "programs",
  "added":   [{"id": "ZpnlInpnyt5", "displayName": "HIV Pro - Patient Identity Registry"}, …],
  "removed": [{"id": "...", "displayName": null}, …],   // null when deleted upstream + no mirror row
  "changed": [{"id": "...", "displayName": "..."}, …]
}
```

- `added`:   UIDs in `b` but not in `a`.
- `removed`: UIDs in `a` but not in `b`.
- `changed`: UIDs in both whose fingerprint differs.

Each result row carries the UID + a best-effort displayName resolved
from the live mirror table, so operators see a program by name rather
than UID.

For snapshots created before V060, `metadata_entity_version` has zero
rows → diff shows the newer snapshot's full population under `added`
and nothing under `removed`/`changed`. This is correct ("no history
yet") and signposted via the empty-A behaviour.

## 4. Verified live

```
POST /sync/metadata                          ✓ snapshot 47 → version rows written:
                                                organisationUnits:484  dataElements:358
                                                programs:31  programRules:388
                                                programStages:76  trackedEntityAttributes:54
                                                trackedEntityTypes:1  categoryOptionCombos:1

POST /sync/metadata (idempotent re-sync)     ✓ snapshot 48

GET /45/diff/48/programs                     ✓ added:31 removed:0 changed:0
                                                (versioning started at 47 → 45 is empty)
GET /47/diff/48/programs                     ✓ added:0 removed:0 changed:0
                                                (identical content, identical fingerprints)

ServiceTest MetadataSyncServiceTest           ✓ 12/12
                MetadataSyncServiceExtendedTest ✓ 10/10
```

## 5. Files changed

```
database/migrations/V060__metadata_entity_version.sql    (new)
server/.../metadata/MetadataSyncService.java             — + JdbcTemplate ctor arg
                                                           + writeEntityVersions() hook
                                                           + batchInsertVersions + fp()
server/.../web/MetadataSnapshotController.java           — + GET /{a}/diff/{b}/{resource}
                                                           + fingerprintsFor + resolveLabel
server/.../test/.../MetadataSyncServiceTest.java         — ctor arg updated
server/.../test/.../MetadataSyncServiceExtendedTest.java — ctor arg updated
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.28
```

## 6. Follow-ups

- UI diff view on the Snapshots page — surface the added / removed /
  changed lists per resource. Next release.
- Prune pre-V060 snapshots or back-fill their version rows from the
  live mirror snapshot_id (lossy — a UID that moved to a newer
  snapshot_id since its historical sync will show up under the newer
  snapshot only). The current empty-history behaviour is acceptable
  for a pilot since diffs across the V060-boundary are rare.

## 7. Build + test

```
mvn test -Dtest='MetadataSyncService*'   ✓ 22/22
mvn -q -DskipTests package               ✓ 2.3.28 JAR
End-to-end sync + diff                   ✓ 3 scenarios green
```
