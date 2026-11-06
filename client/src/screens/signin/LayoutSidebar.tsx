import { useEffect } from 'react';
import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';
import { resolveSignInBackgroundImage } from './resolve';

/**
 * Sidebar layout — the DER default, modelled on DHIS2 2.44's
 * `sidebar` login template:
 *
 *   • Narrow ~420 px white panel on the left holds the brand mark,
 *     app title, intro and the sign-in form. The form is unboxed
 *     (variant='plain') — the panel itself is the container.
 *   • Large right-hand panel renders a background image if one is
 *     configured (via localStorage, meta tag or env), falling back
 *     to the DHIS2 blue gradient.
 *   • On <420 px the right panel collapses out and the sidebar
 *     takes the full width.
 */
export function SignInLayoutSidebar(): JSX.Element {
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
    <div className="der-signin der-signin--sidebar"
         data-test="der-signin">
      <aside className="der-signin__panel">
        <div className="der-signin__panel-inner">
          <SignInHeading tone="dark" />
          <SignInFormCard state={state} onSubmit={onSubmit} variant="plain" />
        </div>
      </aside>
      <div className="der-signin__scenery" aria-hidden="true" />
    </div>
  );
}
