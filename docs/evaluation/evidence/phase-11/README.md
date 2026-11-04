# Phase 11 evidence — operational verification

Phase 11 collects the NFR-sweep + soak + chaos results that gate the
`der-1.0.0` cut. Each sub-slice lands its artifacts in a
sub-directory keyed on its slice number.

## Sub-slices

| Slice | Artifact                        | Evidence folder             | Status |
|------:|---------------------------------|------------------------------|---|
| 11.1  | Journal state-machine recovery  | `11.1-journal-recovery/`     | ✅ shipped |
| 11.2  | 72h soak with central flap      | `11.2-soak-72h/`             | ✅ orchestrator + docs shipped (`scripts/evaluation/soak_72h.sh`); pilot run pending |
| 11.3  | NFR-15/16/17/18/19/20/29 sweep  | `11.3-nfr-sweep/`            | ✅ harness + budget comparators + synthetic e2e in gate (`test_nfr_sweep_e2e.py`); `11.3-nfr-sweep/README.md` lists pins + pass criteria; pilot run pending |
| 11.4  | der-1.0.0 release notes + tag   | `11.4-release/`              | ✅ draft + gate-chain documentation at `11.4-release/README.md`; stable tag awaits 11.2 + 11.3 pilot evidence (no code change required) |

## Related — Phase 12 landed extensions (code only, no pilot hardware)

Phase 12 shipped incremental hardening against the Phase 11 gap
register:

- 12.1 Continuous IN_FLIGHT reaper (not just boot-time) — closes
  the steady-state version of the same durability gap 11.1
  addressed for crashes.
- 12.2 DISPLAYTEXT / DISPLAYKEYVALUEPAIR rule actions +
  javadoc cleanup.
- 12.3 Prometheus counters for drain + pull + reap + referral.
- 12.4 Orphan auto-healing in TrackerGraphReconciler.
- 12.5 Phase 10 consolidated evidence doc +
  `docs/security/role-capability-matrix.md` +
  `docs/operations/admin-endpoints-guide.md`.

See `docs/implementation_status.md` for the full gap register and
`docs/evaluation/evidence/phase-10/` for the tracker-lifecycle
consolidated evidence.

## 11.1 — Journal recovery (shipped)

- Added `OperationJournalRepository.requeueOrphanedInFlight` and
  `JournalInFlightReaperRunner` (fires on `ApplicationReadyEvent`).
  Rows left in `IN_FLIGHT` by the previous process are moved back to
  `PENDING`, `attempt_count` is incremented, and `last_error` is
  stamped with a `reaped at <ts>: DER restart during drain` marker so
  the post-mortem is readable from the journal row itself.
- `scripts/evaluation/chaos_journal_recovery.sh` seeds N stuck
  rows, SIGKILLs DER, reboots, and asserts recovery.
- Live-verified against `der-server-2.3.122.jar`. Full run log:
  [`11.1-journal-recovery/run.log`](11.1-journal-recovery/run.log).

## 11.2 — Soak (deferred)

Needs 72h on pilot-shaped hardware (not available in this sandbox).
Harness scaffolding + launcher documented separately before the
real pilot run.

## 11.3 — NFR sweep (deferred)

Runs against pilot-shaped hardware. See
`scripts/evaluation/nfr_sweep.sh` for the gate script; the evidence
bundle is the full `nfr_sweep` output + a signed `response-contract`
report per DER-ENG-001 §15.

## 11.4 — Release (deferred)

Blocked on 11.2 + 11.3 passing. The tag `der-1.0.0` is cut after
the pilot-hardware NFR evidence lands here.
