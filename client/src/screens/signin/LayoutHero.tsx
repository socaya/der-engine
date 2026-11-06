import { useEffect } from 'react';
import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';
import { resolveSignInBackgroundImage } from './resolve';
import { useSignInSettings } from './useSignInSettings';

export function SignInLayoutHero(): JSX.Element {
  const { state, onSubmit } = useSignInController();
  const s = useSignInSettings();

  useEffect(() => {
    const img = resolveSignInBackgroundImage(s);
    if (img) {
      document.documentElement.style.setProperty(
        '--der-signin-bg-image', `url("${img}")`,
      );
    }
    return () => {
      document.documentElement.style.removeProperty('--der-signin-bg-image');
    };
  }, [s]);

  return (
    <div className="der-signin der-signin--hero"
         data-test="der-signin">
      <div className="der-signin__hero-overlay">
        <header className="der-signin__heading-wrap">
          <SignInHeading appTitle={s.appTitle} appIntro={s.appIntro} />
        </header>
        <section className="der-signin__body">
          <SignInFormCard
            state={state}
            onSubmit={onSubmit}
            submitLabel={s.submitLabel}
            footerHtml={s.footerHtml}
          />
        </section>
      </div>
    </div>
  );
}
