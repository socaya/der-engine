import { useEffect, useState, type ReactNode } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel, fmtBytes, fmtDur, fmtDate, SyncStatusBar } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/**
 * MockupSystemInformation — rich, uniform system diagnostics page.
 *
 * Replaces the plain `DefinitionCard` list with the same Hero + KPI
 * grid + Panel pattern used across the rest of the admin UI. Every
 * section renders a 2-column key/value grid so Database, Scheduler,
 * Storage etc. no longer stack 'Field / wrapped-value' awkwardly.
 */
export function MockupSystemInformation(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.systemInfo().then(setSi)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <ErrorBlock title="System info probe failed" testId="err-sysinfo">{err}</ErrorBlock>;
  if (!si) return <LoadingBlock testId="loading" />;

  // Derived
  const heapUsed = si.runtime.heapUsedBytes ?? 0;
  const heapMax = si.runtime.heapMaxBytes ?? 0;
  const heapPct = heapMax ? Math.round((100 * heapUsed) / heapMax) : 0;
  const storageUsed = (si.storage.totalBytes ?? 0) - (si.storage.usableBytes ?? 0);
  const storagePct = si.storage.totalBytes
    ? Math.round((100 * storageUsed) / si.storage.totalBytes) : 0;
  const dbUp = si.database.configured && !si.database.probeError;
  const schedUp = si.scheduler.started === true;
  const dhis2Up = si.dhis2.probeReachable === true;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={dhis2Up && dbUp && schedUp ? 'success' : 'warning'}
        title="System information"
        statusLabel={dhis2Up && dbUp && schedUp ? 'All subsystems healthy' : 'Degraded subsystem'}
        subtitle={
          <>
            <span>Uptime <strong style={{ color: 'var(--der-ink-900)' }}>{fmtDur(si.runtime.uptimeMillis)}</strong></span>
            <span>·</span>
            <span>Heap <strong style={{ color: 'var(--der-ink-900)' }}>{heapPct}%</strong></span>
            <span>·</span>
            <span>Storage <strong style={{ color: 'var(--der-ink-900)' }}>{storagePct}%</strong></span>
            <span>·</span>
            <span>Database <strong style={{ color: 'var(--der-ink-900)' }}>{dbUp ? 'OK' : 'FAIL'}</strong></span>
            <span>·</span>
            <span>Captured <strong style={{ color: 'var(--der-ink-900)' }}>{fmtDate(si.timestamp)}</strong></span>
          </>
        }
      />

      <div className="ea-ws-grid-2">
        <Panel title="Build &amp; release">
          <KvGrid rows={[
            ['Service', si.service],
            ['Version', mono(si.build.version)],
            ['Commit', mono(si.build.commit)],
            ['Branch', si.build.branch],
            ['Built at', mono(si.build.buildTime)],
            ['Working tree dirty', si.build.dirty ? 'yes' : 'no'],
          ]} />
        </Panel>

        <Panel title="Runtime">
          <KvGrid rows={[
            ['Java', `${si.runtime.javaVendor ?? ''} ${si.runtime.javaVersion ?? ''}`.trim() || '—'],
            ['OS', `${si.runtime.osName ?? '—'} · ${si.runtime.osArch ?? '—'}`],
            ['Hostname', si.runtime.hostname ?? '—'],
            ['Processors', String(si.runtime.availableProcessors ?? '—')],
            ['Uptime', fmtDur(si.runtime.uptimeMillis)],
            ['JVM started', si.runtime.jvmStartTimeMillis
              ? mono(new Date(si.runtime.jvmStartTimeMillis).toISOString()) : '—'],
          ]} />
          <ProgressRow label="Heap used"
                       pct={heapPct}
                       hint={`${fmtBytes(heapUsed)} / ${fmtBytes(heapMax)}`} />
        </Panel>
      </div>

      <div className="ea-ws-grid-2">
        <Panel title="Database">
          <KvGrid rows={[
            ['Product', si.database.product ?? '—'],
            ['Flyway', si.database.flywayVersion ?? '—'],
            ['Migrations', String(si.database.migrationCount ?? '—')],
            ['Users', String(si.database.userCount ?? '—')],
            ['Sessions', String(si.database.sessionCount ?? '—')],
            ['Probe error', si.database.probeError ?? '—'],
          ]} />
        </Panel>

        <Panel title="Scheduler">
          <KvGrid rows={[
            ['Name', si.scheduler.name ?? '—'],
            ['Started', si.scheduler.started ? 'yes' : 'no'],
            ['Standby', si.scheduler.standbyMode ? 'yes' : 'no'],
            ['Executing jobs', String(si.scheduler.executingJobs ?? '—')],
            ['Total jobs', String(si.scheduler.totalJobs ?? '—')],
            ['Probe error', si.scheduler.probeError ?? '—'],
          ]} />
        </Panel>
      </div>

      <div className="ea-ws-grid-2">
        <Panel title="Storage">
          <KvGrid rows={[
            ['Root', mono(si.storage.root ?? '—')],
            ['Status', si.storage.status ?? '—'],
            ['Total', fmtBytes(si.storage.totalBytes)],
            ['Usable', fmtBytes(si.storage.usableBytes)],
            ['Warn below', fmtBytes(si.storage.warnBytes)],
            ['Reject below', fmtBytes(si.storage.rejectBytes)],
          ]} />
          <ProgressRow label="Space used"
                       pct={storagePct}
                       hint={`${fmtBytes(storageUsed)} / ${fmtBytes(si.storage.totalBytes)}`}
                       tone={storagePct > 85 ? 'danger' : storagePct > 70 ? 'warning' : 'success'} />
        </Panel>

        <Panel title="DHIS2 integration">
          <KvGrid rows={[
            ['Central URL', mono(si.dhis2.centralBaseUrl ?? '—')],
            ['Pinned version', si.dhis2.pinnedVersion ?? '—'],
            ['Observed version', si.dhis2.centralVersion ?? '—'],
            ['Profile', si.dhis2.profileName ?? '—'],
            ['Allow mismatch', si.dhis2.allowMismatch ? 'yes' : 'no'],
            ['Probe reachable', si.dhis2.probeReachable ? 'yes' : 'no'],
            ['Probe RTT', si.dhis2.probeDurationMs != null ? `${si.dhis2.probeDurationMs} ms` : '—'],
            ['Captured at', si.dhis2.capturedAt ? mono(si.dhis2.capturedAt) : '—'],
            ['Reason', si.dhis2.reason ?? '—'],
          ]} />
        </Panel>
      </div>

      <div className="ea-ws-grid-2">
        <Panel title="Custom apps">
          <KvGrid rows={[
            ['Installed', String(si.apps.installed ?? 0)],
            ['Enabled', String(si.apps.enabled ?? 0)],
          ]} />
          {si.apps.items && si.apps.items.length > 0 && (
            <div className="ea-table-wrap" style={{ marginTop: 10 }}>
              <table className="ea-table ea-table--dense">
                <thead>
                  <tr><th>Key</th><th>Name</th><th>Version</th><th>Enabled</th></tr>
                </thead>
                <tbody>
                  {si.apps.items.map((a) => (
                    <tr key={a.key}>
                      <td className="ea-mono">{a.key}</td>
                      <td>{a.name}</td>
                      <td className="ea-mono">{a.version}</td>
                      <td>{a.enabled ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Journal backlog">
          {!si.journal || Object.keys(si.journal).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>Journal is empty.</p>
          ) : (
            <KvGrid rows={Object.entries(si.journal).map(([k, v]) => [k, String(v)])} />
          )}
        </Panel>
      </div>

      {si.attribution && (
        <Panel title="User attribution (ADR-0032)">
          <KvGrid rows={[
            ['Configured', si.attribution.configured ? 'yes' : 'no'],
            ['Mapped users', String(si.attribution.mappedUsers ?? '—')],
          ]} />
        </Panel>
      )}
    </div>
  );
}

function mono(s: string): ReactNode {
  return <span className="ea-mono">{s}</span>;
}

function KvGrid({ rows }: { rows: ReadonlyArray<readonly [string, ReactNode]> }): JSX.Element {
  return (
    <dl className="ea-def-list">
      {rows.map(([k, v]) => (
        <div key={k} className="ea-def-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProgressRow({ label, pct, hint, tone = 'info' }: {
  label: string; pct: number; hint: string;
  tone?: 'success' | 'info' | 'warning' | 'danger';
}): JSX.Element {
  const color = tone === 'danger' ? 'var(--der-danger)'
    : tone === 'warning' ? 'var(--der-warning,#e68e29)'
      : tone === 'success' ? 'var(--der-success)'
        : 'var(--der-primary)';
  return (
    <div className="ea-progress-row">
      <div className="ea-progress-head">
        <span className="ea-progress-label">{label}</span>
        <span className="ea-progress-hint">{hint} · {pct}%</span>
      </div>
      <div className="ea-progress-track" aria-label={`${label} ${pct}%`} role="progressbar"
           aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="ea-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

