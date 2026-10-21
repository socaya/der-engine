#!/usr/bin/env python3
"""Fail-fast check that every version-bearing manifest matches the root VERSION.

Per DER-ENG-001 §4.1, the root `VERSION` file is the single source of truth for the
DER release label (`X.Y.Z` or `X.Y.Z-SNAPSHOT`). The server pom, both frontend
package.json files and the health endpoint's reported version must agree. During
development the suffix `-SNAPSHOT` is accepted and must be present on all mirrors.

Usage:
    python3 scripts/check_version_consistency.py [--expected X.Y.Z[-SNAPSHOT]]

Exit codes:
    0 — all manifests consistent.
    1 — mismatch or missing manifest.

This script is intentionally dependency-free so it runs on any Python 3.9+.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "VERSION"
POM = ROOT / "server" / "pom.xml"
ADMIN_UI_PKG = ROOT / "admin-ui" / "package.json"
CLIENT_PKG = ROOT / "client" / "package.json"

SEMVER = re.compile(
    r"^(?P<major>0|[1-9]\d*)\."
    r"(?P<minor>0|[1-9]\d*)\."
    r"(?P<patch>0|[1-9]\d*)"
    r"(?:-(?P<pre>[0-9A-Za-z.-]+))?"
    r"(?:\+(?P<build>[0-9A-Za-z.-]+))?$"
)


def read_version_file() -> str:
    text = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not SEMVER.match(text):
        raise SystemExit(
            f"VERSION file does not contain a valid semantic version: {text!r}"
        )
    return text


def read_pom_version() -> str:
    """Return the project <version>, ignoring any <parent><version/></parent>.

    The project <version> is whichever <version> element is not located inside
    a <parent> block, regardless of ordering within <project>.
    """
    pom = POM.read_text(encoding="utf-8")
    # Strip every <parent>...</parent> block (non-greedy, DOTALL) so the
    # remaining <version> tags are project-level.
    stripped = re.sub(r"<parent>.*?</parent>", "", pom, flags=re.DOTALL)
    match = re.search(r"<version>([^<]+)</version>", stripped)
    if not match:
        raise SystemExit("server/pom.xml has no project <version>.")
    return match.group(1).strip()


def read_pkg_version(path: pathlib.Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    v = data.get("version")
    if not isinstance(v, str):
        raise SystemExit(f"{path.relative_to(ROOT)} has no string .version field")
    return v


def normalise_npm(semver: str) -> str:
    # npm historically disallowed `-SNAPSHOT` in some tool chains, so npm manifests
    # use the suffix `-snapshot` (lowercase). Treat them equivalently.
    return semver.replace("-snapshot", "-SNAPSHOT")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--expected", help="Override the VERSION-file value for CI pre-release checks")
    args = parser.parse_args()

    expected = args.expected if args.expected else read_version_file()
    if not SEMVER.match(expected):
        raise SystemExit(f"--expected is not a valid semantic version: {expected!r}")

    sources = {
        "VERSION": expected,
        "server/pom.xml": read_pom_version(),
        "admin-ui/package.json": normalise_npm(read_pkg_version(ADMIN_UI_PKG)),
        "client/package.json": normalise_npm(read_pkg_version(CLIENT_PKG)),
    }

    mismatches = {name: v for name, v in sources.items() if v != expected}
    for name, v in sources.items():
        status = "OK" if v == expected else "MISMATCH"
        print(f"  [{status}] {name}: {v}")

    if mismatches:
        print(f"\nFAIL: {len(mismatches)} manifest(s) disagree with VERSION={expected}", file=sys.stderr)
        return 1

    print(f"\nPASS: all {len(sources)} version manifests report {expected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
