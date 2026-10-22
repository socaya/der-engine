import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  NoticeBox,
} from '@dhis2/ui';
import { useAuth } from '../auth/AuthContext';
import { triggerMetadataSync } from '../api/edgeApi';
import type { SyncResult } from '../api/edgeApi';

/**
 * DC-03 App launcher.
 *
 * Tiles for each metadata workflow area. ADMIN users also see a card that
 * triggers metadata sync against the central (POST /edge-api/v1/sync/metadata).
 *
 * The launcher never claims DHIS2 writes are centrally accepted — that is a
 * Phase 03.5/04 responsibility.
 */
export function Launcher(): JSX.Element {
  const { state } = useAuth();
  const isAdmin = state.status === 'AUTHENTICATED' && state.user.roles.includes('ADMIN');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const doSync = async (): Promise<void> => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await triggerMetadataSync();
      setLastSync(result);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const tiles: ReadonlyArray<{ to: string; title: string; subtitle: string; testId: string }> = [
    { to: '/metadata/organisation-units', title: 'Organisation units', subtitle: 'Browse the mirrored OU hierarchy.', testId: 'tile-ou' },
    { to: '/metadata/data-sets', title: 'Data sets', subtitle: 'Aggregate data sets available locally.', testId: 'tile-ds' },
    { to: '/metadata/data-elements', title: 'Data elements', subtitle: 'Mirrored data elements.', testId: 'tile-de' },
    { to: '/metadata/programs', title: 'Programs', subtitle: 'Tracker and event programs.', testId: 'tile-prg' },
    { to: '/metadata/tracked-entity-types', title: 'Tracked entity types', subtitle: 'Entity type registry.', testId: 'tile-tet' },
    { to: '/recent', title: 'Recent work', subtitle: 'Your recent activity on this edge.', testId: 'tile-recent' },
    { to: '/session', title: 'Session details', subtitle: 'Session + edge identity.', testId: 'tile-session' },
  ];

  return (
    <div className="der-launcher">
      <h1 data-test="launcher-heading">Launcher</h1>
      <p>
        You are signed in to the DER edge runtime. Workflow applications read from
        this edge; a successful write is <strong>Locally committed</strong> until
        Phase 04 adds the central reconciliation journal.
      </p>
      <div className="der-tile-grid" data-test="launcher-tiles">
        {tiles.map((t) => (
          <Link to={t.to} key={t.testId} className="der-tile-link" data-test={t.testId}>
            <Card>
              <h2>{t.title}</h2>
              <p>{t.subtitle}</p>
            </Card>
          </Link>
        ))}
      </div>

      {isAdmin ? (
        <Card className="der-sync-card" dataTest="sync-card">
          <h2>Metadata sync</h2>
          <p>Pull organisation units, data sets, data elements, programs and tracked entity types from the central DHIS2.</p>
          <Button
            primary
            loading={syncing}
            disabled={syncing}
            onClick={() => void doSync()}
            dataTest="sync-button"
          >
            Sync metadata from central
          </Button>
          {lastSync ? (
            <NoticeBox title="Sync complete" dataTest="sync-result">
              <ul>
                <li>Snapshot id: <code>{lastSync.snapshotId}</code></li>
                <li>Total: {lastSync.total}</li>
                <li>Organisation units: {lastSync.organisationUnits}</li>
                <li>Data elements: {lastSync.dataElements}</li>
                <li>Data sets: {lastSync.dataSets}</li>
                <li>Programs: {lastSync.programs}</li>
                <li>Tracked entity types: {lastSync.trackedEntityTypes}</li>
                <li>Central version: {lastSync.centralVersion}</li>
              </ul>
            </NoticeBox>
          ) : null}
          {syncError ? (
            <NoticeBox error title="Sync failed" dataTest="sync-error">
              {syncError}
            </NoticeBox>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
