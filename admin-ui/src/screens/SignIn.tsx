import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  InputField,
  NoticeBox,
} from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';

/**
 * @dhis2/ui-styled sign-in. Renders at `/sign-in` when RequireAuth
 * sends an unauthenticated user there. Navigates back to the
 * originating route on success (location.state.from.pathname).
 *
 * Design language mirrors DHIS2 2.44 Core apps so operators moving
 * between DHIS2 Capture/Maintenance and DER admin feel at home.
 */
export function SignIn(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, state } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/';

  useEffect(() => {
    if (state.status === 'AUTHENTICATED') {
      navigate(from, { replace: true });
    }
  }, [state.status, from, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof EdgeApiError) {
        if (err.code === 'EDGE_UNREACHABLE') {
          setError(
            'Edge server is unreachable. Check that der-server is running on port 8085.',
          );
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Invalid username or password.');
        } else if (err.code === 'RATE_LIMITED') {
          setError('Too many sign-in attempts. Try again shortly.');
        } else {
          setError(err.message || 'Sign-in failed.');
        }
      } else {
        setError('Sign-in failed. See browser console for details.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ea-sign-in" data-test="sign-in">
      <Card>
        <div className="ea-sign-in-pad">
          <div className="ea-sign-in-brand" aria-hidden="true">
            <span className="ea-sign-in-logo">DER</span>
          </div>
          <h1 className="ea-sign-in-title">Sign in to DER Administration</h1>
          <p className="ea-sign-in-sub">
            DHIS2 Edge Runtime — administration console.
          </p>

          {state.status === 'EDGE_DOWN' && (
            <div className="ea-sign-in-alert" data-test="sign-in-edge-down">
              <NoticeBox warning title="Edge unreachable">
                The DER server is currently unreachable. Start it with{' '}
                <code>java -jar der-server-*.jar</code> and refresh.
              </NoticeBox>
            </div>
          )}
          {error && (
            <div className="ea-sign-in-alert" data-test="sign-in-error">
              <NoticeBox error title="Sign-in failed">
                {error}
              </NoticeBox>
            </div>
          )}

          <form onSubmit={onSubmit} data-test="sign-in-form">
            <div data-test="sign-in-username-field">
              <InputField
                label="Username"
                name="username"
                value={username}
                onChange={({ value }) => setUsername(value ?? '')}
                autoComplete="username"
                placeholder="der-admin"
                required
                dense
              />
            </div>
            <div className="ea-sign-in-spacer" />
            <div data-test="sign-in-password-field">
              <InputField
                label="Password"
                name="password"
                type="password"
                value={password}
                onChange={({ value }) => setPassword(value ?? '')}
                autoComplete="current-password"
                required
                dense
              />
            </div>
            <div className="ea-sign-in-spacer" />
            <div data-test="sign-in-submit">
              <Button
                primary
                type="submit"
                loading={submitting}
                disabled={!username || !password}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </div>
          </form>
          <p className="ea-sign-in-footnote">
            DER&nbsp;{__DER_VERSION__}
          </p>
        </div>
      </Card>
    </div>
  );
}
