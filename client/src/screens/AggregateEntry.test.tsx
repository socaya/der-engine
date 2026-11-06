import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregateEntry } from './AggregateEntry';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';

const health = (ok = true) => ({
  service: 's', status: 'ok', version: '0',
  dhis2Integrated: ok, dhis2Reference: { version: '2.44' }, timestamp: 'now',
});

function stubApi(overrides: Record<string, unknown> = {}): never {
  return {
    readAggregateValues: vi.fn(),
    submitAggregate: vi.fn(),
    health: vi.fn().mockResolvedValue(health()),
    getDataSetMeta: vi.fn().mockResolvedValue({
      id: 'DS', displayName: 'HIV monthly', periodType: 'Quarterly',
    }),
    ...overrides,
  } as never;
}

afterEach(() => vi.restoreAllMocks());

describe('AggregateEntry', () => {
  it('renders dataset + period-type picker from server metadata', async () => {
    renderWithProviders(<AggregateEntry api={stubApi()} />,
      { route: '/aggregate/entry?dataSet=DS' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-dataset')).toHaveTextContent('DS'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-period')).toBeInTheDocument());
    // Bound OU (default "OU-A" via renderWithProviders) renders as a locked
    // display, not a free-text input.
    expect(screen.getByTestId('aggregate-entry-orgunit')).toHaveTextContent('OU-A');
  });

  it('loads values for the bound OU + supplied period', async () => {
    const api = stubApi({
      readAggregateValues: vi.fn().mockResolvedValue({
        dataValues: [{ dataElement: 'de1', orgUnit: 'OU-A', period: '2026Q1',
                       categoryOptionCombo: 'cc', attributeOptionCombo: 'cc', value: '7' }],
      }),
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-load')).toBeEnabled());
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-grid')).toBeInTheDocument());
    expect(screen.getByTestId('aggregate-row-current-de1')).toHaveTextContent('7');
    // Reads must target the bound OU, not the URL ou.
    const readSpy = (api as unknown as {
      readAggregateValues: { mock: { calls: unknown[][] } }
    }).readAggregateValues;
    expect(readSpy.mock.calls[0][0]).toBe('OU-A');
  });

  it('submits with the bound OU and shows the import summary', async () => {
    const submit = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      importCount: { imported: 1, updated: 0, ignored: 0, deleted: 0 },
      conflicts: [],
    });
    const api = stubApi({
      readAggregateValues: vi.fn().mockResolvedValue({
        dataValues: [{ dataElement: 'de1', orgUnit: 'OU-A', period: '2026Q1',
                       categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' }],
      }),
      submitAggregate: submit,
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-load')).toBeEnabled());
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-row-input-de1')).toBeInTheDocument());
    await userEvent.type(screen.getByTestId('aggregate-row-input-de1'), '5');
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-result')).toBeInTheDocument());
    expect(submit.mock.calls[0][0].dataValues[0].orgUnit).toBe('OU-A');
  });

  it('shows conflicts when the import summary has them', async () => {
    const api = stubApi({
      readAggregateValues: vi.fn().mockResolvedValue({
        dataValues: [{ dataElement: 'd', orgUnit: 'OU-A', period: '2026Q1',
                       categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' }],
      }),
      submitAggregate: vi.fn().mockResolvedValue({
        status: 'WARNING',
        conflicts: [{ object: 'd', value: 'nope' }],
      }),
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-load')).toBeEnabled());
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await userEvent.type(await screen.findByTestId('aggregate-row-input-d'), '5');
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-conflicts')).toBeInTheDocument());
  });

  it('error state when load fails', async () => {
    const api = stubApi({
      readAggregateValues: vi.fn().mockRejectedValue(new Error('load-fail')),
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-load')).toBeEnabled());
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('error state when submit fails (string reject)', async () => {
    const api = stubApi({
      readAggregateValues: vi.fn().mockResolvedValue({ dataValues: [
        { dataElement: 'd', orgUnit: 'OU-A', period: '2026Q1',
          categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' },
      ] }),
      submitAggregate: vi.fn().mockRejectedValue('x'),
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-load')).toBeEnabled());
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await userEvent.type(await screen.findByTestId('aggregate-row-input-d'), '1');
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('shows the unbound banner + disables Load when the edge has no bound OU', async () => {
    renderWithProviders(<AggregateEntry api={stubApi()} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1',
        orgUnitBinding: null });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-unbound')).toBeInTheDocument());
    expect(screen.getByTestId('aggregate-entry-load')).toBeDisabled();
  });

  it('shows metadata-error banner when getDataSetMeta rejects', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getDataSetMeta: vi.fn().mockRejectedValue(new Error('x')),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-meta-error')).toBeInTheDocument());
  });

  it('non-Error metadata rejection surfaces as string', async () => {
    renderWithProviders(
      <AggregateEntry api={stubApi({
        getDataSetMeta: vi.fn().mockRejectedValue('nope'),
      })} />,
      { route: '/aggregate/entry?dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-meta-error')).toBeInTheDocument());
  });

  it('shows an unsupported-period-type banner when the periodType is unknown', async () => {
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

  it('program-rule actions: hides a field and auto-fills ASSIGN values', async () => {
    const api = stubApi({
      readAggregateValues: vi.fn().mockResolvedValue({ dataValues: [
        { dataElement: 'DE_HIDDEN', orgUnit: 'OU-A', period: '2026Q1',
          categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' },
        { dataElement: 'DE_ASSIGN', orgUnit: 'OU-A', period: '2026Q1',
          categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' },
      ] }),
      submitAggregate: vi.fn().mockResolvedValue({ status: 'SUCCESS',
        importCount: { imported: 2, updated: 0, ignored: 0, deleted: 0 }, conflicts: [] }),
    });
    vi.spyOn(edgeApi, 'runValidation').mockResolvedValue({
      runId: 'r1', errorCount: 0,
      issues: [
        { issueId: 'h', runId: 'r1', stepId: null,
          code: 'PROGRAM_RULE_HIDEFIELD', severity: 'INFO',
          message: "Field 'DE_HIDDEN' should be hidden",
          fieldRef: 'DE_HIDDEN' },
        { issueId: 'a', runId: 'r1', stepId: null,
          code: 'PROGRAM_RULE_ASSIGN', severity: 'INFO',
          message: "Rule 'Default' suggests value '42' for field 'DE_ASSIGN'.",
          fieldRef: 'DE_ASSIGN', suggestedValue: '42' },
      ],
    });
    renderWithProviders(<AggregateEntry api={api} />,
      { route: '/aggregate/entry?runId=r1&dataSet=DS&period=2026Q1' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-load')).toBeEnabled());
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-grid')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-row-hidden-DE_HIDDEN')).toBeInTheDocument());
    expect(screen.queryByTestId('aggregate-row-input-DE_HIDDEN')).toBeNull();
    expect((screen.getByTestId('aggregate-row-input-DE_ASSIGN') as HTMLInputElement).value)
      .toBe('42');
    expect(screen.getByTestId('aggregate-row-assign-hint-DE_ASSIGN')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    const submitSpy = (api as unknown as {
      submitAggregate: { mock: { calls: { dataValues: { dataElement: string }[] }[][] } }
    }).submitAggregate;
    await waitFor(() => {
      expect(submitSpy.mock.calls.length).toBeGreaterThan(0);
    });
    const call = submitSpy.mock.calls[0][0];
    const des = call.dataValues.map((dv) => dv.dataElement);
    expect(des).toContain('DE_ASSIGN');
    expect(des).not.toContain('DE_HIDDEN');
  });

  it('offline banner when dhis2 unreachable', async () => {
    renderWithProviders(<AggregateEntry api={stubApi({
      health: vi.fn().mockResolvedValue(health(false)),
    })} />, { route: '/aggregate/entry' });
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-entry-offline')).toBeInTheDocument());
  });
});
