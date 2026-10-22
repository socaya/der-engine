import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceEnrollment } from './useDeviceEnrollment';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDeviceEnrollment', () => {
  it('is a no-op when disabled', () => {
    const api = { enrollDevice: vi.fn(), heartbeatDevice: vi.fn() };
    renderHook(() => useDeviceEnrollment({ enabled: false, api }));
    expect(api.enrollDevice).not.toHaveBeenCalled();
  });

  it('enrols on mount', async () => {
    const api = {
      enrollDevice: vi.fn().mockResolvedValue({
        deviceId: 'd1', assignedUserId: null, enrolledAt: 'x',
        lastSeenAt: null, userAgent: null, status: 'APPROVED',
      }),
      heartbeatDevice: vi.fn().mockResolvedValue({ outcome: 'OK' }),
    };
    const { result } = renderHook(() =>
      useDeviceEnrollment({ heartbeatMs: 0, api }));
    await waitFor(() => expect(api.enrollDevice).toHaveBeenCalled());
    await waitFor(() => expect(result.current?.status).toBe('APPROVED'));
    expect(api.heartbeatDevice).not.toHaveBeenCalled();
  });

  it('fires periodic heartbeat after the configured interval', async () => {
    const api = {
      enrollDevice: vi.fn().mockResolvedValue({
        deviceId: 'd2', assignedUserId: null, enrolledAt: 'x',
        lastSeenAt: null, userAgent: null, status: 'APPROVED',
      }),
      heartbeatDevice: vi.fn().mockResolvedValue({ outcome: 'OK' }),
    };
    const { result } = renderHook(() =>
      useDeviceEnrollment({ heartbeatMs: 50, api }));
    await waitFor(() => expect(result.current).not.toBeNull());
    await waitFor(
      () => expect(api.heartbeatDevice.mock.calls.length).toBeGreaterThanOrEqual(2),
      { timeout: 3000 });
    expect(api.heartbeatDevice).toHaveBeenCalledWith('d2');
  });

  it('swallows enrol rejection', async () => {
    const api = {
      enrollDevice: vi.fn().mockRejectedValue(new Error('offline')),
      heartbeatDevice: vi.fn(),
    };
    const { result } = renderHook(() =>
      useDeviceEnrollment({ heartbeatMs: 0, api }));
    await waitFor(() => expect(api.enrollDevice).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('unmount cleans up the heartbeat timer', async () => {
    const api = {
      enrollDevice: vi.fn().mockResolvedValue({
        deviceId: 'd3', assignedUserId: null, enrolledAt: 'x',
        lastSeenAt: null, userAgent: null, status: 'APPROVED',
      }),
      heartbeatDevice: vi.fn().mockResolvedValue({ outcome: 'OK' }),
    };
    const { result, unmount } = renderHook(() =>
      useDeviceEnrollment({ heartbeatMs: 50, api }));
    await waitFor(() => expect(result.current).not.toBeNull());
    unmount();
    const callsAtUnmount = api.heartbeatDevice.mock.calls.length;
    await new Promise((r) => setTimeout(r, 200));
    expect(api.heartbeatDevice.mock.calls.length).toBe(callsAtUnmount);
  });

  it('swallows heartbeat rejection on tick', async () => {
    const api = {
      enrollDevice: vi.fn().mockResolvedValue({
        deviceId: 'd4', assignedUserId: null, enrolledAt: 'x',
        lastSeenAt: null, userAgent: null, status: 'APPROVED',
      }),
      heartbeatDevice: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const { result } = renderHook(() =>
      useDeviceEnrollment({ heartbeatMs: 50, api }));
    await waitFor(() => expect(result.current).not.toBeNull());
    await waitFor(() => expect(api.heartbeatDevice).toHaveBeenCalled(),
      { timeout: 3000 });
  });
});
