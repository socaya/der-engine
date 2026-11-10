import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, useOuContext, OuPicker, SyncStatusBar, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

interface OperatorMetricsRow {
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
  mapping: edgeApi.EdgeUserDhis2Mapping | null;
  conflictCount: number;
  rejectCount: number;
  retryCount: number;
  attentionCount: number;
}

export function OperatorMetrics(): JSX.Element {
  const navigate = useNavigate();
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [mappings, setMappings] =
    useState<Record<string, edgeApi.EdgeUserDhis2Mapping>>({});
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.listUsers(),
      edgeApi.listUserDhis2Mappings(),
      edgeApi.listConflicts(500),
    ]).then(([u, m, c]) => {
      if (u.status === 'fulfilled') setUsers(u.value.users);
      else { setErr(u.reason instanceof Error ? u.reason.message : String(u.reason)); return; }
      if (m.status === 'fulfilled') {
        const idx: Record<string, edgeApi.EdgeUserDhis2Mapping> = {};
        for (const row of m.value) idx[row.edgeUserId] = row;
        setMappings(idx);
      }
      if (c.status === 'fulfilled') setConflicts(c.value);
    });
  }, []);

  if (err && !users) return <ErrorBlock title="Metrics load failed"
                                         testId="err-operator-metrics">{err}</ErrorBlock>;
  if (!users) return <LoadingBlock testId="loading" />;

  const rows: OperatorMetricsRow[] = users.map((u) => {
    const mine = conflicts.filter((c) => c.submittedBy === u.userId);
    const conflictCount = mine.filter((c) => c.state === 'CONFLICT_REVIEW').length;
    const rejectCount = mine.filter((c) => c.state === 'CENTRAL_REJECTED').length;
    const retryCount = mine.filter((c) => c.state === 'RETRYABLE').length;
    return {
      userId: u.userId,
      username: u.username,
      displayName: u.displayName,
      roles: u.roles,
      mapping: mappings[u.userId] ?? null,
      conflictCount, rejectCount, retryCount,
      attentionCount: conflictCount + rejectCount + retryCount,
    };
  });
  const ranked = rows.slice().sort((a, b) =>
    b.attentionCount - a.attentionCount
    || a.username.localeCompare(b.username));

  const totalOperators = rows.length;
  const unmapped = rows.filter((r) => r.mapping == null).length;
  const needCredential = rows.filter(
    (r) => r.mapping != null && !r.mapping.hasCredential).length;
  const withAttention = rows.filter((r) => r.attentionCount > 0).length;
  const totalAttention = rows.reduce((a, r) => a + r.attentionCount, 0);

  const tone: 'success' | 'warning' | 'danger' =
    withAttention === 0 && unmapped === 0 ? 'success'
      : withAttention > 0 ? 'warning' : 'warning';

  return (
    <div className="ea-screen" data-test="operator-metrics">
      <SyncStatusBar
        tone={tone}
        title="Operator metrics"
        statusLabel={`${totalOperators} operator${totalOperators === 1 ? '' : 's'}`}
        subtitle={
          <>
            <span>With attention <strong style={{ color: 'var(--der-ink-900)' }}>{withAttention}</strong></span>
            <span>·</span>
            <span>Unmapped <strong style={{ color: 'var(--der-ink-900)' }}>{unmapped}</strong></span>
            <span>·</span>
            <span>Missing credential <strong style={{ color: 'var(--der-ink-900)' }}>{needCredential}</strong></span>
            <span>·</span>
            <span>Total attention items <strong style={{ color: 'var(--der-ink-900)' }}>{totalAttention}</strong></span>
          </>
        }
        actions={
          <Link to="/monitoring/metrics"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="Monitoring"
                data-test="operator-metrics-open-reliability">
            <UiIcon icon="analytics" size={14} />
            <span>Job reliability</span>
          </Link>
        }
      />
      <Panel title="Per-operator breakdown"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 Click a row for user detail
               </span>
             }>
        {rows.length === 0 ? (
          <EmptyBlock title="No operators"
                      testId="operator-metrics-empty">
            No users on this edge yet.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable"
                   data-test="operator-metrics-table">
              <thead><tr>
                <th>Operator</th>
                <th>DHIS2 mapping</th>
                <th>Credential</th>
                <th style={{ textAlign: 'right' }}>Conflicts</th>
                <th style={{ textAlign: 'right' }}>Rejected</th>
                <th style={{ textAlign: 'right' }}>Retrying</th>
                <th style={{ textAlign: 'right' }}>Attention</th>
              </tr></thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.userId}
                      data-test={`operator-metrics-row-${r.userId}`}
                      onClick={() => navigate(
                        `/provisioning/users/${encodeURIComponent(r.userId)}`)}
                      style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.displayName}</div>
                      <div className="ea-mono ea-text-muted" style={{ fontSize: 12 }}>
                        @{r.username}
                      </div>
                    </td>
                    <td>
                      {r.mapping
                        ? <span className="ea-mono">@{r.mapping.dhis2Username}</span>
                        : <Status tone="warning">Unmapped</Status>}
                    </td>
                    <td>
                      {r.mapping == null
                        ? <span className="ea-text-muted">—</span>
                        : r.mapping.hasCredential
                          ? <Status tone="success">Stored</Status>
                          : <Status tone="warning">Not set</Status>}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right',
                                                      color: r.conflictCount ? 'var(--der-warning-ink)' : undefined }}>
                      {r.conflictCount}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right',
                                                      color: r.rejectCount ? 'var(--der-danger-ink)' : undefined }}>
                      {r.rejectCount}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right',
                                                      color: r.retryCount ? 'var(--der-warning-ink)' : undefined }}>
                      {r.retryCount}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {r.attentionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function FacilityAnalytics(): JSX.Element {
  const [ctx] = useOuContext();
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  useEffect(() => { edgeApi.systemInfo().then(setSi).catch(() => undefined); }, []);
  if (!si) return <LoadingBlock testId="loading" />;
  const journal = Object.entries(si.journal ?? {});
  const total = journal.reduce((a, [, v]) => a + (v as number), 0);
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone="info"
        title="Facility analytics"
        statusLabel={`${total.toLocaleString()} entries`}
        subtitle={
          <>
            <span>Capture throughput for the bound organisation unit.</span>
            <span>·</span>
            <span>Entity kinds <strong style={{ color: 'var(--der-ink-900)' }}>{journal.length}</strong></span>
          </>
        }
      />
      <OuPicker ctx={ctx} />
      <Panel title="By entity kind">
        {journal.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No captured data yet.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr><th>Entity</th><th>Count</th></tr></thead>
              <tbody>
                {journal.map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td className="ea-mono">{(v as number).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

