#!/usr/bin/env python3
"""NFR-18 — Resource-budget assertion.

Reads a resource_sampler.py JSON report + a budgets JSON (default:
budgets/resource_budgets.json) and asserts that every measured
percentile respects its pinned maximum.

Exit codes:
    0 — every assertion passed
    1 — one or more assertions failed
    2 — invalid invocation / malformed inputs

Produces a reviewer-facing Markdown report to stdout (or --out), plus
a structured JSON result for machine consumers via --json-out.

The comparator (`check_budgets`) is pure so the unit test exercises it
without touching the filesystem.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Mapping, Optional


def check_budgets(report: Mapping, budgets: Mapping,
                    duration_seconds: Optional[float] = None
                    ) -> Dict[str, object]:
    """NFR-18 core comparator.

    `report` is the full resource_sampler.py output (expects `summary`).
    `budgets` is the budgets JSON. `duration_seconds` is the sample
    window in seconds — needed to convert the raw diskGrowthBytes
    scalar to the bytes-per-hour budget. When omitted, the sampler's
    own `durationSeconds` field is used.

    Returns:
      {
        'pass': bool,
        'failures': [{'metric': ..., 'measured': ..., 'budget': ..., 'rule': ...}],
        'passed':   [{'metric': ..., 'measured': ..., 'budget': ...}],
      }
    """
    summary = report.get("summary", {}) or {}
    failures: List[Dict[str, object]] = []
    passed: List[Dict[str, object]] = []

    def _check(metric: str, measured, budget, rule: str) -> None:
        if measured is None:
            # Nothing to compare — count as neither pass nor fail,
            # surface to the reviewer as a warning via 'skipped'.
            failures.append({"metric": metric, "measured": None,
                              "budget": budget, "rule": rule,
                              "skipped": "no samples"})
            return
        if measured > budget:
            failures.append({"metric": metric, "measured": measured,
                              "budget": budget, "rule": rule})
        else:
            passed.append({"metric": metric, "measured": measured,
                            "budget": budget})

    # CPU percentiles.
    for p in ("p50", "p95", "p99"):
        budget = budgets.get("cpuPct", {}).get(p + "Max")
        if budget is not None:
            _check(f"cpuPct.{p}",
                    summary.get("cpuPct", {}).get(p),
                    budget, f"cpuPct.{p} <= {budget}")

    # RSS percentiles.
    for p in ("p50", "p95", "p99"):
        budget = budgets.get("rssMb", {}).get(p + "Max")
        if budget is not None:
            _check(f"rssMb.{p}",
                    summary.get("rssMb", {}).get(p),
                    budget, f"rssMb.{p} <= {budget} MB")

    # Latency percentiles.
    for p in ("p50", "p95", "p99"):
        budget = budgets.get("latencyMs", {}).get(p + "Max")
        if budget is not None:
            _check(f"latencyMs.{p}",
                    summary.get("latencyMs", {}).get(p),
                    budget, f"latencyMs.{p} <= {budget} ms")

    # Disk growth — convert the raw bytes to per-hour.
    disk_max = budgets.get("diskGrowthBytesPerHour", {}).get("max")
    if disk_max is not None:
        raw = summary.get("diskGrowthBytes")
        dur = duration_seconds or report.get("durationSeconds")
        if raw is None or dur is None or dur <= 0:
            failures.append({"metric": "diskGrowthBytesPerHour",
                              "measured": None, "budget": disk_max,
                              "rule": f"diskGrowthBytesPerHour <= {disk_max}",
                              "skipped": "insufficient disk samples"})
        else:
            bytes_per_hour = raw * 3600.0 / dur
            _check("diskGrowthBytesPerHour", bytes_per_hour,
                    disk_max,
                    f"diskGrowthBytesPerHour <= {disk_max}")

    return {
        "pass": len([f for f in failures if "skipped" not in f]) == 0,
        "failures": failures,
        "passed": passed,
    }


def markdown_report(result: Mapping) -> str:
    lines = [
        "# NFR-18 resource-budget check",
        "",
        f"* **Result:** **{'PASS' if result.get('pass') else 'FAIL'}**",
        f"* **Passed:** {len(result.get('passed', []))}",
        f"* **Failed:** {len([f for f in result.get('failures', []) if 'skipped' not in f])}",
        f"* **Skipped:** {len([f for f in result.get('failures', []) if 'skipped' in f])}",
        "",
    ]
    hard_fails = [f for f in result.get("failures", []) if "skipped" not in f]
    if hard_fails:
        lines.append("## Budget violations")
        lines.append("| Metric | Measured | Budget | Rule |")
        lines.append("|---|---:|---:|---|")
        for f in hard_fails:
            lines.append(f"| {f['metric']} | {f['measured']} | "
                         f"{f['budget']} | `{f['rule']}` |")
        lines.append("")
    skipped = [f for f in result.get("failures", []) if "skipped" in f]
    if skipped:
        lines.append("## Skipped (insufficient samples)")
        for f in skipped:
            lines.append(f"* **{f['metric']}** — {f['skipped']}")
        lines.append("")
    if result.get("passed"):
        lines.append("## Passing")
        lines.append("| Metric | Measured | Budget |")
        lines.append("|---|---:|---:|")
        for p in result["passed"]:
            lines.append(f"| {p['metric']} | {p['measured']} | "
                         f"{p['budget']} |")
    return "\n".join(lines) + "\n"


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--report", required=True,
                    help="resource_sampler.py JSON output")
    p.add_argument("--budgets",
                    default=str(Path(__file__).resolve().parent
                                / "budgets" / "resource_budgets.json"),
                    help="budgets JSON (default: budgets/resource_budgets.json)")
    p.add_argument("--duration-seconds", type=float, default=None,
                    help="override report['durationSeconds'] for disk conversion")
    p.add_argument("--json-out", default=None,
                    help="write the structured result to this path")
    p.add_argument("--out", default="-",
                    help="Markdown report path; - = stdout")
    args = p.parse_args(argv)

    try:
        with open(args.report, "r", encoding="utf-8") as fh:
            report = json.load(fh)
    except (OSError, ValueError) as e:
        print(f"check_resource_budget: cannot read report: {e}",
              file=sys.stderr)
        return 2

    try:
        with open(args.budgets, "r", encoding="utf-8") as fh:
            budgets = json.load(fh)
    except (OSError, ValueError) as e:
        print(f"check_resource_budget: cannot read budgets: {e}",
              file=sys.stderr)
        return 2

    result = check_budgets(report, budgets,
                             duration_seconds=args.duration_seconds)

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2, sort_keys=True)
            fh.write("\n")

    md = markdown_report(result)
    if args.out == "-":
        sys.stdout.write(md)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(md)

    return 0 if result["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
