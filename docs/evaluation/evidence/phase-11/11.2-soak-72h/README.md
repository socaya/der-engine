# 11.2 — 72h soak evidence

This folder holds the per-run artifacts produced by
`scripts/evaluation/soak_72h.sh`.

## How to run

The soak orchestrator assumes a running local DER on `:8080`, a
running local DHIS2 2.44-SNAPSHOT on `:8090` (Tomcat@10), and a valid
`DER_ADMIN_COOKIE` for the admin surface. See the header of
`scripts/evaluation/soak_72h.sh` for the full env matrix.

### Full 72h run (pilot gate)

```bash
export DER_ADMIN_COOKIE="JSESSIONID=…"
bash scripts/evaluation/soak_72h.sh
```

Writes `docs/evaluation/evidence/phase-11/11.2-soak-72h/<run-id>/`
with:

- `baseline-metrics.prom` + `baseline-journal.json`
- `flap-N.log` × 36 (central-flap cycles across the window)
- `spike-N.log` × 6 + per-worker JSON (write-spikes, twice daily)
- `final-metrics.prom` + `final-journal.json`
- `end-state-assertions.json` — the pass/fail decision
- `manifest.json` — run parameters
- `soak-72h.log` — full orchestrator log

### 10-minute smoke run (dev verification)

Before committing a pilot operator to the 72h window, the maintainer
should smoke-test the orchestrator end-to-end against local DHIS2:

```bash
DER_SOAK_DURATION_SEC=600 \
DER_FLAP_PERIOD_SEC=120 \
DER_FLAP_DOWNTIME_SEC=30 \
DER_SPIKE_PERIOD_SEC=300 \
DER_SPIKE_DURATION_SEC=20 \
DER_SPIKE_RATE=20 \
bash scripts/evaluation/soak_72h.sh
```

The smoke run exercises every code path (flap sequencing, spike
fan-out, end-state assertions, evidence-bundle layout) in ~10 min.

## Pass criteria (per `docs/status/status.md` §15.1)

| # | Assertion | Fails the run |
|---|---|:---:|
| 1 | Zero rows in state IN_FLIGHT at end of window | ✅ |
| 2 | Zero orphaned enrollments / events (TrackerGraphReconciler healed them) | ✅ |
| 3 | Zero overdue referrals (ReferralEscalationJob processed them) | ✅ |
| 4 | `der_journal_drain_success_total` strictly greater than baseline | ✅ |

A run with `end-state-assertions.json#passed = true` is the artifact
the `der-1.0.0` cut consumes as its NFR-17 evidence.

## Related

- `11.1-journal-recovery/` — the mid-publish SIGKILL chaos test
  (Phase 11.1, already green)
- `11.3-nfr-sweep/` — latency / throughput / memory sweep via
  `nfr_sweep.sh`
- `11.4-release/` — the `der-1.0.0.md` release notes draft consumes
  these evidence bundles

## Notes for the pilot operator

- **Resumability.** The orchestrator does not checkpoint. If the
  pilot box reboots mid-soak, the operator picks a fresh run id and
  starts over; evidence bundles are independent per run id.
- **DHIS2 restart command.** `brew services stop/start tomcat@10`
  is the default. On the pilot box this will likely be
  `systemctl stop/start tomcat` — override via `DER_DHIS2_STOP_CMD`
  / `DER_DHIS2_START_CMD`.
- **If a flap fails to restart DHIS2.** The orchestrator logs
  "dhis2 reachable after restart: no" and continues; the next
  spike cycle will exercise the reachability-gate retrying against
  a dead central, which is itself informative. If this persists
  across three consecutive flaps, interrupt the run (SIGINT) — the
  trap handler attempts a DHIS2 restart before exiting.
