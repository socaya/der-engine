import { Link } from 'react-router-dom';
import { Card } from '@dhis2/ui';

interface Tile {
  readonly to: string;
  readonly title: string;
  readonly subtitle: string;
  readonly testId: string;
}

interface ModuleGroup {
  readonly id: string;
  readonly label: string;
  readonly subtitle: string;
  readonly tiles: readonly Tile[];
}

/**
 * DC-03 App launcher — grouped by the six DER Server Modules:
 * DHIS2 · Synchronisation · Network · Workflows · Data · Administration.
 *
 * Each tile links to an operator-usable device-client screen that is
 * backed by a verified server endpoint on that module. Admin-only
 * surfaces (edit connection, pause worker, AP start/stop, user
 * provisioning, backup/restore) stay in admin-ui.
 */
const MODULES: readonly ModuleGroup[] = [
  {
    id: 'dhis2',
    label: 'DHIS2',
    subtitle: 'Central integration status. Metadata itself is consumed as form fields, filter options, and PR/VR validations — not browsed here. Management lives in admin-ui.',
    tiles: [
      { to: '/dhis2/status', title: 'Status', subtitle: 'Reachability + compatibility snapshot.', testId: 'tile-dhis2-status' },
    ],
  },
  {
    id: 'sync',
    label: 'Synchronisation',
    subtitle: 'Scheduled sync jobs, metadata drift and the operation journal.',
    tiles: [
      { to: '/sync/status', title: 'Status', subtitle: 'Sync jobs + drift + worker.', testId: 'tile-sync-status' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    subtitle: 'Edge connectivity and the capture-device access point.',
    tiles: [
      { to: '/network/status', title: 'Status', subtitle: 'Status, interfaces and access point.', testId: 'tile-network-status' },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    subtitle: 'Distributed capture workflows and their runs.',
    tiles: [
      { to: '/capture/runs', title: 'Capture runs', subtitle: 'Workflow-scoped data capture (ADR-0036).', testId: 'tile-capture' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    subtitle: 'Direct DHIS2 writes and the operator work queue.',
    tiles: [
      { to: '/aggregate/datasets', title: 'Aggregate', subtitle: 'Pick a data set to open the entry grid.', testId: 'tile-aggregate' },
      { to: '/programs', title: 'Programs', subtitle: 'Event-only and Tracker programs.', testId: 'tile-programs' },
      { to: '/scheduled', title: 'Scheduled events', subtitle: 'Due-today / overdue events.', testId: 'tile-scheduled' },
      { to: '/review', title: 'Review', subtitle: 'Submitted-work review queue.', testId: 'tile-review' },
      { to: '/drafts', title: 'My drafts', subtitle: 'Draft entries saved on this edge.', testId: 'tile-drafts' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    subtitle: 'This device: session, identity and recent activity.',
    tiles: [
      { to: '/session', title: 'Session', subtitle: 'Session + edge identity.', testId: 'tile-session' },
      { to: '/recent', title: 'Recent work', subtitle: 'Your recent activity on this edge.', testId: 'tile-recent' },
    ],
  },
];

export function Launcher(): JSX.Element {
  return (
    <div className="der-launcher">
      <h1 data-test="launcher-heading">Launcher</h1>
      <p>
        Signed in to the DER edge runtime. The launcher is organised by the
        six Server Modules — only features backed by a verified server endpoint
        appear here. Metadata is managed on the DER server; the client uses
        whatever is already synced.
      </p>

      {MODULES.map((mod) => (
        <section key={mod.id} className="der-module" data-test={`module-${mod.id}`}>
          <header className="der-module__header">
            <h2 data-test={`module-${mod.id}-heading`}>{mod.label}</h2>
            <p>{mod.subtitle}</p>
          </header>
          <div className="der-tile-grid" data-test={`module-${mod.id}-tiles`}>
            {mod.tiles.map((t) => (
              <Link to={t.to} key={t.testId} className="der-tile-link" data-test={t.testId}>
                <Card>
                  <h3>{t.title}</h3>
                  <p>{t.subtitle}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
