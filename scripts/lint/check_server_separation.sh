#!/usr/bin/env bash
#
# NFR-23 — component separation guard.
#
# The spec asks that DER is "separated into tested local execution,
# persistence, journal, sync and administrative components." We map
# those five categories to concrete `ug.ac.mak.der.*` packages and
# enforce that lower-layer packages don't import from upper-layer
# packages:
#
#   web/        (admin / HTTP surface — top)
#   workflows/  (local execution + journal — mid)
#   sync/       (central-sync drain)
#   dhis2/      (upstream integration)
#   metadata/   (persistence of mirrored DHIS2 metadata)
#   security/   (session + audit)
#
# The forbidden-import rules below encode the one-way layering:
# controllers may call services, services must not reach up into
# controllers. Any new violation fails the gate.
#
# A tiny allowlist records intentional exceptions with their
# rationale — review on every change.
#
# Exit codes:
#   0 — clean
#   1 — one or more forbidden imports detected
#   2 — scan error (source tree missing)

set -euo pipefail

SRC="${1:-server/src/main/java}"
if [[ ! -d "$SRC" ]]; then
  echo "server-separation lint: directory not found: $SRC" >&2
  exit 2
fi

# "forbidden imports"  — "from-package regex | imported-package regex".
# A match means the file (col. 1) imports from a package it must not.
declare -a RULES=(
  # Workflows is the bottom tier — must not reach up into controllers.
  'workflows/ | ug\.ac\.mak\.der\.web\.'
  # Metadata persistence must stay pure — no controllers, no workflows.
  'metadata/  | ug\.ac\.mak\.der\.web\.'
  'metadata/  | ug\.ac\.mak\.der\.workflows\.'
  # Security must not depend on the HTTP surface (auditing happens via
  # repositories; controllers call security, not the other way).
  'security/  | ug\.ac\.mak\.der\.web\.'
  # Dhis2 (integration) must not know about workflows — a workflow
  # orchestrator can call the integration client, not vice-versa.
  'dhis2/     | ug\.ac\.mak\.der\.workflows\.'
)

# Allowlist of intentional one-way exceptions. Format: full relative
# file path | short rationale. Every entry MUST reference the ADR or
# release note that justifies the exception.
declare -a ALLOWLIST=(
  'server/src/main/java/ug/ac/mak/der/workflows/drafts/ScheduledDraftPublishService.java | E6 — reuses DraftController.publishCore as single source of truth for publish semantics; see docs/releases/der-2.3.*.md E6 notes'
  'server/src/main/java/ug/ac/mak/der/metadata/MetadataDriftDetector.java | FR-05-10..12 — consumes the OperationJournalEntry value type to scan payload refs against mirror. Read-only coupling to the shape, not the storage; moving the record into a neutral model/ package is slated for a future refactor (ADR-0032)'
)

allowed() {
  local path="$1"
  for entry in "${ALLOWLIST[@]}"; do
    local file="${entry%%|*}"
    file="${file% }"
    if [[ "$path" == "$file" ]]; then
      return 0
    fi
  done
  return 1
}

violations=0
for rule in "${RULES[@]}"; do
  from="${rule%%|*}"; from="${from// /}"
  to="${rule##*|}"; to="${to# }"
  while IFS= read -r -d '' file; do
    # Only check .java files.
    [[ "$file" == *.java ]] || continue
    if grep -Eq "^import ${to}" "$file"; then
      if allowed "$file"; then
        echo "allowlisted: $file  (rule: $from → $to)"
      else
        echo "VIOLATION:   $file"
        grep -E "^import ${to}" "$file" | sed 's/^/             /'
        violations=$((violations + 1))
      fi
    fi
  done < <(find "$SRC/ug/ac/mak/der/${from}" -name '*.java' -print0 2>/dev/null)
done

if (( violations > 0 )); then
  echo
  echo "server-separation lint: ${violations} forbidden import(s)"
  exit 1
fi
echo "server-separation lint: clean"
