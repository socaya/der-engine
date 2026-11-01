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

afterEach(() => vi.restoreAllMocks());

describe('AggregateEntry', () => {
  it('renders dataset from query string', async () => {
    renderWithProviders(<AggregateEntry api={{
      readAggregateValues: vi.fn(), submitAggregate: vi.fn(),
      health: vi.fn().mockResolvedValue(health()),
    } as never} />, { route: '/aggregate/entry?dataSet=DS' });
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-dataset')).toHaveTextContent('DS'));
  });

  it('loads values when button clicked', async () => {
    const api = {
      readAggregateValues: vi.fn().mockResolvedValue({
        dataValues: [{ dataElement: 'de1', orgUnit: 'ou', period: '2026Q1',
                       categoryOptionCombo: 'cc', attributeOptionCombo: 'cc', value: '7' }],
      }),
      submitAggregate: vi.fn(),
      health: vi.fn().mockResolvedValue(health()),
    };
    renderWithProviders(<AggregateEntry api={api as never} />,
      { route: '/aggregate/entry?dataSet=DS&orgUnit=ou&period=2026Q1' });
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-grid')).toBeInTheDocument());
    expect(screen.getByTestId('aggregate-row-current-de1')).toHaveTextContent('7');
  });

  it('submits edits and shows the import summary', async () => {
    const api = {
      readAggregateValues: vi.fn().mockResolvedValue({
        dataValues: [{ dataElement: 'de1', orgUnit: 'ou', period: '2026Q1',
                       categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' }],
      }),
      submitAggregate: vi.fn().mockResolvedValue({ status: 'SUCCESS',
        importCount: { imported: 1, updated: 0, ignored: 0, deleted: 0 }, conflicts: [] }),
      health: vi.fn().mockResolvedValue(health()),
    };
    renderWithProviders(<AggregateEntry api={api as never} />,
      { route: '/aggregate/entry?dataSet=DS&orgUnit=ou&period=2026Q1' });
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() => expect(screen.getByTestId('aggregate-row-input-de1')).toBeInTheDocument());
    await userEvent.type(screen.getByTestId('aggregate-row-input-de1'), '5');
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-result')).toBeInTheDocument());
  });

  it('shows conflicts when the import summary has them', async () => {
    const api = {
      readAggregateValues: vi.fn().mockResolvedValue({
        dataValues: [{ dataElement: 'd', orgUnit: 'ou', period: '2026Q1',
                       categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' }],
      }),
      submitAggregate: vi.fn().mockResolvedValue({ status: 'WARNING',
        conflicts: [{ object: 'd', value: 'nope' }] }),
      health: vi.fn().mockResolvedValue(health()),
    };
    renderWithProviders(<AggregateEntry api={api as never} />,
      { route: '/aggregate/entry?dataSet=DS&orgUnit=ou&period=2026Q1' });
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await userEvent.type(await screen.findByTestId('aggregate-row-input-d'), '5');
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-conflicts')).toBeInTheDocument());
  });

  it('error state when load fails', async () => {
    const api = {
      readAggregateValues: vi.fn().mockRejectedValue(new Error('load-fail')),
      submitAggregate: vi.fn(),
      health: vi.fn().mockResolvedValue(health()),
    };
    renderWithProviders(<AggregateEntry api={api as never} />,
      { route: '/aggregate/entry?orgUnit=ou&period=2026Q1' });
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('error state when submit fails (string reject)', async () => {
    const api = {
      readAggregateValues: vi.fn().mockResolvedValue({ dataValues: [
        { dataElement: 'd', orgUnit: 'ou', period: '2026Q1',
          categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' },
      ] }),
      submitAggregate: vi.fn().mockRejectedValue('x'),
      health: vi.fn().mockResolvedValue(health()),
    };
    renderWithProviders(<AggregateEntry api={api as never} />,
      { route: '/aggregate/entry?orgUnit=ou&period=2026Q1' });
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await userEvent.type(await screen.findByTestId('aggregate-row-input-d'), '1');
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-error')).toBeInTheDocument());
  });

  it('program-rule actions: hides a field and auto-fills ASSIGN values', async () => {
    const api = {
      readAggregateValues: vi.fn().mockResolvedValue({ dataValues: [
        { dataElement: 'DE_HIDDEN', orgUnit: 'ou', period: '2026Q1',
          categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' },
        { dataElement: 'DE_ASSIGN', orgUnit: 'ou', period: '2026Q1',
          categoryOptionCombo: 'c', attributeOptionCombo: 'c', value: '0' },
      ] }),
      submitAggregate: vi.fn().mockResolvedValue({ status: 'SUCCESS',
        importCount: { imported: 2, updated: 0, ignored: 0, deleted: 0 }, conflicts: [] }),
      health: vi.fn().mockResolvedValue(health()),
    };
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
    renderWithProviders(<AggregateEntry api={api as never} />,
      { route: '/aggregate/entry?runId=r1&dataSet=DS&orgUnit=ou&period=2026Q1' });
    await userEvent.click(screen.getByTestId('aggregate-entry-load'));
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-grid')).toBeInTheDocument());
    // Hidden row renders in dim mode without an input.
    await waitFor(() =>
      expect(screen.getByTestId('aggregate-row-hidden-DE_HIDDEN')).toBeInTheDocument());
    expect(screen.queryByTestId('aggregate-row-input-DE_HIDDEN')).toBeNull();
    // Assigned row carries the suggested value.
    expect((screen.getByTestId('aggregate-row-input-DE_ASSIGN') as HTMLInputElement).value)
      .toBe('42');
    expect(screen.getByTestId('aggregate-row-assign-hint-DE_ASSIGN')).toBeInTheDocument();
    // Submit should carry ASSIGN value but not the hidden one.
    await userEvent.click(screen.getByTestId('aggregate-entry-submit'));
    await waitFor(() => expect(api.submitAggregate).toHaveBeenCalled());
    const call = api.submitAggregate.mock.calls[0][0];
    const des = call.dataValues.map((dv: { dataElement: string }) => dv.dataElement);
    expect(des).toContain('DE_ASSIGN');
    expect(des).not.toContain('DE_HIDDEN');
  });

  it('offline banner when dhis2 unreachable', async () => {
    renderWithProviders(<AggregateEntry api={{
      readAggregateValues: vi.fn(), submitAggregate: vi.fn(),
      health: vi.fn().mockResolvedValue(health(false)),
    } as never} />, { route: '/aggregate/entry' });
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-offline')).toBeInTheDocument());
  });
});
