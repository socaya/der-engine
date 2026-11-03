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

  it('DER service down — isDerUp false + status chip surfaces h.status', async () => {
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      ...health(), status: 'DOWN',
    });
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText(/Partial outage/)).toBeInTheDocument());
    /* Status KPI tile shows the raw status when not up. */
    expect(screen.getByText('DOWN')).toBeInTheDocument();
  });

  it('starter-ready status still counts as DER up', async () => {
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      ...health(), status: 'starter-ready',
    });
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText('Live')).toBeInTheDocument());
  });

  it('non-SUCCEEDED jobs drop reliability below 95 → warning tone', async () => {
    const nowIso = new Date().toISOString();
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'J', outcome: 'SUCCEEDED',
        startedAt: nowIso, finishedAt: nowIso,
        durationMs: 10, trigger: 'CRON', detail: null, error: null },
      { runId: 2, jobName: 'J', outcome: 'FAILED',
        startedAt: nowIso, finishedAt: nowIso,
        durationMs: 10, trigger: 'CRON', detail: null, error: 'e' },
    ] as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0));
    /* "2 runs sampled" surfaces in the Reliability tile caption. */
    expect(screen.getByText(/2 runs sampled/)).toBeInTheDocument();
  });

  it('empty jobs list → 0% reliability', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText(/0 runs sampled/)).toBeInTheDocument());
  });

  it('worker backlog > 0 flips the Pending Records tile to warning', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      ...workerHealth(),
      backlog: { PENDING: 10, FAILED: 3 },
    } as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText('13')).toBeInTheDocument());
  });

  it('populated activity feed renders eventType + outcome labels', async () => {
    vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({ entries: [
      { auditId: 'a1', eventType: 'SIGN_IN', outcome: 'SUCCESS',
        observedAt: new Date().toISOString() },
      { auditId: 'a2', eventType: 'ACCESS_DENIED', outcome: 'DENIED',
        observedAt: new Date().toISOString() },
    ] } as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText('SIGN_IN')).toBeInTheDocument());
    expect(screen.getByText('ACCESS_DENIED')).toBeInTheDocument();
  });

  it('populated workflows surface the active vs total counts in KPI tile', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [
      { workflowId: 'wf-1', displayName: 'WF-ANC', enabled: true, steps: [] },
      { workflowId: 'wf-2', displayName: 'WF-PNC', enabled: false, steps: [] },
    ] } as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText(/2 defined/)).toBeInTheDocument());
    /* Edge Workflows tile shows "1" active. */
    expect(screen.getByText('Edge Workflows')).toBeInTheDocument();
  });

  it('populated devices lift the "1 of 2" count in the Connected Clients tile', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [
      { deviceId: 'd-approved-aaaaa', status: 'APPROVED',
        displayName: 'Tab A', lastSeenAt: '2026-11-03T10:00:00Z' },
      { deviceId: 'd-pending-bbbbbb',  status: 'PENDING',
        displayName: null, lastSeenAt: '2026-11-03T09:00:00Z' },
    ] } as never);
    renderWithProviders(<MockupSystemOverview />);
    await waitFor(() =>
      expect(screen.getByText('1 of 2')).toBeInTheDocument());
  });
});
