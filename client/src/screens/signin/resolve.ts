export type SignInLayoutKind =
  | 'standard' | 'sidebar' | 'hero' | 'marketing';

const LAYOUT_STORAGE_KEY = 'der.signin.layout';
const BG_STORAGE_KEY = 'der.signin.backgroundImage';

/**
 * Resolve the active signin layout. Precedence (highest first):
 *
 *   1. Device-level override — `localStorage['der.signin.layout']`.
 *      Lets an operator pin a layout for one device.
 *   2. Server-level deploy config — `<meta name="der-signin-layout"
 *      content="…">` injected into index.html by the DER server at
 *      serve time (one global policy for every device).
 *   3. Build-time env — `VITE_DER_SIGNIN_LAYOUT`.
 *   4. Fallback — `sidebar`, matching the DHIS2 default look.
 *
 * Unknown values are ignored so a typo can't white-screen the
 * sign-in page.
 */
export function resolveSignInLayout(): SignInLayoutKind {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored && isLayout(stored)) return stored;
    } catch { /* storage disabled — fall through */ }
  }
  if (typeof document !== 'undefined') {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="der-signin-layout"]');
    const picked = meta?.content;
    if (picked && isLayout(picked)) return picked;
  }
  const envVal = import.meta.env.VITE_DER_SIGNIN_LAYOUT as
                  string | undefined;
  if (envVal && isLayout(envVal)) return envVal;
  return 'sidebar';
}

/**
 * Resolve the background-image URL used by the sidebar / hero /
 * marketing layouts. Same precedence as the layout; returns
 * `null` when nothing is configured so the layout's CSS falls
 * back to a gradient. An explicit empty string overrides to
 * "no image" — useful for disabling a server-set image on a
 * single device.
 */
export function resolveSignInBackgroundImage(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(BG_STORAGE_KEY);
      if (stored !== null) return stored;
    } catch { /* storage disabled — fall through */ }
  }
  if (typeof document !== 'undefined') {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="der-signin-background"]');
    const picked = meta?.content;
    if (picked) return picked;
  }
  const envVal = import.meta.env.VITE_DER_SIGNIN_BACKGROUND as
                  string | undefined;
  if (envVal) return envVal;
  return null;
}

function isLayout(v: string): v is SignInLayoutKind {
  return v === 'standard' || v === 'sidebar'
      || v === 'hero' || v === 'marketing';
}
