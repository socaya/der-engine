import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularLoader } from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';

export interface RequireAuthProps {
  readonly children: ReactNode;
}

/**
 * Route guard. Redirects to /sign-in when anonymous, to /edge-error when the
 * DER server itself is unreachable. The INITIAL state renders a loader so the
 * UI never flashes an unauthenticated screen while the probe is in flight.
 */
export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'INITIAL') {
    return (
      <div className="der-centered" data-test="auth-loading">
        <CircularLoader small />
      </div>
    );
  }
  if (state.status === 'EDGE_DOWN') {
    return <Navigate to="/edge-error" replace state={{ from: location }} />;
  }
  if (state.status === 'ANONYMOUS') {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
