# UI design system and navigation architecture

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Intended look and feel
Institutional, minimal, soft neutral backgrounds, strong readable typography (Arial or comparable), modest elevation, thin/subtle separators only where needed, limited colour vocabulary, no decorative badge overload. Maintain DHIS2 familiar terminology and app patterns when reusing platform applications.

## Two experiences
**Device client:** local sign-in -> authorised launcher -> aggregate/event/Tracker forms -> record details -> accurate sync status. **Edge administration:** overview; synchronisation; conflicts; metadata; security/recovery; settings. Admin should not appear as an option to standard users.

## Components
Responsive app shell, breadcrumb, context banner (edge available / central unavailable), accessible data tables, filters, form controls, save-state indicator, validation summary, modal confirmation for destructive actions, conflict comparison, audit timeline, skeleton/empty/error views, notification region. Status descriptions must separate local from central success.

## Responsive and interaction rules
Desktop 1280+, tablet 768-1279, small devices <768 as design **breakpoint proposals**, to be tested on actual supported hardware. No horizontal clipping of data entry fields; tables may use responsive overflow with accessible headings. Label every control; visible focus; keyboard operable dialogs; no colour-only critical status.

## Screen production workflow
For each `DC-*` and `EA-*` screen: purpose and authorised role; routed URL; source API; fields; primary/secondary actions; validation/error/empty/loading/pending/denied/conflict/offline states; responsive spec; acceptance checks; status `specified|reused|implemented|verified`. Individual screen documents follow under `ui/screens/`.
