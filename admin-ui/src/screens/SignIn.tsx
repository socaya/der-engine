import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';

/**
 * Admin UI login screen. Renders at `/sign-in` when RequireAuth
 * redirects an unauthenticated user. On success, navigates back
 * to the originating route (location.state.from.pathname).
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
          setError('Edge server is unreachable. Check der-server is running.');
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Invalid username or password.');
        } else if (err.code === 'RATE_LIMITED') {
          setError('Too many sign-in attempts. Try again shortly.');
        } else {
          setError(err.message ?? 'Sign-in failed.');
        }
      } else {
        setError('Sign-in failed. See console for details.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (state.status === 'AUTHENTICATED') {
      navigate(from, { replace: true });
    }
  }, [state.status, from, navigate]);

  return (
    <section
      aria-labelledby="sign-in-heading"
      className="ea-sign-in"
      data-test="sign-in"
    >
      <h1 id="sign-in-heading">Sign in to DER Administration</h1>
      {state.status === 'EDGE_DOWN' && (
        <p role="alert" data-test="sign-in-edge-down">
          Edge server is currently unreachable.
        </p>
      )}
      <form onSubmit={onSubmit}>
        <label htmlFor="sign-in-username">Username</label>
        <input
          id="sign-in-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          data-test="sign-in-username"
        />
        <label htmlFor="sign-in-password">Password</label>
        <input
          id="sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-test="sign-in-password"
        />
        <button
          type="submit"
          disabled={submitting || !username || !password}
          data-test="sign-in-submit"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        {error && (
          <p role="alert" data-test="sign-in-error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
