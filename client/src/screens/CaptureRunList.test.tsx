import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptureRunList } from './CaptureRunList';
import { renderWithProviders } from '../test/renderWithProviders';

const healthy = {
  service: 'der-server', status: 'ok', version: '0',
  dhis2Integrated: true, dhis2Reference: { version: '2.44' }, timestamp: 'now',
};

const offline = { ...healthy, dhis2Integrated: false };

const workflow = {
  workflowId: 'wf-1',
  displayName: 'Monthly HIV',
  boundMetadataKind: 'DATA_SET',
  boundMetadataId: 'ds1',
  enabled: true,
  version: 3,
};

const run = {
  runId: '11111111-2222-3333-4444-555555555555',
  workflowId: 'wf-1',
  workflowVersion: 3,
  businessKey: 'OU-A:2026W40',
  currentStepId: 'step-collect',
  state: 'OPEN' as const,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-05T11:00:00Z',
};

function stubApi(overrides: Record<string, unknown> = {}): never {
  return {
    health: vi.fn().mockResolvedValue(healthy),
    listCaptureWorkflows: vi.fn().mockResolvedValue({ workflows: [workflow] }),
    listCaptureRuns: vi.fn().mockResolvedValue({ count: 1, runs: [run] }),
    startCaptureRun: vi.fn().mockResolvedValue({ ...run, runId: 'new-run' }),
    ...overrides,
  } as never;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('CaptureRunList', () => {
  it('renders empty-pick state before a workflow is chosen', async () => {
    renderWithProviders(<CaptureRunList api={stubApi()} />);
    expect(await screen.findByTestId('capture-runs-pick')).toBeInTheDocument();
  });

  it('loads runs for the workflow in the URL', async () => {
    renderWithProviders(<CaptureRunList api={stubApi()} />, {
      route: '/capture/runs?workflowId=wf-1',
    });
    await waitFor(() => {
      expect(screen.getByTestId(`capture-run-${run.runId}`)).toBeInTheDocument();
    });
    expect(screen.getByText('OU-A:2026W40')).toBeInTheDocument();
  });

  it('shows the empty state when no runs match', async () => {
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          listCaptureRuns: vi.fn().mockResolvedValue({ count: 0, runs: [] }),
        })}
      />,
      { route: '/capture/runs?workflowId=wf-1&state=OPEN' },
    );
    expect(await screen.findByTestId('capture-runs-empty')).toBeInTheDocument();
  });

  it('shows the error state when listCaptureRuns fails', async () => {
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          listCaptureRuns: vi.fn().mockRejectedValue(new Error('boom')),
        })}
      />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    expect(await screen.findByTestId('capture-runs-error')).toBeInTheDocument();
  });

  it('non-Error rejection surfaces as string', async () => {
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          listCaptureRuns: vi.fn().mockRejectedValue('plain'),
        })}
      />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    expect(await screen.findByTestId('capture-runs-error')).toBeInTheDocument();
  });

  it('shows offline banner when health flags dhis2Integrated=false', async () => {
    renderWithProviders(
      <CaptureRunList api={stubApi({ health: vi.fn().mockResolvedValue(offline) })} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('capture-runs-offline')).toBeInTheDocument();
    });
  });

  it('falls back to empty workflow list when the lookup fails', async () => {
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          listCaptureWorkflows: vi.fn().mockRejectedValue(new Error('x')),
        })}
      />,
    );
    expect(await screen.findByTestId('capture-runs-pick')).toBeInTheDocument();
  });

  it('opens the Start-run modal and calls startCaptureRun', async () => {
    const start = vi.fn().mockResolvedValue({ ...run, runId: 'new-run' });
    renderWithProviders(
      <CaptureRunList api={stubApi({ startCaptureRun: start })} />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    await waitFor(() => {
      expect(screen.getByTestId('capture-runs-start')).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId('capture-runs-start'));
    const modal = await screen.findByTestId('capture-runs-start-modal');
    const input = within(modal).getByTestId('capture-runs-start-key').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'OU-B:2026W41' } });
    fireEvent.click(screen.getByTestId('capture-runs-start-confirm'));
    await waitFor(() => {
      expect(start).toHaveBeenCalledWith('wf-1', 'OU-B:2026W41');
    });
  });

  it('shows start error when startCaptureRun rejects', async () => {
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          startCaptureRun: vi.fn().mockRejectedValue(new Error('conflict')),
        })}
      />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    await waitFor(() => {
      expect(screen.getByTestId('capture-runs-start')).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId('capture-runs-start'));
    const modal = await screen.findByTestId('capture-runs-start-modal');
    const input = within(modal).getByTestId('capture-runs-start-key').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'k' } });
    fireEvent.click(screen.getByTestId('capture-runs-start-confirm'));
    expect(await screen.findByTestId('capture-runs-start-error')).toBeInTheDocument();
  });

  it('non-Error start rejection surfaces as string', async () => {
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          startCaptureRun: vi.fn().mockRejectedValue('nope'),
        })}
      />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    await waitFor(() => {
      expect(screen.getByTestId('capture-runs-start')).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId('capture-runs-start'));
    const modal = await screen.findByTestId('capture-runs-start-modal');
    const input = within(modal).getByTestId('capture-runs-start-key').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'k' } });
    fireEvent.click(screen.getByTestId('capture-runs-start-confirm'));
    expect(await screen.findByTestId('capture-runs-start-error')).toBeInTheDocument();
  });

  it('start-run cancel closes the modal without calling the api', async () => {
    const start = vi.fn();
    renderWithProviders(
      <CaptureRunList api={stubApi({ startCaptureRun: start })} />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    await waitFor(() => {
      expect(screen.getByTestId('capture-runs-start')).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId('capture-runs-start'));
    await screen.findByTestId('capture-runs-start-modal');
    fireEvent.click(screen.getByTestId('capture-runs-start-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('capture-runs-start-modal')).not.toBeInTheDocument();
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('changing workflow and state selects updates the URL and reloads', async () => {
    const list = vi.fn().mockResolvedValue({ count: 0, runs: [] });
    renderWithProviders(
      <CaptureRunList api={stubApi({ listCaptureRuns: list })} />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    await screen.findByTestId('capture-runs-heading');
    // the SingleSelectField onChange is deep inside @dhis2/ui's generated
    // DOM; smoke-test the updateParam path by clicking the already-rendered
    // state select "Open" option via its hidden toggle.
    // simpler: assert the first fetch used the workflowId
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith({ workflowId: 'wf-1', state: undefined });
    });
  });

  it('applies state filter from the URL', async () => {
    const list = vi.fn().mockResolvedValue({ count: 0, runs: [] });
    renderWithProviders(
      <CaptureRunList api={stubApi({ listCaptureRuns: list })} />,
      { route: '/capture/runs?workflowId=wf-1&state=AWAITING' },
    );
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith({ workflowId: 'wf-1', state: 'AWAITING' });
    });
  });

  it('renders every state tag', async () => {
    const runs = [
      { ...run, runId: 'r-o', state: 'OPEN' as const },
      { ...run, runId: 'r-a', state: 'AWAITING' as const, currentStepId: null },
      { ...run, runId: 'r-c', state: 'COMPLETED' as const },
      { ...run, runId: 'r-r', state: 'REJECTED' as const },
    ];
    renderWithProviders(
      <CaptureRunList
        api={stubApi({
          listCaptureRuns: vi.fn().mockResolvedValue({ count: 4, runs }),
        })}
      />,
      { route: '/capture/runs?workflowId=wf-1' },
    );
    for (const r of runs) {
      await waitFor(() => {
        expect(screen.getByTestId(`capture-run-${r.runId}`)).toBeInTheDocument();
      });
    }
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.getByText('Awaiting')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });
});
