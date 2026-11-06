import { useEffect, useState } from 'react';
import {
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumnHeader,
  DataTableHead,
  DataTableRow,
  Tag,
} from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type {
  DriftSnapshot,
  JournalWorkerHealth,
  SyncJobRun,
} from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ScreenStates';

export interface SyncStatusProps {
  readonly api?: Pick<
    typeof edgeApi,
    'listSyncJobs' | 'latestDrift' | 'journalWorkerHealth'
  >;
}

function outcomeTag(o: SyncJobRun['outcome']): JSX.Element {
  switch (o) {
    case 'SUCCESS': return <Tag positive>Success</Tag>;
    case 'FAILED':  return <Tag negative>Failed</Tag>;
    case 'STARTED': return <Tag neutral>Running</Tag>;
    case 'SKIPPED': return <Tag>Skipped</Tag>;
  }
}

/**
 * Device-client Module → Synchronisation status. Operator-readable
 * view onto:
 *   GET /edge-api/v1/sync/jobs  (last 20 Quartz runs)
 *   GET /edge-api/v1/sync/drift (last metadata drift snapshot)
 *   GET /edge-api/v1/journal/worker (operation-journal backlog)
 *
 * Admin-only mutators (trigger, pause/resume, retry) stay in admin-ui.
 */
export function SyncStatus({ api = edgeApi }: SyncStatusProps = {}): JSX.Element {
  const [jobs, setJobs] = useState<SyncJobRun[] | null>(null);
  const [drift, setDrift] = useState<DriftSnapshot | null>(null);
  const [worker, setWorker] = useState<JournalWorkerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [j, d, w] = await Promise.all([
          api.listSyncJobs(20),
          api.latestDrift(),
          api.journalWorkerHealth(),
        ]);
        if (!cancelled) { setJobs(j); setDrift(d); setWorker(w); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  if (error) {
    return (
      <ErrorBlock title="Could not load sync status" testId="sync-status-error">
        {error}
      </ErrorBlock>
    );
  }
  if (jobs === null || drift === null || worker === null) {
    return <LoadingBlock testId="sync-status-loading" />;
  }

  const backlogEntries = Object.entries(worker.backlog);

  return (
    <div className="der-module-status">
      <h1 data-test="sync-status-heading">Synchronisation</h1>
      <p>
        Live view of the edge&apos;s sync loop — scheduled jobs, metadata drift
        and the operation-journal worker.
      </p>

      <Card dataTest="sync-status-worker">
        <h2>Journal worker</h2>
        <dl className="der-kv">
          <dt>Enabled</dt>
          <dd>{worker.enabled
            ? <Tag positive dataTest="sync-worker-enabled">Running</Tag>
            : <Tag negative dataTest="sync-worker-paused">Paused</Tag>}</dd>
          <dt>Last tick</dt>
          <dd data-test="sync-worker-tick">{worker.lastTick ?? '—'}</dd>
          <dt>Last batch size</dt>
          <dd>{worker.lastBatchSize}</dd>
        </dl>
        {backlogEntries.length > 0 && (
          <div className="der-worker-backlog" data-test="sync-worker-backlog">
            {backlogEntries.map(([state, count]) => (
              <span key={state} className="der-chip" data-test={`sync-worker-backlog-${state}`}>
                {state}: {count}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card dataTest="sync-status-drift">
        <h2>Metadata drift</h2>
        {drift.driftId == null ? (
          <p data-test="sync-drift-none">
            No metadata snapshots compared yet.
            {drift.message ? ` (${drift.message})` : ''}
          </p>
        ) : (
          <dl className="der-kv">
            <dt>Captured</dt>
            <dd data-test="sync-drift-captured">{drift.capturedAt}</dd>
            <dt>Snapshot</dt>
            <dd data-test="sync-drift-snapshots">
              {drift.snapshotFrom} → {drift.snapshotTo}
            </dd>
            <dt>Fingerprint</dt>
            <dd data-test="sync-drift-fingerprint">
              {(drift.fingerprintFrom ?? '').slice(0, 8)} →{' '}
              {(drift.fingerprintTo ?? '').slice(0, 8)}
            </dd>
          </dl>
        )}
      </Card>

      <Card dataTest="sync-status-jobs">
        <h2>Recent sync jobs</h2>
        {jobs.length === 0 ? (
          <EmptyBlock title="No runs" testId="sync-jobs-empty">
            No scheduled-job runs recorded yet.
          </EmptyBlock>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableColumnHeader>Job</DataTableColumnHeader>
                <DataTableColumnHeader>Outcome</DataTableColumnHeader>
                <DataTableColumnHeader>Started</DataTableColumnHeader>
                <DataTableColumnHeader>Duration</DataTableColumnHeader>
                <DataTableColumnHeader>Triggered by</DataTableColumnHeader>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {jobs.map((j, i) => (
                <DataTableRow key={j.runId ?? i} dataTest={`sync-job-${j.runId ?? i}`}>
                  <DataTableCell>{j.jobName}</DataTableCell>
                  <DataTableCell>{outcomeTag(j.outcome)}</DataTableCell>
                  <DataTableCell>{j.startedAt}</DataTableCell>
                  <DataTableCell>
                    {j.durationMs != null ? `${j.durationMs} ms` : '—'}
                  </DataTableCell>
                  <DataTableCell>{j.triggeredBy}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
