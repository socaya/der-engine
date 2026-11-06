import { useCallback, useState, type ReactNode } from 'react';
import { DerAppLauncher } from './DerAppLauncher';
import { DerBreadcrumb } from './DerBreadcrumb';
import { DerTopbar } from './DerTopbar';

export interface DerShellProps {
  readonly children: ReactNode;
}

/**
 * ADR-0037 C-UI-2 — device-client shell.
 *
 * Owns the app-launcher overlay and the user-menu dropdown. The
 * overlay is dismissable (Esc, backdrop click, close button, tile
 * click); the menu is dismissable (Esc, outside click). No nested
 * router is needed — both overlays close themselves on navigation.
 */
export function DerShell({ children }: DerShellProps): JSX.Element {
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleLauncher = useCallback(() => {
    setUserMenuOpen(false);
    setLauncherOpen((v) => !v);
  }, []);
  const closeLauncher = useCallback(() => setLauncherOpen(false), []);
  const toggleUserMenu = useCallback(() => {
    setLauncherOpen(false);
    setUserMenuOpen((v) => !v);
  }, []);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  return (
    <div className="der-shell" data-test="der-shell">
      <DerTopbar onLauncherClick={toggleLauncher}
                  userMenuOpen={userMenuOpen}
                  onUserMenuToggle={toggleUserMenu}
                  onUserMenuClose={closeUserMenu} />
      <DerBreadcrumb />
      <main className="der-shell__main" data-test="der-shell-main">
        {children}
      </main>
      <DerAppLauncher open={launcherOpen} onClose={closeLauncher} />
    </div>
  );
}
