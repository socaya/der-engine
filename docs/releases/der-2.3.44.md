# der-2.3.44 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.39`

## Headline

**Backend frontier cleanup — five items in one release.** All of the
backend/polish work queued since 2.3.33 ships together: peer trust,
SSE inbox stream, encrypted peer passwords, metadata-driven
enrollment attributes, and an NFR harness.

| # | Scope |
|---|---|
| 1 | Peer-level `direct_import=true` — trusted peers bypass inbox |
| 2 | SSE push for inbox arrivals |
| 3 | AES-256-GCM encrypt `auth_password` at rest |
| 4 | Metadata-driven attribute list for EnrollmentCreate |
| 5 | NFR evaluation harness |

## 1. Peer trust (V065)

```sql
ALTER TABLE workflow_peer ADD COLUMN direct_import BOOLEAN DEFAULT false;
```

```
POST /edge-api/v1/workflows/peers/{peerId}/trust  { directImport: true }
```

Push flow reads `direct_import`; when true the push URL drops the
`?inbox=true` suffix and the receiver applies directly.

UI: new **Trust** column on the peers table with a checkbox toggle
("direct" / "via inbox" label).

## 2. SSE inbox stream

New `WorkflowInboxStream` component mirroring `WorkflowQueueStream`
(2.3.24). `GET /workflows/import-inbox/stream` emits
`inbox.updated` on every import.received / import.accepted /
import.rejected call. UI opens an EventSource and re-fetches on
cue — matches the queue's 23 ms push latency pattern.

Security: `/import-inbox/stream` authenticated-level like the queue
stream.

## 3. Encrypted peer passwords (§2.3.42)

```
DER_PEER_SECRET_KEY  (env, 32+ random chars)
   → SHA-256 → AES-256-GCM key
   → ENC:<base64url(iv ∥ ct ∥ tag)> stored in workflow_peer.auth_password
```

- Writes via `WorkflowPeerController.add` and `.setCredentials` now
  go through `PeerSecretCrypto.encrypt`.
- Push reads via `.decrypt` — tolerates legacy plaintext rows for
  backward compat (returns as-is when no `ENC:` prefix).
- Missing env → fallback dev-only key with a WARN log so pilots
  catch the misconfig in startup logs.

`.env.local.example` and `application.yml` grew the key.

## 4. Metadata-driven TEA list in EnrollmentCreate (§2.3.43)

When `?attributes=` is absent, the client fetches
`/api/programs/{id}?fields=id,programTrackedEntityAttributes` and
builds the input list from `programTrackedEntityAttributes[].trackedEntityAttribute.id`.
Explicit `?attributes=` still wins (pilots can override).

New client helper `edgeApi.programTrackedEntityAttributes(programId)`.

## 5. NFR evaluation harness (§2.3.44)

`scripts/evaluation/nfr_harness.sh` runs four probes and writes a
report into the evidence directory:

```json
{
  "metadataSync":           { "elapsedMs": 4797, "rowsMirrored": 874 },
  "workflowCreate":         { "medianMs": 29,   "p95Ms": 31 },
  "queueRead":              { "medianMs": 50,   "p95Ms": 56 },
  "contributionThroughput": { "totalMs": 117,   "opsPerSec": 85.47 }
}
```

Numbers above are a live sample from the dev host — pilots run the
same script against their edge to produce the archive bundle. The
`scripts/evaluation/evidence_bundle.sh` wraps the output per spec.

## 6. Files changed

```
database/migrations/V065__workflow_peer_direct_import.sql       (new)
server/.../workflow/WorkflowInboxStream.java                    (new)
server/.../workflow/PeerSecretCrypto.java                       (new)
server/.../web/WorkflowPeerController.java                      — trust toggle +
                                                                   crypto on in/out +
                                                                   direct_import push
server/.../web/CaptureWorkflowController.java                   — SSE endpoint +
                                                                   notifyUpdate on inbox events
server/.../security/SecurityConfig.java                         — /import-inbox/stream auth
server/.../test/.../CaptureWorkflowControllerTest.java          — + WorkflowInboxStream mock
server/src/main/resources/application.yml                       — der.peer.secret-key
.env.local.example                                              — DER_PEER_SECRET_KEY
admin-ui/src/api/edgeApi.ts                                     — setWorkflowPeerTrust +
                                                                   WorkflowPeer.directImport
admin-ui/src/screens/workflow/WorkflowPeers.tsx                 — Trust column + checkbox
admin-ui/src/screens/workflow/WorkflowImportInbox.tsx           — EventSource consumer
client/src/api/edgeApi.ts                                       — programTrackedEntityAttributes
client/src/screens/EnrollmentCreate.tsx                         — metadata fallback for TEA list
scripts/evaluation/nfr_harness.sh                               (new, executable)
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.44
```

## 7. Verified

```
mvn -DskipTests package                                ✓ 2.3.44 JAR
CaptureWorkflowControllerTest                          ✓ 20/20
client/npm test                                        ✓ 157/157
nfr_harness.sh (10 iterations)                         ✓ 4 probes, report written
```

## 8. Follow-ups

- One-shot migration script to re-encrypt legacy plaintext passwords
  on first boot after 2.3.42.
- Signed NFR reports (GPG) once pilots standardise on a key.
- Peer registry UI should show "last successful push" relative time
  (today it shows the raw timestamp).
