import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DerAppLauncher } from './DerAppLauncher';
import { DerBreadcrumb } from './DerBreadcrumb';
import { DerTopbar } from './DerTopbar';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import { count as queueCount } from '../offline/queue';
import { drainOfflineQueue } from '../offline/replay';

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
  const [queued, setQueued] = useState<number>(0);
  const online = useOnlineStatus();

  // Shell-level offline-queue plumbing. Two reasons to live here:
  //   1. One auto-drain for every dispatched app — the drain used
  //      to live on AggregateEntry only; capture-event +
  //      capture-tracker + workflow-capture had their own
  //      duplicate copies or none at all.
  //   2. The topbar chip can show "N queued" regardless of which
  //      app owns the submission.
  // Re-count every 2 s so a submit that queues from inside a
  // dispatched app bumps the badge without the app needing to
  // push.
  const lastDrainOnline = useRef<boolean | null>(null);
  useEffect(() => {
    if (online && lastDrainOnline.current !== true) {
      drainOfflineQueue().catch(() => undefined);
    }
    lastDrainOnline.current = online;
  }, [online]);
  useEffect(() => {
    let cancelled = false;
    const tick = async (): Promise<void> => {
      try {
        const n = await queueCount();
        if (!cancelled) setQueued(n);
      } catch { /* queue unavailable */ }
    };
    void tick();
    const id = window.setInterval(() => { void tick(); }, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

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
                  onUserMenuClose={closeUserMenu}
                  queuedCount={queued}
                  online={online} />
      <DerBreadcrumb />
      <main className="der-shell__main" data-test="der-shell-main">
        {children}
      </main>
      <DerAppLauncher open={launcherOpen} onClose={closeLauncher} />
    </div>
  );
}
