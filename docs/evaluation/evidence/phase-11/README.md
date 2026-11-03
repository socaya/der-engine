# Phase 11 evidence — operational verification

Phase 11 collects the NFR-sweep + soak + chaos results that gate the
`der-1.0.0` cut. Each sub-slice lands its artifacts in a
sub-directory keyed on its slice number.

## Sub-slices

| Slice | Artifact                        | Evidence folder             |
|------:|---------------------------------|------------------------------|
| 11.1  | Journal state-machine recovery  | `11.1-journal-recovery/`     |
| 11.2  | 72h soak with central flap      | `11.2-soak-72h/` (TBD)       |
| 11.3  | NFR-15/17/18/29 sweep           | `11.3-nfr-sweep/` (TBD)      |
| 11.4  | der-1.0.0 release notes + tag   | `11.4-release/` (TBD)        |

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
