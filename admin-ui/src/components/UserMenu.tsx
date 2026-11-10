import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * UI-11 — modern user chip with context menu.
 *
 * <p>Replaces the inline "user chip + Sign out" pair on the
 * admin topbar. Clicking the avatar opens a popover with
 * display name, roles, profile link, and the sign-out action
 * — matches the pattern DER operators already know from the
 * client app.</p>
 */
export function UserMenu(): JSX.Element | null {
  const { state, signOut } = useAuth();
  const [open, setOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    try { await signOut(); }
    catch { /* no-op */ }
    finally { setOpen(false); }
  }, [signOut]);

  if (state.status !== 'AUTHENTICATED') return null;
  const user = state.user;
  const name = user.displayName ?? user.username;
  const roles = (user.roles ?? []).join(' · ');

  return (
    <div className="ea-user-menu"
         ref={rootRef}
         data-test="user-menu"
         style={{ position: 'relative' }}>
      <button type="button"
              className="ea-user-menu__trigger"
              data-test="user-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              title={name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: 4,
                background: 'transparent',
                border: 0,
                borderRadius: 999,
                cursor: 'pointer',
              }}>
        <span className="ea-user-avatar"
              aria-hidden="true"
              style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: 'var(--der-primary, #2563eb)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
          {initials(name)}
        </span>
        <svg viewBox="0 0 24 24" width={12} height={12}
             fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true"
             style={{ color: 'var(--der-text-muted, #6b7280)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="menu"
             className="ea-user-menu__pop"
             data-test="user-menu-pop"
             style={{
               position: 'absolute',
               right: 0,
               top: 'calc(100% + 6px)',
               minWidth: 240,
               background: 'var(--der-surface, #fff)',
               border: '1px solid var(--der-border-soft, #e2e6ef)',
               borderRadius: 10,
               boxShadow:
                 '0 1px 2px rgba(15,25,50,0.04), 0 10px 28px rgba(15,25,50,0.12)',
               zIndex: 200,
               padding: 8,
             }}>
          <div style={{ padding: '6px 10px 10px',
                         borderBottom: '1px solid var(--der-border-soft, #edf0f5)',
                         marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
            <div className="ea-text-muted"
                 style={{ fontSize: 11, marginTop: 2 }}>
              {user.username}
              {roles ? ` · ${roles}` : ''}
            </div>
          </div>
          <Link to={`/provisioning/users/${encodeURIComponent(user.userId)}`}
                role="menuitem"
                data-test="user-menu-profile"
                onClick={() => setOpen(false)}
                style={menuItemStyle()}>
            <svg viewBox="0 0 24 24" width={14} height={14}
                 fill="none" stroke="currentColor" strokeWidth="1.75"
                 strokeLinecap="round" strokeLinejoin="round"
                 aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
            <span>My profile</span>
          </Link>
          <Link to="/settings"
                role="menuitem"
                data-test="user-menu-settings"
                onClick={() => setOpen(false)}
                style={menuItemStyle()}>
            <svg viewBox="0 0 24 24" width={14} height={14}
                 fill="none" stroke="currentColor" strokeWidth="1.75"
                 strokeLinecap="round" strokeLinejoin="round"
                 aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>System settings</span>
          </Link>
          <button type="button"
                  role="menuitem"
                  data-test="user-menu-signout"
                  onClick={() => { void handleSignOut(); }}
                  style={{
                    ...menuItemStyle(),
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 0,
                    borderTop: '1px solid var(--der-border-soft, #edf0f5)',
                    marginTop: 4,
                    paddingTop: 10,
                    cursor: 'pointer',
                    color: 'var(--der-danger-ink, #a92a2a)',
                  }}>
            <svg viewBox="0 0 24 24" width={14} height={14}
                 fill="none" stroke="currentColor" strokeWidth="1.75"
                 strokeLinecap="round" strokeLinejoin="round"
                 aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--der-text, #0f172a)',
    textDecoration: 'none',
    borderRadius: 6,
  };
}

function initials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
