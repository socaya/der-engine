#!/usr/bin/env python3
"""NFR-15 (latency) + NFR-16 (throughput) — bench-budget assertion.

Reads a der_bench.py JSON report + a budgets JSON (default:
budgets/bench_budgets.json) and asserts every per-concurrency
latency percentile respects its pinned maximum, every throughput
meets its pinned minimum, and the error rate is below the ceiling.

Per-concurrency overrides (budgets.latencyMs.perConcurrency.<N>,
budgets.throughputRps.perConcurrency.<N>) take precedence over the
global ceiling/floor so specific concurrency levels can carry
tighter or looser limits.

Exit codes:
    0 — every assertion passed
    1 — one or more assertions failed
    2 — invalid invocation / malformed inputs

Produces a reviewer-facing Markdown report to stdout (or --out), plus
a structured JSON result for machine consumers via --json-out.

The comparator (`check_budgets`) is pure so the unit test exercises
it without touching the filesystem.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Mapping, Optional


def _per_concurrency(budget_block: Mapping, concurrency: int) -> Mapping:
    """Returns the effective per-concurrency budget, overlaying any
    explicit override on top of the global ceiling/floor."""
    pc = (budget_block.get("perConcurrency") or {}).get(str(concurrency))
    return pc or {}


def check_budgets(report: Mapping, budgets: Mapping) -> Dict[str, object]:
    """NFR-15 + NFR-16 core comparator.

    `report` is the full der_bench.py output (expects `levels[]`).
    `budgets` is the budgets JSON.

    Returns:
      {
        'pass': bool,
        'failures': [{'metric': ..., 'concurrency': ..., 'measured': ..., 'budget': ..., 'rule': ...}],
        'passed':   [{'metric': ..., 'concurrency': ..., 'measured': ..., 'budget': ...}],
      }
    """
    failures: List[Dict[str, object]] = []
    passed: List[Dict[str, object]] = []

    lat_block = budgets.get("latencyMs", {}) or {}
    tp_block = budgets.get("throughputRps", {}) or {}
    err_block = budgets.get("errors", {}) or {}
    max_err_pct = err_block.get("maxErrorRatePct")

    def _max_rule(metric: str, c: int, measured, budget, rule: str) -> None:
        if measured is None:
            return
        if measured > budget:
            failures.append({"metric": metric, "concurrency": c,
                              "measured": measured, "budget": budget,
                              "rule": rule})
        else:
            passed.append({"metric": metric, "concurrency": c,
                            "measured": measured, "budget": budget})

    def _min_rule(metric: str, c: int, measured, budget, rule: str) -> None:
        if measured is None:
            return
        if measured < budget:
            failures.append({"metric": metric, "concurrency": c,
                              "measured": measured, "budget": budget,
                              "rule": rule})
        else:
            passed.append({"metric": metric, "concurrency": c,
                            "measured": measured, "budget": budget})

    for level in report.get("levels", []) or []:
        c = int(level.get("concurrency", 0))
        lat_override = _per_concurrency(lat_block, c)
        tp_override = _per_concurrency(tp_block, c)

        # Latency per-percentile — NFR-15.
        for p in ("p50", "p95", "p99"):
            # Override wins when present, else global ceiling.
            budget = lat_override.get(p + "Max",
                                        lat_block.get(p + "Max"))
            if budget is None:
                continue
            _max_rule(f"latencyMs.{p}", c,
                        level.get(f"{p}_ms"), budget,
                        f"latencyMs.{p} <= {budget} ms @ c={c}")

        # Throughput — NFR-16.
        tp_min = tp_override.get("min", tp_block.get("min"))
        if tp_min is not None:
            _min_rule("throughputRps", c,
                        level.get("throughput_rps"), tp_min,
                        f"throughputRps >= {tp_min} @ c={c}")

        # Error rate — NFR-19 adjunct, surfaced in the same report so
        # the operator sees latency + throughput + errors together.
        if max_err_pct is not None:
            total = int(level.get("total", 0))
            failed = int(level.get("failed", 0))
            err_pct = (100.0 * failed / total) if total else 0.0
            _max_rule("errorRatePct", c, round(err_pct, 3), max_err_pct,
                        f"errorRatePct <= {max_err_pct} @ c={c}")

    return {
        "pass": len(failures) == 0,
        "failures": failures,
        "passed": passed,
    }


def markdown_report(result: Mapping) -> str:
    lines = [
        "# NFR-15 / NFR-16 bench-budget check",
        "",
        f"* **Result:** **{'PASS' if result.get('pass') else 'FAIL'}**",
        f"* **Passed:** {len(result.get('passed', []))}",
        f"* **Failed:** {len(result.get('failures', []))}",
        "",
    ]
    fails = result.get("failures", [])
    if fails:
        lines.append("## Budget violations")
        lines.append("| Concurrency | Metric | Measured | Budget | Rule |")
        lines.append("|---:|---|---:|---:|---|")
        for f in fails:
            lines.append(
                f"| {f['concurrency']} | {f['metric']} | "
                f"{f['measured']} | {f['budget']} | `{f['rule']}` |")
        lines.append("")
    if result.get("passed"):
        lines.append("## Passing")
        lines.append("| Concurrency | Metric | Measured | Budget |")
        lines.append("|---:|---|---:|---:|")
        for p in result["passed"]:
            lines.append(
                f"| {p['concurrency']} | {p['metric']} | "
                f"{p['measured']} | {p['budget']} |")
    return "\n".join(lines) + "\n"


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--report", required=True,
                    help="der_bench.py JSON output")
    p.add_argument("--budgets",
                    default=str(Path(__file__).resolve().parent
                                / "budgets" / "bench_budgets.json"),
                    help="budgets JSON (default: budgets/bench_budgets.json)")
    p.add_argument("--json-out", default=None,
                    help="write the structured result to this path")
    p.add_argument("--out", default="-",
                    help="Markdown report path; - = stdout")
    args = p.parse_args(argv)

    try:
        with open(args.report, "r", encoding="utf-8") as fh:
            report = json.load(fh)
    except (OSError, ValueError) as e:
        print(f"check_bench_budget: cannot read report: {e}",
              file=sys.stderr)
        return 2

    try:
        with open(args.budgets, "r", encoding="utf-8") as fh:
            budgets = json.load(fh)
    except (OSError, ValueError) as e:
        print(f"check_bench_budget: cannot read budgets: {e}",
              file=sys.stderr)
        return 2

    result = check_budgets(report, budgets)

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
