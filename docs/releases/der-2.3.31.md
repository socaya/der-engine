# der-2.3.31 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.30`

## Headline

**Queue auto-scopes to the operator's preferred device.** No more
hunting the dropdown on every page load — pick a device once and the
queue remembers. True device-authenticated principal is deferred;
this release ships the operator-facing half via a saved user
preference.

## 1. Server

### `GET /edge-api/v1/workflows/queue`

- New query param `?allDevices=true` opts out of the saved scope.
- When `?deviceId=X` is supplied → scope by X (unchanged).
- When neither is supplied → read
  `user_preference(workflow.preferredDeviceId)` and auto-scope.
- Response grew two keys so the UI can display what's happening:

```
{
  "rows": [...],
  "appliedDeviceId": "<uuid> | null",
  "deviceScopeSource": "QUERY" | "PREFERENCE" | "NONE"
}
```

`CaptureWorkflowController` grew a `UserPreferenceService` dep +
`PREF_PREFERRED_DEVICE` constant.

## 2. Admin UI

Queue page:
- On load, hydrates its device dropdown from the saved pref so the
  operator sees what's active.
- Changing the dropdown POSTs the new value to
  `/user-prefs/workflow.preferredDeviceId` (or DELETEs when "All
  devices" is chosen).
- Field-hint reflects `deviceScopeSource`:
  - PREFERENCE → "Auto-scoped from your saved preferred device."
  - QUERY → "Scoped by explicit filter."
  - NONE → "All devices in view — pick one to auto-scope on next load."

Switch to `.ea-field` / `.ea-field-label` idiom so the dropdown
matches the wizard restyle (2.3.27).

## 3. Verified live

```
POST /user-prefs/workflow.preferredDeviceId     ✓
GET /queue                                       ✓ scope=PREFERENCE applied=<uuid>
GET /queue?allDevices=true                       ✓ scope=NONE
GET /queue?deviceId=<other>                      ✓ scope=QUERY (query wins over pref)
UI hint after reload                             ✓ "Auto-scoped from your saved …"
CaptureWorkflowControllerTest                    ✓ 20/20
```

## 4. Files changed

```
server/.../web/CaptureWorkflowController.java            — + UserPreferenceService dep,
                                                             + allDevices query param,
                                                             + appliedDeviceId / deviceScopeSource
                                                             on the response
server/.../web/CaptureWorkflowControllerTest.java        — + MockBean UserPreferenceService
admin-ui/src/api/edgeApi.ts                              — workflowQueue({deviceId, allDevices});
                                                           readAllUserPrefs / writeUserPref /
                                                           deleteUserPref / PREF_PREFERRED_DEVICE
admin-ui/src/screens/workflow/WorkflowQueue.tsx          — ea-field idiom, persist pref on change,
                                                             scope-source hint, hydrate from pref
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.31
```

## 5. Follow-up (true device auth)

A device-authenticated principal (DER-MSG v2 device-level JWT already
in the stack) is still a future release — once sessions carry a
device identity, the controller will prefer that over the saved pref
and no operator-facing config will be needed. Today's user-pref
mechanism is the pilot-friendly bridge.
