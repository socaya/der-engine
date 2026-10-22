import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export interface RequireAuthProps {
  readonly children: ReactNode;
}

/** Route guard — same contract as the client's RequireAuth. */
export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'INITIAL') {
    return <div className="der-centered" data-test="auth-loading" role="status">Loading…</div>;
  }
  if (state.status === 'EDGE_DOWN') {
    return <Navigate to="/edge-error" replace state={{ from: location }} />;
  }
  if (state.status === 'ANONYMOUS') {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
