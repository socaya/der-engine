import { useEffect } from 'react';
import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';
import { resolveSignInBackgroundImage } from './resolve';
import { useSignInSettings } from './useSignInSettings';

export function SignInLayoutSidebar(): JSX.Element {
  const { state, onSubmit } = useSignInController();
  const settings = useSignInSettings();

  useEffect(() => {
    const img = resolveSignInBackgroundImage(settings);
    if (img) {
      document.documentElement.style.setProperty(
        '--der-signin-bg-image', `url("${img}")`,
      );
    }
    return () => {
      document.documentElement.style.removeProperty('--der-signin-bg-image');
    };
  }, [settings]);

  return (
    <div className="der-signin der-signin--sidebar"
         data-test="der-signin">
      <aside className="der-signin__panel">
        <div className="der-signin__panel-inner">
          <SignInHeading
            tone="dark"
            appTitle={settings.appTitle}
            appIntro={settings.appIntro}
          />
          <SignInFormCard
            state={state}
            onSubmit={onSubmit}
            variant="plain"
            submitLabel={settings.submitLabel}
            footerHtml={settings.footerHtml}
          />
        </div>
      </aside>
      <div className="der-signin__scenery" aria-hidden="true" />
    </div>
  );
}
