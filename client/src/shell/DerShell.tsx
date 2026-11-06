import type { ReactNode } from 'react';
import { DerBreadcrumb } from './DerBreadcrumb';
import { DerTopbar } from './DerTopbar';

export interface DerShellProps {
  readonly children: ReactNode;
}

/**
 * ADR-0037 C-UI-1 — device-client shell.
 *
 * Layout:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ DerTopbar                                 │
 *   ├────────────────────────────────────────────┤
 *   │ DerBreadcrumb (hidden on /)                │
 *   ├────────────────────────────────────────────┤
 *   │ <main>  children                           │
 *   └────────────────────────────────────────────┘
 *
 * C-UI-2 adds the app-launcher overlay + user menu dropdown; the
 * shell is the mount point for the overlay portal.
 */
export function DerShell({ children }: DerShellProps): JSX.Element {
  return (
    <div className="der-shell" data-test="der-shell">
      <DerTopbar />
      <DerBreadcrumb />
      <main className="der-shell__main" data-test="der-shell-main">
        {children}
      </main>
    </div>
  );
}
