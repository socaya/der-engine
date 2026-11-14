import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDeviceEnrollment } from './useDeviceEnrollment';
import { getStoredDeviceStatus } from './DeviceEnrollment';
import { deviceApprovalMode } from '../api/edgeApi';

/**
 * Fires the enrol-and-heartbeat loop whenever the session is
 * AUTHENTICATED, and surfaces a non-blocking pending-approval
 * notice. Renders nothing when the server reports APPROVED (or
 * when the session is anonymous).
 *
 * ADR-0019 slice B: the server-side DeviceApprovalInterceptor now
 * actually blocks bundle fetch + writes for non-APPROVED devices when
 * strict mode is on. The banner copy reflects that — "Writes still
 * work" is correct only in permissive mode. The mode is fetched once
 * on mount from the public /system/device-approval-mode endpoint.
 */
export function DeviceBoot(): JSX.Element | null {
  const { state } = useAuth();
  const enrolled = state.status === 'AUTHENTICATED';
  const device = useDeviceEnrollment({ enabled: enrolled });
  const [strict, setStrict] = useState(true);
  useEffect(() => {
    if (!enrolled) return;
    deviceApprovalMode()
      .then((m) => setStrict(m.required))
      .catch(() => setStrict(true));
  }, [enrolled]);

  if (!enrolled) {
    return null;
  }
  const status = device?.status ?? getStoredDeviceStatus();
  if (status === null || status === 'APPROVED') {
    return null;
  }
  return (
    <div className="der-device-banner" role="status" data-test="device-banner">
      <strong>Device {device?.deviceId.slice(0, 8) ?? '…'}:</strong>{' '}
      <span data-test="device-banner-status">{status}</span>
      {status === 'PENDING' && (
        <>
          {' — '}
          <span>
            awaiting admin approval.{' '}
            {strict
              ? 'Client apps and data entry are blocked until approved.'
              : 'Writes still work.'}
          </span>
        </>
      )}
      {status === 'SUSPENDED' && (
        <>
          {' — '}
          <span>
            suspended by an admin.
            {strict && ' Client apps and data entry are blocked.'}
          </span>
        </>
      )}
      {status === 'REVOKED' && (
        <>{' — '}<span>revoked; contact an admin to re-enrol.</span></>
      )}
    </div>
  );
}
