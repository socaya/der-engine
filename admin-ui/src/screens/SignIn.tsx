import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';
import { ErrorBlock, EmptyBlock } from '../components/ScreenStates';

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
      <div className="ea-sign-in-card">
        <div className="ea-sign-in-pad">
          <div className="ea-sign-in-brand" aria-hidden="true">
            <span className="ea-sign-in-logo">DER</span>
          </div>
          <h1 className="ea-sign-in-title">Sign in to DER Administration</h1>
          <p className="ea-sign-in-sub">
            DHIS2 Edge Runtime — administration console.
          </p>

          {state.status === 'EDGE_DOWN' && (
            <div data-test="sign-in-edge-down">
              <ErrorBlock title="Edge unreachable" testId="sign-in-edge-down-inner">
                The DER server is currently unreachable. Start it with{' '}
                <code>java -jar der-server-*.jar</code> and refresh.
              </ErrorBlock>
            </div>
          )}
          {error && (
            <div data-test="sign-in-error">
              <ErrorBlock title="Sign-in failed" testId="sign-in-error-inner">
                {error}
              </ErrorBlock>
            </div>
          )}

          <div className="ea-sign-in-dev-hint" data-test="sign-in-dev-hint">
            <EmptyBlock title="Test credentials (dev build only)" testId="sign-in-dev-hint-inner">
              <div className="ea-sign-in-dev-hint-row">
                <span>Username</span>
                <code>der-admin</code>
                <button
                  type="button"
                  className="ea-sign-in-dev-fill"
                  onClick={() => {
                    setUsername('der-admin');
                    setPassword('OY2/uIass26KcwqwMIc+UjqlBDNDU4ER');
                  }}
                >
                  Autofill
                </button>
              </div>
              <div className="ea-sign-in-dev-hint-row">
                <span>Password</span>
                <code>OY2/uIass26KcwqwMIc+UjqlBDNDU4ER</code>
              </div>
              <p className="ea-sign-in-dev-hint-note">
                Rotate before any shared or production use. See{' '}
                <code>docs/evaluation/TEST_CREDENTIALS.md</code>.
              </p>
            </EmptyBlock>
          </div>
          <form onSubmit={onSubmit} data-test="sign-in-form">
            <div data-test="sign-in-username-field" className="ea-field">
              <label className="ea-field-label" htmlFor="sign-in-username">
                Username <span className="ea-field-required" aria-hidden="true">*</span>
              </label>
              <input
                id="sign-in-username"
                className="ea-input"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="der-admin"
                required
              />
            </div>
            <div className="ea-sign-in-spacer" />
            <div data-test="sign-in-password-field" className="ea-field">
              <label className="ea-field-label" htmlFor="sign-in-password">
                Password <span className="ea-field-required" aria-hidden="true">*</span>
              </label>
              <input
                id="sign-in-password"
                className="ea-input"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="ea-sign-in-spacer" />
            <div data-test="sign-in-submit">
              <button
                type="submit"
                className="ea-btn ea-btn--primary"
                disabled={submitting || !username || !password}
              >
                {submitting && <span className="ea-btn-spinner" aria-hidden="true" />}
                <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
              </button>
            </div>
          </form>
          <p className="ea-sign-in-footnote">
            DER&nbsp;{__DER_VERSION__}
          </p>
        </div>
      </div>
    </div>
  );
}
