import type { SystemInfo } from '../api/edgeApi';

/**
 * M1: System Components panel. Lists the stack components (DER
 * server, Postgres, scheduler, metadata mirror, journal worker,
 * …) with a status dot each. Mirrors the "System Topology" list
 * on the reference mockup.
 */
export interface SystemComponentsProps {
  readonly info: SystemInfo | null;
}

interface Row {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly status: 'ok' | 'warn' | 'danger' | 'muted';
}

function rowsFor(info: SystemInfo | null): Row[] {
  if (!info) return [];
  return [
    {
      key: 'der',
      label: 'DER server',
      value: `${info.build?.version ?? '—'} · ${info.runtime?.javaVersion ?? '—'}`,
      status: 'ok',
    },
    {
      key: 'postgres',
      label: 'PostgreSQL',
      value: (info.database?.product ?? '—').split(' on ')[0],
      status: info.database?.product ? 'ok' : 'warn',
    },
    {
      key: 'scheduler',
      label: 'Scheduler',
      value: info.scheduler?.started
        ? `${info.scheduler?.name ?? ''} · ${info.scheduler?.totalJobs ?? 0} jobs`
        : 'stopped',
      status: info.scheduler?.started ? 'ok' : 'warn',
    },
    {
      key: 'compat',
      label: 'Compat engine',
      value: info.dhis2?.probeReachable
        ? `${info.dhis2?.profileName ?? '—'} · ${info.dhis2?.probeDurationMs ?? '?'}ms`
        : 'probe failed',
      status: info.dhis2?.probeReachable ? 'ok' : 'danger',
    },
    {
      key: 'journal',
      label: 'Journal worker',
      value: `${info.journal?.central_accepted ?? 0} accepted`,
      status: (info.journal?.central_rejected ?? 0) > 0 ? 'warn' : 'ok',
    },
    {
      key: 'storage',
      label: 'Storage',
      value: info.storage?.root ?? '—',
      status: info.storage?.status === 'OK' ? 'ok'
        : info.storage?.status === 'WARN' ? 'warn' : 'danger',
    },
    {
      key: 'apps',
      label: 'Custom apps',
      value: `${info.apps?.enabled ?? 0} enabled of ${info.apps?.installed ?? 0}`,
      status: 'muted',
    },
    {
      key: 'attribution',
      label: 'User attribution',
      value: `${info.attribution?.mappedUsers ?? 0} users mapped`,
      status: 'muted',
    },
  ];
}

export function SystemComponents({ info }: SystemComponentsProps): JSX.Element {
  const rows = rowsFor(info);
  return (
    <section className="ea-syscomp" data-test="system-components">
      <h2>System components</h2>
      <ul className="ea-syscomp-list">
        {rows.length === 0 && (
          <li className="ea-syscomp-row ea-syscomp-row--muted">Loading…</li>
        )}
        {rows.map((r) => (
          <li
            key={r.key}
            className="ea-syscomp-row"
            data-test={`sys-${r.key}`}
          >
            <span className={`ea-syscomp-dot ea-syscomp-dot--${r.status}`} />
            <span className="ea-syscomp-label">{r.label}</span>
            <span className="ea-syscomp-value">{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
