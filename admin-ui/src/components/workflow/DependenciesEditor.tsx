import type { CaptureWorkflowStep,
                CaptureWorkflowDependency } from '../../api/edgeApi';

interface Props {
  steps: readonly CaptureWorkflowStep[];
  dependencies: readonly CaptureWorkflowDependency[];
  onChange(deps: CaptureWorkflowDependency[]): void;
}

/** Form-based dependency editor. New steps are minted with a
 *  client-side UUID in StepsEditor.addStep, so dependency rows always
 *  reference concrete UUIDs — no server-side placeholder resolution. */
export function DependenciesEditor({ steps, dependencies, onChange }: Props): JSX.Element {
  const stepsWithKey = steps
    .filter((s) => s.stepId)
    .map((s) => ({
      key: s.stepId!,
      label: `#${s.ordinal} — ${s.displayName}`,
    }));

  function add(): void {
    if (steps.length < 2) {
      return;
    }
    const next = [...dependencies];
    next.push({
      stepId: stepsWithKey[1].key,
      dependsOnStepId: stepsWithKey[0].key,
      kind: 'COMPLETES_BEFORE',
    });
    onChange(next);
  }

  function remove(ix: number): void {
    onChange(dependencies.filter((_, i) => i !== ix));
  }

  function update(ix: number, patch: Partial<CaptureWorkflowDependency>): void {
    const next = [...dependencies];
    next[ix] = { ...next[ix], ...patch };
    onChange(next);
  }

  return (
    <div className="ea-cwf-deps" data-test="cwf02-deps-editor">
      {dependencies.length === 0 && (
        <p className="ea-text-muted" style={{ padding: '8px 0', fontSize: 13 }}>
          No dependencies — steps can be captured in any order.
        </p>
      )}
      {dependencies.map((d, i) => (
        <div key={i} className="ea-cwf-dep-row"
             data-test={`cwf02-dep-${i}`}
             style={{ display: 'flex', gap: 8, alignItems: 'center',
                       padding: '6px 0', fontSize: 13 }}>
          <select value={d.stepId}
                  data-test={`cwf02-dep-${i}-step`}
                  onChange={(e) => update(i, { stepId: e.target.value })}
                  style={{ maxWidth: 300 }}>
            {stepsWithKey.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <span style={{ color: 'var(--der-ink-500)' }}>depends on</span>
          <select value={d.dependsOnStepId}
                  data-test={`cwf02-dep-${i}-dependson`}
                  onChange={(e) => update(i, { dependsOnStepId: e.target.value })}
                  style={{ maxWidth: 300 }}>
            {stepsWithKey.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <span className="ea-text-muted" style={{ fontSize: 12 }}>
            (COMPLETES_BEFORE)
          </span>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                  data-test={`cwf02-dep-${i}-remove`}
                  onClick={() => remove(i)}>Remove</button>
        </div>
      ))}
      <button type="button" className="ea-btn ea-btn--sm"
              data-test="cwf02-dep-add"
              disabled={steps.length < 2}
              onClick={add}>
        + Add dependency
      </button>
    </div>
  );
}
