import { SignInLayoutHero } from './signin/LayoutHero';
import { SignInLayoutMarketing } from './signin/LayoutMarketing';
import { SignInLayoutSidebar } from './signin/LayoutSidebar';
import { SignInLayoutStandard } from './signin/LayoutStandard';
import { resolveSignInLayout } from './signin/resolve';

/**
 * DC-01 Sign in (ADR-0037 C-UI-3 / C-UI-3b / C-UI-3c).
 *
 * Picks one of four layouts: standard / sidebar / hero / marketing.
 * Default is `sidebar` — the DHIS2 2.44 look with a narrow white
 * form panel on the left and a full-bleed background image on the
 * right. Override precedence: `localStorage['der.signin.layout']`
 * (device) → `<meta name="der-signin-layout">` (server deploy) →
 * `VITE_DER_SIGNIN_LAYOUT` (build) → `sidebar` fallback.
 */
export function SignIn(): JSX.Element {
  switch (resolveSignInLayout()) {
    case 'standard':  return <SignInLayoutStandard />;
    case 'hero':      return <SignInLayoutHero />;
    case 'marketing': return <SignInLayoutMarketing />;
    case 'sidebar':
    default:          return <SignInLayoutSidebar />;
  }
}
