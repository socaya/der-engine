# Use cases and end-to-end workflow contracts

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## UC-01 — Provision an edge
**Actor:** authorised installer. **Preconditions:** reachable central reference, credentials, TLS trust, mapped site scope. **Flow:** validate host -> configure endpoint -> verify release -> provision local runtime -> bootstrap metadata -> test access -> activate. **Exception:** any failed prerequisite prevents activation; logs state whether safe to retry. **Postcondition:** device clients can open the selected applications from a LAN endpoint.

## UC-02 — Offline aggregate submission
**Actor:** reporting officer. **Preconditions:** pre-provisioned user, data set, period and OU. **Flow:** sign in locally -> open form -> read shared values -> enter value -> validate -> local transaction commit -> other user retrieves updated value. **WAN:** absent throughout. **Postcondition:** explicitly pending central exchange. **Exceptions:** forbidden OU, wrong metadata or competing edit -> reject/resolve, no silent overwrite.

## UC-03 — Offline event
**Actor:** permitted event officer. **Flow:** open configured program -> create/edit event -> apply field rules -> commit -> another user retrieves. **Exceptions:** missing option, invalid date, permission revoked centrally while disconnected (policy decision), repeated submission.

## UC-04 — Dependent Tracker pathway
**Actors:** user A and user B. **Flow:** user A creates or updates an entity/enrolment; user B retrieves the same locally committed entity and completes a permitted subsequent program stage. **Exceptions:** unique identifier collision, stale snapshot, relationship inconsistency. **Proof:** distinct sessions and users, central unreachable.

## UC-05 — Restore WAN and reconcile
**Actor:** background worker. **Flow:** detect connectivity -> select dependency-ready journal -> submit -> verify central results -> ack accepted or retain rejection/conflict/uncertainty -> fetch eligible central updates -> update local without stopping workflows. **Exceptions:** central processed request but response lost; retry requires effect inspection.

## UC-06 — Concurrent divergence
**Actors:** edge user and central user. **Flow:** fork changes during WAN partition -> reconnect -> compare versions/invariants -> apply safe policy or raise review. **Postcondition:** no silent destructive overwrite; audit shows both versions and resolution.

## UC-07 — Recover from worker restart
**Actor:** system operator. **Flow:** intentionally stop worker during pending/in-flight work -> restart -> reload durable state -> reconcile uncertain submissions -> retain accepted local records -> resume. **Failure:** no unacknowledged deletion or falsely marked success.

## UC-08 — Permission/metadata drift
**Actor:** central admin, local user and worker. **Flow:** central changes a rule or revokes access while disconnected; edge processes under documented bounded offline policy; on reconnect refreshes metadata and revalidates pending operations. **Exceptions:** incompatible payload held for review; new central denial not silently ignored.
