import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';
import { useSignInSettings } from './useSignInSettings';

export function SignInLayoutStandard(): JSX.Element {
  const { state, onSubmit } = useSignInController();
  const s = useSignInSettings();
  return (
    <div className="der-signin der-signin--standard"
         data-test="der-signin">
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
  );
}
