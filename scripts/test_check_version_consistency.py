#!/usr/bin/env python3
"""Negative/positive tests for scripts/check_version_consistency.py.

Run with: python3 scripts/test_check_version_consistency.py
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SCRIPT = HERE / "check_version_consistency.py"


def run(expected: str | None, workdir: pathlib.Path) -> subprocess.CompletedProcess[str]:
    # Invoke the copy inside the temp workdir so the script resolves ROOT to
    # that workdir rather than the real repository.
    script_in_workdir = workdir / "scripts" / SCRIPT.name
    cmd = [sys.executable, str(script_in_workdir)]
    if expected is not None:
        cmd += ["--expected", expected]
    env = {"PYTHONDONTWRITEBYTECODE": "1"}
    return subprocess.run(cmd, cwd=workdir, capture_output=True, text=True, env=env)


def materialise(tmp: pathlib.Path, version_file: str, pom: str, admin_pkg: str, client_pkg: str) -> None:
    (tmp / "VERSION").write_text(version_file)
    (tmp / "server").mkdir(parents=True)
    (tmp / "server" / "pom.xml").write_text(pom)
    (tmp / "admin-ui").mkdir()
    (tmp / "admin-ui" / "package.json").write_text(admin_pkg)
    (tmp / "client").mkdir()
    (tmp / "client" / "package.json").write_text(client_pkg)
    # The script resolves ROOT relative to its own path, so we must copy it in.
    (tmp / "scripts").mkdir()
    shutil.copy(SCRIPT, tmp / "scripts" / SCRIPT.name)


MATCHING_POM = """<?xml version='1.0' encoding='UTF-8'?>
<project>
  <parent><version>3.3.8</version></parent>
  <groupId>ug.ac.mak.der</groupId>
  <artifactId>der-server</artifactId>
  <version>{v}</version>
</project>
"""

PARENT_FIRST_POM = """<?xml version='1.0' encoding='UTF-8'?>
<project>
  <groupId>ug.ac.mak.der</groupId>
  <artifactId>der-server</artifactId>
  <version>{v}</version>
  <parent><version>3.3.8</version></parent>
</project>
"""


def test_pass_matching_versions() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        materialise(
            tmp,
            "0.1.0-SNAPSHOT\n",
            MATCHING_POM.format(v="0.1.0-SNAPSHOT"),
            json.dumps({"name": "a", "version": "0.1.0-snapshot"}),
            json.dumps({"name": "c", "version": "0.1.0-snapshot"}),
        )
        result = run(None, tmp)
        assert result.returncode == 0, (
            f"expected PASS, got rc={result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
        assert "PASS" in result.stdout, result.stdout
        print("  [OK] pass_matching_versions")


def test_pass_version_before_parent() -> None:
    """Pom with <version> before <parent> must still be accepted."""
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        materialise(
            tmp,
            "0.1.0-SNAPSHOT\n",
            PARENT_FIRST_POM.format(v="0.1.0-SNAPSHOT"),
            json.dumps({"name": "a", "version": "0.1.0-snapshot"}),
            json.dumps({"name": "c", "version": "0.1.0-snapshot"}),
        )
        result = run(None, tmp)
        assert result.returncode == 0, result.stdout + result.stderr
        print("  [OK] pass_version_before_parent")


def test_fail_pom_mismatch() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        materialise(
            tmp,
            "0.1.0-SNAPSHOT\n",
            MATCHING_POM.format(v="0.2.0-SNAPSHOT"),  # <-- mismatch
            json.dumps({"name": "a", "version": "0.1.0-snapshot"}),
            json.dumps({"name": "c", "version": "0.1.0-snapshot"}),
        )
        result = run(None, tmp)
        assert result.returncode == 1, result.stdout + result.stderr
        assert "MISMATCH" in result.stdout, result.stdout
        print("  [OK] fail_pom_mismatch")


def test_fail_admin_mismatch() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        materialise(
            tmp,
            "0.1.0-SNAPSHOT\n",
            MATCHING_POM.format(v="0.1.0-SNAPSHOT"),
            json.dumps({"name": "a", "version": "9.9.9"}),  # <-- mismatch
            json.dumps({"name": "c", "version": "0.1.0-snapshot"}),
        )
        result = run(None, tmp)
        assert result.returncode == 1, result.stdout + result.stderr
        assert "admin-ui/package.json" in result.stdout
        print("  [OK] fail_admin_mismatch")


def test_fail_invalid_semver_in_version_file() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        materialise(
            tmp,
            "not-a-version\n",
            MATCHING_POM.format(v="0.1.0-SNAPSHOT"),
            json.dumps({"name": "a", "version": "0.1.0-snapshot"}),
            json.dumps({"name": "c", "version": "0.1.0-snapshot"}),
        )
        result = run(None, tmp)
        assert result.returncode != 0, result.stdout + result.stderr
        assert "VERSION file" in (result.stdout + result.stderr)
        print("  [OK] fail_invalid_semver_in_version_file")


def test_root_repository_consistency() -> None:
    """Smoke test: the live repository must be consistent."""
    result = subprocess.run([sys.executable, str(SCRIPT)], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, (
        f"Live repo is NOT consistent.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    print("  [OK] root_repository_consistency")


def main() -> int:
    tests = [
        test_pass_matching_versions,
        test_pass_version_before_parent,
        test_fail_pom_mismatch,
        test_fail_admin_mismatch,
        test_fail_invalid_semver_in_version_file,
        test_root_repository_consistency,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as exc:
            failed += 1
            print(f"  [FAIL] {t.__name__}: {exc}")
    print()
    print(f"{len(tests) - failed}/{len(tests)} tests passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
