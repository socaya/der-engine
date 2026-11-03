import { describe, expect, it } from 'vitest';
import { validateWorkflow } from './validate';
import type { CaptureWorkflowDependency,
                CaptureWorkflowStep } from '../../api/edgeApi';

/* validateWorkflow mirrors server-side validation: name + binding
 * required, step ordinals unique + named, dependencies reference
 * existing steps, no self-loops, no cycles. */

function step(id: string, ordinal: number, name = `Step ${ordinal}`)
: CaptureWorkflowStep {
  return {
    stepId: id, ordinal, displayName: name,
    ownerRole: 'OPERATOR', stepKind: 'CAPTURE',
    sectionKind: 'AD_HOC', sectionRef: null,
    ownerDeviceId: null, fields: [],
  } as unknown as CaptureWorkflowStep;
}

function dep(from: string, to: string): CaptureWorkflowDependency {
  return { stepId: to, dependsOnStepId: from,
           // minimal shape — server has more fields but validator
           // only reads stepId / dependsOnStepId.
         } as unknown as CaptureWorkflowDependency;
}

describe('validateWorkflow', () => {
  it('happy path — no errors returned', () => {
    const errs = validateWorkflow({
      displayName: 'My workflow',
      boundMetadataId: 'ds-1',
      steps: [step('a', 0), step('b', 1)],
      dependencies: [dep('a', 'b')],
    });
    expect(errs).toEqual([]);
  });

  it('empty display name → NAME_REQUIRED', () => {
    const errs = validateWorkflow({
      displayName: '  ', boundMetadataId: 'ds-1',
      steps: [], dependencies: [],
    });
    expect(errs.map((e) => e.code)).toContain('NAME_REQUIRED');
  });

  it('empty binding → BINDING_REQUIRED', () => {
    const errs = validateWorkflow({
      displayName: 'name', boundMetadataId: '  ',
      steps: [], dependencies: [],
    });
    expect(errs.map((e) => e.code)).toContain('BINDING_REQUIRED');
  });

  it('duplicate ordinal across steps → ORDINAL_DUPLICATE', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0), step('b', 0)],
      dependencies: [],
    });
    expect(errs.map((e) => e.code)).toContain('ORDINAL_DUPLICATE');
  });

  it('step with blank display name → STEP_NAME_REQUIRED', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0, '   ')], dependencies: [],
    });
    expect(errs.map((e) => e.code)).toContain('STEP_NAME_REQUIRED');
  });

  it('dependency referring to missing step → DEP_UNKNOWN_STEP', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0)],
      dependencies: [dep('missing', 'a')],
    });
    expect(errs.map((e) => e.code)).toContain('DEP_UNKNOWN_STEP');
  });

  it('self-dependency → DEP_SELF', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0)],
      dependencies: [dep('a', 'a')],
    });
    expect(errs.map((e) => e.code)).toContain('DEP_SELF');
  });

  it('simple 2-node cycle → DAG_CYCLE', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0), step('b', 1)],
      dependencies: [dep('a', 'b'), dep('b', 'a')],
    });
    expect(errs.map((e) => e.code)).toContain('DAG_CYCLE');
  });

  it('3-node transitive cycle (a→b→c→a) → DAG_CYCLE', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0), step('b', 1), step('c', 2)],
      dependencies: [dep('a', 'b'), dep('b', 'c'), dep('c', 'a')],
    });
    expect(errs.map((e) => e.code)).toContain('DAG_CYCLE');
  });

  it('acyclic DAG with multiple roots → no cycle error', () => {
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [step('a', 0), step('b', 1), step('c', 2), step('d', 3)],
      dependencies: [dep('a', 'c'), dep('b', 'c'), dep('c', 'd')],
    });
    expect(errs.map((e) => e.code)).not.toContain('DAG_CYCLE');
  });

  it('step without stepId is skipped (continue branch in DAG build)', () => {
    /* Steps missing stepId shouldn't be added to the node set — a
     * dependency pointing at them would surface DEP_UNKNOWN_STEP,
     * not crash. */
    const noIdStep = {
      ...step('ignored', 0),
      stepId: undefined,
    } as unknown as CaptureWorkflowStep;
    const errs = validateWorkflow({
      displayName: 'w', boundMetadataId: 'ds',
      steps: [noIdStep, step('b', 1)],
      dependencies: [],
    });
    /* No crash; only the normal errors (if any). */
    expect(errs).toEqual([]);
  });

  it('multiple errors accumulate in one call', () => {
    const errs = validateWorkflow({
      displayName: '', boundMetadataId: '',
      steps: [step('a', 0, ''), step('b', 0, '')],
      dependencies: [dep('a', 'a')],
    });
    const codes = errs.map((e) => e.code);
    expect(codes).toContain('NAME_REQUIRED');
    expect(codes).toContain('BINDING_REQUIRED');
    expect(codes).toContain('ORDINAL_DUPLICATE');
    expect(codes).toContain('STEP_NAME_REQUIRED');
    expect(codes).toContain('DEP_SELF');
  });
});
