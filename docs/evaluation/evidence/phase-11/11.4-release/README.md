# Phase 11.4 — der-1.0.0 release notes

## Status

- **Release note draft:** ✅ shipped at `docs/releases/der-1.0.0.md`.
- **Stable tag cut:** 🧰 pending — gated on 11.2 (72 h soak) + 11.3
  (NFR sweep) producing live pilot-hardware evidence.
- **Supersession path:** `der-1.0.0-rc.1` (`docs/releases/der-1.0.0-rc.1.md`),
  `der-1.0.0-rc.2` (`docs/releases/der-1.0.0-rc.2.md`), and the
  Phase 7–14 incremental releases (`der-2.3.90` through
  `der-2.3.122`) roll up into 1.0.0.

## Gate chain the tag depends on

```
┌──────────────────────┐    ┌────────────────────────────┐
│ 11.1 journal recovery│    │ scripts/run_all_checks.sh  │
│ (shipped)            │    │   gate PASS at 32 steps    │
└──────────┬───────────┘    └────────────┬───────────────┘
           │                              │
           └────────────────┬─────────────┘
                            ▼
                ┌───────────────────────────┐
                │ 11.2 72h soak             │
                │   evidence bundle         │
                │   (pending pilot run)     │
                └────────────┬──────────────┘
                             │
                             ▼
                ┌───────────────────────────┐
                │ 11.3 NFR sweep             │
                │   evidence bundle          │
                │   (pending pilot run,      │
                │    synthetic smoke in gate)│
                └────────────┬──────────────┘
                             │
                             ▼
                ┌───────────────────────────┐
                │ der-1.0.0 stable tag      │
                │   no code change — tag    │
                │   cuts from the commit    │
                │   that passed 11.1 to 11.3│
                └───────────────────────────┘
```

## Evidence attachment checklist

When the pilot run completes, attach the two produced evidence
subtrees under their phase-11 sub-folders:

- `11.2-soak-72h/<run-id>/` — soak orchestrator output + final
  journal-depth assertion + central-flap log.
- `11.3-nfr-sweep/<run-id>/` — resource + bench + backup-integrity
  + experiment-export subtree (see
  `docs/evaluation/evidence/phase-11/11.3-nfr-sweep/README.md`).

## No pending code changes

Every P1 item on `docs/implementation_status.md` is DONE. The stable
cut is a tag-only operation once the pilot evidence lands — no
additional feature work is required.
