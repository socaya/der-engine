import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';

/**
 * §2.3.30 — Client-side capture surface that reacts to the server's
 * progressive-validation issues for a workflow run.
 *
 * Clients call this hook on every capture screen that renders inputs
 * backed by a workflow run; it polls (SSE could land later) and
 * exposes three derived views:
 *
 *   - {@link RunValidationState.hiddenFields} — field UIDs the server
 *     said the client should hide (`PROGRAM_RULE_HIDEFIELD`,
 *     `PROGRAM_RULE_HIDESECTION`).
 *   - {@link RunValidationState.assignedValues} — field UIDs the
 *     server computed a value for (`PROGRAM_RULE_ASSIGN`). Capture
 *     screens pre-fill the input when the operator has not already
 *     typed something.
 *   - {@link RunValidationState.createEventCues} — informational cues
 *     telling the client to schedule a follow-up event
 *     (`PROGRAM_RULE_CREATEEVENT`).
 *
 * The underlying issue list is also returned so screens can render a
 * run-wide banner with ERROR/WARNING summaries.
 */

export interface RunValidationState {
  issues: edgeApi.ValidationIssue[];
  errorCount: number;
  hiddenFields: Set<string>;
  assignedValues: Map<string, string>;
  createEventCues: edgeApi.ValidationIssue[];
  loading: boolean;
  error: string | null;
}

export function useRunValidation(runId: string | null | undefined,
                                   opts?: { pollMs?: number }): RunValidationState {
  const pollMs = opts?.pollMs ?? 10_000;
  const [issues, setIssues] = useState<edgeApi.ValidationIssue[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = (): Promise<void> =>
      edgeApi.runValidation(runId)
        .then((r) => {
          if (cancelled) return;
          setIssues(r.issues);
          setErrorCount(r.errorCount);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    load();
    const t = window.setInterval(load, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [runId, pollMs]);

  const derived = useMemo(() => {
    const hidden = new Set<string>();
    const assigned = new Map<string, string>();
    const cues: edgeApi.ValidationIssue[] = [];
    for (const i of issues) {
      switch (i.code) {
        case 'PROGRAM_RULE_HIDEFIELD':
        case 'PROGRAM_RULE_HIDESECTION':
          if (i.fieldRef) hidden.add(i.fieldRef);
          break;
        case 'PROGRAM_RULE_ASSIGN':
          // §2.3.37 — prefer the structured suggestedValue the server
          // now ships; fall back to the message-text parser for issues
          // persisted before the migration landed.
          if (i.fieldRef) {
            if (typeof i.suggestedValue === 'string') {
              assigned.set(i.fieldRef, i.suggestedValue);
            } else {
              const m = i.message.match(/(?:value|assigns)\s+'([^']*)'/);
              if (m && m[1] != null) assigned.set(i.fieldRef, m[1]);
            }
          }
          break;
        case 'PROGRAM_RULE_CREATEEVENT':
          cues.push(i);
          break;
        default:
          break;
      }
    }
    return { hidden, assigned, cues };
  }, [issues]);

  return {
    issues, errorCount, loading, error,
    hiddenFields: derived.hidden,
    assignedValues: derived.assigned,
    createEventCues: derived.cues,
  };
}
