import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { enrolOrRefresh, heartbeat, type DeviceState } from './DeviceEnrollment';

export interface UseDeviceEnrollmentOptions {
  readonly api?: Pick<typeof edgeApi, 'enrollDevice' | 'heartbeatDevice'>;
  /** Heartbeat cadence in milliseconds; default 5 min. 0 disables heartbeat. */
  readonly heartbeatMs?: number;
  /** Skip enrol entirely (e.g. in SignIn where the user isn't yet authenticated). */
  readonly enabled?: boolean;
}

/**
 * Drives the ADR-0019 device-identity lifecycle on first mount of
 * the authenticated client:
 *   1. Generate / read installation UUID.
 *   2. POST /devices/enroll — upsert + initial heartbeat.
 *   3. Periodic heartbeat.
 *
 * Returns the latest {@link DeviceState} or {@code null} while the
 * initial enrol is in flight.
 */
export function useDeviceEnrollment(options: UseDeviceEnrollmentOptions = {}):
    DeviceState | null {
  const api = options.api ?? edgeApi;
  const heartbeatMs = options.heartbeatMs ?? 5 * 60 * 1000;
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<DeviceState | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const s = await enrolOrRefresh(api);
        if (cancelled) return;
        setState(s);
        if (heartbeatMs > 0) {
          timer = setInterval(() => {
            heartbeat(s.deviceId, api).catch(() => undefined);
          }, heartbeatMs);
        }
      } catch {
        // Enrol failing is non-fatal — client keeps working, admin
        // sees the lack of row and investigates.
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearInterval(timer);
      }
    };
  }, [api, heartbeatMs, enabled]);

  return state;
}
