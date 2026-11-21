import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EdgeApiError } from '../api/edgeApi';
import { ErrorBlock, EmptyBlock } from '../components/ScreenStates';
import { useSignInSettings } from './useSignInSettings';

const DEFAULT_TITLE = 'Sign in to DER Administration';
const DEFAULT_SUB = 'DHIS2 Edge Runtime — administration console.';
const DEFAULT_SUBMIT = 'Sign in';

/**
 * DER admin sign-in screen.
 *
 * Renders at `/sign-in` whenever RequireAuth redirects an
 * unauthenticated user there. After a successful sign-in, navigates
 * back to the originally requested route (location.state.from.pathname).
 *
 * Layout is a single card centred on the canvas: brand lockup →
 * title + subtitle → optional edge-down banner → username → password
 * (with reveal) → submit. The dev-only credentials autofill lives
 * below the form, visually subordinate to the primary task, and is
 * still gated by `EmptyBlock` so it looks like informational copy
 * rather than a prompt.
 */
export function SignIn(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, state } = useAuth();
  const settings = useSignInSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);

  const title = settings.appTitle?.trim() ? settings.appTitle : DEFAULT_TITLE;
  const sub = settings.appIntro?.trim() ? settings.appIntro : DEFAULT_SUB;
  const submitLabel = settings.submitLabel?.trim() ? settings.submitLabel : DEFAULT_SUBMIT;
  const footer = settings.footerHtml?.trim() ? settings.footerHtml : null;
  const bgStyle: CSSProperties | undefined = settings.hasBackground && settings.backgroundUrl
    ? {
        backgroundImage: `url("${settings.backgroundUrl}?v=${settings.backgroundEtag ?? ''}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

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
            'DER server is unreachable. Check that der-server is running on port 8085.',
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
    <div className="ea-sign-in" data-test="sign-in" style={bgStyle}>
      <div className="ea-sign-in-card">
        <div className="ea-sign-in-pad">
          <div className="ea-sign-in-brand" aria-hidden="true">
            <img
              className="ea-sign-in-logo-img"
              src="/admin/assets/der-logo.svg"
              alt="DER — DHIS2 Edge Runtime"
              onError={(e) => {
                /* Fall back to the single-colour icon-only mark if
                 * the full brand lockup fails to load (e.g. when
                 * served from a stripped-down dev shell). */
                const img = e.currentTarget as HTMLImageElement;
                if (!img.dataset.fellback) {
                  img.dataset.fellback = 'true';
                  img.src = '/brand/der-icon-navy.svg';
                } else {
                  img.style.display = 'none';
                }
              }}
            />
          </div>
          <div className="ea-sign-in-wordmark" aria-hidden="true">
            DHIS2&nbsp;Edge&nbsp;Runtime
          </div>
          <h1 className="ea-sign-in-title" data-test="sign-in-title">{title}</h1>
          <p className="ea-sign-in-sub" data-test="sign-in-sub">{sub}</p>

          {state.status === 'EDGE_DOWN' && (
            <div data-test="sign-in-edge-down" className="ea-sign-in-banner">
              <ErrorBlock title="DER server unreachable" testId="sign-in-edge-down-inner">
                The DER server is currently unreachable. Start it with{' '}
                <code>java -jar der-server-*.jar</code> and refresh.
              </ErrorBlock>
            </div>
          )}
          {error && (
            <div data-test="sign-in-error" className="ea-sign-in-banner">
              <ErrorBlock title="Sign-in failed" testId="sign-in-error-inner">
                {error}
              </ErrorBlock>
            </div>
          )}

          <form onSubmit={onSubmit} data-test="sign-in-form" className="ea-sign-in-form">
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
                autoFocus
                required
              />
            </div>
            <div className="ea-sign-in-spacer" />
            <div data-test="sign-in-password-field" className="ea-field">
              <label className="ea-field-label" htmlFor="sign-in-password">
                Password <span className="ea-field-required" aria-hidden="true">*</span>
              </label>
              <div className="ea-sign-in-pw-wrap">
                <input
                  id="sign-in-password"
                  className="ea-input ea-sign-in-pw-input"
                  name="password"
                  type={revealPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="ea-sign-in-pw-toggle"
                  onClick={() => setRevealPassword((v) => !v)}
                  aria-pressed={revealPassword}
                  aria-label={revealPassword ? 'Hide password' : 'Show password'}
                  title={revealPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {revealPassword ? (
                    // eye-slash — hide
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.7 6.2A10.6 10.6 0 0112 6c5 0 9 4 10 6-0.5 1-1.6 2.6-3.3 4" />
                      <path d="M6.3 7.6C3.5 9.4 2 11.4 2 12c1 2 5 6 10 6 1.7 0 3.3-.5 4.6-1.2" />
                      <path d="M10 10a3 3 0 004 4" />
                    </svg>
                  ) : (
                    // eye — show
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M2 12c1-2 5-6 10-6s9 4 10 6c-1 2-5 6-10 6s-9-4-10-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="ea-sign-in-spacer" />
            <div data-test="sign-in-submit">
              <button
                type="submit"
                className="ea-btn ea-btn--primary ea-sign-in-submit-btn"
                disabled={submitting || !username || !password}
                data-test="sign-in-submit-btn"
              >
                {submitting && <span className="ea-btn-spinner" aria-hidden="true" />}
                <span>{submitting ? 'Signing in…' : submitLabel}</span>
              </button>
            </div>
          </form>

          <div className="ea-sign-in-dev-hint" data-test="sign-in-dev-hint">
            <EmptyBlock
              title="Development build — test credentials"
              testId="sign-in-dev-hint-inner"
            >
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

          {footer ? (
            <div
              className="ea-sign-in-footnote"
              data-test="sign-in-footer"
              /* Admin-written settings output — not user input. Same
               * treatment as the device client's SignInFormCard footer. */
              dangerouslySetInnerHTML={{ __html: footer }}
            />
          ) : (
            <p className="ea-sign-in-footnote">
              DER&nbsp;{__DER_VERSION__}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
