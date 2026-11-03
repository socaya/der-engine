import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Fleet } from './Fleet';

const empty = {
  summary: { edgeCount: 0, peerCount: 0, peersUp24h: 0,
              latestHealthProbeAt: null, self: { edgeId: 'self-1' } },
  edges: [], peers: [],
};
const populated = {
  summary: { edgeCount: 2, peerCount: 1, peersUp24h: 1,
              latestHealthProbeAt: '2026-11-03T12:00:00Z',
              self: { edgeId: 'self-1' } },
  edges: [
    { edgeId: 'self-1-aaaaaaaaaaaaaaaaaaaaaa', displayName: 'Self',
      siteId: 'S1', role: 'self' as const,
      firstSeenAt: '2026-11-01T00:00:00Z', lastSeenAt: '2026-11-03T12:00:00Z',
      announcedVersion: '1.0.0', tags: null },
    { edgeId: 'peer-1-bbbbbbbbbbbbbbbbbbbbb', displayName: null,
      siteId: null, role: 'peer' as const,
      firstSeenAt: '2026-11-02T00:00:00Z', lastSeenAt: '2026-11-03T11:00:00Z',
      announcedVersion: null, tags: null },
  ],
  peers: [
    { peerId: 'p1', nodeId: 'n-1', endpoint: 'https://a.local',
      state: 'UP', trust: 'TRUSTED', lastOutcome: 'UP',
      lastLatencyMs: 42, remoteVersion: '1.0.0',
      samples24h: 24, up24h: 24, uptime24h: 100 },
    { peerId: 'p2', nodeId: null, endpoint: 'https://b.local',
      state: 'DOWN', trust: 'UNVERIFIED', lastOutcome: 'DEGRADED',
      lastLatencyMs: null, remoteVersion: null,
      samples24h: 0, up24h: 0, uptime24h: null },
    { peerId: 'p3', nodeId: 'n-3', endpoint: 'https://c.local',
      state: 'DOWN', trust: 'TRUSTED', lastOutcome: 'FAIL',
      lastLatencyMs: null, remoteVersion: null,
      samples24h: 2, up24h: 0, uptime24h: 0 },
    { peerId: 'p4', nodeId: 'n-4', endpoint: 'https://d.local',
      state: 'DOWN', trust: 'TRUSTED', lastOutcome: null,
      lastLatencyMs: null, remoteVersion: null,
      samples24h: 0, up24h: 0, uptime24h: null },
  ],
};

function mockFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => new Response(ok ? JSON.stringify(body) : '',
    { status: ok ? 200 : 500 })) as never;
}

describe('Fleet screen', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
      .mockImplementation(mockFetch(populated) as never) as never;
  });
  afterEach(() => { fetchSpy.mockRestore(); vi.useRealTimers(); });

  it('renders the fleet screen root', async () => {
    renderWithProviders(<Fleet />);
    await waitFor(() => expect(screen.getByTestId('fleet')).toBeInTheDocument());
  });
  it('shows summary counts and both tables populated', async () => {
    renderWithProviders(<Fleet />);
    await waitFor(() => expect(screen.getByText('Self')).toBeInTheDocument());
    expect(screen.getByText(/2 edges · 1\/1 peers up 24 h/)).toBeInTheDocument();
    expect(screen.getByLabelText('Fleet roster')).toBeInTheDocument();
    expect(screen.getByLabelText('Peer health')).toBeInTheDocument();
    expect(screen.getByText('SELF')).toBeInTheDocument();
    expect(screen.getByText('PEER')).toBeInTheDocument();
    expect(screen.getByText('n-1')).toBeInTheDocument();
    expect(screen.getByText('UP')).toBeInTheDocument();
    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
    expect(screen.getByText('42 ms')).toBeInTheDocument();
    expect(screen.getByText('100 %')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
  });
  it('renders empty state when no edges and no peers', async () => {
    fetchSpy.mockImplementation(mockFetch(empty) as never);
    renderWithProviders(<Fleet />);
    await waitFor(() =>
      expect(screen.getByText(/Fleet roster is empty/)).toBeInTheDocument());
    expect(screen.getByText(/No peers configured/)).toBeInTheDocument();
    expect(screen.getByText(/0 edges · 0\/0 peers up 24 h/)).toBeInTheDocument();
  });
  it('refresh button re-fetches', async () => {
    renderWithProviders(<Fleet />);
    await waitFor(() => expect(screen.getByText('Self')).toBeInTheDocument());
    const before = fetchSpy.mock.calls.length;
    await userEvent.click(screen.getByLabelText('Refresh fleet'));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before));
  });
  it('swallows fetch errors silently', async () => {
    fetchSpy.mockImplementation(mockFetch(null, false) as never);
    renderWithProviders(<Fleet />);
    // No data loaded -> empty hints show up.
    await waitFor(() =>
      expect(screen.getByText(/Fleet roster is empty/)).toBeInTheDocument());
  });
});
