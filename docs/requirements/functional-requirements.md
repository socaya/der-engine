# Complete functional requirements register

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.


The following are the **full 176 baseline requirement statements**, retained verbatim from the previous register. P0/P1/P2 designate intended priority, **not evidence of implementation**. Each requirement must eventually be mapped to code and a passing acceptance test.

### FR-01-01 — Site registration (P0)
**Module:** Provisioning and site configuration  
**Shall requirement:** Create stable edge-node identity, site name, organisation-unit scope and central-system registration.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-02 — Central connection setup (P0)
**Module:** Provisioning and site configuration  
**Shall requirement:** Configure verified central endpoint, supported DHIS2 version, secure trust configuration and network routes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-03 — Provisioning credentials (P0)
**Module:** Provisioning and site configuration  
**Shall requirement:** Enrol the edge with scoped central integration credentials without exposing secrets.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-04 — Initial readiness checks (P0)
**Module:** Provisioning and site configuration  
**Shall requirement:** Verify time, DNS, certificates, storage, database, network and dependencies before activation.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-05 — Bootstrap metadata (P0)
**Module:** Provisioning and site configuration  
**Shall requirement:** Import the authorised complete dependency set for selected workflows and retain its fingerprint.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-06 — Bootstrap records (P0)
**Module:** Provisioning and site configuration  
**Shall requirement:** Seed authorised working records using scoped retrieval and checkpoints.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-07 — Site configuration (P1)
**Module:** Provisioning and site configuration  
**Shall requirement:** Manage configurable connectivity policies, limits, local URL and time-zone settings.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-08 — Reproducible deployment (P1)
**Module:** Provisioning and site configuration  
**Shall requirement:** Install or redeploy the selected architecture using versioned scripts and configuration.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-09 — Controlled upgrade (P1)
**Module:** Provisioning and site configuration  
**Shall requirement:** Check compatibility and provide rollback strategy before local runtime upgrades.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-01-10 — Decommissioning (P1)
**Module:** Provisioning and site configuration  
**Shall requirement:** Revoke credentials, preserve audit/export evidence and securely retire the site.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-01 — Offline login (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Authenticate previously provisioned and authorised users without central availability.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-02 — Identity provisioning (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Synchronise permitted user identity and credential material using an approved secure mechanism.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-03 — Session management (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Issue, refresh and expire local sessions independently of WAN reachability.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-04 — Login protection (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Apply rate limits, failed-attempt control and relevant account lock policies.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-05 — Credential protection (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Store only permitted password verifiers or keys; never persist plaintext secrets.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-06 — Expiry policy (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Enforce local offline login age, credential expiry and revalidation policy.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-07 — Unprovisioned users (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Deny first-time offline authentication unless a specifically approved provisioning method exists.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-08 — User lifecycle (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Update or disable locally provisioned users upon central change and record effective scope.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-09 — Break-glass access (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Support a formally configured, audited emergency-access policy only if approved.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-02-10 — Clock and token safety (P0)
**Module:** Local identity and authentication  
**Shall requirement:** Handle clock skew and token expiry with explicit fail-safe decisions.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-01 — Role permissions (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Enforce applicable local read, create, edit, delete and approval permissions.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-02 — Organisation scope (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Restrict all application and API operations to assigned organisation units and descendants.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-03 — Program and data-set scope (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Restrict access to permitted DHIS2 programs, stages, data sets and data elements.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-04 — Record filtering (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Filter local searches and listings to records authorised for the acting user.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-05 — Server-side enforcement (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Enforce permissions in local APIs irrespective of frontend state.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-06 — Permission snapshots (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Version and timestamp imported permissions and track stale authorisations.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-07 — Privileged-operation policy (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Block operations requiring unavailable current central authority.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-08 — Revocation reconciliation (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Apply central revocations after restoration and review operations performed under stale grants.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-09 — Service isolation (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Ensure synchronisation service credentials cannot be used for general user activity.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-03-10 — Security event audit (P0)
**Module:** Authorisation and data isolation  
**Shall requirement:** Record denied access, permission changes and sensitive administration operations.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-01 — Local primary endpoint (P0)
**Module:** Local application/API execution  
**Shall requirement:** Direct all participating LAN clients to the edge for supported workflows in every connectivity mode.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-02 — Application availability (P0)
**Module:** Local application/API execution  
**Shall requirement:** Serve supported DHIS2 application resources without central live dependencies.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-03 — Dependency resolution (P0)
**Module:** Local application/API execution  
**Shall requirement:** Resolve the documented subset of required frontend requests against local services.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-04 — API compatibility (P0)
**Module:** Local application/API execution  
**Shall requirement:** Return version-appropriate response structures and HTTP outcomes for declared supported routes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-05 — Local validations (P0)
**Module:** Local application/API execution  
**Shall requirement:** Run applicable server and client validation for supported operations while disconnected.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-06 — Error semantics (P0)
**Module:** Local application/API execution  
**Shall requirement:** Communicate unsupported operations distinctly from temporary failures and invalid input.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-07 — Cross-client refresh (P0)
**Module:** Local application/API execution  
**Shall requirement:** Expose newly committed records to other authorised clients, through refresh/poll or optional notifications.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-08 — Local search (P0)
**Module:** Local application/API execution  
**Shall requirement:** Support search, pagination and retrieval for declared aggregate, event and Tracker records.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-09 — Date/time handling (P0)
**Module:** Local application/API execution  
**Shall requirement:** Apply consistent locale, date, time-zone and period semantics.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-04-10 — Compatibility manifest (P0)
**Module:** Local application/API execution  
**Shall requirement:** Publish supported DHIS2 release, workflows, operations and known deviations.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-01 — Dependency closure (P0)
**Module:** Metadata and rules  
**Shall requirement:** Identify and cache all metadata dependencies of selected workflows.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-02 — Data elements and categories (P0)
**Module:** Metadata and rules  
**Shall requirement:** Manage supported data elements, category combinations and category options.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-03 — Data sets (P0)
**Module:** Metadata and rules  
**Shall requirement:** Manage data sets, periods, sections and permitted organisation units.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-04 — Tracker metadata (P0)
**Module:** Metadata and rules  
**Shall requirement:** Manage tracked entity types, attributes, programs, enrolments and stages.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-05 — Options and translations (P0)
**Module:** Metadata and rules  
**Shall requirement:** Manage relevant option sets, option groups and displayed names.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-06 — Program rules (P0)
**Module:** Metadata and rules  
**Shall requirement:** Execute defined supported program-rule actions and expressions locally.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-07 — Validation rules (P0)
**Module:** Metadata and rules  
**Shall requirement:** Apply supported mandatory, range, uniqueness and cross-field validations.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-08 — Metadata versions (P0)
**Module:** Metadata and rules  
**Shall requirement:** Store source versions, retrieval time and fingerprints for dependent objects.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-09 — Safe metadata refresh (P0)
**Module:** Metadata and rules  
**Shall requirement:** Validate references before activating new metadata packages.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-10 — Metadata drift impact (P0)
**Module:** Metadata and rules  
**Shall requirement:** Identify pending operations made against changed or incompatible definitions.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-11 — Quarantine incompatible work (P0)
**Module:** Metadata and rules  
**Shall requirement:** Prevent silent reinterpretation of affected pending changes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-05-12 — Metadata diagnostics (P0)
**Module:** Metadata and rules  
**Shall requirement:** Present missing dependencies, mismatches and effective local configuration.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-01 — Data set selection (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Open locally available authorised data sets by org unit and reporting period.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-02 — Aggregate data entry (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Create and modify selected aggregate data values with complete compound keys.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-03 — Category and period validation (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Apply category combination, period and value-type rules.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-04 — Shared aggregate visibility (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Show committed values to a second authorised client during WAN outage.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-05 — Concurrent key updates (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Detect stale or competing writes to identical aggregate-value keys.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-06 — Report completion (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Support configured save/completeness states within supported scope.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-07 — Aggregate exchange (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Prepare supported dataValueSets and interpret central acceptance/rejection.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-06-08 — Aggregate reconciliation (P0)
**Module:** Aggregate reporting  
**Shall requirement:** Resolve independently changed central aggregate values according to policy.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-01 — Event creation (P0)
**Module:** Event capture  
**Shall requirement:** Create permitted standalone events using stable supported identities.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-02 — Event editing (P0)
**Module:** Event capture  
**Shall requirement:** Update permitted event data with expected-version checks.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-03 — Event retrieval (P0)
**Module:** Event capture  
**Shall requirement:** Search and view events from the local persistent store.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-04 — Event validation (P0)
**Module:** Event capture  
**Shall requirement:** Apply stage, program, option, type and required-value checks.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-05 — Org-unit and user rules (P0)
**Module:** Event capture  
**Shall requirement:** Enforce applicable ownership and organisation permissions.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-06 — Event history (P0)
**Module:** Event capture  
**Shall requirement:** Track local changes and sync status without losing prior evidence.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-07 — Event import (P0)
**Module:** Event capture  
**Shall requirement:** Exchange events via target-version supported Tracker/event API methods.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-07-08 — Event conflicts (P0)
**Module:** Event capture  
**Shall requirement:** Identify central divergence, deletion and duplicate event identity.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-01 — Tracked entity creation (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Create and persist tracked entities with required attributes and stable identities.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-02 — Tracker search (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Find permitted tracked entities locally using indexed authorised fields.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-03 — Tracker updates (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Update tracked entity attributes with version checks.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-04 — Enrolment lifecycle (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Create and maintain permitted enrolments and statuses.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-05 — Program-stage events (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Create and edit enrolment-linked events by configured stage.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-06 — Relationships (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Preserve permitted tracked-entity and event relationships with referential integrity.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-07 — Dependent workflow continuity (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Permit one authorised user to continue workflow steps from another user’s committed changes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-08 — Uniqueness checks (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Apply locally evaluable unique-attribute constraints and flag central collisions.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-09 — Rules and transitions (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Enforce supported program rules, mandatory fields and guarded state changes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-10 — Tracker graph reconciliation (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Synchronise entity, enrolment, event and relationship dependencies in safe order.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-11 — Central import findings (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Interpret per-object import errors, accepted results and conflicts.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-08-12 — Tracker audit (P0)
**Module:** Tracker and dependent workflows  
**Shall requirement:** Retain actor, operation identity and locally committed workflow history.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-01 — ACID local commits (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Use transactional persistence for supported records and invariant checks.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-02 — Atomic outbox creation (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Persist accepted business change and its synchronisation journal entry atomically.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-03 — Stable operation identity (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Assign globally unique operation identifiers and maintain source identities.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-04 — Local sequence (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Maintain an ordered, durable per-edge commit sequence or equivalent cursor.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-05 — Reference integrity (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Protect entity, enrolment, event and metadata relationships.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-06 — Optimistic concurrency (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Reject or classify changes with unexpected record version.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-07 — Duplicate local submission (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Identify repeated client requests without creating unintended business effects.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-08 — Read-after-write (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Make committed changes visible across authorised sessions after successful commit.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-09 — Query performance (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Index required local lookup and workflow fields.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-09-10 — Retention and purge (P0)
**Module:** Shared data and transaction integrity  
**Shall requirement:** Retain unresolved operations; purge only by approved retention policy.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-01 — Local write collision (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Detect simultaneous incompatible modifications within the edge.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-02 — Central divergence (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Detect conflicts when central state changed independently during separation.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-03 — Conflict taxonomy (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Classify stale-version, uniqueness, delete/update, permission, metadata and relationship conflicts.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-04 — Safe automatic merge (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Only merge explicitly approved compatible operations under preserved invariants.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-05 — No blind last-write-wins (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Never silently overwrite meaningful changes solely by latest timestamp.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-06 — Review cases (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Create durable review cases preserving source, actor, payload and competing values.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-07 — Human review (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Provide authorised accept/reject/rework decision operations.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-08 — Resolution auditing (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Record reviewer, rationale, timestamp and effects of every resolution.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-09 — Retry after resolution (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Return a resolved operation to eligible processing when appropriate.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-10-10 — Conflict metrics (P0)
**Module:** Conflict detection and resolution  
**Shall requirement:** Report true-positive, false-positive and false-negative cases in experiments.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-01 — Journal schema (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Persist operation identity, entity scope, event type, metadata version, dependency and payload reference.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-02 — State machine (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Support locally committed, pending, leased, uncertain, centrally accepted, rejected and review-required states.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-03 — Attempt history (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Persist requests, attempt numbers, timings, results and central correlation IDs.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-04 — Crash-safe leases (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Reclaim abandoned in-progress work without losing the operation.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-05 — Explicit acknowledgement (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Require defensible central acceptance evidence before final accepted status.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-06 — Replay protection (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Associate retries with stable identities and inspect central effects where supported.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-07 — Dead-letter handling (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Retain permanently rejected or malformed operations with diagnostics.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-08 — Journal queries (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Allow scoped inspection and export of journal status for administration and tests.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-09 — Checkpoint management (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Persist sync cursors only after associated effects are durably acknowledged.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-11-10 — Ordering constraints (P0)
**Module:** Durable journal and sync state  
**Shall requirement:** Protect object dependencies and sequence-sensitive changes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-01 — WAN detection (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Detect central reachability independently of local service availability.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-02 — Asynchronous scheduling (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Submit eligible operations without blocking local request completion.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-03 — Batch selection (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Choose eligible changes by dependency, scope and configured batch limits.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-04 — Target-specific adapters (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Use verified API contracts for the pinned DHIS2 target version.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-05 — Transport security (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Authenticate and encrypt central transmissions.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-06 — Import inspection (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Interpret overall and per-object import success, ignored items, conflicts and errors.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-07 — Retry policy (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Use bounded exponential backoff, jitter and retry classifications.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-08 — Lost-response recovery (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Resolve uncertain central effects without claiming exactly-once delivery.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-09 — Rate control (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Limit sync concurrency and impact on local workflow processing.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-10 — Pause and resume (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Allow safe worker pause, resume and graceful stop.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-11 — Backlog reporting (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Measure queued, attempted, accepted, rejected and unresolved work.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-12-12 — Continuous operation (P0)
**Module:** Edge-to-central synchronisation  
**Shall requirement:** Continue local workflows throughout backlog draining and reconciliation.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-01 — Remote change retrieval (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Retrieve centrally modified permitted records using supported version-specific mechanisms.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-02 — Scope filtering (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Limit pulled records to authorised local data scope.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-03 — Remote cursor (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Persist the point of confirmed remote import where supported.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-04 — Apply central changes (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Apply compatible remote changes transactionally to local state.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-05 — Divergence check (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Do not overwrite locally pending changes with an unreviewed central version.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-06 — Metadata refresh pipeline (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Stage, verify and activate central metadata updates safely.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-07 — Permission refresh (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Incorporate relevant central identity and authorisation changes.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-08 — Remote deletion handling (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Handle remote removal/unavailability according to defined retention and reconciliation policies.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-09 — Restartable refresh (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Resume interrupted remote pulls without duplicate side effects.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-13-10 — Freshness reporting (P0)
**Module:** Central-to-edge refresh  
**Shall requirement:** Display last confirmed refresh and stale scope status.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-01 — Connected mode (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Keep local execution primary when central WAN is available.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-02 — Disconnected mode (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Preserve supported workflows with no live central requests.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-03 — Recovery mode (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Resume reconciliation without taking the local application offline.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-04 — Worker restart (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Resume journal processing after sync process crashes/restarts.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-05 — Application restart (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Recover all previously acknowledged local commits after runtime restart.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-06 — Database recovery (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Use storage recovery procedure with integrity verification.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-07 — Backup (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Create consistent backups covering local working state, metadata and pending journal.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-08 — Restore (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Restore tested snapshots and re-establish a safe reconciliation checkpoint.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-09 — Storage alarms (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Warn or safely reject new operations when durable storage cannot be assured.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-10 — Clock skew (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Detect material drift affecting operation ordering, expiry and observability.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-11 — Graceful shutdown (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Drain or release leases and finish/rollback in-flight local transactions safely.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-14-12 — Failure boundary (P0)
**Module:** Connectivity and resilience  
**Shall requirement:** Explicitly state no operation guarantee during complete LAN, edge host or power failure.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-01 — Site dashboard (P0)
**Module:** Operational administration  
**Shall requirement:** Show edge identity, location scope, software version and health.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-02 — Connectivity panel (P0)
**Module:** Operational administration  
**Shall requirement:** Show central reachability, last successful exchange and offline duration.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-03 — Sync dashboard (P0)
**Module:** Operational administration  
**Shall requirement:** Display queue totals, sync outcomes, processing rates and backlog age.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-04 — Conflict workspace (P0)
**Module:** Operational administration  
**Shall requirement:** Allow authorised review and explanation of unresolved conflicts.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-05 — Metadata inspector (P0)
**Module:** Operational administration  
**Shall requirement:** Show current metadata version and compatibility warnings.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-06 — User scope viewer (P1)
**Module:** Operational administration  
**Shall requirement:** Inspect provisioned users and effective permission age.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-07 — Backup tools (P1)
**Module:** Operational administration  
**Shall requirement:** Schedule and verify backup/restore procedures.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-08 — Configuration editor (P1)
**Module:** Operational administration  
**Shall requirement:** Change approved settings with validation and audit records.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-09 — Support bundle (P1)
**Module:** Operational administration  
**Shall requirement:** Export sanitised logs, configuration and evidence for diagnosis.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-15-10 — Operational reporting (P1)
**Module:** Operational administration  
**Shall requirement:** Generate local operational summaries without falsely claiming central acceptance.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-01 — TLS on LAN (P0)
**Module:** Security and audit  
**Shall requirement:** Use authenticated encrypted client-to-edge transport.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-02 — TLS to central (P0)
**Module:** Security and audit  
**Shall requirement:** Validate central certificates and protect outbound exchanges.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-03 — Secret isolation (P0)
**Module:** Security and audit  
**Shall requirement:** Store service credentials in protected configuration or secret storage.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-04 — Least privilege (P0)
**Module:** Security and audit  
**Shall requirement:** Separate end-user, administrator, reviewer and sync-worker authorities.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-05 — Audit trail (P0)
**Module:** Security and audit  
**Shall requirement:** Log security-sensitive changes and resolution decisions with correlation IDs.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-06 — Log sanitisation (P0)
**Module:** Security and audit  
**Shall requirement:** Exclude passwords, access tokens and unnecessary sensitive payloads from logs.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-07 — Data at rest (P0)
**Module:** Security and audit  
**Shall requirement:** Apply documented appropriate database/filesystem protection and backup encryption.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-08 — Tenant/site boundaries (P0)
**Module:** Security and audit  
**Shall requirement:** Deny cross-site record access beyond explicitly assigned scope.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-09 — Session fixation protection (P0)
**Module:** Security and audit  
**Shall requirement:** Use secure session cookie/token semantics and logout invalidation.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-10 — Stale-permission handling (P0)
**Module:** Security and audit  
**Shall requirement:** Apply fail-safe permissions when central access changes while offline.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-11 — Import validation (P0)
**Module:** Security and audit  
**Shall requirement:** Validate and constrain central payload and metadata ingestion.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-16-12 — Administrative accountability (P0)
**Module:** Security and audit  
**Shall requirement:** Require authenticated authorisation for backup, import and conflict overrides.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-01 — Synthetic fixtures (P0)
**Module:** Testability and evidence  
**Shall requirement:** Generate seeded aggregate/event/Tracker inputs without personal data.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-02 — WAN fault injection (P0)
**Module:** Testability and evidence  
**Shall requirement:** Deterministically disconnect and restore only the WAN while keeping LAN alive.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-03 — Concurrent workload driver (P0)
**Module:** Testability and evidence  
**Shall requirement:** Run defined simultaneous client updates and dependent workflow steps.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-04 — Compatibility oracle (P0)
**Module:** Testability and evidence  
**Shall requirement:** Compare selected inputs, validation responses and resulting records with reference DHIS2.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-05 — Conflict oracle (P0)
**Module:** Testability and evidence  
**Shall requirement:** Define expected conflict classes and compute precision and recall.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-06 — Durability verification (P0)
**Module:** Testability and evidence  
**Shall requirement:** Confirm committed data/journal survive defined restarts.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-07 — Sync reconciliation oracle (P0)
**Module:** Testability and evidence  
**Shall requirement:** Compare central and local intended effects after recovery.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-08 — Resource measurements (P1)
**Module:** Testability and evidence  
**Shall requirement:** Capture CPU, RAM, disk, latency and throughput.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-09 — Result export (P1)
**Module:** Testability and evidence  
**Shall requirement:** Export experiment configuration, inputs, failures and measured outputs.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.

### FR-17-10 — Regression suite (P1)
**Module:** Testability and evidence  
**Shall requirement:** Run automated integration tests for all declared supported workflows.  
**Implementation contract:** Specify the responsible component, observable input/output and failure behaviour during design.  
**Verification:** Positive case; denied/invalid case; WAN-outage effect where relevant; evidence ID assigned in `verification/traceability-matrix.csv`.
