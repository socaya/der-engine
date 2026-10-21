#!/usr/bin/env bash
# scripts/release.sh — DER release-version bump helper.
#
# Per docs/delivery/02-release-and-versioning.md and DER-ENG-001 §4.1:
#   * one root VERSION file is the single source of truth
#   * server/pom.xml, admin-ui/package.json and client/package.json mirror it
#   * git tag convention is `der-X.Y.Z` (annotated, preferably signed)
#
# This script is intentionally conservative:
#   * it only edits files, never commits, tags or pushes
#   * it refuses to run with a dirty working tree unless --allow-dirty
#   * it validates the new version against SemVer 2.0.0 before touching anything
#
# Usage:
#   scripts/release.sh <new-version>                           # e.g. 0.2.0 or 0.2.0-rc.1 or 0.2.0-SNAPSHOT
#   scripts/release.sh --snapshot <next>                        # convenience: appends -SNAPSHOT
#   scripts/release.sh --dry-run <new-version>                  # show what would change
#   scripts/release.sh --allow-dirty <new-version>              # permit uncommitted edits
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SEMVER='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$'

usage() {
  sed -n '2,20p' "$0"
  exit 1
}

DRY_RUN=0
ALLOW_DIRTY=0
MAKE_SNAPSHOT=0
NEW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --snapshot)    MAKE_SNAPSHOT=1; shift ;;
    -h|--help)     usage ;;
    -*)            echo "Unknown flag: $1" >&2; usage ;;
    *)             NEW="$1"; shift ;;
  esac
done

[[ -n "$NEW" ]] || usage
if (( MAKE_SNAPSHOT )); then
  NEW="${NEW%-SNAPSHOT}-SNAPSHOT"
fi

if [[ ! "$NEW" =~ $SEMVER ]]; then
  echo "Invalid semantic version: $NEW" >&2
  exit 2
fi

CURRENT="$(cat VERSION | tr -d '[:space:]')"
echo "Current VERSION: $CURRENT"
echo "Requested:       $NEW"

if (( ! ALLOW_DIRTY )); then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: working tree is dirty. Commit or pass --allow-dirty." >&2
    git status --short >&2
    exit 3
  fi
fi

# Compute the npm-safe pre-release suffix: npm scopes don't love SNAPSHOT in
# uppercase, so mirror the convention already used in the repo.
npm_version="$(echo "$NEW" | sed 's/-SNAPSHOT$/-snapshot/')"

apply() {
  local file="$1" pattern="$2" replacement="$3"
  if (( DRY_RUN )); then
    echo "  [dry-run] $file: s|$pattern|$replacement|"
  else
    # Use perl for portability (BSD sed vs GNU sed divergence).
    perl -0777 -i -pe "s|$pattern|$replacement|" "$file"
    echo "  updated  $file"
  fi
}

echo
echo "Planned changes:"
apply "VERSION" '.*' "$NEW\n"

# server/pom.xml: replace the project-level <version>, leaving <parent><version/>
# alone. The project version appears immediately after <artifactId>der-server</artifactId>.
apply "server/pom.xml" \
  '<artifactId>der-server</artifactId>\s*<version>[^<]+</version>' \
  "<artifactId>der-server</artifactId><version>$NEW</version>"

apply "admin-ui/package.json" '"version":\s*"[^"]+"' "\"version\": \"$npm_version\""
apply "client/package.json"   '"version":\s*"[^"]+"' "\"version\": \"$npm_version\""

if (( DRY_RUN )); then
  echo
  echo "Dry-run complete. No files written."
  exit 0
fi

echo
echo "Verifying consistency ..."
python3 scripts/check_version_consistency.py

echo
echo "Next steps (NOT performed by this script):"
if [[ "$NEW" == *-SNAPSHOT ]]; then
  echo "  * commit on a feature or release branch; snapshots are not tagged."
else
  echo "  * update CHANGELOG.md and docs/releases/der-$NEW.md"
  echo "  * commit the version bump on release/$NEW"
  echo "  * run scripts/run_all_checks.sh and archive the evidence bundle"
  echo "  * sign and push the tag: git tag -s der-$NEW -m 'DER $NEW' && git push origin der-$NEW"
fi
