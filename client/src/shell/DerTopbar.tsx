import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';
import { UserMenu } from './UserMenu';

export interface DerTopbarProps {
  readonly onLauncherClick?: () => void;
  readonly userMenuOpen?: boolean;
  readonly onUserMenuToggle?: () => void;
  readonly onUserMenuClose?: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * ADR-0037 topbar — DHIS2 HeaderBar-alike.
 *
 *   - Brand lockup uses the DER negative-white icon SVG, not a
 *     text monogram (matches the DHIS2 HeaderBar logo slot).
 *   - Bound-OU chip is plain inline text (no background tint).
 *   - User surface is a circular 32 px avatar showing the
 *     operator's initials (A&A → "AA"). Full name, role and
 *     bound OU live inside the dropdown, mirroring DHIS2's own
 *     profile menu.
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
        <img className="der-topbar__brand-logo"
             src="/brand/der-icon-white.svg"
             alt=""
             aria-hidden="true" />
        <span className="der-topbar__brand-text">DHIS2 Edge Runtime</span>
      </Link>

      {bound ? (
        <span className="der-topbar__orgunit" data-test="der-topbar-orgunit">
          {bound.orgUnitDisplayName ?? bound.orgUnitId}
        </span>
      ) : (
        <span className="der-topbar__orgunit der-topbar__orgunit--unbound"
               data-test="der-topbar-unbound">
          Not bound to an organisation unit
        </span>
      )}

      <span className="der-topbar__spacer" />

      <button type="button"
              className="der-topbar__btn der-topbar__btn--icon"
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
                  className="der-topbar__avatar"
                  data-test="der-topbar-user"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={`Open profile menu for ${user.displayName}`}
                  onClick={onUserMenuToggle}>
            <span aria-hidden="true">{initials(user.displayName)}</span>
          </button>
          <UserMenu open={userMenuOpen}
                    onClose={onUserMenuClose ?? (() => undefined)} />
        </span>
      )}
    </header>
  );
}
