import { type FormEvent } from 'react';
import { Button, InputField, NoticeBox } from '@dhis2/ui';
import type { SignInState } from './useSignInController';

export interface SignInHeadingProps {
  readonly tone?: 'light' | 'dark';
  readonly appTitle?: string | null;
  readonly appIntro?: string | null;
}

const DEFAULT_TITLE = 'DHIS2 Edge Runtime';
const DEFAULT_INTRO =
  'Offline-first capture bound to a single organisation unit. '
  + 'Authentication is local to this edge host — no reach-through '
  + 'to the central DHIS2.';

export function SignInHeading(
  { tone = 'light', appTitle, appIntro }: SignInHeadingProps = {},
): JSX.Element {
  const toneClass = tone === 'dark' ? 'der-signin-heading--dark' : '';
  return (
    <div className={`der-signin-heading ${toneClass}`.trim()}
         data-test="der-signin-heading">
      <img
        className="der-signin-heading__brand-mark"
        src={tone === 'dark' ? '/brand/der-icon-navy.svg' : '/brand/der-icon-white.svg'}
        alt="DER"
      />
      <div className="der-signin-heading__titles">
        <h1 className="der-signin-heading__app-title"
             data-test="signin-app-title">
          {appTitle && appTitle.trim() !== '' ? appTitle : DEFAULT_TITLE}
        </h1>
        <p className="der-signin-heading__app-intro">
          {appIntro && appIntro.trim() !== '' ? appIntro : DEFAULT_INTRO}
        </p>
      </div>
    </div>
  );
}

export interface SignInFormCardProps {
  readonly state: SignInState;
  readonly onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  readonly variant?: 'card' | 'plain';
  readonly submitLabel?: string | null;
  readonly footerHtml?: string | null;
}

export function SignInFormCard(
  { state, onSubmit, variant = 'card', submitLabel, footerHtml }: SignInFormCardProps,
): JSX.Element {
  const {
    username, setUsername,
    password, setPassword,
    submitting, error, alreadyIn, alreadyInUsername,
  } = state;
  const cls = variant === 'plain' ? 'der-signin__form' : 'der-signin__card';
  const label = submitLabel && submitLabel.trim() !== '' ? submitLabel : 'Sign in';
  const showInnerTitle = variant === 'card';
  return (
    <section className={cls} data-test="der-signin-card">
      {showInnerTitle && <h1 data-test="signin-heading">Sign in</h1>}

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
        <div className="der-signin-actions">
          <Button
            primary
            type="submit"
            loading={submitting}
            disabled={submitting || alreadyIn || username === '' || password === ''}
            dataTest="signin-submit"
          >
            {label}
          </Button>
        </div>
      </form>
      {footerHtml && footerHtml.trim() !== '' ? (
        <div
          className="der-signin__footer"
          data-test="signin-footer"
          /* Admin-controlled rich text — rendered as HTML so links work.
           * The admin screen is ADMIN-only; this is settings output, not
           * user input, matching the DHIS2 login's own footer semantics. */
          dangerouslySetInnerHTML={{ __html: footerHtml }}
        />
      ) : (
        <p className="der-signin__footer">
          Trouble signing in? An admin can approve your device on the DER
          admin UI.
        </p>
      )}
    </section>
  );
}
