#!/usr/bin/env bash
#
# §2.3.112 R-AI — cross-module navigation regression guard.
#
# Enforces the rule from docs/releases/der-2.3.107.md (R-AB):
#
#   > Cross-module navigation must be either (a) a labelled Related
#   > dropdown in a screen header, (b) a labelled per-row context
#   > menu, (c) a landing-page "View All" tile, (d) a Status chip
#   > whose chip itself is the visual affordance, or (e) a trailing
#   > ↗ glyph with title= disclosure. Every disclosed cross-module
#   > Link must carry a data-cross-module="<target>" attribute.
#
# This script scans admin-ui/src for <Link to="/<module>/..."> that
# live in a different module's source file and reports any that
# don't carry data-cross-module (plus a short exempt-paths list for
# known compliant patterns we don't want to tag — Status chips,
# routes to the enclosing module, back-links, redirect routes).
#
# Exit codes:
#   0 — clean
#   1 — one or more undisclosed cross-module Links detected
#   2 — scan error (e.g. source tree missing)

set -euo pipefail

ADMIN_UI="${1:-admin-ui/src}"
if [[ ! -d "$ADMIN_UI" ]]; then
  echo "cross-module lint: directory not found: $ADMIN_UI" >&2
  exit 2
fi

# Module roots DER currently nav-groups. Keep aligned with
# admin-ui/src/app/navigation.ts.
MODULES=(sync workflows data network integration access settings
         approvals referral provisioning dhis2 audit backup restore
         maintenance diagnostics)

# Known compliant centralised affordances — Links rendered here are
# always disclosed via RelatedMenu or scoped drill patterns, so we
# don't re-check inside them.
EXEMPT_FILES=(
  "shared.tsx"                       # RelatedMenu adds data-cross-module itself
  "App.tsx"                          # route definitions
  "AdminShell.tsx"                   # top-nav + OU chip + sign-out
  "Dashboard.tsx"                    # Workspace View All tiles
  "Workspace.tsx"
  "SystemOverview.tsx"
  "navigation.ts"
  "RecentActivity.tsx"               # dashboard timeline
  "QuickActions.tsx"                 # dashboard quick-action grid
)

fail_count=0
report() {
  echo "cross-module lint: $*" >&2
}

# Walk every .tsx under admin-ui/src.
while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  # Skip exempt files.
  for ex in "${EXEMPT_FILES[@]}"; do
    [[ "$base" == "$ex" ]] && continue 2
  done

  # Grep every <Link to="/<module>/..."> occurrence. Multi-line Link
  # declarations are the norm, so scan each line and tolerate the
  # `to={...}` dynamic form by only flagging string-literal paths.
  while IFS=: read -r line_no match; do
    [[ -z "$match" ]] && continue
    # Extract the destination path.
    target_path="$(sed -nE 's|.*to="(/[a-zA-Z0-9/_.?=&-]+)".*|\1|p' <<< "$match")"
    [[ -z "$target_path" ]] && continue
    target_module="$(sed -nE 's|^/([a-zA-Z0-9_-]+).*|\1|p' <<< "$target_path")"
    [[ -z "$target_module" ]] && continue

    # Determine source module from file path or filename heuristics.
    # Files under src/screens/<Module>.tsx etc. are heuristically
    # mapped by common prefixes.
    src_module="unknown"
    case "$base" in
      Data*.tsx)         src_module="data" ;;
      Dhis2*.tsx)        src_module="dhis2" ;;
      Network*.tsx)      src_module="network" ;;
      Sync*.tsx)         src_module="sync" ;;
      Capability*.tsx|CapabilityScreens.tsx|EACoreScreens.tsx)
                          src_module="integration" ;;
      MoreScreens.tsx)   src_module="mixed" ;;    # ApprovalDetail,
                                                    # ReferralDetail,
                                                    # SyncWorker etc. live here
      Workflow*.tsx)     src_module="workflows" ;;
      Metadata.tsx)      src_module="data" ;;
      Users*.tsx|EACoreScreens.tsx)
                          src_module="access" ;;
    esac

    # Same module → intra-module link, skip.
    if [[ "$src_module" == "$target_module" ]]; then continue; fi
    # 'mixed' sources are too heterogeneous to classify statically;
    # we rely on them carrying data-cross-module explicitly.
    if [[ "$src_module" == "unknown" ]]; then continue; fi

    # Does this Link (or its multi-line block) carry
    # data-cross-module? Scan the next 6 lines for the attribute.
    end=$((line_no + 6))
    if sed -n "${line_no},${end}p" "$file" | grep -q 'data-cross-module'; then
      continue
    fi
    report "$file:$line_no undisclosed cross-module Link $src_module → $target_module ($target_path)"
    fail_count=$((fail_count + 1))
  done < <(grep -nE '<Link[[:space:]]+to="/' "$file" || true)
done < <(find "$ADMIN_UI" -name '*.tsx' -print0)

if (( fail_count > 0 )); then
  echo "cross-module lint: $fail_count undisclosed cross-module Link(s) found." >&2
  echo "  Each cross-module <Link to=\"/<module>/...\"> must either:" >&2
  echo "    - carry a data-cross-module=\"<target>\" attribute, or" >&2
  echo "    - live inside RelatedMenu / a Status chip / an exempt file." >&2
  exit 1
fi

echo "cross-module lint: clean (0 undisclosed cross-module Links)."
