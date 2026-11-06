/**
 * ADR-0037 C-UI-2 — single source of truth for the six Server
 * Modules the device client exposes. Shared by DerAppLauncher
 * (overlay) and the existing screens/Launcher.tsx until that
 * screen collapses into DerHome in C-UI-3.
 */

export type ModuleId =
  | 'dhis2' | 'sync' | 'network' | 'workflows' | 'data' | 'admin';

export interface ModuleTile {
  readonly id: ModuleId;
  readonly label: string;
  readonly subtitle: string;
  readonly to: string;
  readonly testId: string;
  /** Inline SVG path-data for the tile icon. 24x24 viewbox,
   *  stroke-based. Keeps the overlay self-contained — no icon
   *  package dependency. */
  readonly icon: string;
}

/** Stroke-only SVG icons, 24x24. */
const ICON = {
  plug:      'M9 7V3 M15 7V3 M7 10h10v4a5 5 0 0 1-10 0v-4z M12 19v3',
  sync:      'M20 12a8 8 0 1 1-2.34-5.66 L20 8 M14 4h6v6',
  wifi:      'M5 12a12 12 0 0 1 14 0 M8 15a7 7 0 0 1 8 0 M11 18a2 2 0 0 1 2 0 M12 21h.01',
  workflow:  'M4 5h6v6H4z M14 13h6v6h-6z M10 8h8 M12 11v2',
  dataset:   'M4 7h16 M4 12h16 M4 17h16 M4 3h16v18H4z',
  user:      'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
} as const;

export const MODULES: readonly ModuleTile[] = [
  { id: 'dhis2', label: 'DHIS2',
    subtitle: 'Reachability + compatibility',
    to: '/dhis2/status', testId: 'app-dhis2', icon: ICON.plug },
  { id: 'sync', label: 'Synchronisation',
    subtitle: 'Jobs · drift · worker',
    to: '/sync/status', testId: 'app-sync', icon: ICON.sync },
  { id: 'network', label: 'Network',
    subtitle: 'Status · interfaces · AP',
    to: '/network/status', testId: 'app-network', icon: ICON.wifi },
  { id: 'workflows', label: 'Workflows',
    subtitle: 'Capture runs',
    to: '/capture/runs', testId: 'app-workflows', icon: ICON.workflow },
  { id: 'data', label: 'Data',
    subtitle: 'Aggregate · Programs · Drafts',
    to: '/aggregate/datasets', testId: 'app-data', icon: ICON.dataset },
  { id: 'admin', label: 'Administration',
    subtitle: 'Session · recent work',
    to: '/session', testId: 'app-admin', icon: ICON.user },
];
