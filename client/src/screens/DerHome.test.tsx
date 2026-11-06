import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DerHome } from './DerHome';
import { renderWithProviders } from '../test/renderWithProviders';

function stubApi(overrides: Record<string, unknown> = {}): never {
  return {
    listDrafts: vi.fn().mockResolvedValue({ drafts: [
      { draftId: 'd1', kind: 'aggregate', title: 't', payload: {}, updatedAt: 'x' },
      { draftId: 'd2', kind: 'aggregate', title: 't2', payload: {}, updatedAt: 'x' },
    ] }),
    journalWorkerHealth: vi.fn().mockResolvedValue({
      enabled: true, lastTick: 'x', lastBatchSize: 0,
      backlog: { PENDING: 3, RETRYABLE: 1, CONFLICT_REVIEW: 0, CENTRAL_ACCEPTED: 99 },
    }),
    ...overrides,
  } as never;
}

afterEach(() => vi.restoreAllMocks());

describe('DerHome', () => {
  it('shows the bound OU card when bound', async () => {
    renderWithProviders(<DerHome api={stubApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId('der-home-bound')).toHaveTextContent('Facility A'));
    expect(screen.getByTestId('der-home-bound')).toHaveTextContent('OU-A');
  });

  it('shows "Not bound" when the edge has no OU binding', async () => {
    renderWithProviders(<DerHome api={stubApi()} />, { orgUnitBinding: null });
    await waitFor(() =>
      expect(screen.getByTestId('der-home-bound')).toHaveTextContent('Not bound'));
  });

  it('renders drafts count from listDrafts', async () => {
    renderWithProviders(<DerHome api={stubApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId('der-home-drafts')).toHaveTextContent('2'));
  });

  it('renders attention count as the PENDING+RETRYABLE+CONFLICT+UNKNOWN sum', async () => {
    // The journalWorkerHealth stub returns PENDING:3 + RETRYABLE:1 → 4.
    renderWithProviders(<DerHome api={stubApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId('der-home-attention')).toHaveTextContent('4'));
  });

  it('shows 0 on listDrafts failure', async () => {
    renderWithProviders(<DerHome api={stubApi({
      listDrafts: vi.fn().mockRejectedValue(new Error('boom')),
    })} />);
    await waitFor(() =>
      expect(screen.getByTestId('der-home-drafts')).toHaveTextContent('0'));
  });

  it('shows 0 on journalWorkerHealth failure', async () => {
    renderWithProviders(<DerHome api={stubApi({
      journalWorkerHealth: vi.fn().mockRejectedValue(new Error('boom')),
    })} />);
    await waitFor(() =>
      expect(screen.getByTestId('der-home-attention')).toHaveTextContent('0'));
  });

  it('exposes links to drafts / sync-status / review', async () => {
    renderWithProviders(<DerHome api={stubApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId('der-home-drafts-link'))
        .toHaveAttribute('href', '/drafts'));
    expect(screen.getByTestId('der-home-attention-link'))
      .toHaveAttribute('href', '/sync/status');
    expect(screen.getByTestId('der-home-queued-link'))
      .toHaveAttribute('href', '/review');
  });
});
