#!/usr/bin/env python3
"""Validate that the repository on disk still contains the files Phase 00+ assumes.

This is a cheap, zero-dependency sanity check layered on top of the richer
`scripts/check_registers.py`. It verifies physical layout, not content.
"""
from pathlib import Path
import csv
import sys

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    'README.md',
    'VERSION',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'server/pom.xml',
    'server/mvnw',
    'server/src/main/java/ug/ac/mak/der/DerApplication.java',
    'admin-ui/package.json',
    'client/package.json',
    'deployment/systemd/der.service.example',
    'docs/ui/source-screen-inventory.csv',
    'docs/requirements/source-functional-register.csv',
    'docs/requirements/source-nonfunctional-register.csv',
    'docs/verification/traceability-matrix.csv',
    'scripts/check_version_consistency.py',
    'scripts/check_registers.py',
    'scripts/run_all_checks.sh',
]

missing = [p for p in REQUIRED if not (ROOT / p).is_file()]

screen_csv = ROOT / 'docs/ui/source-screen-inventory.csv'
if screen_csv.is_file():
    with screen_csv.open(newline='', encoding='utf-8') as stream:
        screens = list(csv.DictReader(stream))
else:
    screens = []

if missing:
    print(f'FAIL: missing required files: {missing}', file=sys.stderr)
    sys.exit(1)
if len(screens) != 54:
    print(f'FAIL: expected 54 screen specifications, got {len(screens)}', file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(REQUIRED)} critical files present; {len(screens)} screens listed.')
