import { Card, Tag } from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';
import { getStoredDeviceId, getStoredDeviceStatus } from '../device/DeviceEnrollment';

/** DC-02 Session details. Phase 03c read-only projection of the current session. */
export function SessionDetails(): JSX.Element {
  const { state } = useAuth();
  const deviceId = getStoredDeviceId();
  const deviceStatus = getStoredDeviceStatus();
  if (state.status !== 'AUTHENTICATED') {
    // RequireAuth guards the route; this branch should not be reachable
    // but we render a defensive placeholder for safety.
    return <p data-test="session-placeholder">Not signed in.</p>;
  }
  const user = state.user;
  return (
    <div className="der-session-details">
      <h1 data-test="session-heading">Session details</h1>
      <Card>
        <dl>
          <dt>User id</dt>
          <dd data-test="session-userId"><code>{user.userId}</code></dd>
          <dt>Username</dt>
          <dd data-test="session-username">{user.username}</dd>
          <dt>Display name</dt>
          <dd>{user.displayName}</dd>
          <dt>Roles</dt>
          <dd data-test="session-roles">
            {user.roles.map((r) => (
              <Tag key={r} className="der-role-tag">{r}</Tag>
            ))}
          </dd>
          <dt>Expires at</dt>
          <dd data-test="session-expires">{user.expiresAt}</dd>
          <dt>Device</dt>
          <dd data-test="session-device">
            {deviceId
              ? <>
                  <code>{deviceId.slice(0, 8)}</code>
                  {' '}
                  <Tag className="der-device-tag" data-test="session-device-status">
                    {deviceStatus ?? 'UNKNOWN'}
                  </Tag>
                </>
              : <span data-test="session-device-missing">
                  not enrolled yet (see Launcher)
                </span>}
          </dd>
        </dl>
      </Card>
    </div>
  );
}
