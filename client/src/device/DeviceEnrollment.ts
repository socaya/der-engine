import * as edgeApi from '../api/edgeApi';

/**
 * Client-side device identity (ADR-0019). The installation UUID is
 * stored in {@code localStorage} and generated once per browser
 * install; the raw enrolment token is stored in {@code sessionStorage}
 * so a tab refresh re-reads it but a browser restart does not.
 */

const DEVICE_ID_KEY = 'der_device_id';
const DEVICE_TOKEN_KEY = 'der_device_token';
const DEVICE_STATUS_KEY = 'der_device_status';

export interface DeviceState {
  readonly deviceId: string;
  readonly status: edgeApi.DeviceStatus;
}

export function getStoredDeviceId(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

export function readOrGenerateDeviceId(): string {
  const existing = getStoredDeviceId();
  if (existing) return existing;
  // crypto.randomUUID is available in every evergreen browser; fall back
  // to a time-seeded UUID shape only to keep jsdom tests from throwing.
  const randomUUID = typeof crypto !== 'undefined'
    ? (crypto as Crypto & { randomUUID?: () => string }).randomUUID
    : undefined;
  const uuid = typeof randomUUID === 'function' ? randomUUID.call(crypto) : fallbackUuid();
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, uuid);
  } catch {
    // ignore — the enrol POST will still succeed, just not persist.
  }
  return uuid;
}

function fallbackUuid(): string {
  // RFC4122 v4 shape; good enough for jsdom. Real browsers never hit this.
  const hex = (n: number): string => n.toString(16).padStart(2, '0');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const s = Array.from(bytes, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export async function enrolOrRefresh(
  api: Pick<typeof edgeApi, 'enrollDevice'> = edgeApi,
): Promise<DeviceState> {
  const deviceId = readOrGenerateDeviceId();
  const device = await api.enrollDevice(deviceId, window.navigator.userAgent);
  try {
    if (device.enrolmentToken) {
      window.sessionStorage.setItem(DEVICE_TOKEN_KEY, device.enrolmentToken);
    }
    window.localStorage.setItem(DEVICE_STATUS_KEY, device.status);
  } catch {
    // ignore storage failures
  }
  return { deviceId: device.deviceId, status: device.status };
}

export async function heartbeat(
  deviceId: string,
  api: Pick<typeof edgeApi, 'heartbeatDevice'> = edgeApi,
): Promise<void> {
  await api.heartbeatDevice(deviceId);
}

export function getStoredDeviceStatus(): edgeApi.DeviceStatus | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_STATUS_KEY);
    if (raw === 'PENDING' || raw === 'APPROVED' || raw === 'SUSPENDED' || raw === 'REVOKED') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
