import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepsEditor } from './StepsEditor';
import type { CaptureWorkflowStep, EdgeDeviceRow } from '../../api/edgeApi';

/* StepsEditor is a pure controlled component: renders one card per
 * step, with controls for ordinal / displayName / ownerRole /
 * ownerDeviceId / stepKind / sectionKind / sectionRef. Each control
 * fires onChange with the mutated steps array. Empty-state message +
 * "Add step" button + "Remove" per card round out the surface. */

function step(ix: number, overrides: Partial<CaptureWorkflowStep> = {})
: CaptureWorkflowStep {
  return {
    stepId: `step-${ix}`, ordinal: ix,
    displayName: `Step ${ix}`,
    ownerRole: 'OPERATOR',
    stepKind: 'CAPTURE',
    sectionKind: 'AD_HOC',
    sectionRef: null, ownerDeviceId: null,
    fields: [],
    ...overrides,
  } as unknown as CaptureWorkflowStep;
}

function device(id: string, extra: Partial<EdgeDeviceRow> = {})
: EdgeDeviceRow {
  return {
    deviceId: id, status: 'APPROVED',
    lastSeenAt: 'now', assignedUserId: null,
    enrolmentTokenHash: 'h', enrolledAt: 'now',
    approvedBy: null, approvedAt: null, userAgent: 'ua',
    firmwareVersion: null, displayName: null, formFactor: 'TABLET',
    ...extra,
  } as unknown as EdgeDeviceRow;
}

describe('StepsEditor', () => {
  it('empty steps array → placeholder message + enabled Add button', () => {
    render(<StepsEditor steps={[]} devices={[]}
             onChange={() => undefined} />);
    expect(screen.getByText(/No steps yet/)).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-step-add')).toBeInTheDocument();
  });

  it('populated steps render one card each + the Remove button', () => {
    render(<StepsEditor steps={[step(0), step(1)]} devices={[]}
             onChange={() => undefined} />);
    expect(screen.getByTestId('cwf02-step-0')).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-step-0-remove')).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-step-1-remove')).toBeInTheDocument();
  });

  it('ordinal change fires onChange with the new value', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0)]} devices={[]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-ordinal'),
                      { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(arg[0].ordinal).toBe(5);
  });

  it('display-name change fires onChange with new displayName', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0)]} devices={[]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-name'),
                      { target: { value: 'Capture visit' } });
    expect(onChange.mock.calls[0][0][0].displayName).toBe('Capture visit');
  });

  it('owner-role select change fires onChange with new role', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0)]} devices={[]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-role'),
                      { target: { value: 'REVIEWER' } });
    expect(onChange.mock.calls[0][0][0].ownerRole).toBe('REVIEWER');
  });

  it('device select — picking a device sets ownerDeviceId', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0)]}
             devices={[device('dev-1', { displayName: 'Tab 1' })]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-device'),
                      { target: { value: 'dev-1' } });
    expect(onChange.mock.calls[0][0][0].ownerDeviceId).toBe('dev-1');
  });

  it('device select — picking "— inherit —" sets ownerDeviceId to null', () => {
    const onChange = vi.fn();
    render(<StepsEditor
             steps={[step(0, { ownerDeviceId: 'dev-1' })]}
             devices={[device('dev-1')]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-device'),
                      { target: { value: '' } });
    expect(onChange.mock.calls[0][0][0].ownerDeviceId).toBeNull();
  });

  it('step-kind change fires onChange', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0)]} devices={[]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-stepkind'),
                      { target: { value: 'APPROVE' } });
    expect(onChange.mock.calls[0][0][0].stepKind).toBe('APPROVE');
  });

  it('section-kind change fires onChange', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0)]} devices={[]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-sectionkind'),
                      { target: { value: 'PROGRAM_STAGE' } });
    expect(onChange.mock.calls[0][0][0].sectionKind).toBe('PROGRAM_STAGE');
  });

  it('section-ref change — non-empty sets the UID, empty sets null', () => {
    const onChange = vi.fn();
    render(<StepsEditor
             steps={[step(0, { sectionRef: 'sec-old' })]}
             devices={[]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-step-0-sectionref'),
                      { target: { value: 'sec-new' } });
    expect(onChange.mock.calls[0][0][0].sectionRef).toBe('sec-new');
    /* Clear → null branch. */
    onChange.mockClear();
    fireEvent.change(screen.getByTestId('cwf02-step-0-sectionref'),
                      { target: { value: '' } });
    expect(onChange.mock.calls[0][0][0].sectionRef).toBeNull();
  });

  it('Remove button fires onChange with the step omitted', () => {
    const onChange = vi.fn();
    render(<StepsEditor steps={[step(0), step(1)]} devices={[]}
             onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cwf02-step-1-remove'));
    const arg = onChange.mock.calls[0][0];
    expect(arg).toHaveLength(1);
    expect(arg[0].stepId).toBe('step-0');
  });

  it('Add step button appends a step with a client-side UUID', () => {
    /* Install a crypto.randomUUID stub if the test env lacks it. */
    const originalUuid = globalThis.crypto?.randomUUID;
    (globalThis.crypto as unknown as { randomUUID: () => string })
      .randomUUID = () => 'uuid-stub';
    try {
      const onChange = vi.fn();
      render(<StepsEditor steps={[]} devices={[]}
               onChange={onChange} />);
      fireEvent.click(screen.getByTestId('cwf02-step-add'));
      const arg = onChange.mock.calls[0][0];
      expect(arg).toHaveLength(1);
      expect(arg[0].stepId).toBe('uuid-stub');
      expect(arg[0].ordinal).toBe(0);
      expect(arg[0].ownerRole).toBe('OPERATOR');
      expect(arg[0].stepKind).toBe('CAPTURE');
      expect(arg[0].sectionKind).toBe('AD_HOC');
    } finally {
      if (originalUuid) {
        (globalThis.crypto as unknown as { randomUUID: () => string })
          .randomUUID = originalUuid;
      }
    }
  });

  it('device option label — formFactor appended when non-UNKNOWN', () => {
    render(<StepsEditor steps={[step(0)]}
             devices={[
               device('dev-tab', { displayName: 'Tab 1',
                                     formFactor: 'TABLET' }),
               device('dev-unk', { displayName: null,
                                     formFactor: 'UNKNOWN' }),
             ]}
             onChange={() => undefined} />);
    /* The option strings surface — "Tab 1 · tablet" and the uid-slice
     * form for the UNKNOWN-formFactor device. */
    const select = screen.getByTestId('cwf02-step-0-device') as HTMLSelectElement;
    const texts = Array.from(select.options).map((o) => o.textContent);
    expect(texts.some((t) => (t ?? '').includes('tablet'))).toBe(true);
    /* UNKNOWN formFactor doesn't append a suffix. */
    expect(texts.some((t) => (t ?? '').includes('dev-unk'))).toBe(true);
  });
});
