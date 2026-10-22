import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AggregateDatasetPicker } from './AggregateDatasetPicker';
import { renderWithProviders } from '../test/renderWithProviders';

const health = (dhis2Integrated = true) => ({
  service: 'der-server', status: 'ok', version: '0',
  dhis2Integrated, dhis2Reference: { version: '2.44' }, timestamp: 'now',
});

afterEach(() => vi.restoreAllMocks());

describe('AggregateDatasetPicker', () => {
  it('shows datasets', async () => {
    const api = {
      metadataList: vi.fn().mockResolvedValue({
        dataSets: [{ id: 'ds1', displayName: 'HIV monthly' }],
      }),
      health: vi.fn().mockResolvedValue(health(true)),
    };
    renderWithProviders(<AggregateDatasetPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('aggregate-datasets-heading')).toBeInTheDocument());
    expect(screen.getByTestId('aggregate-dataset-ds1')).toHaveTextContent('HIV monthly');
  });

  it('empty state when no datasets', async () => {
    const api = {
      metadataList: vi.fn().mockResolvedValue({ dataSets: [] }),
      health: vi.fn().mockResolvedValue(health(true)),
    };
    renderWithProviders(<AggregateDatasetPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('aggregate-datasets-empty')).toBeInTheDocument());
  });

  it('offline banner when dhis2 unreachable', async () => {
    const api = {
      metadataList: vi.fn().mockResolvedValue({ dataSets: [{ id: 'd', displayName: 'D' }] }),
      health: vi.fn().mockResolvedValue(health(false)),
    };
    renderWithProviders(<AggregateDatasetPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('aggregate-datasets-offline')).toBeInTheDocument());
  });

  it('error state', async () => {
    const api = {
      metadataList: vi.fn().mockRejectedValue(new Error('boom')),
      health: vi.fn().mockResolvedValue(health(true)),
    };
    renderWithProviders(<AggregateDatasetPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('aggregate-datasets-error')).toBeInTheDocument());
  });

  it('non-Error rejection surfaces as string', async () => {
    const api = {
      metadataList: vi.fn().mockRejectedValue('plain'),
      health: vi.fn().mockResolvedValue(health(true)),
    };
    renderWithProviders(<AggregateDatasetPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('aggregate-datasets-error')).toBeInTheDocument());
  });

  it('falls back to items[] if dataSets missing', async () => {
    const api = {
      metadataList: vi.fn().mockResolvedValue({ items: [{ id: 'x', displayName: 'X' }] }),
      health: vi.fn().mockResolvedValue(health(true)),
    };
    renderWithProviders(<AggregateDatasetPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('aggregate-dataset-x')).toBeInTheDocument());
  });
});
