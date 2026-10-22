import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enrolOrRefresh, getStoredDeviceId, getStoredDeviceStatus,
  heartbeat, readOrGenerateDeviceId,
} from './DeviceEnrollment';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DeviceEnrollment', () => {
  it('generates and persists a UUID on first read', () => {
    const first = readOrGenerateDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(window.localStorage.getItem('der_device_id')).toBe(first);
  });

  it('reuses the UUID on subsequent reads', () => {
    const first = readOrGenerateDeviceId();
    expect(readOrGenerateDeviceId()).toBe(first);
  });

  it('returns null when nothing has been generated', () => {
    expect(getStoredDeviceId()).toBeNull();
  });

  it('getStoredDeviceId returns null when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getStoredDeviceId()).toBeNull();
    spy.mockRestore();
  });

  it('getStoredDeviceStatus returns null for junk', () => {
    window.localStorage.setItem('der_device_status', 'bogus');
    expect(getStoredDeviceStatus()).toBeNull();
  });

  it('getStoredDeviceStatus returns the parsed status', () => {
    window.localStorage.setItem('der_device_status', 'APPROVED');
    expect(getStoredDeviceStatus()).toBe('APPROVED');
  });

  it('getStoredDeviceStatus returns null when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getStoredDeviceStatus()).toBeNull();
    spy.mockRestore();
  });

  it('enrolOrRefresh persists the enrolment token and status', async () => {
    const api = {
      enrollDevice: vi.fn().mockResolvedValue({
        deviceId: 'd1', assignedUserId: null, enrolledAt: 'x',
        lastSeenAt: null, userAgent: null, status: 'PENDING',
        enrolmentToken: 'tok-xyz',
      }),
    };
    const state = await enrolOrRefresh(api);
    expect(state.deviceId).toBe('d1');
    expect(state.status).toBe('PENDING');
    expect(window.sessionStorage.getItem('der_device_token')).toBe('tok-xyz');
    expect(window.localStorage.getItem('der_device_status')).toBe('PENDING');
  });

  it('enrolOrRefresh swallows storage errors', async () => {
    const api = {
      enrollDevice: vi.fn().mockResolvedValue({
        deviceId: 'd1', assignedUserId: null, enrolledAt: 'x',
        lastSeenAt: null, userAgent: null, status: 'APPROVED',
      }),
    };
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const state = await enrolOrRefresh(api);
    expect(state.status).toBe('APPROVED');
    spy.mockRestore();
  });

  it('heartbeat delegates to the api', async () => {
    const api = { heartbeatDevice: vi.fn().mockResolvedValue({ outcome: 'OK' }) };
    await heartbeat('d1', api);
    expect(api.heartbeatDevice).toHaveBeenCalledWith('d1');
  });

  it('fallbackUuid when crypto.randomUUID missing', () => {
    // Save and remove crypto.randomUUID so the fallback branch fires.
    const cryptoObj = crypto as Crypto & { randomUUID?: () => string };
    const original = cryptoObj.randomUUID;
    Object.defineProperty(cryptoObj, 'randomUUID', {
      value: undefined, configurable: true, writable: true,
    });
    try {
      const id = readOrGenerateDeviceId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(cryptoObj, 'randomUUID', {
        value: original, configurable: true, writable: true,
      });
    }
  });

  it('readOrGenerateDeviceId swallows localStorage set failure', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const id = readOrGenerateDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-/);
    spy.mockRestore();
  });
});
