import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, InputField, NoticeBox } from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';

/**
 * DC-01 Sign in.
 *
 * Posts to /edge-api/v1/auth/sign-in via the AuthContext. On success,
 * navigates to the "from" location (set by RequireAuth) or /launcher.
 * Displays explicit, differentiated errors for invalid credentials,
 * rate-limiting and edge-down — FR-04-06 unsupported-vs-temporary.
 */
export function SignIn(): JSX.Element {
  const { signIn, state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyIn = state.status === 'AUTHENTICATED';

  const onSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      const to = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/launcher';
      navigate(to, { replace: true });
    } catch (err) {
      if (err instanceof EdgeApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('Username or password is incorrect.');
        } else if (err.code === 'RATE_LIMITED') {
          setError('Too many sign-in attempts. Try again in a minute.');
        } else {
          setError('Edge runtime is unreachable. Check the server status.');
        }
      } else {
        setError('Unexpected error during sign-in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="der-centered">
      <Card className="der-signin-card" dataTest="signin-card">
        <h1 data-test="signin-heading">DER Edge Runtime — Sign in</h1>
        <p>
          Signing in with your DER-mirrored credentials. This does not reach the central
          DHIS2 — authentication is local to this edge host.
        </p>
        {error ? (
          <NoticeBox error title="Sign-in failed" dataTest="signin-error">
            {error}
          </NoticeBox>
        ) : null}
        {alreadyIn ? (
          <NoticeBox title="Already signed in" dataTest="signin-already">
            You are already signed in as <strong>{state.user.username}</strong>.
          </NoticeBox>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <InputField
            label="Username"
            name="username"
            value={username}
            onChange={({ value }) => setUsername(value ?? '')}
            disabled={submitting || alreadyIn}
            dataTest="signin-username"
          />
          <InputField
            label="Password"
            type="password"
            name="password"
            value={password}
            onChange={({ value }) => setPassword(value ?? '')}
            disabled={submitting || alreadyIn}
            dataTest="signin-password"
          />
          <div className="der-signin-actions">
            <Button
              primary
              type="submit"
              loading={submitting}
              disabled={submitting || alreadyIn || username === '' || password === ''}
              dataTest="signin-submit"
            >
              Sign in
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
