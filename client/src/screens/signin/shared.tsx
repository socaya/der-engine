import { type FormEvent } from 'react';
import { Button, InputField, NoticeBox } from '@dhis2/ui';
import type { SignInState } from './useSignInController';

export interface SignInHeadingProps {
  readonly tone?: 'light' | 'dark';
}

/**
 * Brand mark + app title + intro. Used by every signin layout.
 * The `tone` prop flips text colour for dark vs light surfaces —
 * standard/sidebar/marketing use `light` (the mark sits on blue);
 * hero uses `dark` (mark + title sit on a white card).
 */
export function SignInHeading(
  { tone = 'light' }: SignInHeadingProps = {},
): JSX.Element {
  const toneClass = tone === 'dark' ? 'der-signin-heading--dark' : '';
  return (
    <div className={`der-signin-heading ${toneClass}`.trim()}
         data-test="der-signin-heading">
      <div className="der-signin-heading__titles">
        <h1 className="der-signin-heading__app-title"
             data-test="signin-app-title">
          DHIS2 Edge Runtime
        </h1>
        <p className="der-signin-heading__app-intro">
          Offline-first capture bound to a single organisation unit.
          Authentication is local to this edge host — no reach-through
          to the central DHIS2.
        </p>
      </div>
      <div className="der-signin-heading__brand-mark" aria-hidden="true">DER</div>
    </div>
  );
}

export interface SignInFormCardProps {
  readonly state: SignInState;
  readonly onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /**
   * `card` wraps the form in the bordered `.der-signin__card` box
   * (used by centered-card layouts); `plain` renders inputs flush
   * with the surrounding panel — the DHIS2 default look where the
   * sidebar is itself the container and the form is unboxed.
   */
  readonly variant?: 'card' | 'plain';
}

export function SignInFormCard(
  { state, onSubmit, variant = 'card' }: SignInFormCardProps,
): JSX.Element {
  const {
    username, setUsername,
    password, setPassword,
    submitting, error, alreadyIn, alreadyInUsername,
  } = state;
  const cls = variant === 'plain' ? 'der-signin__form' : 'der-signin__card';
  return (
    <section className={cls} data-test="der-signin-card">
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
          You are already signed in as <strong>{alreadyInUsername}</strong>.
        </NoticeBox>
      )}
      <form onSubmit={onSubmit}>
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
    </section>
  );
}
