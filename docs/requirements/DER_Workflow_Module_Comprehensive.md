# DHIS2 Edge Runtime (DER) Workflow Module

**Module:** DER Workflow Module  
**Project:** DHIS2 Edge Runtime (DER)  
**Document Type:** Functional and Technical Module Specification  
**Scope:** Multi-user, multi-device, facility-level DHIS2 workflow execution, assembly, continuity, conflict handling, metadata control, and synchronisation.

---

# 1. Purpose

The DER Workflow Module provides the facility-level runtime needed to execute DHIS2 workflows across multiple users and devices while maintaining one shared, coherent, DHIS2-compatible workflow state.

The module is responsible for more than offline data capture. It must:

- Support distributed participation by multiple users, devices, and service points.
- Merge partial workflow contributions into complete DHIS2-compatible structures.
- Preserve the logical identity of DHIS2 data and metadata.
- Make data produced in one workflow step available to dependent workflow steps.
- Maintain workflow continuity over the facility LAN when WAN connectivity is unavailable.
- Execute validation rules and relevant program rules locally.
- Track metadata versions and prevent unsafe metadata changes from corrupting active local workflows.
- Detect and resolve conflicts at meaningful logical boundaries.
- Persist a durable operation journal for retry, reconstruction, recovery, and audit.
- Generate valid DHIS2-compatible payloads for central synchronisation.
- Reconcile local and central state safely when connectivity returns.
- Preserve traceability across users, devices, workflow steps, metadata versions, and sync operations.

The module therefore acts as a **shared facility workflow runtime**, not merely a cache or offline queue.

---

# 2. Core Architectural Principle

DER treats workflow execution as distributed, but workflow state as unified.

```text
Multiple Users / Devices
        |
        v
Partial Workflow Contributions
        |
        v
Workflow Assembly / Merge Engine
        |
        +-- identity matching
        +-- structural validation
        +-- field/value merge
        +-- conflict detection
        +-- metadata compatibility
        +-- rule evaluation
        |
        v
Canonical Workflow State
        |
        +-- exposed to dependent local workflows
        +-- visible to authorised users/devices
        +-- retained for audit and recovery
        +-- transformed into DHIS2 payloads
        |
        v
Synchronisation Engine
        |
        v
Central DHIS2
```

---

# 3. Module Responsibilities

The Workflow Module shall provide the following major capabilities:

1. Workflow definition interpretation.
2. Workflow instance creation.
3. Multi-user participation.
4. Multi-device participation.
5. Shared workflow state.
6. Partial data assembly.
7. Canonical state materialisation.
8. Workflow dependency management.
9. Workflow readiness calculation.
10. Local validation.
11. Local rule execution.
12. Completion management.
13. Approval-state handling where applicable.
14. Conflict detection.
15. Conflict resolution.
16. Metadata snapshot management.
17. Metadata compatibility checking.
18. Local operation journaling.
19. DHIS2 payload construction.
20. Data synchronisation.
21. Metadata synchronisation.
22. Retry and recovery.
23. Audit and traceability.
24. Queue and assignment management.
25. Local authentication and access control.
26. Optional peer-to-peer exchange.

---

# 4. Supported Workflow Families

DER supports three primary workflow families.

```text
DER WORKFLOWS
|
+-- 1. DATA-CAPTURE WORKFLOWS
|   |
|   +-- Aggregate Data Set
|   +-- Event Program
|   +-- Tracker Program
|
+-- 2. METADATA WORKFLOWS
|   |
|   +-- Discovery
|   +-- Download
|   +-- Dependency Resolution
|   +-- Validation
|   +-- Versioning
|   +-- Staging
|   +-- Activation
|   +-- Migration
|   +-- Supersession
|
+-- 3. SYNCHRONISATION / CONTROL WORKFLOWS
    |
    +-- Local to Central Data Sync
    +-- Central to Edge Metadata Sync
    +-- Conflict Management
    +-- Retry / Recovery
    +-- Completion / Approval
    +-- Access Refresh
    +-- Optional Peer-to-Peer Sync
```

---

# 5. Facility Runtime Context

DER operates between the central DHIS2 server and users within the facility.

```text
                         CENTRAL DHIS2
                               |
                               | WAN
                               |
                               v
                    +----------------------+
                    |   DER FACILITY NODE  |
                    +----------------------+
                    | Metadata Repository  |
                    | Workflow Engine      |
                    | Merge Engine         |
                    | Dependency Engine    |
                    | Canonical State      |
                    | Rule Engine          |
                    | Validation Engine    |
                    | Conflict Manager     |
                    | Sync Journal         |
                    | Payload Builder      |
                    | Local Event Bus      |
                    | Access Control       |
                    +----------+-----------+
                               |
                         Facility LAN/Wi-Fi
                               |
       +-----------------------+------------------------+
       |                       |                        |
       v                       v                        v
 Registration             Consultation              Laboratory
 User / Device            User / Device             User / Device
       |                       |                        |
       +-----------------------+------------------------+
                               |
                               v
                           Pharmacy
                           User / Device
```

---

# 6. Shared Facility State

All authorised local devices should interact with the same shared workflow state.

A record created or updated on one device should become available to other authorised devices without requiring a central DHIS2 round trip.

```text
Device A
   |
   v
DER Shared State
   |
   +--> Device B
   +--> Device C
   +--> Device D
```

The device is not the owner of the workflow. It is an execution point.

---

# 7. Common Workflow Model

## 7.1 Workflow Definition

```text
WorkflowDefinition
|
+-- id
+-- uid
+-- name
+-- type
+-- metadataSnapshotId
+-- organisationUnitScope
+-- steps[]
+-- dependencies[]
+-- rules[]
+-- constraints[]
+-- permissions[]
+-- version
```

---

## 7.2 Workflow Instance

```text
WorkflowInstance
|
+-- id
+-- definitionId
+-- workflowType
+-- organisationUnit
+-- metadataSnapshotId
+-- state
+-- revision
+-- participants[]
+-- currentSteps[]
+-- completedSteps[]
+-- dependencyState
+-- validationState
+-- conflictState
+-- syncState
+-- createdAt
+-- updatedAt
```

---

# 8. Actor Model

## 8.1 User

```text
User
|
+-- uid
+-- username
+-- displayName
+-- roles[]
+-- groups[]
+-- organisationUnits[]
+-- dataViewOrganisationUnits[]
+-- authorisedPrograms[]
+-- authorisedDataSets[]
```

---

## 8.2 Device

```text
Device
|
+-- deviceId
+-- deviceName
+-- type
+-- operatingSystem
+-- applicationVersion
+-- edgeNodeId
+-- trustState
+-- lastSeen
```

Possible device types include:

- Desktop workstation.
- Laptop.
- Tablet.
- Smartphone.
- Kiosk.
- Laboratory workstation.
- Pharmacy workstation.
- Registration workstation.
- Facility server.
- Trusted peer DER node.

---

# 9. Participation Context

Every mutation shall be traceable to:

```text
ParticipationContext
|
+-- userId
+-- roleIds[]
+-- deviceId
+-- edgeNodeId
+-- organisationUnit
+-- workflowDefinitionId
+-- workflowInstanceId
+-- workflowStepId
+-- timestamp
```

---

# 10. Workflow Assembly and Merge Engine

The Workflow Assembly and Merge Engine is a core DER component.

Its responsibility is to merge partial contributions from multiple users and devices into one canonical workflow representation.

```text
Contribution A
Contribution B
Contribution C
      |
      v
Identity Matching
      |
      v
Structural Validation
      |
      v
Merge
      |
      +-- independent changes --> combine
      +-- identical changes ---> accept
      +-- divergent changes ---> conflict
      |
      v
Canonical State
```

The engine must preserve the original operations while also maintaining a materialised canonical state.

---

# 11. Operation Journal and Materialised State

DER maintains two complementary representations.

## 11.1 Operation Journal

```text
OperationJournal
|
+-- operationId
+-- sequence
+-- workflowInstanceId
+-- objectType
+-- objectUid
+-- action
+-- field
+-- oldValue
+-- newValue
+-- userId
+-- deviceId
+-- metadataSnapshotId
+-- baseRevision
+-- localRevision
+-- timestamp
+-- syncState
```

## 11.2 Canonical Workflow State

```text
CanonicalWorkflowState
|
+-- workflowInstanceId
+-- workflowType
+-- organisationUnit
+-- metadataSnapshotId
+-- revision
+-- data
+-- completeness
+-- validationState
+-- dependencyState
+-- conflictState
+-- syncState
+-- contributors[]
+-- lastUpdatedAt
```

The journal is the durable history of changes.

The canonical state is the current merged representation consumed by users, dependent workflows, validation, and sync.

---

# 12. Workflow Merge Rules

The merge engine should apply the following logic:

```text
Incoming contribution
        |
        v
Resolve logical identity
        |
        +-- object not present -> add
        |
        +-- same value --------> no conflict
        |
        +-- independent field -> merge
        |
        +-- same field changed differently
                               -> conflict
```

Merge decisions should occur at the smallest meaningful logical unit.

---

# 13. Aggregate Data Set Workflow

## 13.1 Workflow Identity

Aggregate workflow instance:

```text
Data Set
+ Organisation Unit
+ Period
+ Attribute Option Combination (AOC)
```

Atomic data value identity:

```text
Data Element
+ Category Option Combination (COC)
+ Organisation Unit
+ Period
+ Attribute Option Combination (AOC)
```

---

# 14. Aggregate Multi-User Distribution

Example:

```text
HMIS Monthly Report
|
+-- OPD Section
|   +-- User A
|   +-- Device A
|
+-- ANC Section
|   +-- User B
|   +-- Device B
|
+-- Laboratory Section
|   +-- User C
|   +-- Device C
|
+-- Immunisation Section
|   +-- User D
|   +-- Device D
|
+-- Final Review
    +-- HMIS Focal Person
    +-- Device E
```

All contributions belong to the same:

```text
DataSet + OU + Period + AOC
```

---

# 15. Aggregate Assembly

DER should assemble distributed values into one canonical aggregate structure.

```text
OPD values
ANC values
Laboratory values
Immunisation values
        |
        v
Aggregate Merge Engine
        |
        v
Canonical Aggregate Workflow
```

The module must preserve:

- Data Set UID.
- Organisation Unit UID.
- Period.
- AOC.
- Data Element UID.
- COC.
- Value.
- Comment where applicable.
- Follow-up/completion state where applicable.
- Provenance.

---

# 16. Aggregate Workflow States

```text
NOT_STARTED
IN_PROGRESS
PARTIALLY_COMPLETE
VALIDATION_FAILED
READY_FOR_REVIEW
REVIEWED
COMPLETED
QUEUED_FOR_SYNC
SYNCED
CONFLICT
REOPENED
```

---

# 17. Aggregate Conflict Detection

Example conflict:

```text
User A:
DE = Malaria cases
COC = Female / 5-14
Value = 20

User B:
DE = Malaria cases
COC = Female / 5-14
Value = 24
```

Same:

```text
DE + COC + OU + Period + AOC
```

Result:

```text
CONFLICT
```

Different COC means no conflict.

---

# 18. DHIS2-Compatible Aggregate Output

DER should be able to materialise a DHIS2-compatible DataValueSet structure.

Conceptually:

```json
{
  "dataSet": "DATASET_UID",
  "period": "202610",
  "orgUnit": "ORG_UNIT_UID",
  "attributeOptionCombo": "AOC_UID",
  "dataValues": [
    {
      "dataElement": "DE_UID",
      "categoryOptionCombo": "COC_UID",
      "value": "20"
    }
  ]
}
```

The exact transport format shall follow the supported DHIS2 API version.

---

# 19. Event Program Workflow

Event workflow identity:

```text
Program
+ Event UID
+ Organisation Unit
+ Program AOC where configured
```

Supported actions may include:

```text
CREATE_EVENT
UPDATE_EVENT
DELETE_EVENT
COMPLETE_EVENT
REOPEN_EVENT
UPDATE_DATA_VALUE
REMOVE_DATA_VALUE
UPDATE_DATE
UPDATE_STATUS
UPDATE_GEOMETRY
```

---

# 20. Event Multi-Device Participation

```text
Event
|
+-- Created by Device A
+-- Updated by Device B
+-- Reviewed by Device C
+-- Completed by Device D
```

Where the business process contains distinct operational steps, separate program-stage events are preferred over one oversized shared event.

---

# 21. DHIS2-Compatible Event Output

Conceptually:

```json
{
  "program": "PROGRAM_UID",
  "programStage": "STAGE_UID",
  "orgUnit": "ORG_UNIT_UID",
  "occurredAt": "2026-10-31",
  "status": "COMPLETED",
  "dataValues": [
    {
      "dataElement": "DE_UID",
      "value": "..."
    }
  ]
}
```

---

# 22. Tracker Workflow

Tracker is the primary model for longitudinal and multi-step workflows.

```text
Tracked Entity
|
+-- Attributes
|
+-- Enrollment
    |
    +-- Program Stage Event 1
    +-- Program Stage Event 2
    +-- Program Stage Event 3
    +-- Program Stage Event N
```

---

# 23. Tracker Facility Example

```text
Patient
|
+-- Enrollment
    |
    +-- Registration
    |   +-- User A / Device A
    |
    +-- Triage
    |   +-- User B / Device B
    |
    +-- Consultation
    |   +-- User C / Device C
    |
    +-- Laboratory
    |   +-- User D / Device D
    |
    +-- Pharmacy
    |   +-- User E / Device E
    |
    +-- Follow-up
        +-- User F / Device F
```

The same enrollment is the common workflow container.

---

# 24. Tracker Assembly

DER merges all compatible partial contributions into the canonical Tracker structure.

```text
Tracked Entity Attributes
          |
Enrollment fields
          |
Program Stage Events
          |
Event Data Values
          |
Relationships
          |
          v
Canonical Tracker Workflow
```

---

# 25. DHIS2-Compatible Tracker Output

Conceptually:

```json
{
  "trackedEntity": "TEI_UID",
  "trackedEntityType": "TET_UID",
  "orgUnit": "ORG_UNIT_UID",
  "attributes": [
    {
      "attribute": "ATTRIBUTE_UID",
      "value": "..."
    }
  ],
  "enrollments": [
    {
      "enrollment": "ENROLLMENT_UID",
      "program": "PROGRAM_UID",
      "orgUnit": "ORG_UNIT_UID",
      "status": "ACTIVE",
      "events": [
        {
          "event": "EVENT_UID",
          "programStage": "STAGE_UID",
          "status": "COMPLETED",
          "dataValues": [
            {
              "dataElement": "DE_UID",
              "value": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

Exact payload structures shall follow the configured DHIS2 version and endpoint.

---

# 26. Tracker Conflict Units

## 26.1 Tracked Entity Attribute

```text
TrackedEntityUID + AttributeUID
```

## 26.2 Enrollment Field

```text
EnrollmentUID + Field
```

## 26.3 Event Field

```text
EventUID + Field
```

## 26.4 Event Data Value

```text
EventUID + DataElementUID
```

## 26.5 Relationship

```text
RelationshipUID
```

---

# 27. Workflow Dependency Engine

The Workflow Dependency Engine determines when downstream workflow steps can proceed.

```text
Workflow Step A
      |
      | produces data/state
      v
Canonical Workflow State
      |
      | dependency evaluation
      v
Workflow Step B
```

---

# 28. Workflow Dependency Definition

```text
WorkflowDependency
|
+-- id
+-- sourceStepId
+-- sourceObjectType
+-- sourceField
+-- targetStepId
+-- required
+-- condition
+-- transformation
+-- availabilityRule
```

---

# 29. Workflow Step Definition

```text
WorkflowStep
|
+-- id
+-- name
+-- type
+-- dependsOn[]
+-- requiredInputs[]
+-- optionalInputs[]
+-- produces[]
+-- activationCondition
+-- completionCondition
+-- allowedRoles[]
+-- allowedOrganisationUnits[]
```

---

# 30. Workflow Readiness States

```text
BLOCKED
WAITING_FOR_INPUT
READY
IN_PROGRESS
PARTIALLY_COMPLETE
COMPLETE
CONFLICTED
INVALID
NOT_APPLICABLE
```

---

# 31. Example Dependency Chain

```text
Registration
   |
   v
Triage
   |
   v
Consultation
   |
   +----> Laboratory
   |
   +----> Pharmacy
```

Possible dependency rules:

```text
Consultation depends on:
  Registration COMPLETE
  Triage COMPLETE

Laboratory depends on:
  Consultation laboratoryRequest = true

Pharmacy depends on:
  Consultation prescription exists
```

---

# 32. Data Availability for Downstream Workflows

When a workflow step completes or changes, DER must immediately expose the resulting canonical state to dependent steps.

```text
Triage completed
      |
      v
Canonical State updated
      |
      v
Dependency Engine reevaluates
      |
      v
Consultation becomes READY
      |
      v
Consultation device receives:
  patient identity
  vitals
  previous observations
```

No central DHIS2 round trip is required.

---

# 33. Local Workflow Publication

Every canonical state change should publish internal events.

```text
workflow.state.updated
workflow.step.ready
workflow.step.completed
workflow.data.available
workflow.dependency.satisfied
workflow.dependency.blocked
workflow.conflict.detected
workflow.sync.ready
```

These events can trigger:

- Queue updates.
- UI refresh.
- Rule evaluation.
- Dependency reevaluation.
- Sync preparation.
- Notifications.

---

# 34. Local Event Bus

The Workflow Module should include an internal event bus.

Example events:

```text
dataset.value.changed
dataset.completed

event.created
event.updated
event.completed

tracker.entity.created
tracker.enrollment.created
tracker.event.completed

metadata.received
metadata.validated
metadata.activated

conflict.detected
conflict.resolved

sync.queued
sync.completed
sync.failed
```

---

# 35. Program Rule Workflow

DER should execute applicable program rules locally.

Possible actions include:

```text
SHOW_FIELD
HIDE_FIELD
ASSIGN_VALUE
SET_MANDATORY
SHOW_WARNING
SHOW_ERROR
HIDE_SECTION
HIDE_PROGRAM_STAGE
DISPLAY_TEXT
```

Program rules should execute against the metadata snapshot associated with the active workflow state.

---

# 36. Validation Workflow

Validation should occur progressively.

```text
Field Validation
     |
     v
Section Validation
     |
     v
Event Validation
     |
     v
Stage Validation
     |
     v
Enrollment Validation
     |
     v
Workflow Completion Validation
     |
     v
Pre-Sync Validation
```

Validation should include:

- Required values.
- Data type checks.
- Option membership.
- Numeric ranges.
- Date constraints.
- Data Element constraints.
- Program Rules.
- Validation Rules.
- Referential integrity.
- Metadata compatibility.
- Access rights.
- Organisation Unit scope.
- Workflow dependency constraints.

---

# 37. Metadata Workflow

Metadata is a managed workflow.

```text
Central DHIS2
     |
     v
DISCOVERED
     |
     v
DOWNLOADED
     |
     v
DEPENDENCIES_RESOLVED
     |
     v
VALIDATED
     |
     v
STAGED
     |
     v
ACTIVATED
     |
     v
SUPERSEDED
```

Exceptional states:

```text
REJECTED
INCOMPATIBLE
CONFLICT
ROLLBACK_REQUIRED
```

---

# 38. Metadata Snapshot

```text
MetadataSnapshot
|
+-- id
+-- sourceInstance
+-- sourceRevision
+-- dhis2Version
+-- downloadedAt
+-- activatedAt
+-- checksum
+-- status
+-- objectCount
+-- dependencyGraph
```

Every local workflow mutation should reference:

```text
metadataSnapshotId
```

---

# 39. Metadata Scope

Supported metadata should include, at minimum:

## Aggregate

- Data Sets.
- Data Set Sections.
- Data Elements.
- Category Combinations.
- Categories.
- Category Options.
- Category Option Combinations.
- Attribute Category Combinations.
- Attribute Option Combinations.
- Validation Rules.
- Period Types.
- Organisation Units.
- Sharing/access metadata.

## Event and Tracker

- Programs.
- Program Stages.
- Program Stage Sections.
- Program Stage Data Elements.
- Data Elements.
- Tracked Entity Types.
- Tracked Entity Attributes.
- Program Tracked Entity Attributes.
- Option Sets.
- Options.
- Program Rules.
- Program Rule Variables.
- Program Rule Actions.
- Relationship Types.
- Program Indicators where required.
- Organisation Units.
- Sharing/access metadata.

---

# 40. Metadata Change Classification

| Change Type | Example | Default DER Treatment |
|---|---|---|
| Non-breaking | Rename label | Activate |
| Additive | Add optional field | Activate after validation |
| Restrictive | Make field mandatory | Compatibility review |
| Structural | Add/remove stage | Migration check |
| Semantic | Change option meaning | Review |
| Identity-affecting | Change category/AOC structure | High-risk |
| Access-related | Change OU/program sharing | Recalculate access |
| Destructive | Remove field/stage | Preserve historical references |

---

# 41. Metadata Compatibility Workflow

```text
Incoming Metadata
      |
      v
Compare with Active Snapshot
      |
      v
Classify Change
      |
      +-- safe -----> Stage -----> Activate
      |
      +-- risky ----> Compatibility Analysis
                          |
                 +--------+--------+
                 |                 |
                 v                 v
             Compatible        Incompatible
                 |                 |
                 v                 v
              Activate            Hold
                                     |
                                     v
                              Migration / Review
```

---

# 42. Metadata and Active Workflow Continuity

If central metadata changes while the facility is offline:

```text
Central = Metadata V12
DER     = Metadata V11
```

DER may continue active workflows against V11.

Each locally created record should preserve:

```text
metadataSnapshotId = V11
```

When V12 arrives, DER must determine whether V11-generated records remain compatible before sync or activation.

---

# 43. Data Synchronisation Workflow

## 43.1 Local to Central

```text
LOCAL_CHANGE
    |
    v
QUEUED
    |
    v
VALIDATED
    |
    v
ASSEMBLED
    |
    v
PAYLOAD_READY
    |
    v
SENDING
    |
    +---- success ----> SYNCED
    |
    +---- transient --> RETRY_WAIT
    |
    +---- conflict ---> CONFLICT
    |
    +---- rejected ---> REJECTED
```

---

# 44. Merge Before Sync

DER should not blindly forward raw device fragments.

Preferred sequence:

```text
Device Change
    |
    v
Operation Journal
    |
    v
Merge into Canonical State
    |
    v
Validate
    |
    v
Build DHIS2-Compatible Payload
    |
    v
Synchronise
```

---

# 45. Central to DER Reconciliation

```text
CENTRAL_CHANGE
    |
    v
RECEIVED
    |
    v
COMPARE_LOCAL_STATE
    |
    +-- no divergence ---> APPLY
    |
    +-- identical -------> ACKNOWLEDGE
    |
    +-- divergence ------> CONFLICT
```

---

# 46. Synchronisation Journal

```text
SyncJournalEntry
|
+-- operationId
+-- sequence
+-- objectType
+-- objectUid
+-- workflowType
+-- workflowInstanceId
+-- action
+-- userId
+-- deviceId
+-- edgeNodeId
+-- baseRevision
+-- localRevision
+-- metadataSnapshotId
+-- payload
+-- createdAt
+-- retryCount
+-- lastAttemptAt
+-- syncState
+-- conflictId
```

---

# 47. Idempotency

Each sync operation should have a stable unique:

```text
operationId
```

Retries must not create duplicate records.

---

# 48. Conflict Categories

DER should support:

```text
VALUE_CONFLICT
DELETE_UPDATE_CONFLICT
CREATE_CREATE_CONFLICT
DUPLICATE_ENTITY_CONFLICT
METADATA_VERSION_CONFLICT
WORKFLOW_STATE_CONFLICT
COMPLETION_CONFLICT
ACCESS_CONFLICT
RELATIONSHIP_CONFLICT
IDENTITY_CONFLICT
```

---

# 49. Conflict Lifecycle

```text
DETECTED
   |
   v
CLASSIFIED
   |
   +-- auto-resolvable --> RESOLVED_AUTOMATICALLY
   |
   +-- review required -> PENDING_REVIEW
                              |
                              v
                        RESOLVED_MANUALLY
                              |
                              v
                          RESYNC_QUEUED
```

---

# 50. Conflict Resolution Policies

Possible policies:

- Central wins.
- Edge wins where allowed.
- Latest valid update wins.
- Earliest accepted update wins.
- Field-level merge.
- Set union.
- Append-only.
- Duplicate merge.
- Authorised review.
- Reject unsafe mutation.
- Preserve both versions pending reconciliation.

Policies should be configurable by object type and field semantics.

---

# 51. Workflow Queue

DER should expose queues such as:

```text
Registration Queue
Triage Queue
Consultation Queue
Laboratory Queue
Pharmacy Queue
Supervisor Review Queue
Conflict Review Queue
Sync Failure Queue
```

Queue item:

```text
WorkflowQueueItem
|
+-- workflowInstanceId
+-- stepId
+-- priority
+-- assignedRole
+-- assignedUser
+-- status
+-- createdAt
+-- dueAt
```

---

# 52. Workflow Assignment

Assignments may be based on:

- User.
- Role.
- User group.
- Service point.
- Program stage.
- Data Set section.
- Organisation Unit.
- Device class.
- Queue membership.

Device assignment should normally remain advisory, not permanent.

---

# 53. User Handoff

```text
User A completes Triage
        |
        v
DER updates canonical state
        |
        v
Consultation dependency satisfied
        |
        v
Consultation queue updated
        |
        v
User B continues
```

---

# 54. Device Handoff

```text
Device A
   |
   | writes to DER
   v
Shared Canonical State
   |
   v
Device B
```

No manual export/import should be required.

---

# 55. Concurrent Execution

DER should support safe parallel workflow execution.

```text
Consultation
   |
   +----> Laboratory
   |
   +----> Pharmacy Preparation
```

Concurrency is allowed where dependency rules, metadata, and conflict policy permit it.

---

# 56. Completion Workflow

Aggregate example:

```text
Section Capture
   |
   v
Validation
   |
   v
Review
   |
   v
Data Set Completion
```

Tracker example:

```text
Event Completion
   |
   v
Stage Progression
   |
   v
Enrollment Completion
```

DER should distinguish:

```text
LOCAL_COMPLETED
CENTRAL_COMPLETION_PENDING
CENTRALLY_COMPLETED
```

---

# 57. Approval Workflow

Where applicable:

```text
Captured
   |
   v
Reviewed
   |
   v
Approved
   |
   v
Accepted Centrally
```

Approval state must remain compatible with configured DHIS2 approval mechanisms where supported.

---

# 58. Access Control Workflow

```text
User Login
   |
   v
Authenticate
   |
   v
Load Cached Role / OU / Sharing Metadata
   |
   v
Evaluate Workflow Permission
   |
   +-- allowed --> Open Workflow
   |
   +-- denied --> Reject
```

---

# 59. Offline Authentication

During WAN outage:

```text
User
 |
 v
DER Local Authentication
 |
 v
Cached Credential / Session Validation
 |
 v
Role and OU Evaluation
 |
 v
Access Granted
```

The implementation must define:

- Credential caching.
- Credential refresh.
- Session expiry.
- Revocation behaviour.
- Encryption at rest.

---

# 60. Recovery Workflow

DER must recover safely from:

- Power loss.
- Edge-node restart.
- Database restart.
- Device disconnect.
- WAN loss.
- Partial sync.
- Interrupted metadata activation.
- Duplicate request delivery.

Recovery:

```text
Restart
  |
  v
Verify Storage
  |
  v
Replay Unfinished Journal Operations
  |
  v
Rebuild Canonical State if required
  |
  v
Restore Workflow Queues
  |
  v
Resume Pending Sync
  |
  v
Recheck Conflicts
```

---

# 61. Rebuilding Canonical State

The canonical state must be reproducible from:

```text
Metadata Snapshot
+
Operation Journal
+
Persisted Base State
```

This supports:

- Recovery.
- Debugging.
- Audit.
- Conflict replay.
- Deterministic testing.

---

# 62. Optional Peer-to-Peer Workflow

Where enabled:

```text
DER Node A
   |
   | secure peer link
   v
DER Node B
```

Possible uses:

- Mobile outreach.
- Temporary facility interconnection.
- Emergency data relay.
- Metadata relay.
- Recovery where one site has WAN connectivity.

Peer exchange must support:

- Node identity.
- Mutual authentication.
- Trust policy.
- Duplicate protection.
- Sequence tracking.
- Conflict detection.
- Audit logging.

---

# 63. Peer Sync States

```text
DISCOVERED
AUTHENTICATED
TRUSTED
EXCHANGING
ACKNOWLEDGED
CONFLICT
DISCONNECTED
REVOKED
```

---

# 64. Workflow Security Requirements

Minimum controls:

- Authentication.
- Role-based access.
- Organisation Unit access.
- Program/Data Set access.
- Device trust.
- Session expiry.
- Secure local storage.
- Encrypted transport.
- Replay protection.
- Audit logging.
- Metadata integrity checks.
- Peer authentication where enabled.

---

# 65. Workflow Audit Requirements

The audit trail must answer:

- Who changed the data?
- From which device?
- At which facility?
- In which workflow instance?
- Which workflow step?
- Which metadata version?
- What was the previous value?
- What is the new value?
- Was it merged?
- Was it validated?
- Was it synchronised?
- Was there a conflict?
- How was the conflict resolved?
- Which version was accepted centrally?

---

# 66. Recommended Internal Services

```text
WorkflowService
WorkflowAssemblyService
WorkflowDependencyService
CanonicalStateService
AggregateWorkflowService
EventWorkflowService
TrackerWorkflowService
MetadataService
RuleEngine
ValidationService
QueueService
AssignmentService
ConflictService
SyncService
PayloadBuilderService
JournalService
AuditService
AccessControlService
DeviceService
RecoveryService
PeerSyncService
```

---

# 67. Suggested Persistence Model

```text
workflow_definitions
workflow_instances
workflow_steps
workflow_dependencies
workflow_assignments
workflow_history

canonical_states

metadata_snapshots
metadata_objects
metadata_dependencies

aggregate_values
tracked_entities
enrollments
events
event_data_values
relationships

operation_journal
sync_journal
sync_attempts

conflicts
conflict_versions
conflict_resolutions

devices
sessions
audit_events
```

---

# 68. Workflow History

```text
WorkflowHistory
|
+-- workflowInstanceId
+-- eventType
+-- previousState
+-- newState
+-- userId
+-- deviceId
+-- timestamp
+-- reason
+-- metadataSnapshotId
```

---

# 69. Workflow API Responsibilities

Suggested endpoints:

```text
/workflows
/workflows/{id}
/workflows/{id}/state
/workflows/{id}/steps
/workflows/{id}/dependencies
/workflows/{id}/history

/datasets/instances
/events
/tracker/entities
/tracker/enrollments

/metadata/snapshots
/metadata/updates
/metadata/compatibility

/sync/journal
/sync/status
/sync/retry

/conflicts
/conflicts/{id}
/conflicts/{id}/resolve

/queues
/assignments
/devices
/users/sessions
```

---

# 70. Functional Requirements

The module shall:

1. Support Aggregate Data Set, Event Program, and Tracker Program workflows.
2. Allow multiple users and devices to contribute to the same logical workflow.
3. Merge partial contributions into canonical workflow state.
4. Preserve Data Set + OU + Period + AOC identity.
5. Preserve DE + COC + OU + Period + AOC atomic identity.
6. Preserve Event UID and event data-value identities.
7. Preserve Tracker entity, enrollment, event, attribute, and relationship identities.
8. Make data available to dependent workflows immediately after local commit.
9. Calculate workflow readiness dynamically.
10. Maintain dependency graphs.
11. Support sequential, conditional, repeatable, parallel, and cross-service workflows.
12. Execute applicable local program rules.
13. Execute validation before completion and sync.
14. Track metadata snapshots for every local mutation.
15. Detect breaking metadata changes.
16. Stage metadata before activation.
17. Journal all mutations durably.
18. Reconstruct canonical state after restart.
19. Generate valid DHIS2-compatible payloads.
20. Synchronise canonical structures with central DHIS2.
21. Support deterministic retry.
22. Support idempotency.
23. Detect conflicts at the smallest meaningful logical unit.
24. Support automated and manual conflict resolution.
25. Preserve user/device provenance.
26. Support workflow queues and assignments.
27. Support user and device handoff.
28. Maintain local completion independently from central acknowledgement.
29. Recover after power, network, database, and application failures.
30. Provide observability and audit.
31. Support optional secure peer-to-peer exchange.

---

# 71. Non-Functional Requirements

The module should be:

- Offline-first.
- Multi-user.
- Multi-device.
- Conflict-aware.
- Version-aware.
- Durable.
- Transaction-safe.
- Recoverable.
- Auditable.
- Secure.
- Observable.
- DHIS2-compatible.
- Extensible.
- Idempotent.
- Resource-conscious.
- Suitable for facility-level hardware.

---

# 72. Performance Requirements

The module should target:

- Low-latency local writes.
- Near-immediate local visibility.
- Efficient canonical-state updates.
- Concurrent user access.
- Non-blocking background sync.
- Fast dependency reevaluation.
- Efficient metadata diffing.
- Safe retry.
- Minimal duplicate payload transfer.

---

# 73. Observability

Metrics should include:

```text
active_workflows
workflow_step_latency
local_visibility_latency
merge_operations
merge_conflicts

pending_sync_operations
sync_success_rate
sync_failure_rate
sync_retry_count

open_conflicts
conflict_resolution_time

metadata_age
metadata_activation_failures

active_devices
authenticated_users

operation_journal_depth
sync_journal_depth
workflow_queue_depth
```

---

# 74. Recommended DER Workflow Architecture

```text
DER Workflow Module
|
+-- Workflow Engine
|
+-- Workflow Assembly / Merge Engine
|
+-- Workflow Dependency Engine
|
+-- Canonical State Store
|
+-- Rule Engine
|
+-- Validation Engine
|
+-- Queue / Assignment Engine
|
+-- Conflict Manager
|
+-- Metadata Manager
|
+-- Operation Journal
|
+-- Sync Journal
|
+-- DHIS2 Payload Builder
|
+-- Local Event Bus
|
+-- Access Control
|
+-- Recovery Manager
|
+-- Optional Peer Sync
```

---

# 75. End-to-End Tracker Example

```text
Patient Arrives
      |
      v
Registration User / Device A
      |
      v
DER receives contribution
      |
      v
Merge Engine
      |
      v
Canonical Tracked Entity / Enrollment
      |
      v
Triage becomes READY
      |
      v
Triage User / Device B
      |
      v
Triage Event added
      |
      v
Canonical State updated
      |
      v
Consultation becomes READY
      |
      v
Clinician / Device C
      |
      +-------------------+
      |                   |
      v                   v
Laboratory              Pharmacy
Device D                Device E
      |                   |
      +---------+---------+
                |
                v
        Canonical State Updated
                |
                v
          Validation / Rules
                |
                v
            Sync Queue
                |
                v
          Central DHIS2
                |
                v
           Reconciliation
```

---

# 76. End-to-End Aggregate Example

```text
Monthly Data Set
      |
      +--> OPD User / Device
      |
      +--> ANC User / Device
      |
      +--> Lab User / Device
      |
      +--> EPI User / Device
              |
              v
       Partial Contributions
              |
              v
        Aggregate Merge
              |
              v
   Canonical DataValueSet State
              |
              v
       Validation / Review
              |
              v
          Completion
              |
              v
        DHIS2 Payload Builder
              |
              v
           Central DHIS2
```

---

# 77. End-to-End Metadata Example

```text
Central Metadata V12
        |
        | WAN unavailable
        X
        |
DER continues with V11
        |
        +-- workflow changes created under V11
        |
        | WAN restored
        v
DER receives V12
        |
        v
Compatibility Analysis
        |
        +-- compatible --> Activate + Sync
        |
        +-- incompatible --> Hold + Migration / Conflict
```

---

# 78. Initial Prototype Scope

A strong initial DER prototype should demonstrate:

## Aggregate Workflow

- One Data Set.
- One Organisation Unit.
- One Period.
- One AOC.
- Multiple sections.
- Multiple users/devices.
- Canonical merge.
- DataValueSet generation.

## Event Workflow

- Independent event capture.
- Multi-device access.
- Merge/update handling.
- Event payload generation.

## Tracker Workflow

- Tracked Entity.
- Enrollment.
- At least three Program Stages.
- Multiple users/devices.
- Workflow dependencies.
- Canonical state assembly.
- Tracker payload generation.

## Metadata Workflow

- Snapshot download.
- Version comparison.
- Compatibility classification.
- Staging.
- Activation.

## Synchronisation Workflow

- Durable operation journal.
- Canonical-state sync.
- Retry.
- Reconciliation.

## Conflict Workflow

- Aggregate value conflict.
- Tracker data-value conflict.
- Metadata-version conflict.

---

# 79. Evaluation Scenarios

## Scenario A: Normal WAN

- Multiple users capture data.
- Shared state updates locally.
- Data synchronises continuously.

## Scenario B: WAN Failure

- Central DHIS2 becomes unreachable.
- Local workflows continue.
- Shared workflow visibility remains available.

## Scenario C: Split Data Assembly

- Multiple devices contribute different workflow fragments.
- DER merges them.
- Canonical DHIS2-compatible structure is produced.

## Scenario D: Workflow Continuity

- One workflow step produces data.
- Dependent step becomes READY.
- Another user/device continues locally.

## Scenario E: Concurrent Conflict

- Two users change the same logical value.
- DER detects and classifies conflict.

## Scenario F: Metadata Change During Outage

- Central metadata changes.
- DER continues using existing snapshot.
- New metadata is checked before activation.

## Scenario G: Edge Restart

- DER restarts with unsynchronised work.
- Canonical state is reconstructed.
- Pending sync resumes.

## Scenario H: Device Handoff

- User A captures one step.
- User B continues from another device.

## Scenario I: Central Divergence

- Central record changes during outage.
- DER detects divergence on reconnect.
- Reconciliation workflow is triggered.

---

# 80. Formal Module Definition

> **The DER Workflow Module is the facility-level execution layer that interprets DHIS2 metadata and coordinates aggregate, event, tracker, metadata, and synchronisation workflows across multiple authorised users and devices. It merges distributed partial contributions into canonical DHIS2-compatible workflow state, makes newly available data immediately accessible to dependent workflows over the facility LAN, preserves metadata-version and user/device provenance, applies local validation and business rules, detects conflicts at meaningful logical boundaries, and safely reconciles local operations with the central DHIS2 server when connectivity is available.**

---

# 81. Conceptual Summary

```text
WHO
User / Role

WHERE
Organisation Unit

WHAT
Data Set / Program

WHICH WORKFLOW INSTANCE
Data Set + OU + Period + AOC
or
Event UID
or
Enrollment UID

WHICH STEP
Data Set Section
or
Program Stage

WHICH DATA ITEM
DE + COC
or
Event + Data Element
or
Tracked Entity + Attribute

FROM WHERE
Device / DER Node

UNDER WHICH CONFIGURATION
Metadata Snapshot

WHAT HAPPENED
Create
Update
Delete
Complete
Schedule
Merge
Resolve

WHAT IS THE LOCAL STATE
Blocked
Ready
In Progress
Complete
Conflict

WHAT IS THE SYNC STATE
Local
Queued
Sending
Synced
Conflict
Rejected
```

The key DER principle is:

```text
DISTRIBUTED EXECUTION
        +
SHARED CANONICAL STATE
        +
DEPENDENCY-AWARE CONTINUITY
        +
DHIS2-COMPATIBLE SYNCHRONISATION
```

This is the foundation for a facility-level, offline-first, conflict-aware DHIS2 Edge Runtime.
