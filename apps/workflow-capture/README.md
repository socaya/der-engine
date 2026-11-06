# `@der/app-workflow-capture`

Workflow-run capture app (C-UI-5c slice 5). Replaces
`client/src/screens/CaptureRunList.tsx` and
`client/src/screens/CaptureRunForm.tsx` (ADR-0036) over the
slice-5 rollout. The shell screens are **unchanged** by this
slice — this app and the shell screens coexist. The shell screens
flip to a redirect in a later release.

## Build

```sh
cd client && node scripts/build-apps.mjs
```

Output: `apps/workflow-capture/dist/bundle.js` — a single ESM
module externalling react, react/jsx-runtime, react-dom,
react-router-dom and `@der/app-sdk`.

## Install

From **Admin UI → Settings → App catalogue → Install app**:

- App key: `workflow-capture`
- Display name: `Workflow capture`
- Module: `Data`
- Version: `0.1.0-alpha.1`
- Requires DER API: `1.0.0`
- File: `apps/workflow-capture/dist/bundle.js`

## UI (slice 5)

- Pick a capture workflow from
  `useDerApi().listCaptureWorkflows()`.
- List open runs for the selected workflow via
  `useDerApi().listCaptureRuns()`.
- Click a run to open its inline form card: run summary,
  current-step id, business key, and the current step's
  binding display name pulled from
  `useDerApi().getCaptureRunForm()` with any prefill from
  `getCaptureRunData()`.
- **Start run** inline (operator enters a business key) via
  `useDerApi().startCaptureRun()`.
- **Advance** button on the open run calls
  `useDerApi().advanceCaptureRun()` — slice-5 submit path
  (no data-value editing yet; see follow-ups).
- Online StatusPill reflects `useOnlineStatus()`.

## Pending backend / future slices

Full capture-form parity (per-field editing via the shell's
`CaptureFormRenderer`, aggregate / event write-back, upstream
context merge, D-CAP-8 error-code surfacing) lives in the shell's
`CaptureRunForm.tsx` and migrates in later slice-5 follow-ups.
The slice-5 app surfaces the run and advance path but does not
yet submit field values — the Advance control is the only
writable action.
