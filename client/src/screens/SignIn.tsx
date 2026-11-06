import { SignInLayoutHero } from './signin/LayoutHero';
import { SignInLayoutMarketing } from './signin/LayoutMarketing';
import { SignInLayoutSidebar } from './signin/LayoutSidebar';
import { SignInLayoutStandard } from './signin/LayoutStandard';
import { resolveSignInLayout } from './signin/resolve';
import { useSignInSettings } from './signin/useSignInSettings';

/**
 * DC-01 Sign in (ADR-0037 C-UI-3 / 3b / 3c / 3d).
 *
 * Picks one of four layouts. Precedence (highest first):
 * device `localStorage['der.signin.layout']` → server admin
 * setting → `<meta name="der-signin-layout">` → `VITE_DER_SIGNIN_LAYOUT`
 * → `sidebar` fallback. Each layout then fetches the same server
 * settings for title / intro / submit label / background image.
 */
export function SignIn(): JSX.Element {
  const settings = useSignInSettings();
  switch (resolveSignInLayout(settings)) {
    case 'standard':  return <SignInLayoutStandard />;
    case 'hero':      return <SignInLayoutHero />;
    case 'marketing': return <SignInLayoutMarketing />;
    case 'sidebar':
    default:          return <SignInLayoutSidebar />;
  }
}
