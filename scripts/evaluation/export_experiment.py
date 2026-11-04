#!/usr/bin/env python3
"""FR-17-09 — Experiment export.

Gathers an evaluation sweep's artefacts into a single reviewer-facing
bundle:

  * **experiment config** — commit SHA, DER version, base URL,
    concurrency levels, duration, operator who ran it, hardware
    fingerprint (from the sampler report)
  * **inputs** — copies of the budget pins (`budgets/*.json`) + the
    bench target path, verbatim; the comparator fed on these so the
    reviewer can reproduce the assertions
  * **failures** — every bench + resource-budget failure, every
    bench error breakdown with > 0, backup-integrity divergence,
    clock-drift warnings
  * **measured outputs** — raw sampler report, bench report,
    budget-check reports (JSON + MD), operator-metrics snapshot,
    backup-integrity evidence

The output layout under `--out <dir>/experiment-<ts>-<commit>/`:

    config.json           — the experiment config block
    failures.json         — the aggregated failures block
    inputs/               — budget pins copied verbatim
    outputs/              — every raw artefact (sampler, bench, …)
    manifest.json         — SHA-256 of every file + generation timestamp

Exit 0 — bundle written; 1 — missing/malformed input; 2 — invocation
error.

`collect_failures` and `summarise_inputs` are pure so the unit test
can exercise them without the filesystem.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Mapping, Optional


# ---------------------------------------------- pure helpers

def collect_failures(resource_budget: Optional[Mapping],
                        bench_budget: Optional[Mapping],
                        bench_report: Optional[Mapping],
                        backup_integrity: Optional[Mapping]
                        ) -> Dict[str, object]:
    """NFR-17-09 — gathers every failure signal from the sweep's
    artefacts into one dict. Each source is optional so partial
    sweeps (e.g. the backup round-trip didn't run) don't abort the
    bundle generation."""
    out: Dict[str, object] = {}

    if resource_budget is not None:
        fails = [f for f in (resource_budget.get("failures") or [])
                 if "skipped" not in f]
        out["resourceBudget"] = {
            "pass": bool(resource_budget.get("pass")),
            "failures": fails,
        }

    if bench_budget is not None:
        out["benchBudget"] = {
            "pass": bool(bench_budget.get("pass")),
            "failures": list(bench_budget.get("failures") or []),
        }

    if bench_report is not None:
        error_rows: List[Dict[str, object]] = []
        for lvl in bench_report.get("levels", []) or []:
            errs = lvl.get("errors") or {}
            nonzero = {k: int(v) for k, v in errs.items() if int(v) > 0}
            if nonzero:
                error_rows.append({
                    "concurrency": lvl.get("concurrency"),
                    "errors": nonzero,
                    "failed": int(lvl.get("failed", 0)),
                    "total": int(lvl.get("total", 0)),
                })
        saturation = bench_report.get("saturation") or {}
        out["bench"] = {
            "errorsByLevel": error_rows,
            "saturatedAtConcurrency": saturation.get("saturatedAtConcurrency"),
            "latencyInflectedAtConcurrency":
                saturation.get("latencyInflectedAtConcurrency"),
        }

    if backup_integrity is not None:
        diff = backup_integrity.get("fingerprintDiff") or {}
        out["backupIntegrity"] = {
            "pass": bool(backup_integrity.get("match")),
            "byStateDiff": diff.get("byStateDiff", {}),
            "countsDiff": diff.get("countsDiff", {}),
            "missing": diff.get("missing", []),
        }

    out["anyFailure"] = any([
        not out.get("resourceBudget", {}).get("pass", True),
        not out.get("benchBudget", {}).get("pass", True),
        bool(out.get("bench", {}).get("errorsByLevel")),
        not out.get("backupIntegrity", {}).get("pass", True),
    ])
    return out


def summarise_inputs(budget_files: Mapping[str, Mapping]) -> Dict[str, object]:
    """Compacts the pinned budget files to the few fields a reviewer
    actually wants to compare — avoids the committee noise.

    `budget_files` is a map of label → parsed JSON body."""
    out: Dict[str, object] = {}
    for label, body in budget_files.items():
        compact: Dict[str, object] = {}
        for k, v in body.items():
            if isinstance(k, str) and k.startswith("_"):
                continue
            compact[k] = v
        out[label] = compact
    return out


# ---------------------------------------------- filesystem helpers

def _read_json(path: Optional[Path]) -> Optional[Dict]:
    if path is None or not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(65536), b""):
            h.update(block)
    return h.hexdigest()


def _write_manifest(bundle_dir: Path, generated_at: str) -> None:
    files: Dict[str, str] = {}
    for root, _, names in os.walk(bundle_dir):
        for name in names:
            full = Path(root) / name
            if full.name == "manifest.json":
                continue
            rel = full.relative_to(bundle_dir).as_posix()
            files[rel] = _sha256(full)
    manifest = {
        "generatedAt": generated_at,
        "files": dict(sorted(files.items())),
    }
    with (bundle_dir / "manifest.json").open("w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=True)
        fh.write("\n")


# ---------------------------------------------- main

def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sweep-dir", required=True,
                    help="Evaluation sweep output directory (holds "
                         "resource-sample.json, bench-health.json, …)")
    p.add_argument("--budgets-dir",
                    default=str(Path(__file__).resolve().parent / "budgets"),
                    help="Pinned budget files to embed as inputs")
    p.add_argument("--out", required=True,
                    help="Where to write the experiment bundle")
    p.add_argument("--commit", default="unknown")
    p.add_argument("--base-url", default="unknown")
    p.add_argument("--duration-seconds", type=float, default=0.0)
    p.add_argument("--concurrency", default="1,5,10,20")
    p.add_argument("--operator", default=os.environ.get("USER", "unknown"))
    args = p.parse_args(argv)

    sweep = Path(args.sweep_dir)
    if not sweep.is_dir():
        print(f"export_experiment: sweep dir missing: {sweep}",
              file=sys.stderr)
        return 1

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    bundle_name = f"experiment-{generated_at.replace(':', '-')}-{args.commit}"
    bundle = Path(args.out) / bundle_name
    (bundle / "inputs").mkdir(parents=True, exist_ok=True)
    (bundle / "outputs").mkdir(parents=True, exist_ok=True)

    # 1. Load every known sweep artefact (missing ones are just omitted).
    sampler = _read_json(sweep / "resource-sample.json")
    resource_budget = _read_json(sweep / "resource-budget-result.json")
    bench_report = _read_json(sweep / "bench-health.json")
    bench_budget = _read_json(sweep / "bench-budget-result.json")
    backup_integrity = _read_json(sweep / "backup-integrity.json")
    operator_metrics = _read_json(sweep / "operator-metrics.json")

    # 2. Copy raw outputs verbatim for reproducibility.
    for name in ("resource-sample.json", "resource-budget-result.json",
                   "resource-budget-report.md",
                   "bench-health.json", "bench-budget-result.json",
                   "bench-budget-report.md",
                   "backup-integrity.json", "operator-metrics.json",
                   "manifest.json", "nfr-sweep.log"):
        src = sweep / name
        if src.is_file():
            shutil.copy2(src, bundle / "outputs" / src.name)

    # 3. Copy pinned inputs.
    budgets_dir = Path(args.budgets_dir)
    budget_files: Dict[str, Dict] = {}
    if budgets_dir.is_dir():
        for src in sorted(budgets_dir.glob("*.json")):
            shutil.copy2(src, bundle / "inputs" / src.name)
            parsed = _read_json(src)
            if parsed is not None:
                budget_files[src.stem] = parsed

    # 4. Config block.
    hw = (sampler or {}).get("hardware", {}) or {}
    config = {
        "generatedAt": generated_at,
        "operator": args.operator,
        "commit": args.commit,
        "baseUrl": args.base_url,
        "durationSeconds": args.duration_seconds,
        "concurrencyLevels": [int(c) for c in args.concurrency.split(",") if c.strip()],
        "hardware": hw,
        "inputsSummary": summarise_inputs(budget_files),
    }
    with (bundle / "config.json").open("w", encoding="utf-8") as fh:
        json.dump(config, fh, indent=2, sort_keys=True)
        fh.write("\n")

    # 5. Failures block.
    failures = collect_failures(resource_budget, bench_budget,
                                   bench_report, backup_integrity)
    with (bundle / "failures.json").open("w", encoding="utf-8") as fh:
        json.dump(failures, fh, indent=2, sort_keys=True)
        fh.write("\n")

    # 6. Manifest with SHA-256 of every file.
    _write_manifest(bundle, generated_at)

    print(f"experiment bundle written: {bundle}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
