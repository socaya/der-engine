import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregateEntry } from './AggregateEntry';
import { renderWithProviders } from '../test/renderWithProviders';

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

  it('offline banner when dhis2 unreachable', async () => {
    renderWithProviders(<AggregateEntry api={{
      readAggregateValues: vi.fn(), submitAggregate: vi.fn(),
      health: vi.fn().mockResolvedValue(health(false)),
    } as never} />, { route: '/aggregate/entry' });
    await waitFor(() => expect(screen.getByTestId('aggregate-entry-offline')).toBeInTheDocument());
  });
});
