import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregateEntry } from './AggregateEntry';
import { renderWithProviders } from '../test/renderWithProviders';
import type {
  CaptureFormAssembly,
  CaptureFormDataPrefill,
} from '../api/edgeApi';

const health = (ok = true) => ({
  service: 's', status: 'ok', version: '0',
  dhis2Integrated: ok, dhis2Reference: { version: '2.44' }, timestamp: 'now',
});

function form(): CaptureFormAssembly {
  return {
    formType: 'AGGREGATE',
    bindingKind: 'DATA_SET',
    bindingUid: 'DS',
    displayName: 'HIV monthly',
    ownership: { ownerRole: 'OPERATOR', ownerDeviceId: null, isMyStep: true },
    sections: [{
      sectionUid: 'sec-1',
      displayName: 'Core',
      fields: [{
        fieldRef: 'de1', dataElementUid: 'de1', categoryOptionComboUid: null,
        dataElementDisplayName: 'Doses', categoryOptionComboDisplayName: null,
        valueType: 'NUMBER', optionSetUid: null, requirement: 'OPTIONAL',
      }, {
        fieldRef: 'de2:cc', dataElementUid: 'de2', categoryOptionComboUid: 'cc',
        dataElementDisplayName: 'Attendance', categoryOptionComboDisplayName: 'Male',
        valueType: 'NUMBER', optionSetUid: null, requirement: 'OPTIONAL',
      }],
    }],
    upstreamContext: [],
  };
}

function prefill(cells: Record<string, string> = {}): CaptureFormDataPrefill {
  return { cells, lastUpdatedAt: null };
}

function stubApi(overrides: Record<string, unknown> = {}): never {
  return {
    submitAggregate: vi.fn().mockResolvedValue({ status: 'SUCCESS',
      importCount: { imported: 1, updated: 0, ignored: 0, deleted: 0 },
      conflicts: [] }),
    health: vi.fn().mockResolvedValue(health()),
    getDataSetMeta: vi.fn().mockResolvedValue({
      id: 'DS', displayName: 'HIV monthly', periodType: 'Monthly',
    }),
    getCaptureDataSetForm: vi.fn().mockResolvedValue(form()),
    getCaptureDataSetData: vi.fn().mockResolvedValue(prefill()),
    ...overrides,
  } as never;
}

afterEach(() => vi.restoreAllMocks());

describe('AggregateEntry', () => {
  it('renders dataset + bound OU + period picker, no form until period picked', async () => {
    renderWithProviders(<AggregateEntry api={stubApi()} />,
      { route: '/aggregate/entry?dataSet=DS' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-dataset')).toHaveTextContent('DS'));
    expect(screen.getByTestId('aggregate-entry-orgunit')).toHaveTextContent('OU-A');
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-period')).toBeInTheDocument());
    // Form is not rendered until a period is selected.
    expect(screen.queryByTestId('capture-form')).toBeNull();
  });

  it('renders the capture form once period is in URL + prefill lands', async () => {
    const data = vi.fn().mockResolvedValue(prefill({ de1: '12' }));
    renderWithProviders(
      <AggregateEntry api={stubApi({ getCaptureDataSetData: data })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('capture-form')).toBeInTheDocument());
    // D-CAP-3 envelope projected: field labelled "Doses", prefill value 12.
    expect(
      screen.getByTestId('capture-field-de1').querySelector('input'),
    ).toHaveValue(12);
    expect(screen.getByText('Doses')).toBeInTheDocument();
    expect(screen.getByText('Attendance — Male')).toBeInTheDocument();
    expect(data).toHaveBeenCalledWith('DS', 'OU-A', '202611');
  });

  it('shows a spinner while the prefill fetch is in flight and hides it on resolve', async () => {
    let resolveFn: (r: CaptureFormDataPrefill) => void = () => undefined;
    const pending = new Promise<CaptureFormDataPrefill>((r) => { resolveFn = r; });
    const api = stubApi({
      getCaptureDataSetData: vi.fn().mockReturnValue(pending),
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-loading')).toBeInTheDocument());
    resolveFn(prefill());
    await waitFor(() =>
      expect(screen.queryByTestId('aggregate-entry-loading')).toBeNull());
  });

  it('submits every field in the form using the bound OU + selected period', async () => {
    const submit = vi.fn().mockResolvedValue({ status: 'SUCCESS',
      importCount: { imported: 2, updated: 0, ignored: 0, deleted: 0 },
      conflicts: [] });
    renderWithProviders(
      <AggregateEntry api={stubApi({ submitAggregate: submit })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('capture-form')).toBeInTheDocument());
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '9' } },
    );
    fireEvent.change(
      screen.getByTestId('capture-field-de2:cc').querySelector('input')!,
      { target: { value: '4' } },
    );
    fireEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({
        dataSet: 'DS',
        orgUnit: 'OU-A',
        period: '202611',
        dataValues: [
          { dataElement: 'de1', value: '9' },
          { dataElement: 'de2', value: '4', categoryOptionCombo: 'cc' },
        ],
      });
    });
    expect(await screen.findByTestId('aggregate-entry-result')).toBeInTheDocument();
  });

  it('shows conflicts in the import summary', async () => {
    const submit = vi.fn().mockResolvedValue({
      status: 'WARNING', conflicts: [{ object: 'de1', value: 'bad' }],
    });
    renderWithProviders(
      <AggregateEntry api={stubApi({ submitAggregate: submit })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('capture-form')).toBeInTheDocument());
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-conflicts')).toBeInTheDocument());
  });

  it('error state when the prefill fetch rejects', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getCaptureDataSetData: vi.fn().mockRejectedValue(new Error('boom')),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('non-Error prefill rejection surfaces as string', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getCaptureDataSetData: vi.fn().mockRejectedValue('nope'),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('error state when submit rejects', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        submitAggregate: vi.fn().mockRejectedValue(new Error('x')),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('capture-form')).toBeInTheDocument());
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('non-Error submit rejection surfaces as string', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        submitAggregate: vi.fn().mockRejectedValue('nope'),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('capture-form')).toBeInTheDocument());
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('does NOT fetch prefill when the edge is unbound', async () => {
    const data = vi.fn();
    renderWithProviders(
      <AggregateEntry api={stubApi({ getCaptureDataSetData: data })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611',
        orgUnitBinding: null });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-unbound')).toBeInTheDocument());
    expect(data).not.toHaveBeenCalled();
  });

  it('shows metadata-error banner when getDataSetMeta rejects', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getDataSetMeta: vi.fn().mockRejectedValue(new Error('x')),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-meta-error')).toBeInTheDocument());
  });

  it('non-Error metadata rejection surfaces as string', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getDataSetMeta: vi.fn().mockRejectedValue('nope'),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-meta-error')).toBeInTheDocument());
  });

  it('shows form-error banner when getCaptureDataSetForm rejects', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getCaptureDataSetForm: vi.fn().mockRejectedValue(new Error('x')),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-form-error')).toBeInTheDocument());
  });

  it('non-Error form rejection surfaces as string', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getCaptureDataSetForm: vi.fn().mockRejectedValue('nope'),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-form-error')).toBeInTheDocument());
  });

  it('shows the unsupported-period-type banner when the server reports an unknown type', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getDataSetMeta: vi.fn().mockResolvedValue({
          id: 'DS', displayName: 'X', periodType: 'Fortnightly',
        }),
      })} />,
      { route: '/aggregate/entry?dataSet=DS' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-period-unsupported')).toBeInTheDocument());
  });

  it('shows a validation banner + disables submit when a field is invalid', async () => {
    // Required field left empty → ERROR → submit disabled.
    const requiredForm = () => ({
      ...form(),
      sections: [{
        sectionUid: 's', displayName: 'Core',
        fields: [{
          fieldRef: 'req', dataElementUid: 'req', categoryOptionComboUid: null,
          dataElementDisplayName: 'Required DE', categoryOptionComboDisplayName: null,
          valueType: 'TEXT' as const, optionSetUid: null,
          requirement: 'REQUIRED' as const,
        }],
      }],
    });
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getCaptureDataSetForm: vi.fn().mockResolvedValue(requiredForm()),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=202611' },
    );
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-validation')).toBeInTheDocument());
    expect(screen.getByTestId('aggregate-entry-submit')).toBeDisabled();
    fireEvent.change(
      screen.getByTestId('capture-field-req').querySelector('input')!,
      { target: { value: 'ok' } },
    );
    await waitFor(() =>
      expect(screen.queryByTestId('aggregate-entry-validation')).toBeNull());
    expect(screen.getByTestId('aggregate-entry-submit')).toBeEnabled();
  });

  it('offline banner when dhis2 unreachable', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        health: vi.fn().mockResolvedValue(health(false)),
      })} />, { route: '/aggregate/entry?dataSet=DS' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-offline')).toBeInTheDocument());
  });
});
