# NFR-30 — Storage fault-injection (no false acknowledgement)

**ID:** nfr-30-storage-fault-injection
**Status:** PINNED
**Evidence class:** executable fault-injection scenario (in-repo
JUnit) + pilot drill procedure
**Covered requirement:** NFR-30 "When disk, DB or credentials
prevent durable acceptance, reject explicitly; never report false
success."

## Preconditions

- `StorageHealthProbe` configured with warn + reject thresholds
  (defaults: 500 MB warn, 200 MB reject, overridable via
  `der.storage.warn-bytes` / `der.storage.reject-bytes`).
- `StorageAdmissionInterceptor` wired via `StorageWebConfig` on
  `/edge-api/**` and `/api/**` write methods.

## Fault injection

The probe boundary is where fault enters:

- **Test env** — the scenario subclasses `StorageHealthProbe` and
  overrides `sample()` to return
  `Status.REJECT` with `usableBytes = 100 MB`,
  `rejectBytes = 200 MB`. No real disk IO, no tmpfs, deterministic
  across hosts.
- **Pilot env** — operator fills a tmpfs mount to >99% of total
  (or sets the reject-bytes knob high enough that normal usable
  space drops below). `Files.getUsableSpace(root)` in
  `StorageHealthProbe` picks that up and reports REJECT on the
  next sample, triggering the same control path.

## Scenario

### Write-rejection matrix

For each hot write path, assert the admission gate short-circuits
with HTTP 507 + `STORAGE_FULL_REJECT` body:

| Method | Path | Expected |
|---|---|---|
| POST | `/api/dataValueSets` | 507 `STORAGE_FULL_REJECT` |
| POST | `/api/events` | 507 `STORAGE_FULL_REJECT` |
| POST | `/api/tracker` | 507 `STORAGE_FULL_REJECT` |
| POST | `/edge-api/v1/apps/install` | 507 `STORAGE_FULL_REJECT` |
| POST | `/edge-api/v1/backup/request` | 507 `STORAGE_FULL_REJECT` |
| POST | `/edge-api/v1/sync/metadata` | 507 `STORAGE_FULL_REJECT` |

### Read pass-through

For each hot read path, assert the gate admits (200 or whatever
the handler returns — read methods are always allowed):

| Method | Path | Expected |
|---|---|---|
| GET | `/api/dataValueSets` | admit (reads diagnose) |
| GET | `/edge-api/v1/system/health` | admit |
| GET | `/edge-api/v1/apps` | admit |

### Admin recovery bypass

For each admin-recovery path, assert the gate admits even under
REJECT so operators can free space without lifting the alarm first:

| Method | Path | Expected |
|---|---|---|
| POST | `/edge-api/v1/auth/sign-in` | admit (session issue) |
| POST | `/edge-api/v1/admin/ops/journal/purge` | admit |
| POST | `/edge-api/v1/admin/ops/backup/integrity/check` | admit |

## Invariants pinned

1. **Short-circuit at the gate** — `preHandle` returns `false`,
   so the controller + service never see the request and nothing
   lands in `operation_journal`. No false acknowledgement.
2. **HTTP 507 + structured discriminator** — clients get a
   specific `STORAGE_FULL_REJECT` code they can switch on, not
   a generic 5xx that would conflate with transient faults.
3. **Reads survive** — operators can diagnose through the alarm.
4. **Admin recovery survives** — sign-in + purge + integrity-check
   stay reachable so operators can free space / clean up without
   first having to lift the alarm manually.

## Pilot drill procedure

To reproduce in a running DER appliance:

```bash
# 1. Pick a tmpfs big enough to hold the appliance's hot paths,
#    small enough to exhaust quickly.
sudo mkdir -p /mnt/der-storage-drill
sudo mount -t tmpfs -o size=512M none /mnt/der-storage-drill
sudo mv /var/lib/der /mnt/der-storage-drill/
sudo ln -s /mnt/der-storage-drill/der /var/lib/der
sudo systemctl restart der-server

# 2. Fill to >99%.
sudo fallocate -l 510M /mnt/der-storage-drill/filler

# 3. Confirm the probe reports REJECT.
curl -s -b "$DER_COOKIE" https://der.local/edge-api/v1/system/storage | jq '.status'
# → "REJECT"

# 4. Attempt a write — expect HTTP 507 + STORAGE_FULL_REJECT.
curl -s -b "$DER_COOKIE" -X POST -H 'Content-Type: application/json' \
  -d '{"dataSet":"...","dataValues":[...]}' \
  https://der.local/api/dataValueSets -i | head
# HTTP/1.1 507 Insufficient Storage
# Content-Type: application/json
# {"code":"STORAGE_FULL_REJECT",...}

# 5. Verify no row was persisted.
psql -h localhost -U der -d der \
  -c "SELECT count(*) FROM der.operation_journal WHERE created_at > now() - interval '1 minute';"
# → 0

# 6. Tear down the drill.
sudo rm /mnt/der-storage-drill/filler
sudo systemctl restart der-server
```

## Evidence pointer

Executable at
`server/src/test/java/ug/ac/mak/der/nfr/Nfr30StorageFaultInjectionScenarioTest.java`.
Runs under `mvn -DskipITs -Dtest='Nfr30*' test` and appears in
the every-release gate output.

## Reset instructions

Test env: none required — the fault is injected via a probe
subclass, no state outlasts the test.

Pilot env: drop the filler file (step 6 above), `systemctl
restart der-server`.

## Cross-references

- `StorageAdmissionInterceptor` — the gate.
- `StorageHealthProbe` — the fault source.
- `StorageWebConfig` — registers the gate on `/edge-api/**` and
  `/api/**`.
- NFR-07 pair pin: shows acknowledged writes do travel across
  clients. Combined, you get "acknowledged → observable;
  unacknowledged → never persisted."
- NFR-32: pins no central IO on the write path (complementary).
- FR-14-09: the parent FR that shipped the storage-alarm
  mechanism itself.
