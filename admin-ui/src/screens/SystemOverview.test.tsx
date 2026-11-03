import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { MockupSystemOverview } from './SystemOverview';
import { health, compat, systemInfo, workerHealth } from '../test/dataModuleFixtures';

beforeEach(() => {
  vi.spyOn(edgeApi, 'health').mockResolvedValue(health());
  vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfo());
  vi.spyOn(edgeApi, 'compat').mockResolvedValue(compat());
  vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue(workerHealth());
  vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
    { runId: 1, jobName: 'J', outcome: 'SUCCEEDED',
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      durationMs: 10, trigger: 'CRON', detail: null, error: null },
  ] as never);
  vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [
    { deviceId: 'd-1', status: 'APPROVED', displayName: null, lastSeenAt: '2026-11-02T00:00:00Z' },
  ] } as never);
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [
    { workflowId: 'wf-1', displayName: 'WF 1', enabled: true, steps: [] },
  ] } as never);
  vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({ entries: [] } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('SystemOverview', () => {
  it('loads then shows "All systems operational"', async () => {
    renderWithProviders(<MockupSystemOverview />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/All systems operational/)).toBeInTheDocument());
    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('System Topology')).toBeInTheDocument();
  });

  it('shows Partial outage when DHIS2 central is unreachable', async () => {
    vi.spyOn(edgeApi, 'compat').mockResolvedValue(compat(false));
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText(/Partial outage/)).toBeInTheDocument());
  });

  it('empty-state messaging for workflows / devices / activity', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] } as never);
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] } as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText(/No clients enrolled/)).toBeInTheDocument());
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
  });
});
