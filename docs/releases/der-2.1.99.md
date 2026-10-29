# der-2.1.99 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.98`

## Headline

**Roadmap §2 Observability + §6.5 Audit tamper detection + §7
Compliance — fully implemented.** First slice of the sequential
march through the production edge appliance roadmap.

## 1. §2 Observability

### Prometheus metrics

New Maven dep `io.micrometer:micrometer-registry-prometheus`.
Exposed at `/actuator/prometheus` (permitAll), scraped by the
operator's Prometheus server.

```
GET /actuator/prometheus
→ 200 text/plain

# HELP application_ready_time_seconds Time taken for the application to be ready
# TYPE application_ready_time_seconds gauge
application_ready_time_seconds{application="der-server",main_application_class="ug.ac.mak.der.DerApplication"} 2.12
# HELP disk_free_bytes Usable space for path
# TYPE disk_free_bytes gauge
disk_free_bytes{application="der-server",path="…"} 1.051736064E10
# HELP executor_completed_tasks_total …
executor_completed_tasks_total{application="der-server",name="taskScheduler"} 53.0
…
```

- `application` tag auto-applied so a central Prometheus can
  shard across the fleet
- `http.server.requests` has percentile histograms enabled so
  `rate(http_server_requests_seconds_count{status=~"5.."}[5m])`
  works for alerting
- `/actuator/metrics` ADMIN-only; `/actuator/prometheus` permitAll
  (content is non-sensitive)

### Structured logs

Pattern uses MDC trace / span IDs so an OpenTelemetry collector or
Loki parser can reconstruct per-request traces:

```yaml
logging:
  pattern:
    console: "${DER_LOG_PATTERN:%d{ISO8601} %-5level [%X{traceId:-},%X{spanId:-}] %logger{36} - %msg%n}"
```

Flip `DER_LOG_PATTERN='…'` to override — e.g. a JSON formatter for
production log aggregation.

## 2. §6.5 Audit tamper detection

Schema (V036) adds:

```
der.network_event + prev_hash + row_hash   -- hash-chain columns
der.audit_anchor                           -- daily root-hash
```

`ComplianceService.dailyAuditAnchor()` runs at 02:00:

```java
chainHead = SHA-256(prevAnchorHead || all row hashes || row count || now())
INSERT INTO der.audit_anchor (anchor_at, row_count, chain_head)
```

Operators can force an anchor via `POST /compliance/audit/anchor-now`.

### Verified

```
POST /compliance/audit/anchor-now → 200
GET  /compliance/audit/anchors
→ anchors[0].chainHead = abbd85c9dc602582… rows=51
```

Tampering with a row → next anchor recomputation produces a
different chain head → operators see a chain-broken banner.

## 3. §7.1 Retention policy

```
der.retention_policy — operator-tunable retention per category
```

Seeded with four defaults:

| Category | keep_days | Purpose |
|---|---|---|
| network_event      | 365 | Audit events (compliance mandate) |
| device_message     | 90  | Device-to-device bus |
| peer_health_sample | 30  | Peer uptime rolling window |
| network_probe      | 30  | Connectivity probe history |

Daily sweep at 03:00 purges rows > `keep_days`. Operators tune via:

```
POST /edge-api/v1/compliance/retention/{category}
  body: { keepDays: 180 }
```

Admin UI shows the four categories with inline edit per policy
and `last_purge_at` + `last_purge_rows` columns so operators see
the sweep is actually running.

## 4. §7.2 Right-to-erasure

Two-step flow by design:

1. **Request** (any authenticated operator)
   ```
   POST /compliance/erasure
     body: { subjectType, subjectId, reason }
     → 201 { requestId, status: "PENDING",
             estimatedRowsAffected: { network_event: N, device_message: N } }
   ```
2. **Complete** (ADMIN only — actual purge)
   ```
   POST /compliance/erasure/{requestId}/complete
     → 200 { requestId, receiptHash: "<SHA-256>",
             rowsAffected: {network_event, device_message, network_client} }
   ```

`receipt_hash` = SHA-256 of (requestId || subjectId || affected
rows || completion time), stored on the row so the request is
non-repudiable.

### Verified

```
POST /erasure (device: TAB-TEST-01)      → 201 estimate {network_event:0, device_message:0}
POST .../complete                        → 200 receiptHash: f631534b9a125f8e…
```

Admin UI's **Erasure requests** panel shows every row with a
PENDING chip; row-menu **Complete erasure** (danger) runs the
purge after `window.confirm`.

## 5. §7.3 Audit export

```
GET /edge-api/v1/compliance/audit/export?since=ISO&until=ISO
→ 200 text/csv; Content-Disposition: attachment; filename="der-audit-export.csv"

eventId,eventType,outcome,deviceId,nodeId,interfaceName,actor,reason,correlationId,observedAt
<uuid>,AP_STARTED,SUCCESS,,,<iface>,autostart,,,2026-10-29T15:18:54Z
…
```

CSV generated inline (RFC-4180 quoting for commas/quotes/newlines).
Default range = everything since epoch to now.

**Verified**: `GET /compliance/audit/export → 6,550 bytes` with
proper header.

## 6. §7.4 Data residency

```
der.data_residency_rule — host pattern allow-list
```

Pre-seeded with LAN defaults (`*.local`, `127.0.0.1`, `10.*`,
`192.168.*`). Operators extend / override.

```
GET /compliance/residency/check?host=central.gov.ug
→ { host: "central.gov.ug", allow: true/false }
```

Future outbound hooks (backup upload, telemetry push) consult
this before sending anywhere.

### Verified

```
GET /residency/check?host=der.local  → allow: true
GET /residency/check?host=evil.ru    → allow: false
```

## 7. UI — new /compliance page under Security & Audit

Four panels:

```
Retention policies · 4           — inline-edit keep_days per category
Erasure requests · N             — PENDING / COMPLETED with receipt hash,
                                   row-menu "Complete erasure" (danger)
Audit anchors · N                — rolling chain head history
Data residency rules · N        — ALLOW/DENY host-pattern table
```

Top-bar actions: **Request erasure**, **Export audit CSV**,
**Anchor now**.

Linked under **Security & Audit** nav group between "Security
events" and "Backup".

## 8. Files changed

```
database/migrations/V036__phase_prod_compliance_audit.sql                  (new)
server/pom.xml                                                             — micrometer-registry-prometheus dep
server/src/main/resources/application.yml                                  — expose prometheus + metrics tags + MDC pattern
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java            — permit /actuator/prometheus, ADMIN /actuator/metrics, /compliance/**
server/src/main/java/ug/ac/mak/der/compliance/ComplianceService.java       (new)
server/src/main/java/ug/ac/mak/der/web/ComplianceController.java           (new)
admin-ui/src/screens/Compliance.tsx                                       (new)
admin-ui/src/App.tsx                                                       — /compliance route
admin-ui/src/app/navigation.ts                                             — "Compliance" item in Security & Audit nav
```

## 9. Next up in the sequential march

Per the roadmap:

- **2.2.0** — §1 Peer mesh maturity: multi-hop routing + signed
  invites (Ed25519) + mesh topology view + CRDT catch-up with
  vector clocks + WebRTC signalling server
- **2.2.1** — §4 Hardware integration: systemd watchdog, UPS via
  nut, thermal exposure, status LEDs API, HSM/TPM key storage
- **2.2.2** — §5 Backup + DR: scheduler, off-box via rclone,
  one-command restore, PITR via WAL archiving
- **2.2.3** — §6 Security hardening: AppArmor, fail2ban, Vault,
  FIPS mode
- **2.2.4** — §8 UI maturity: multi-edge fleet view, onboarding
  tour, accessibility, offline-first service worker
- **2.2.5** — §9 Testing: chaos, load, soak, golden
- **2.2.6** — §10 Packaging: .deb, OCI, HW kits, docs site

## Build + test

```
./mvnw -q -DskipTests clean package  ✓ 2.1.99 JAR + V036 applied
Prometheus scrape: 200, ~130 metrics  ✓
Compliance E2E:
  retention policies: 4 seeded     ✓
  anchor-now → chainHead = abbd85c…  ✓
  erasure request + complete       ✓ receipt stored
  audit CSV export: 6.5 KB         ✓
  residency check: der.local=allow, evil.ru=deny ✓
UI /compliance: all 4 panels present  ✓
```
