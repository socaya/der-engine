import { useAuth } from '../auth/AuthContext';
import { useDeviceEnrollment } from './useDeviceEnrollment';
import { getStoredDeviceStatus } from './DeviceEnrollment';

/**
 * Fires the enrol-and-heartbeat loop whenever the session is
 * AUTHENTICATED, and surfaces a non-blocking pending-approval
 * notice. Renders nothing when the server reports APPROVED (or
 * when the session is anonymous). ADR-0019 slice A: non-blocking
 * on purpose; approval gating lives with Initiative 10 slice B.
 */
export function DeviceBoot(): JSX.Element | null {
  const { state } = useAuth();
  const enrolled = state.status === 'AUTHENTICATED';
  const device = useDeviceEnrollment({ enabled: enrolled });

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
          <span>awaiting admin approval. Writes still work.</span>
        </>
      )}
      {status === 'SUSPENDED' && (
        <>{' — '}<span>suspended by an admin.</span></>
      )}
      {status === 'REVOKED' && (
        <>{' — '}<span>revoked; contact an admin to re-enrol.</span></>
      )}
    </div>
  );
}
