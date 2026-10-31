import type { CaptureWorkflowDependency,
                CaptureWorkflowStep } from '../../api/edgeApi';

export interface ValidationError {
  code: string;
  message: string;
}

/** Pre-save validation: unique ordinals, non-empty names, and
 *  dependency DAG is acyclic. Mirrors what the server would reject
 *  so operators see errors inline rather than on round-trip. */
export function validateWorkflow(opts: {
  displayName: string;
  boundMetadataId: string;
  steps: readonly CaptureWorkflowStep[];
  dependencies: readonly CaptureWorkflowDependency[];
}): ValidationError[] {
  const errors: ValidationError[] = [];
  if (opts.displayName.trim() === '') {
    errors.push({ code: 'NAME_REQUIRED', message: 'Display name is required.' });
  }
  if (opts.boundMetadataId.trim() === '') {
    errors.push({ code: 'BINDING_REQUIRED',
                  message: 'Bound metadata UID is required.' });
  }
  // Ordinal uniqueness.
  const seenOrdinals = new Set<number>();
  for (const s of opts.steps) {
    if (seenOrdinals.has(s.ordinal)) {
      errors.push({ code: 'ORDINAL_DUPLICATE',
                    message: `Duplicate step ordinal ${s.ordinal}.` });
    }
    seenOrdinals.add(s.ordinal);
    if (s.displayName.trim() === '') {
      errors.push({ code: 'STEP_NAME_REQUIRED',
                    message: `Step ordinal ${s.ordinal} has no display name.` });
    }
  }
  // DAG acyclicity — classic DFS.
  const nodes = new Set<string>();
  const edges = new Map<string, Set<string>>();
  for (const s of opts.steps) {
    if (!s.stepId) continue;
    nodes.add(s.stepId);
    edges.set(s.stepId, new Set());
  }
  for (const d of opts.dependencies) {
    const from = d.dependsOnStepId;  // must complete before `stepId`
    const to = d.stepId;
    if (!nodes.has(from) || !nodes.has(to)) {
      errors.push({ code: 'DEP_UNKNOWN_STEP',
                    message: 'Dependency references a step that no longer exists.' });
      continue;
    }
    if (from === to) {
      errors.push({ code: 'DEP_SELF',
                    message: 'A step cannot depend on itself.' });
      continue;
    }
    edges.get(from)!.add(to);
  }
  // Cycle detection.
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  nodes.forEach((n) => color.set(n, WHITE));
  function dfs(u: string): boolean {
    color.set(u, GRAY);
    for (const v of edges.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        return true;
      }
      if (color.get(v) === WHITE && dfs(v)) {
        return true;
      }
    }
    color.set(u, BLACK);
    return false;
  }
  for (const n of nodes) {
    if (color.get(n) === WHITE && dfs(n)) {
      errors.push({ code: 'DAG_CYCLE',
                    message: 'Dependencies form a cycle. Rework them so steps can be ordered linearly.' });
      break;
    }
  }
  return errors;
}
