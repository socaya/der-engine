# der-2.3.38 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.37`

## Headline

**Receive-side import inbox** — peer pushes no longer silently
overwrite the receiver's workflow catalogue. They land as PENDING
imports an operator reviews and accepts or rejects. Closes the trust
gap in the §62–§63 peer flow.

## 1. Schema (V064)

```sql
CREATE TABLE der.workflow_import_inbox (
    import_id       UUID PRIMARY KEY,
    received_at     TIMESTAMPTZ DEFAULT now(),
    received_by     UUID,
    from_label      TEXT,
    display_name    TEXT NOT NULL,
    bound_kind      TEXT NOT NULL,
    bound_id        TEXT NOT NULL,
    canonical_json  JSONB NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
    decided_at      TIMESTAMPTZ,
    decided_by      UUID,
    decision_note   TEXT,
    accepted_workflow_id UUID REFERENCES capture_workflow
);
```

## 2. API

```
POST /edge-api/v1/workflows/import?inbox=true&fromLabel=<peer-label>
   → 200 { status: PENDING_REVIEW, importId, displayName }

GET  /edge-api/v1/workflows/import-inbox[?status=PENDING|ACCEPTED|REJECTED]
POST /edge-api/v1/workflows/import-inbox/{importId}/accept
POST /edge-api/v1/workflows/import-inbox/{importId}/reject   body { note }
```

- `?inbox=false` on the import endpoint keeps the pre-2.3.38
  direct-import path (manual uploads from the admin UI still work).
- Accept re-runs the existing `CaptureWorkflowImportService.importWorkflow`
  with the stored canonical doc; records the resulting `workflow_id`
  so the inbox row stays auditable.
- Reject marks the row with a note.

## 3. Sender side

`WorkflowPeerController.push` now opts in to inbox mode by default
with `?inbox=true&fromLabel=peer-<first-8-of-peerId>`. Receivers see
every incoming push as PENDING and decide.

## 4. UI — `/admin/workflows/import-inbox`

- `ea-screen-header` + tab bar (Pending / Accepted / Rejected / All).
- Table: workflow name, peer label, received-at, binding kind:id,
  status pill, action cell (Accept + reject-note input + Reject on
  PENDING rows; decision timestamp + note on resolved rows).
- Sidebar entry: Workflows → **Import inbox**.

## 5. Verified live

```
Register loopback peer with service-account creds        ✓
Push workflow (defaults to inbox mode)                   ✓ receiver returns
                                                             PENDING_REVIEW + importId
GET /import-inbox                                        ✓ 1 PENDING entry
POST /import-inbox/{id}/accept                           ✓ workflow materialised
                                                             (new workflow_id returned)
GET /import-inbox?status=PENDING                         ✓ 0 entries
```

CaptureWorkflowControllerTest 20/20.

## 6. Files changed

```
database/migrations/V064__workflow_import_inbox.sql     (new)
server/.../web/CaptureWorkflowController.java           — + ?inbox=true branch
                                                           + /import-inbox GET + accept
                                                           + /import-inbox reject
                                                           + JdbcTemplate ctor arg
server/.../web/WorkflowPeerController.java              — push defaults to inbox mode
server/.../web/CaptureWorkflowControllerTest.java       — + JdbcTemplate MockBean
admin-ui/src/api/edgeApi.ts                             — listImportInbox + accept + reject
admin-ui/src/screens/workflow/WorkflowImportInbox.tsx   (new)
admin-ui/src/App.tsx                                    — /workflows/import-inbox route
admin-ui/src/app/navigation.ts                          — sidebar "Import inbox"
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.38
```

## 7. Follow-ups

- Diff view on PENDING inbox entries — compare the incoming
  canonical doc against the local workflow by displayName /
  boundMetadataId so operators see what would change on accept.
- Peer-level default: today every push goes to the receiver's inbox.
  Trusted peers could carry `direct_import=true` to bypass review.
- SSE push for inbox arrivals so reviewers get live notifications
  (same pattern as the queue stream).
