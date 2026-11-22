# DER Android — pilot runbook (0.1.0-alpha)

Operational guide for standing up a pilot of the native Android
client built per ADR-0041. Targets 5+ devices at one facility,
running alongside an existing DER edge.

The engineering roadmap (Phases 1–10) is complete and the app builds
a signed Android App Bundle. Phase 11 — this document plus the live
pilot — is the field exercise that verifies the app hits its exit
criteria before we open the Internal track to a wider audience.

## Scope

- **In**: single-facility pilot; 5–20 devices; CHW capture + operator
  dashboard + supervisor approvals.
- **Out**: multi-facility rollout; patient-identifiable data on
  unapproved devices; biometric unlock on devices with no enrolled
  biometric (the app falls back to Sign out).

## Exit criteria

| Metric | Target |
|---|---|
| Devices in the pilot | ≥ 5 |
| Days running | ≥ 14 continuous |
| Crash-free session rate | ≥ 99% |
| Capture end-to-end latency, median | ≤ 60 s from Save to visible in DER |
| Operator-reported blockers | ≤ 2 open at end of pilot |
| Offline capture → drain success rate | ≥ 99% within 24 h of reconnect |

## Pre-pilot checklist

### Server-side (DER edge)

- [ ] DER edge is running 2.4.x or later with Phase 7 workflow + Phase 8 approvals.
- [ ] `/edge-api/v1/system/info` returns 200 for an admin session.
- [ ] A test device enrols + signs in from a laptop + round-trips a
      dataValueSet successfully (web client smoke test).
- [ ] At least one workflow has `ownerDeviceId` on its steps so the
      distributed-handoff path is exercisable.
- [ ] Referral inbox has a non-empty seed row for supervisors to
      exercise Accept/Dismiss.

### Device-side (per tablet)

- [ ] Android 7 (API 24) or newer.
- [ ] 2 GB RAM minimum; 4 GB recommended.
- [ ] Biometric hardware (fingerprint or face) enrolled in Android
      Settings, OR a device PIN set (the biometric unlock falls back
      to device credential).
- [ ] Clinic Wi-Fi SSID known + autoconnect enabled.
- [ ] Device date + time set to automatic (DHIS2 rejects submissions
      with skewed clocks).
- [ ] Optional: screen pin / kiosk mode on if the tablet is shared.

### Release artefact

- [ ] `./gradlew :app:bundleRelease` succeeds on a machine with the
      production keystore configured (per README).
- [ ] The resulting `.aab` is uploaded to the Play Console →
      **Internal testing** track.
- [ ] Each tester's email is added to the Internal testing testers
      list.
- [ ] Release notes (`docs/releases/android-0.1.0-alpha.md`) link
      is included in the Play Console "What's new in this release"
      field.

## Day-0 enrolment flow (per device)

1. Tester opens the Play Internal track link + installs **DER**.
2. First launch → SignIn with facility credentials.
3. Device auto-enrols via `POST /edge-api/v1/devices/enroll`.
4. App shows **Waiting for admin approval**; the device appears in
   the admin-UI Devices → Enrolment queue within ~5 s.
5. Admin clicks Approve.
6. Device polls `/edge-api/v1/devices/{id}` and flips to Home within
   ~10 s.
7. Tester opens Settings → Security → toggles **Require biometric
   unlock** on.
8. Tester runs a one-shot smoke capture: Data entry → pick a
   dataset → fill → Save. Row should appear in the web client's
   Data overview within ~60 s.

## Daily operations

- **Edge reachability**: the Dashboard tile is green when the app
  can reach the edge; red if not. Clinic LAN flaps are expected and
  the capture journal rides them.
- **Pending captures**: the Dashboard's Sync queue card shows a live
  count. Operators can hit Drain now to force an immediate retry.
- **Approvals**: supervisors open Approvals every morning to clear
  overnight queue + accept any routed-in referrals.
- **Workflow**: CHWs work through their service-point queue from the
  Workflow tile. Each ready row → Advance step; the client posts to
  the edge and broadcasts a DPP/1 frame to any nearby peer.

## Failure modes + recovery

| Symptom | Likely cause | Recovery |
|---|---|---|
| "Device not approved yet" screen stays after admin approves | Device polling backoff; tap **Check again** | Approval propagates within 4 s poll cycle |
| **Offline** indicator on Dashboard | Wi-Fi dropped; edge down | App queues captures locally; drains on reconnect |
| **Save failed** on Data entry / Capture | Mismatched period format; OU UID typo | Edge returns 400 — journal row goes FAILED; operator edits via Drafts (Phase 11+) or clears via Settings → Clear local data if nothing else works |
| Biometric prompt appears every launch and never succeeds | Biometric unenrolled after preference set | **Sign out instead** button → sign in fresh; toggle preference off from Settings |
| Repeated 401 on every request | Session cookie expired or server restarted | App drops to SignIn automatically on next request; sign in again |
| Device shows **Device blocked** | Admin suspended/revoked in admin-UI | Sign out, raise with admin, re-enrol if approved to return |
| Approval queue empty but web shows pending | Role mismatch — the Android user's role doesn't include the step's ownerRole | Check Settings → Diagnostics → Signed in as; have admin adjust role grants |

## Feedback

Operators open **Settings → Send feedback to support** to compose
an email with device diagnostics pre-filled:

- app version + build
- device UUID + user agent
- signed-in username
- pending capture count
- server URL
- last-crash stack trace (if the app crashed since the previous launch)

Emails route to `support@der.example.org` (override before upload
via `FeedbackComposer.launch(recipient = ...)` — kept as a constant
to avoid a Settings input that would make this screen edit-able).

## Pilot close-out

When the exit criteria above are met (or timebox elapses):

1. Pull the last-crash files from every device (via feedback emails)
   + tally the crash-free session rate.
2. Collect operator-reported blockers.
3. Write a release note with pilot findings as a Phase 11 appendix.
4. If exit criteria hit → promote the same `.aab` to the **Closed
   testing** track, expand to adjacent facilities.
5. If not → file follow-on tickets, cut Phase 11.x or a 0.1.1-alpha
   point release, re-run the pilot.
