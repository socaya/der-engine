import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export interface UserMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * ADR-0037 C-UI-2 — user menu dropdown anchored to the topbar
 * user tile. Items: Session details, Recent work, Sign out.
 *
 * Dismisses on Esc + outside click. Focus moves to the first
 * item on open for keyboard operators.
 */
export function UserMenu({ open, onClose }: UserMenuProps): JSX.Element | null {
  const { state, signOut } = useAuth();
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
    // mousedown so Topbar's own toggle-click doesn't race the close.
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const user = state.status === 'AUTHENTICATED' ? state.user : null;
  if (!user) return null;

  async function doSignOut(): Promise<void> {
    // Swallow sign-out failures — the server-side session cookie
    // is still valid, but from the operator's seat they explicitly
    // asked to leave. Route to /sign-in anyway so the UI matches
    // their intent; the next api call will surface any real auth
    // state.
    try { await signOut(); } catch { /* reported server-side */ }
    onClose();
    navigate('/sign-in');
  }

  return (
    <div className="der-user-menu"
         role="menu"
         aria-label="User menu"
         data-test="der-user-menu"
         ref={menuRef}>
      <div className="der-user-menu__header">
        <div className="der-user-menu__name" data-test="der-user-menu-name">
          {user.displayName}
        </div>
        <div className="der-user-menu__role" data-test="der-user-menu-role">
          {user.roles.join(' · ')}
        </div>
      </div>
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
