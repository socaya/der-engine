#!/usr/bin/env python3
"""
Phase 07.3 — dead cross-module Link tripwire.

Scans admin-ui/src for every ``<Link ... data-cross-module="..." ... to="..."/>``
(and the equivalent ``RelatedMenu`` item shape) and verifies that each
destination resolves against a ``<Route path="...">`` registered in
admin-ui/src/App.tsx.

A broken destination here means an operator clicking a disclosed
cross-module jump lands on React Router's 404 page — exactly the gap
Phase 07 was chartered to close. Keeping this script in CI stops the
same regression from re-opening when someone adds a drill-in and
mistypes the route.

Exit codes:
  0 — every data-cross-module target resolves to a route
  1 — one or more dead cross-module targets
  2 — scan error (unexpected input tree)

Usage: python3 scripts/lint/check_cross_module_targets.py [admin-ui/src]
"""

from __future__ import annotations

import pathlib
import re
import sys
from typing import Optional


def route_patterns(app_tsx: str) -> list[str]:
    """Every ``<Route path="...">`` literal from the admin-ui App shell."""
    return sorted(set(re.findall(r'path="(/[^"]*)"', app_tsx)))


def match_route(target: str, routes: list[str]) -> Optional[str]:
    path = target.split('?')[0].split('#')[0]
    for route in routes:
        pattern = re.sub(r':[a-zA-Z0-9_]+', r'[^/]+',
                         route.replace('*', '.*')) + '$'
        if re.match(pattern, path):
            return route
    return None


def scan(root: pathlib.Path) -> list[tuple[str, str, str, str]]:
    app = (root / 'App.tsx').read_text()
    routes = route_patterns(app)
    broken: list[tuple[str, str, str, str]] = []

    link_patterns = [
        # <Link to="..." ... data-cross-module="...">
        re.compile(
            r'<Link[^>]*?to=\{?["`]([^"`}]+)["`]\}?[^>]*?'
            r'data-cross-module="([^"]+)"',
            re.DOTALL),
        # data-cross-module="..." ... to="..."
        re.compile(
            r'data-cross-module="([^"]+)"[^>]*?to=\{?["`]([^"`}]+)["`]\}?',
            re.DOTALL),
    ]
    # RelatedMenu items: { label: 'X', module: 'Mod', to: '/path' }
    related_pattern = re.compile(
        r"\{\s*label:[^}]+?\bmodule:\s*'([^']+)'[^}]+?\bto:\s*['`]([^'`]+)['`]")

    seen: set[tuple[str, str, str]] = set()
    for path in root.rglob('*.tsx'):
        rel = path.relative_to(root.parent)
        text = path.read_text()
        for pattern in link_patterns:
            for m in pattern.finditer(text):
                groups = m.groups()
                dest = groups[0] if groups[0].startswith('/') else groups[1]
                mod = groups[1] if groups[0].startswith('/') else groups[0]
                key = (str(rel), dest, mod)
                if key in seen:
                    continue
                seen.add(key)
                if match_route(dest, routes) is None:
                    broken.append((str(rel), dest, mod,
                                    'Link'))
        for m in related_pattern.finditer(text):
            mod, dest = m.group(1), m.group(2)
            key = (str(rel), dest, mod)
            if key in seen:
                continue
            seen.add(key)
            if match_route(dest, routes) is None:
                broken.append((str(rel), dest, mod, 'RelatedMenu'))

    return broken


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'admin-ui/src')
    if not root.is_dir():
        print(f'cross-module targets lint: directory not found: {root}',
              file=sys.stderr)
        return 2
    broken = scan(root)
    if broken:
        print('cross-module targets lint: dead destinations detected:',
              file=sys.stderr)
        for rel, dest, mod, kind in broken:
            print(f'  [{kind}] {rel}: data-cross-module="{mod}" -> {dest} '
                  '(no matching <Route path>)',
                  file=sys.stderr)
        print(f'\n{len(broken)} dead cross-module target(s).', file=sys.stderr)
        return 1
    print('cross-module targets lint: clean '
          '(every disclosed cross-module Link resolves).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
