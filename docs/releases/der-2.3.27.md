# der-2.3.27 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.26`

## Headline

**Wizard restyle + feature-complete controls.** The guided workflow
designer now looks like the rest of DER (ea-card / ea-form-section /
ea-field-label idiom), carries the three workflow-level toggles it
was missing (enabled, requires-approval, default device), ships a
proper dependency editor, and no longer bounces operators to the
advanced designer when a workflow uses section kinds the wizard
doesn't natively render.

## 1. Style parity

Before: raw inline styles, labels at `--der-ink-500` (looked inactive),
~720 px max-width, generous paddings that left the content area
visibly empty.

After:
- `.ea-screen-header` for the title + subtitle + Advanced link.
- `.ea-card.ea-form-card` wraps every step; `.ea-form-section` for
  each group with a 220 px label gutter matching `EAUserCreate`,
  `EACompatInspector` etc.
- `.ea-field-label` (14 px / 600 / ink-700) for form labels, with
  `.ea-field-hint` (12 px / ink-400) under each.
- Primary text uses `--der-ink-900`; `--der-ink-500` reserved for
  genuinely secondary content.
- Width lifted to 1040 px so the step rows + settings + deps all
  fit the content area.

Reference: this adopts the same tokens EAUserCreate (`admin-ui/src/screens/EACoreScreens.tsx:383`) uses throughout.

## 2. New / completed controls

### Workflow-level panel (step 3)

| Control | Field | Behaviour |
|---|---|---|
| Status | `enabled` | Enabled / Disabled select. Disabled workflows don't accept new runs. |
| Approval gate | `requiresApproval` | "No sign-off" / "Reviewer must sign off before submission". |
| Default device | `defaultDeviceId` | Dropdown of all enrolled devices; "— operator chooses per step —" leaves per-step picks free. |

All three were previously hard-coded (`enabled: true`,
`requiresApproval: false`, `defaultDeviceId: null`). Edit mode
prefills them from the stored workflow.

### Dependency editor

New `DependencyEditor` component on step 3. Rows the operator ticks
appear in both `from` and `to` dropdowns; each dependency carries
`COMPLETES_BEFORE` (the only kind the engine currently honours).
Validation: self-dependency and vanished-step references flagged
inline. Zero rows → the wizard emits the historical linear chain
(step N depends on step N-1).

`buildWorkflowPayload` grew an `explicitDependencies` input that
resolves breakable-id references to the freshly-minted stepIds at
save time.

## 3. "Advanced options" hard-stop removed

Previously, opening a workflow that mixed `AD_HOC` / `COC_SPLIT` /
`TEI_ATTRIBUTE_GROUP` / … steps surfaced:

```
This workflow uses advanced options
It mixes section kinds the guided editor does not model yet.
```

...and bounced the operator to the technical designer. Pilots hit
this on workflows authored before the wizard existed.

`isWizardCompatible(w)` now always returns true. Non-native kinds
appear as regular step rows with an `(advanced · <kind>)` suffix in
the label and are highlighted with `.ea-wizard-rows tr.is-advanced`.
The operator can still enable/disable them, change the role, change
the device, and pick fields. Changing the section binding itself
stays as the one thing that requires the advanced designer (not
blocked — just not exposed in the wizard).

Prefill also tolerates `detectWorkflowType` / `listX` failures so a
workflow bound to a UID that was removed upstream still opens with
its step list intact.

## 4. Verified live

```
Phase A  new workflow                                  ✓ enabled / approval / default-device
                                                         controls render
         deps-add button visible                       ✓
         dep row 0 after add                           ✓
         save → requiresApproval=true, enabled=true,
                                   deps=[COMPLETES_BEFORE]
Phase B  edit mode prefill                             ✓ YES / ENABLED pre-selected
                                                         dep row re-populates
Phase C  advanced-kind (AD_HOC) workflow opens         ✓ no incompat block
                                                         advanced row rendered
Phase D  style parity                                  ✓ .ea-field-label present
pageerrors                                             ✓ 0
admin-ui unit tests                                    241/245 (4 pre-existing baseline)
```

## 5. Files changed

```
admin-ui/src/screens/workflow/WorkflowWizard.tsx         — restyle + settings panel
                                                           + DependencyEditor
                                                           + advanced-kind rows
                                                           + resilient prefill
admin-ui/src/screens/workflow/wizardMetadata.ts          — buildWorkflowPayload accepts
                                                           enabled / requiresApproval /
                                                           defaultDeviceId / explicitDependencies
                                                           + WIZARD_NATIVE_KINDS export
                                                           + isWizardCompatible now permissive
admin-ui/src/styles.css                                  — ea-wizard-* rewrite:
                                                           ea-wizard-type-grid, ea-wizard-pick,
                                                           ea-wizard-steps, ea-wizard-deps,
                                                           ea-wizard-rows alignment with ea-table,
                                                           ink-900 primary / ink-500 only secondary
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.27
```

## 6. Build + test

```
tsc -b && vite build          ✓
mvn -q -DskipTests package    ✓ 2.3.27 JAR
End-to-end 4-phase sweep      ✓ zero pageerrors
```
