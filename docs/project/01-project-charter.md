# Project charter and objectives

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Problem
Centrally hosted DHIS2 sites lose dependable access to shared records, authorisation, metadata and dependent workflow services when central connectivity fails. Browser/device capture can retain isolated drafts but does not inherently create a shared, durable, coordinated application environment for multiple LAN users. Standalone site instances create a separate challenge: safely reconciling local and central records, metadata and permissions.

## General objective
Design, implement and experimentally evaluate a conflict-aware Edge DHIS2 Runtime supporting locally executed, authorised, shared and durable selected workflows, independently of continuous WAN connectivity, with reliable asynchronous central reconciliation.

## Four specific objectives (preserve in reports)
- **OBJ-1 Requirements:** Analyse functional, architecture, persistence, security, metadata, concurrency, recovery and synchronisation needs for full offline execution of selected workflows.
- **OBJ-2 Architecture:** Design a shared local execution and conflict-aware synchronisation architecture with local services, authorised access and background reconciliation.
- **OBJ-3 Implementation:** Implement selected aggregate, event and Tracker workflows over LAN in connected/disconnected modes with persistent commits and data/metadata exchange.
- **OBJ-4 Evaluation:** Experimentally measure compatibility, continuity, cross-client visibility, durability, recovery, concurrent integrity, conflict accuracy, reconciliation and resource consumption.

## Research artefact and evaluation
Deliver executable edge server + clients + shared durable database + background coordinator + conflict review and tests. Test with synthetic datasets and isolated WAN faults while LAN remains operational. Compare equivalent reference behaviours only; log unsupported cases. **No real patient records are required.**

## Success criteria
An authorised client saves a supported record during WAN outage; a second authorised LAN client reads and continues an eligible dependent workflow; selected validation remains functional; local commits survive tested restarts; central exchange produces accountable accepted/rejected/review-required results without silent duplication; evidence is reproducible.

## Reference materials
`MDCSE_Concise_IEEE_Final/Plan_B_Proposal.tex` (provided project proposal), existing SRS and functional/nonfunctional registers. The proposal is the controlling research-scope document, not a claim of implementation.
