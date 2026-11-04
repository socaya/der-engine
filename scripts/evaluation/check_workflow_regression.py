#!/usr/bin/env python3
"""FR-17-10 — Workflow-regression catalogue checker.

Walks `supported_workflows.json` and asserts:

  1. Every declared workflow references at least one test file.
  2. Every referenced test file actually exists on disk.
  3. Every workflow carries at least one FR identifier.
  4. No duplicate workflow ids.

The live suite in regression_suite.sh does the operator-facing
HTTP probes; this static check guards the catalogue itself so
a workflow can't be deprecated-in-practice (test deleted) without
also being removed from the catalogue.

Exit 0 — catalogue clean; 1 — assertion failures; 2 — invocation
error.

The validator is pure so the unit test can exercise it against
synthetic catalogues.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional


def validate_catalogue(catalogue: Mapping, server_test_root: Path
                          ) -> Dict[str, object]:
    """Validates the catalogue against the on-disk test tree.

    Returns {'pass', 'errors', 'workflows'} where 'workflows' is a
    per-workflow status record (missing-tests, no-fr, etc).
    """
    workflows = catalogue.get("workflows") or []
    errors: List[Dict[str, object]] = []
    per_workflow: List[Dict[str, object]] = []
    seen_ids: Dict[str, int] = {}

    for idx, wf in enumerate(workflows):
        wid = wf.get("id")
        wf_errors: List[str] = []

        if not wid:
            wf_errors.append("missing id")
        else:
            if wid in seen_ids:
                wf_errors.append(f"duplicate id (first seen at index {seen_ids[wid]})")
            else:
                seen_ids[wid] = idx

        if not wf.get("fr"):
            wf_errors.append("missing fr[] — every workflow must map to at least one FR")

        tests = wf.get("tests") or []
        if not tests:
            wf_errors.append("no tests referenced")

        missing_tests: List[str] = []
        for rel in tests:
            full = server_test_root / rel
            if not full.is_file():
                missing_tests.append(rel)
        if missing_tests:
            wf_errors.append(f"missing test files: {missing_tests}")

        per_workflow.append({
            "id": wid,
            "label": wf.get("label"),
            "fr": wf.get("fr", []),
            "testsDeclared": len(tests),
            "testsMissing": missing_tests,
            "errors": wf_errors,
            "status": "FAIL" if wf_errors else "PASS",
        })
        for e in wf_errors:
            errors.append({"workflow": wid or f"idx[{idx}]", "error": e})

    return {
        "pass": len(errors) == 0,
        "total": len(workflows),
        "errors": errors,
        "workflows": per_workflow,
    }


def collect_operator_probes(catalogue: Mapping) -> List[str]:
    """Flattens every workflow's operatorProbes[] into a de-duplicated
    list the live regression_suite.sh can walk. Order-preserving."""
    seen: Dict[str, None] = {}
    for wf in catalogue.get("workflows") or []:
        for p in (wf.get("operatorProbes") or []):
            if p not in seen:
                seen[p] = None
    return list(seen.keys())


def _default_test_root() -> Path:
    return (Path(__file__).resolve().parent.parent.parent
            / "server" / "src" / "test" / "java" / "ug" / "ac" / "mak" / "der")


def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--catalogue",
                    default=str(Path(__file__).resolve().parent
                                / "supported_workflows.json"))
    p.add_argument("--test-root", default=str(_default_test_root()))
    p.add_argument("--probes", action="store_true",
                    help="Print the de-duplicated operator-probe list "
                         "and exit (for regression_suite.sh consumption)")
    p.add_argument("--json-out", default=None)
    args = p.parse_args(list(argv) if argv is not None else None)

    try:
        with open(args.catalogue, "r", encoding="utf-8") as fh:
            catalogue = json.load(fh)
    except (OSError, ValueError) as e:
        print(f"check_workflow_regression: cannot read catalogue: {e}",
              file=sys.stderr)
        return 2

    if args.probes:
        for p in collect_operator_probes(catalogue):
            print(p)
        return 0

    result = validate_catalogue(catalogue, Path(args.test_root))

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2, sort_keys=True)
            fh.write("\n")

    if result["pass"]:
        print(f"workflow regression catalogue: OK — "
              f"{result['total']} workflows, all tests present")
        return 0

    print(f"workflow regression catalogue: {len(result['errors'])} error(s)",
          file=sys.stderr)
    for e in result["errors"]:
        print(f"  - {e['workflow']}: {e['error']}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
