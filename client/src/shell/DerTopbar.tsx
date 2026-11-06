import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';
import { UserMenu } from './UserMenu';

export interface DerTopbarProps {
  /** C-UI-2 wires this to toggle the app-launcher overlay. */
  readonly onLauncherClick?: () => void;
  /** C-UI-2 wires this to toggle the user menu dropdown. */
  readonly userMenuOpen?: boolean;
  readonly onUserMenuToggle?: () => void;
  readonly onUserMenuClose?: () => void;
}

/**
 * ADR-0037 C-UI-1 topbar. DHIS2-alike chrome: dark navy bar,
 * brand lockup, bound-OU badge, spacer, app-launcher button, user
 * tile. No notifications bell — status surfaces live in the
 * Server-Module screens.
 *
 * The app-launcher button is wired to a no-op in C-UI-1. The
 * overlay it opens lands in C-UI-2.
 */
export function DerTopbar(
  {
    onLauncherClick,
    userMenuOpen = false,
    onUserMenuToggle,
    onUserMenuClose,
  }: DerTopbarProps = {},
): JSX.Element {
  const { state } = useAuth();
  const binding = useOrgUnitBinding();
  const user = state.status === 'AUTHENTICATED' ? state.user : null;
  const bound = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding
    : null;

  return (
    <header className="der-topbar" data-test="der-topbar">
      <Link to="/" className="der-topbar__brand" data-test="der-topbar-brand">
        <span className="der-topbar__brand-mark" aria-hidden="true">DER</span>
        <span>Edge Runtime</span>
      </Link>

      {bound ? (
        <span className="der-topbar__orgunit" data-test="der-topbar-orgunit">
          <strong>{bound.orgUnitDisplayName ?? bound.orgUnitId}</strong>
          <code>{bound.orgUnitId}</code>
        </span>
      ) : (
        <span className="der-topbar__orgunit der-topbar__orgunit--unbound"
               data-test="der-topbar-unbound">
          Not bound to an organisation unit
        </span>
      )}

      <span className="der-topbar__spacer" />

      <button type="button"
              className="der-topbar__btn"
              data-test="der-topbar-launcher"
              aria-label="Open app launcher"
              onClick={onLauncherClick}>
        <svg className="der-topbar__icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3"  y="3"  width="6" height="6" rx="1" />
          <rect x="15" y="3"  width="6" height="6" rx="1" />
          <rect x="3"  y="15" width="6" height="6" rx="1" />
          <rect x="15" y="15" width="6" height="6" rx="1" />
        </svg>
      </button>

      {user && (
        <span className="der-user-wrap">
          <button type="button"
                  className="der-topbar__btn der-topbar__user"
                  data-test="der-topbar-user"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={onUserMenuToggle}>
            {user.displayName}
          </button>
          <UserMenu open={userMenuOpen}
                    onClose={onUserMenuClose ?? (() => undefined)} />
        </span>
      )}
    </header>
  );
}
