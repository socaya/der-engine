import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Testing } from './Testing';

const empty = {
  summary: { totalRuns: 0, last24hRuns: 0, last24hPass: 0, last24hFail: 0 },
  runs: [],
};
const populated = {
  summary: { totalRuns: 10, last24hRuns: 4, last24hPass: 3, last24hFail: 1 },
  runs: [
    { runId: 'r1', kind: 'LOAD' as const, scenario: 'baseline',
      startedAt: '2026-11-03T12:00:00Z', finishedAt: '2026-11-03T12:00:30Z',
      outcome: 'PASS' as const, durationMs: 3000,
      requestsTotal: 240, requestsFailed: 1,
      latencyP50Ms: 10, latencyP95Ms: 50, latencyP99Ms: 100,
      throughputRps: 8.2, triggeredBy: 'alice' },
    { runId: 'r2', kind: 'CHAOS' as const, scenario: 'pool',
      startedAt: '2026-11-03T11:00:00Z', finishedAt: '2026-11-03T11:01:00Z',
      outcome: 'FAIL' as const, durationMs: 60000,
      requestsTotal: null, requestsFailed: null,
      latencyP50Ms: null, latencyP95Ms: null, latencyP99Ms: null,
      throughputRps: null, triggeredBy: null },
    { runId: 'r3', kind: 'SOAK' as const, scenario: 'warm',
      startedAt: '2026-11-03T10:00:00Z', finishedAt: null,
      outcome: 'RUNNING' as const, durationMs: null,
      requestsTotal: 0, requestsFailed: 0,
      latencyP50Ms: null, latencyP95Ms: null, latencyP99Ms: null,
      throughputRps: null, triggeredBy: 'bob' },
    { runId: 'r4', kind: 'GOLDEN' as const, scenario: 'deploy',
      startedAt: '2026-11-02T00:00:00Z', finishedAt: '2026-11-02T00:00:10Z',
      outcome: 'ABORTED' as const, durationMs: 10000,
      requestsTotal: 10, requestsFailed: 0,
      latencyP50Ms: 1, latencyP95Ms: 2, latencyP99Ms: 3,
      throughputRps: 1.0, triggeredBy: 'bob' },
  ],
};

function mkFetch(body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body),
    { status: 200 })) as never;
}

describe('Testing screen', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
      .mockImplementation(mkFetch(populated) as never) as never;
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('mounts', async () => {
    renderWithProviders(<Testing />);
    await waitFor(() => expect(screen.getByTestId('testing')).toBeInTheDocument());
  });
  it('renders summary and all four outcome tones', async () => {
    renderWithProviders(<Testing />);
    await waitFor(() => expect(screen.getByText('PASS')).toBeInTheDocument());
    expect(screen.getByText('FAIL')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('ABORTED')).toBeInTheDocument();
    expect(screen.getByText(/3\/4 PASS 24 h · 10 total/)).toBeInTheDocument();
    expect(screen.getByText('8.2')).toBeInTheDocument();
  });
  it('empty state message when no runs', async () => {
    fetchSpy.mockImplementation(mkFetch(empty) as never);
    renderWithProviders(<Testing />);
    await waitFor(() =>
      expect(screen.getByText(/No testing runs yet/)).toBeInTheDocument());
  });
  it('clicking Load button posts and refetches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Testing />);
    await waitFor(() => expect(screen.getByText('PASS')).toBeInTheDocument());
    const before = fetchSpy.mock.calls.length;
    await user.click(screen.getByTestId('btn-load'));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before + 1));
    // One of the fetches must have been a POST to /testing/load
    const postCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes('/testing/load'));
    expect(postCall).toBeTruthy();
  });
  it('clicking Chaos and Soak buttons posts to correct endpoints', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Testing />);
    await waitFor(() => expect(screen.getByTestId('btn-chaos')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-chaos'));
    await waitFor(() => expect(fetchSpy.mock.calls.some((c) =>
      String(c[0]).includes('/testing/chaos'))).toBe(true));
    await user.click(screen.getByTestId('btn-soak'));
    await waitFor(() => expect(fetchSpy.mock.calls.some((c) =>
      String(c[0]).includes('/testing/soak'))).toBe(true));
  });
  it('refresh action re-fetches', async () => {
    renderWithProviders(<Testing />);
    await waitFor(() => expect(screen.getByText('PASS')).toBeInTheDocument());
    const before = fetchSpy.mock.calls.length;
    await userEvent.click(screen.getByLabelText('Refresh testing history'));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before));
  });
  it('loading label before data', () => {
    fetchSpy.mockImplementation(() => new Promise(() => undefined) as never);
    renderWithProviders(<Testing />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });
});
