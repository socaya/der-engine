import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, InputField, NoticeBox } from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';

/**
 * DC-01 Sign in (ADR-0037 C-UI-3 redesign).
 *
 * Matches the DHIS2 2.44 "standard" login template visually: blue
 * body background, Roboto, a heading strip with the DER monogram +
 * app title + intro, and a centered white sign-in card. Shell
 * chrome is NOT rendered for this route (RequireAuth never wraps
 * /sign-in).  Flat per project rule — 1 px border, no shadow.
 *
 * Posts to /edge-api/v1/auth/sign-in via AuthContext. On success,
 * navigates to the "from" location set by RequireAuth, or "/".
 * Error messages are explicit per FR-04-06 (invalid credentials
 * vs rate-limited vs edge-down).
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
      const to = (location.state as { from?: { pathname: string } } | null)
                 ?.from?.pathname ?? '/';
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
    <div className="der-signin" data-test="der-signin">
      <header className="der-signin__heading">
        <div className="der-signin__titles">
          <h1 className="der-signin__app-title" data-test="signin-app-title">
            DHIS2 Edge Runtime
          </h1>
          <p className="der-signin__app-intro">
            Offline-first capture bound to a single organisation unit.
            Authentication is local to this edge host — no reach-through
            to the central DHIS2.
          </p>
        </div>
        <div className="der-signin__brand-mark" aria-hidden="true">DER</div>
      </header>
      <section className="der-signin__body">
        <div className="der-signin__card" data-test="der-signin-card">
          <h1 data-test="signin-heading">Sign in</h1>
          <p className="der-signin__sub">
            Use your DER-mirrored credentials to continue.
          </p>

          {error && (
            <NoticeBox error title="Sign-in failed" dataTest="signin-error">
              {error}
            </NoticeBox>
          )}
          {alreadyIn && (
            <NoticeBox title="Already signed in" dataTest="signin-already">
              You are already signed in as <strong>{state.user.username}</strong>.
            </NoticeBox>
          )}
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
            <div className="der-signin-actions" style={{ marginTop: 16 }}>
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
          <p className="der-signin__footer">
            Trouble signing in? An admin can approve your device on the DER
            admin UI.
          </p>
        </div>
      </section>
    </div>
  );
}
