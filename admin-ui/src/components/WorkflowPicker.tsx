import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';

/**
 * §2.3.97 R-E — Workflow-definition picker.
 *
 * Narrow dropdown that lets a Data-module admin scope the browse (and
 * the "Ready for Central" payload preview) to the capture workflow
 * that produced the rows. Fetches the catalogue once on mount; filters
 * by the optional {@code boundKind} so an aggregate screen only shows
 * DATA_SET workflows, events shows PROGRAM_STAGE / PROGRAM, etc.
 */
export function WorkflowPicker(
  { value, onChange, boundKind, placeholder, dataTest }:
    {
      value: string;
      onChange(workflowId: string): void;
      boundKind?: ReadonlyArray<
        | 'DATA_SET'
        | 'DATA_SET_SECTION'
        | 'DATA_ELEMENT'
        | 'PROGRAM'
        | 'PROGRAM_SECTION'
        | 'PROGRAM_STAGE'
        | 'PROGRAM_STAGE_SECTION'
        | 'TRACKED_ENTITY_TYPE'
        | 'TRACKED_ENTITY_ATTRIBUTE'
        | 'SYSTEM'
      >;
      placeholder?: string;
      dataTest?: string;
    },
): JSX.Element {
  const [options, setOptions]
    = useState<ReadonlyArray<edgeApi.CaptureWorkflowSummary> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    edgeApi.listWorkflows()
      .then((r) => { if (alive) setOptions(r.workflows); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const scoped = useMemo(() => {
    if (!options) return [];
    if (!boundKind || boundKind.length === 0) return options;
    const allow = new Set(boundKind);
    return options.filter((w) => allow.has(w.boundMetadataKind));
  }, [options, boundKind]);

  if (err) {
    return (
      <span className="ea-text-muted" data-test={`${dataTest}-err`}>
        Workflow catalogue unavailable
      </span>
    );
  }

  return (
    <select className="ea-input"
             style={{ maxWidth: 220 }}
             value={value}
             onChange={(e) => onChange(e.target.value)}
             data-test={dataTest ?? 'workflow-picker'}
             disabled={options === null}>
      <option value="">{placeholder ?? 'Any workflow'}</option>
      {scoped.map((w) => (
        <option key={w.workflowId} value={w.workflowId}>
          {w.displayName}
          {w.enabled ? '' : ' (disabled)'}
        </option>
      ))}
    </select>
  );
}
