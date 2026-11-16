# NFR-14 — Offline privilege + credential freshness

**ID:** nfr-14-offline-credential-freshness
**Status:** PINNED
**Evidence class:** executable scenario (in-repo JUnit)
**Covered requirement:** NFR-14 "Offline privilege and credential
freshness decisions follow documented deny/expiry policy."

## Preconditions

- DER configured with `der.security.offline-credential.max-age-days=30`
  (default).
- A DHIS2-origin user with Argon2id verifier on disk
  (`edge_credential.algorithm='ARGON2ID'`).
- Rate limiter doesn't trip (sign-in attempts spaced out).
- No existing active session — the test starts from a cold cookie
  state.

## Fixture

- Username: `nurse.alice`
- Origin: `DHIS2` (external_uid=`DHIS2_UID_ALICE`)
- Role: `OPERATOR`
- Password: `n0t-a-real-password` (hashed with real `PasswordHasher`)

## Scenario (time-travel)

Clock is injected via `Clock.fixed(at, UTC)` on each
`AuthenticationService` instance so the scenario can simulate four
distinct moments without a scheduler:

| Instant | Reachability | Action | Expected |
|---|---|---|---|
| **T0** | REACHABLE | `signIn(alice, pw)` | `Success`; `last_central_sync_at` stamped to `T0` |
| **T + 29d** | OFFLINE | `signIn(alice, pw)` | `Success` (within 30-day window); witness unchanged |
| **T + 31d** | OFFLINE | `signIn(alice, pw)` | `OfflineCredentialExpired` + audit `SIGN_IN_FAILURE reason=OFFLINE_CREDENTIAL_EXPIRED maxAgeDays=30`; witness unchanged; no session |
| **T + 31d + 1h** | REACHABLE | `signIn(alice, pw)` | `Success`; witness refreshed to `T + 31d + 1h`; window resets |

## Invariants pinned

1. **Within-window signs in** — exercising the policy's
   lower-boundary behavior against both age math and the OFFLINE
   gate branch simultaneously.
2. **Beyond-window denies** — exact `OfflineCredentialExpired`
   outcome; no session issued; witness unchanged. Pins the FR-02-06
   gate against silent downgrade.
3. **Deny emits audit evidence** — `SIGN_IN_FAILURE` with
   `reason=OFFLINE_CREDENTIAL_EXPIRED` + `maxAgeDays` attributed
   to the correct `subjectUserId`. Operators correlate denials to
   policy without log-diving.
4. **REACHABLE auto-refreshes** — the online path calls
   `markCentralSyncAt(now)` BEFORE the age check, so an operator
   whose witness is stale can refresh it by signing in while the
   WAN is up. Pins the "no permanent lockout" escape hatch.

## Evidence pointer

Executable at
`server/src/test/java/ug/ac/mak/der/nfr/Nfr14OfflineCredentialFreshnessScenarioTest.java`.
Runs under `mvn -DskipITs -Dtest='Nfr14*' test` and appears in the
every-release gate output as part of the server unit-test pass.

## Reset instructions

None required — the scenario holds all state in-process. No DB
fixtures are inserted; the `EdgeUserRepository` is a Mockito stub
backed by an `AtomicReference<Instant>` that captures witness
writes.

## Cross-references

- Implementation: `AuthenticationService#offlineCredentialFresh`
  (server/src/main/java/ug/ac/mak/der/security/AuthenticationService.java)
- Config: `SecurityProperties.OfflineCredential`
- FR tie-in: FR-02-06 (shipped at commit `406028b1`), FR-02-10
  (session expiry fail-safe)
- ADR: ADR-0017 security hardening part 1
