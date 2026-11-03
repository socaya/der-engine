import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeshTopology } from './useMeshTopology';
import type { TopologyResponse } from './types';

const fakeTopology: TopologyResponse = {
  site: { id: 's', name: 'Site' },
  wan: { status: 'online', state: 'OK', centralDhis2Available: true,
         internetAvailable: true, lastProbeAt: null, centralIsLocal: false },
  der: { id: 'der', name: 'DER', type: 'edge', status: 'online',
         fingerprint: 'fp', ipAddress: '1.1.1.1', hostname: 'der',
         centralBridge: true },
  devices: [],
  peers: [],
  connections: [],
  summary: { devices: 0, devicesOnline: 0, devicesDegraded: 0,
              devicesOffline: 0, syncQueueTotal: 0, peers: 0,
              peersConnected: 0, wanStatus: 'online' },
};

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' } });
}
function statusResponse(status: number): Response {
  return new Response('', { status });
}

describe('useMeshTopology', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
      .mockResolvedValue(okResponse(fakeTopology) as never) as never;
  });
  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  it('loads topology on mount', async () => {
    const { result } = renderHook(() => useMeshTopology(15000));
    await vi.waitFor(() => {
      expect(result.current.topology).not.toBeNull();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('/edge-api/v1/network/mesh/topology',
      { credentials: 'include' });
  });
  it('refetches on the configured interval', async () => {
    const { result } = renderHook(() => useMeshTopology(5000));
    await vi.waitFor(() => expect(result.current.topology).not.toBeNull());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
  });
  it('surfaces HTTP error status', async () => {
    fetchSpy.mockResolvedValueOnce(statusResponse(500) as never);
    const { result } = renderHook(() => useMeshTopology(15000));
    await vi.waitFor(() => expect(result.current.error).toBe('HTTP 500'));
    expect(result.current.loading).toBe(false);
  });
  it('surfaces thrown fetch error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useMeshTopology(15000));
    await vi.waitFor(() => expect(result.current.error).toMatch(/boom/));
  });
  it('manual reload() refetches', async () => {
    const { result } = renderHook(() => useMeshTopology(15000));
    await vi.waitFor(() => expect(result.current.topology).not.toBeNull());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.reload(); });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
  it('cleans up on unmount', async () => {
    const { result, unmount } = renderHook(() => useMeshTopology(1000));
    await vi.waitFor(() => expect(result.current.topology).not.toBeNull());
    unmount();
    const before = fetchSpy.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(fetchSpy.mock.calls.length).toBe(before);
  });
  it('restarts interval when refreshMs changes', async () => {
    const { result, rerender } = renderHook(
      ({ ms }: { ms: number }) => useMeshTopology(ms),
      { initialProps: { ms: 10000 } });
    await vi.waitFor(() => expect(result.current.topology).not.toBeNull());
    rerender({ ms: 2000 });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    await act(async () => { vi.advanceTimersByTime(2000); });
    await vi.waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(2));
  });
});
