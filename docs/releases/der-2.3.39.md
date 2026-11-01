# der-2.3.39 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.38`

## Headline

**Diff view on PENDING inbox entries.** Operators reviewing an
incoming workflow push can now see exactly what would change before
accepting — step-level added / removed / changed against the local
workflow it would replace.

## 1. API

```
GET /edge-api/v1/workflows/import-inbox/{importId}/diff
→ 200
{
  "importId": "<uuid>",
  "incoming":      { displayName, boundKind, boundId, stepCount },
  "matchStrategy": "NONE" | "DISPLAY_NAME" | "BINDING",
  "local":         { workflowId, displayName, stepCount } | null,
  "summary":       "NO_CHANGES" | "REPLACEMENT" | "NEW_WORKFLOW",
  "added":   [{ ordinal, displayName, stepKind, fieldCount }],
  "removed": [{ ordinal, displayName, stepKind }],
  "changed": [{ ordinal,
                 local:    { displayName, stepKind, fieldCount },
                 incoming: { displayName, stepKind, fieldCount } }]
}
```

Match resolution:
1. `boundMetadataKind:boundMetadataId` equal to a local workflow →
   `BINDING`.
2. Else `displayName` equal (case-insensitive) → `DISPLAY_NAME`.
3. Else → `NONE`, `summary: NEW_WORKFLOW`.

Step diff is keyed by ordinal; equality considers `displayName`,
`stepKind`, and field count. (SectionKind / sectionRef live in the
server-side record, not the canonical doc; they'll land once the
canonical schema carries them.)

## 2. UI

- PENDING rows grow a **Review** button that fetches the diff and
  renders an inline sub-row.
- Diff block adapts to the summary:
  - `NEW_WORKFLOW` — single line, "no local match".
  - `NO_CHANGES` — matched-but-identical message.
  - `REPLACEMENT` — three colour-coded groups (Added / Removed /
    Changed) using the existing `.ea-diff-group--{success|error|warning}`
    styles from the Snapshot diff page.
- Toggling the Review button hides the diff again.

## 3. Verified live

```
Push workflow via peer loop                        ✓ PENDING entry
Rename local workflow so diff finds it via BINDING ✓ matchStrategy=BINDING
GET /import-inbox/{id}/diff                        ✓ summary=NO_CHANGES
                                                      added:0 changed:0
                                                      local.displayName="Diff NEW (local renamed)"
server/CaptureWorkflowControllerTest               ✓ 20/20
```

## 4. Files changed

```
server/.../web/CaptureWorkflowController.java      — + /import-inbox/{id}/diff
                                                      + HashMap import
admin-ui/src/api/edgeApi.ts                        — importInboxDiff + ImportInboxDiff
admin-ui/src/screens/workflow/WorkflowImportInbox.tsx — Review button + inline
                                                      InboxDiffBlock using existing
                                                      ea-diff-group styles
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.39
```

## 5. Follow-ups

- Diff should also show role / device assignment changes per step —
  needs those fields on `CanonicalStep` or a parallel diff pass.
- "What would be lost" preview — list the local dependencies the
  replacement would overwrite.
