import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CaptureFormRenderer,
  type FieldValue,
} from './CaptureFormRenderer';
import type { CaptureFormAssembly, CaptureFormField } from '../api/edgeApi';

function field(partial: Partial<CaptureFormField> & { fieldRef: string }): CaptureFormField {
  return {
    fieldRef: partial.fieldRef,
    dataElementUid: partial.dataElementUid ?? partial.fieldRef,
    categoryOptionComboUid: partial.categoryOptionComboUid ?? null,
    dataElementDisplayName: partial.dataElementDisplayName ?? partial.fieldRef,
    categoryOptionComboDisplayName: partial.categoryOptionComboDisplayName ?? null,
    valueType: partial.valueType ?? 'TEXT',
    optionSetUid: partial.optionSetUid ?? null,
    requirement: partial.requirement ?? 'OPTIONAL',
  };
}

function assembly(overrides: Partial<CaptureFormAssembly> = {}): CaptureFormAssembly {
  return {
    formType: 'AGGREGATE',
    bindingKind: 'DATA_SET',
    bindingUid: 'ds1',
    displayName: 'HIV monthly',
    ownership: { ownerRole: 'OPERATOR', ownerDeviceId: 'dev-1', isMyStep: true },
    sections: [
      {
        sectionUid: 'sec-1',
        displayName: 'Core',
        fields: [field({ fieldRef: 'de1', valueType: 'TEXT' })],
      },
    ],
    upstreamContext: [],
    ...overrides,
  };
}

describe('CaptureFormRenderer', () => {
  it('renders header + binding breadcrumb + a TEXT input', () => {
    const onChange = vi.fn();
    render(
      <CaptureFormRenderer
        form={assembly()}
        values={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('capture-form-title')).toHaveTextContent('HIV monthly');
    expect(screen.getByTestId('capture-form-binding')).toHaveTextContent('AGGREGATE');
    const input = screen.getByTestId('capture-field-de1').querySelector('input')!;
    fireEvent.change(input, { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith('de1', '12');
  });

  it('shows the not-owned banner and disables inputs when isMyStep=false', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          ownership: { ownerRole: 'REVIEWER', ownerDeviceId: null, isMyStep: false },
        })}
        values={{}}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('capture-form-not-owned')).toBeInTheDocument();
    const input = screen.getByTestId('capture-field-de1').querySelector('input')!;
    expect(input).toBeDisabled();
  });

  it('respects READONLY requirement even when the step is owned', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'de1', requirement: 'READONLY' }),
            ],
          }],
        })}
        values={{ de1: 'set' }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('capture-field-de1').querySelector('input')).toBeDisabled();
  });

  it('switches to a textarea for LONG_TEXT', () => {
    const onChange = vi.fn();
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'notes', valueType: 'LONG_TEXT' }),
            ],
          }],
        })}
        values={{}}
        onChange={onChange}
      />,
    );
    const ta = screen.getByTestId('capture-field-notes').querySelector('textarea')!;
    fireEvent.change(ta, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('notes', 'hello');
  });

  it('switches to a number input for numeric value types', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'n', valueType: 'NUMBER' }),
              field({ fieldRef: 'i', valueType: 'INTEGER_POSITIVE' }),
            ],
          }],
        })}
        values={{ n: '5' }}
        onChange={() => undefined}
      />,
    );
    expect(
      screen.getByTestId('capture-field-n').querySelector('input'),
    ).toHaveAttribute('type', 'number');
    expect(
      screen.getByTestId('capture-field-i').querySelector('input'),
    ).toHaveAttribute('type', 'number');
  });

  it('renders date + datetime inputs with correct type', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'd', valueType: 'DATE' }),
              field({ fieldRef: 'dt', valueType: 'DATETIME' }),
            ],
          }],
        })}
        values={{}}
        onChange={() => undefined}
      />,
    );
    expect(
      screen.getByTestId('capture-field-d').querySelector('input'),
    ).toHaveAttribute('type', 'date');
    expect(
      screen.getByTestId('capture-field-dt').querySelector('input'),
    ).toHaveAttribute('type', 'datetime-local');
  });

  it('renders a checkbox for BOOLEAN / TRUE_ONLY and emits booleans', () => {
    const onChange = vi.fn();
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'b1', valueType: 'BOOLEAN' }),
              field({ fieldRef: 'b2', valueType: 'TRUE_ONLY' }),
            ],
          }],
        })}
        values={{ b1: true, b2: 'true' }}
        onChange={onChange}
      />,
    );
    const b1 = screen.getByTestId('capture-field-b1').querySelector('input')!;
    fireEvent.click(b1);
    expect(onChange).toHaveBeenCalledWith('b1', false);
  });

  it('marks option-set fields with a placeholder but still uses InputField', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'opt', valueType: 'TEXT', optionSetUid: 'OS1' }),
            ],
          }],
        })}
        values={{}}
        onChange={() => undefined}
      />,
    );
    expect(
      screen.getByTestId('capture-field-opt').querySelector('input'),
    ).toHaveAttribute('placeholder', 'option code');
  });

  it('labels disaggregated fields with a COC suffix', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({
                fieldRef: 'de:cc',
                dataElementDisplayName: 'Doses',
                categoryOptionComboDisplayName: 'Male under 5',
              }),
            ],
          }],
        })}
        values={{}}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText('Doses — Male under 5')).toBeInTheDocument();
  });

  it('renders the upstream-context panel with formatted values', () => {
    const form = assembly({
      upstreamContext: [{
        stepId: 'step-a',
        stepDisplayName: 'Collection',
        fields: [
          field({ fieldRef: 'notes', valueType: 'TEXT' }),
          field({ fieldRef: 'ok', valueType: 'BOOLEAN' }),
          field({ fieldRef: 'blank', valueType: 'TEXT' }),
        ],
      }],
    });
    const values: Record<string, FieldValue> = { notes: 'hi', ok: true };
    render(
      <CaptureFormRenderer
        form={form}
        values={values}
        onChange={() => undefined}
      />,
    );
    const panel = screen.getByTestId('capture-upstream');
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('capture-upstream-notes')).toHaveTextContent('hi');
    expect(screen.getByTestId('capture-upstream-ok')).toHaveTextContent('Yes');
    expect(screen.getByTestId('capture-upstream-blank')).toHaveTextContent('—');
  });

  it('honours the external disabled prop', () => {
    render(
      <CaptureFormRenderer
        form={assembly()}
        values={{}}
        onChange={() => undefined}
        disabled
      />,
    );
    expect(
      screen.getByTestId('capture-field-de1').querySelector('input'),
    ).toBeDisabled();
  });

  it('coerces numeric values held as numbers into strings for display', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'n', valueType: 'NUMBER' }),
            ],
          }],
        })}
        values={{ n: '7' }}
        onChange={() => undefined}
      />,
    );
    expect(
      screen.getByTestId('capture-field-n').querySelector('input'),
    ).toHaveValue(7);
  });

  it('falls back to the index when sectionUid is null', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: null, displayName: 'No uid',
            fields: [field({ fieldRef: 'x' })],
          }],
        })}
        values={{}}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('capture-section-0')).toBeInTheDocument();
  });

  it('BOOLEAN upstream with string value is formatted as-is', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          upstreamContext: [{
            stepId: 's', stepDisplayName: 'S',
            fields: [field({ fieldRef: 'ok', valueType: 'BOOLEAN' })],
          }],
        })}
        values={{ ok: 'true' }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('capture-upstream-ok')).toHaveTextContent('true');
  });

  it('number input fires onChange with the string value', () => {
    const onChange = vi.fn();
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'n', valueType: 'NUMBER' }),
            ],
          }],
        })}
        values={{}}
        onChange={onChange}
      />,
    );
    fireEvent.change(
      screen.getByTestId('capture-field-n').querySelector('input')!,
      { target: { value: '42' } },
    );
    expect(onChange).toHaveBeenCalledWith('n', '42');
  });

  it('date + datetime inputs fire onChange', () => {
    const onChange = vi.fn();
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'd', valueType: 'DATE' }),
              field({ fieldRef: 'dt', valueType: 'DATETIME' }),
            ],
          }],
        })}
        values={{}}
        onChange={onChange}
      />,
    );
    fireEvent.change(
      screen.getByTestId('capture-field-d').querySelector('input')!,
      { target: { value: '2026-11-05' } },
    );
    fireEvent.change(
      screen.getByTestId('capture-field-dt').querySelector('input')!,
      { target: { value: '2026-11-05T10:00' } },
    );
    expect(onChange).toHaveBeenCalledWith('d', '2026-11-05');
    expect(onChange).toHaveBeenCalledWith('dt', '2026-11-05T10:00');
  });

  it('option-set input fires onChange', () => {
    const onChange = vi.fn();
    render(
      <CaptureFormRenderer
        form={assembly({
          sections: [{
            sectionUid: 's', displayName: 'S', fields: [
              field({ fieldRef: 'opt', valueType: 'TEXT', optionSetUid: 'OS1' }),
            ],
          }],
        })}
        values={{}}
        onChange={onChange}
      />,
    );
    fireEvent.change(
      screen.getByTestId('capture-field-opt').querySelector('input')!,
      { target: { value: 'CODE-A' } },
    );
    expect(onChange).toHaveBeenCalledWith('opt', 'CODE-A');
  });

  it('coerces NO for a false boolean upstream value', () => {
    render(
      <CaptureFormRenderer
        form={assembly({
          upstreamContext: [{
            stepId: 's', stepDisplayName: 'S',
            fields: [field({ fieldRef: 'ok', valueType: 'BOOLEAN' })],
          }],
        })}
        values={{ ok: false }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByTestId('capture-upstream-ok')).toHaveTextContent('No');
  });
});
