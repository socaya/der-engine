import { Button, Card, NoticeBox } from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';

/**
 * DC-18 Edge connection error.
 *
 * Shown when the AuthContext probes GET /edge-api/v1/auth/session and gets
 * EDGE_UNREACHABLE. Clear, actionable copy — the user should check that the
 * DER server is actually up on the edge host rather than guess that it's a
 * network issue.
 */
export function EdgeConnectionError(): JSX.Element {
  const { refresh } = useAuth();
  return (
    <div className="der-centered">
      <Card className="der-edge-error-card" dataTest="edge-error-card">
        <NoticeBox error title="DER edge runtime is unreachable" dataTest="edge-error-notice">
          The DER edge runtime at this origin did not respond. This is a local
          issue, not a central or internet outage.
        </NoticeBox>
        <ul>
          <li>Check that the DER server is running on the edge host.</li>
          <li>Confirm NGINX (or the dev proxy) is routing <code>/edge-api/v1</code> to the DER server.</li>
          <li>Ask the edge administrator to check <code>/var/log/der</code> and systemd status.</li>
        </ul>
        <div className="der-edge-error-actions">
          <Button primary onClick={() => void refresh()} dataTest="edge-error-retry">
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
