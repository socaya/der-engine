import { SignInFormCard, SignInHeading } from './shared';
import { useSignInController } from './useSignInController';

/**
 * Standard layout — the DHIS2 2.44 default. Blue body background
 * (`--der-signin-bg`), heading strip on top (brand mark + app
 * title + intro, light text), centered white card below.
 */
export function SignInLayoutStandard(): JSX.Element {
  const { state, onSubmit } = useSignInController();
  return (
    <div className="der-signin der-signin--standard"
         data-test="der-signin">
      <header className="der-signin__heading-wrap">
        <SignInHeading />
      </header>
      <section className="der-signin__body">
        <SignInFormCard state={state} onSubmit={onSubmit} />
      </section>
    </div>
  );
}
