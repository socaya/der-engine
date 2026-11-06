import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';

export interface UserMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Profile dropdown — modelled on DHIS2's HeaderBar profile menu.
 *
 * Structure:
 *   • Header card — large avatar + display name + role chip +
 *     bound-OU line.
 *   • Account group — Session details, Recent work, Account
 *     preferences, Change password.
 *   • Help group — Help & documentation, About DER.
 *   • Sign out — separated by a rule, danger tone.
 *
 * Esc + outside-mousedown close. Focus lands on the first
 * actionable item on open.
 */
export function UserMenu({ open, onClose }: UserMenuProps): JSX.Element | null {
  const { state, signOut } = useAuth();
  const binding = useOrgUnitBinding();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const user = state.status === 'AUTHENTICATED' ? state.user : null;
  if (!user) return null;
  const bound = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding : null;

  async function doSignOut(): Promise<void> {
    try { await signOut(); } catch { /* reported server-side */ }
    onClose();
    navigate('/sign-in');
  }

  return (
    <div className="der-user-menu"
         role="menu"
         aria-label="Profile menu"
         data-test="der-user-menu"
         ref={menuRef}>
      <div className="der-user-menu__header">
        <div className="der-user-menu__avatar" aria-hidden="true">
          {initials(user.displayName)}
        </div>
        <div className="der-user-menu__identity">
          <div className="der-user-menu__name" data-test="der-user-menu-name">
            {user.displayName}
          </div>
          <div className="der-user-menu__role" data-test="der-user-menu-role">
            {user.roles.join(' · ') || 'OPERATOR'}
          </div>
          {bound && (
            <div className="der-user-menu__ou"
                 data-test="der-user-menu-ou">
              {bound.orgUnitDisplayName ?? bound.orgUnitId}
            </div>
          )}
        </div>
      </div>

      <nav className="der-user-menu__group" aria-label="Account">
        <Link to="/session"
              className="der-user-menu__item"
              role="menuitem"
              data-test="der-user-menu-session"
              ref={firstItemRef}
              onClick={onClose}>
          Session details
        </Link>
        <Link to="/recent"
              className="der-user-menu__item"
              role="menuitem"
              data-test="der-user-menu-recent"
              onClick={onClose}>
          Recent work
        </Link>
        <Link to="/session/preferences"
              className="der-user-menu__item"
              role="menuitem"
              data-test="der-user-menu-preferences"
              onClick={onClose}>
          Account preferences
        </Link>
        <Link to="/session/password"
              className="der-user-menu__item"
              role="menuitem"
              data-test="der-user-menu-password"
              onClick={onClose}>
          Change password
        </Link>
      </nav>

      <div className="der-user-menu__divider" role="separator" />

      <nav className="der-user-menu__group" aria-label="Help">
        <Link to="/help"
              className="der-user-menu__item"
              role="menuitem"
              data-test="der-user-menu-help"
              onClick={onClose}>
          Help &amp; documentation
        </Link>
        <Link to="/help/about"
              className="der-user-menu__item"
              role="menuitem"
              data-test="der-user-menu-about"
              onClick={onClose}>
          About DER
        </Link>
      </nav>

      <div className="der-user-menu__divider" role="separator" />

      <button type="button"
              className="der-user-menu__item der-user-menu__item--danger"
              role="menuitem"
              data-test="der-user-menu-signout"
              onClick={() => { void doSignOut(); }}>
        Sign out
      </button>
    </div>
  );
}
