# der-2.3.35 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.34`

## Headline

**Service-account auth for inter-edge push.** The peer registry now
stores a username + password per peer; the push flow signs in to the
peer first and replays the resulting DER_SESSION cookie on the actual
`/workflows/import` call. Real production peer sharing works without
any changes to the receiving edge.

## 1. Schema (V062)

```sql
ALTER TABLE der.workflow_peer
    ADD COLUMN auth_username TEXT,
    ADD COLUMN auth_password TEXT;
```

Plaintext in the pilot DB — documented in the UI hint
("Stored plaintext in the pilot DB — rotate quarterly") and in the
release note here. Encryption at rest is a follow-up once key
management lands.

## 2. Push flow

```java
if (peer has credentials):
    POST  <peer>/edge-api/v1/auth/sign-in
    extract DER_SESSION cookie from Set-Cookie
    POST  <peer>/edge-api/v1/workflows/import   with Cookie: DER_SESSION=…
else:
    POST  <peer>/edge-api/v1/workflows/import   (anonymous — pre-2.3.35 path)
```

A failed sign-in short-circuits before the body is sent and reports
`sign-in HTTP <code>` as the `last_push_status`, so the operator
sees "bad creds" vs. "import rejected" distinctly.

Receiving-side logic is unchanged — the existing cookie-session
filter + ADMIN gate on `/workflows/import` is now the authoritative
check.

## 3. API additions

```
POST   /edge-api/v1/workflows/peers
   body { displayName, baseUrl, authUsername?, authPassword? }

POST   /edge-api/v1/workflows/peers/{peerId}/credentials
   body { authUsername, authPassword }      # rotate without recreating
```

The GET list surfaces `authUsername` so the UI can show "signed in as
<user>" or "anonymous" per row. **The password is never returned
over the API.**

## 4. UI

### Add-peer card

Four fields now:
- Label
- Base URL
- Service-account username (optional)
- Service-account password (optional)

With a hint: "Stored plaintext in the pilot DB — rotate quarterly."

### Peers table

New **Auth** column with:
- `signed in` pill + mono username when creds set, or `anonymous`
  pill otherwise.
- `<details>Rotate credentials</details>` disclosure containing
  username + password inputs + a Save button that POSTs to
  `.../credentials`.

## 5. Verified live

```
Register loopback peer with authUsername=der-admin + password  ✓
Push                                                            ✓ status: OK
                                                                  receiver created wf
list → authUsername shown, lastPushStatus=OK                    ✓

Rotate credentials to bad password                              ✓
Push → status: sign-in HTTP 401                                 ✓
```

## 6. Files changed

```
database/migrations/V062__workflow_peer_auth.sql            (new)
server/.../web/WorkflowPeerController.java                  — + auth columns,
                                                             POST /credentials,
                                                             push: sign-in-first + cookie
                                                             replay with timeout handling
admin-ui/src/api/edgeApi.ts                                 — addWorkflowPeer({…, auth*}),
                                                             setWorkflowPeerCredentials,
                                                             WorkflowPeer.authUsername
admin-ui/src/screens/workflow/WorkflowPeers.tsx             — new form fields + Auth
                                                             column + rotate disclosure
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.35
```

## 7. Follow-ups

- Encrypt `auth_password` at rest once a key-management story
  (Postgres pgcrypto / Vault) lands.
- Replace username/password with a short-lived service token the
  receiving edge issues to the sending edge during enrolment.
- Receive-side "import inbox" so a push lands as a pending import
  rather than silently overwriting.
