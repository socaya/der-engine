# Next-phases execution plan — Phases 13–16

**Prepared:** 2026-11-03
**Source:** gap register in `docs/status/status.md` §3
**Autonomous-shippable:** 10 of 28 remaining items — the ones that
don't need pilot hardware, UI design review, or ops-policy
decisions I can't make unilaterally.

## Autonomous-shippable (ship now)

| Phase | Gap | Area | Why safe to ship autonomously |
|---|---|---|---|
| 13.1 | G1 Pull-write interlock | Sync | Postgres row-lock + ADR extension; isolated change |
| 13.2 | G2 Manual pull result polling | Data / Sync | New read endpoint over existing scheduled_job_run table |
| 13.3 | G9 Cross-entity topological sort in puller | Sync | Deterministic order fix inside existing code path |
| 13.4 | G10 Conflict-detail central-value column | Data | Server-side already has last_response; UI add-only |
| 14.1 | G17 Rule-run audit trail | Workflows | Audit event enhancement, no API breakage |
| 14.2 | G18 Referral ack cross-check | Sync (security) | Server-side defence; no breaking change |
| 14.3 | G13 Tracker draft publishing | Workflows / Data | Extends existing DraftPublishService |

## Needs your input first (do not ship autonomously)

| Phase | Gap | Why blocked |
|---|---|---|
| 13.5 | G3 Admin UI user-edit | Needs role-boundary decisions you haven't signed off on |
| 13.6 | G4 Clock-skew session invalidation | Needs threshold policy from ops |
| 13.7 | G5 Break-glass admin recovery | Needs SOP + physical-access protocol |
| 14.4 | G15 Hardware signals → sync pause | Needs threshold policy + hw inventory |
| 14.5 | G20 Cross-LAN peer discovery | Needs tenant model + central relay design |

## Pilot-hardware blocked

| Phase | Gap | Notes |
|---|---|---|
| 15.1 | G6 72h soak + NFR sweep | Needs 2–4 vCPU / 4–8 GB RAM pilot box |
| 15.2 | G7 der-1.0.0 cut | Blocked on 15.1 |

## Execution order (autonomous track)

Sequence picked for low-risk-first + high-leverage early:

1. **13.2 — manual pull result polling** (smallest, pure additive)
2. **14.2 — referral ack cross-check** (security fix, small)
3. **13.4 — conflict-detail central-value column** (unblocks ops UX)
4. **14.1 — rule-run audit trail** (observability improvement)
5. **13.3 — cross-entity topological sort** (correctness)
6. **13.1 — pull-write interlock + ADR-0035** (largest, most impact)
7. **14.3 — tracker draft publishing** (closes a visible UI gap)

Each slice ships as its own commit with the Phase.{sub} prefix.
Each starts a TaskCreate, executes, commits, marks the task done.
Pause and summarise after 13.1 (midpoint); hard-stop after 14.3 or
if context pressure mounts.
