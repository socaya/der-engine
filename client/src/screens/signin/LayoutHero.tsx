import { useEffect } from 'react';
import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';
import { resolveSignInBackgroundImage } from './resolve';

/**
 * Hero layout — a full-bleed background image with a centered
 * card on top. Heading text stays light-tone so it reads on the
 * image. Falls back to a blue gradient when no image is set.
 */
export function SignInLayoutHero(): JSX.Element {
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
    <div className="der-signin der-signin--hero"
         data-test="der-signin">
      <div className="der-signin__hero-overlay">
        <header className="der-signin__heading-wrap">
          <SignInHeading />
        </header>
        <section className="der-signin__body">
          <SignInFormCard state={state} onSubmit={onSubmit} />
        </section>
      </div>
    </div>
  );
}
