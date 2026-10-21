#!/usr/bin/env python3
"""Positive + negative tests for scripts/check_registers.py.

Each negative test mutates a *copy* of the live docs tree and asserts the
checker fails with exit code 1. The live repository smoke test confirms the
baseline is actually valid.
"""
from __future__ import annotations

import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT = HERE / "check_registers.py"


def materialise(dst: pathlib.Path) -> None:
    shutil.copytree(ROOT / "docs", dst / "docs")
    (dst / "scripts").mkdir()
    shutil.copy(SCRIPT, dst / "scripts" / SCRIPT.name)


def run(workdir: pathlib.Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(workdir / "scripts" / SCRIPT.name)],
        cwd=workdir,
        capture_output=True,
        text=True,
    )


def with_copy(mutator):
    def _runner() -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td)
            materialise(tmp)
            mutator(tmp)
            result = run(tmp)
            assert result.returncode == 1, (
                f"expected exit 1 after mutation; got {result.returncode}\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )
    return _runner


def _drop_last_fr(root: pathlib.Path) -> None:
    path = root / "docs" / "requirements" / "source-functional-register.csv"
    lines = path.read_text(encoding="utf-8").splitlines()
    path.write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")


def _delete_a_screen_spec(root: pathlib.Path) -> None:
    (root / "docs" / "ui" / "screens" / "EA-01.md").unlink()


def _corrupt_nfr_priority(root: pathlib.Path) -> None:
    path = root / "docs" / "requirements" / "source-nonfunctional-register.csv"
    text = path.read_text(encoding="utf-8")
    path.write_text(text.replace("NFR-01,P0", "NFR-01,P9", 1), encoding="utf-8")


def _introduce_orphan_in_traceability(root: pathlib.Path) -> None:
    path = root / "docs" / "verification" / "traceability-matrix.csv"
    with path.open("a", encoding="utf-8") as fh:
        fh.write("FR-99-99,P0,Mystery module,OBJ-X,,,,,\n")


def test_live_repo_passes() -> None:
    """Baseline sanity: the real repo must satisfy every check."""
    result = subprocess.run([sys.executable, str(SCRIPT)], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, (
        f"Live repo registers are not valid!\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    print("  [OK] live_repo_passes")


def main() -> int:
    tests = {
        "live_repo_passes": test_live_repo_passes,
        "fail_when_fr_count_wrong": with_copy(_drop_last_fr),
        "fail_when_screen_spec_missing": with_copy(_delete_a_screen_spec),
        "fail_when_nfr_priority_invalid": with_copy(_corrupt_nfr_priority),
        "fail_when_orphan_in_traceability": with_copy(_introduce_orphan_in_traceability),
    }
    failed = 0
    for name, fn in tests.items():
        try:
            fn()
            if name != "live_repo_passes":
                print(f"  [OK] {name}")
        except AssertionError as exc:
            failed += 1
            print(f"  [FAIL] {name}: {exc}")
    print()
    print(f"{len(tests) - failed}/{len(tests)} tests passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
