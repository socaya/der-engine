import { useEffect } from 'react';
import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';
import { resolveSignInBackgroundImage } from './resolve';

/**
 * Marketing layout — full-page background image on the left,
 * floating form card anchored right. Same image source as the
 * hero + sidebar layouts.
 */
export function SignInLayoutMarketing(): JSX.Element {
  const { state, onSubmit } = useSignInController();

  useEffect(() => {
    const img = resolveSignInBackgroundImage();
    if (img) {
      document.documentElement.style.setProperty(
        '--der-signin-bg-image', `url("${img}")`,
      );
    }
    return () => {
      document.documentElement.style.removeProperty('--der-signin-bg-image');
    };
  }, []);

  return (
    <div className="der-signin der-signin--marketing"
         data-test="der-signin">
      <div className="der-signin__marketing-panel">
        <SignInHeading />
      </div>
      <section className="der-signin__floating-card">
        <SignInFormCard state={state} onSubmit={onSubmit} />
      </section>
    </div>
  );
}
