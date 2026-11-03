import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Breadcrumbs, Panel, SyncStatusBar,
  fmtDate, fmtAgo,
  isInEdgeOrgUnitScope, OutOfScopeBanner,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';
import { useOrgUnit } from '../components/OrgUnitContext';

/**
 * §2.3.92 R-C/2.2 — `/data/aggregate/:valueId`: full row detail for
 * one locally-stored aggregate value. Shows the row header +
 * resolved metadata names + the compound key, the DER-local workflow
 * lineage, and the outbox journal history (all operation_journal
 * rows ever logged for this value's compound key).
 */
export function DataAggregateDetail(): JSX.Element {
  const { valueId = '' } = useParams();
  const [detail, setDetail]
    = useState<edgeApi.LocalAggregateDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { binding: edgeOu } = useOrgUnit();

  useEffect(() => {
    edgeApi.getLocalAggregate(valueId)
      .then((d) => { setDetail(d); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [valueId]);

  if (err) {
    return (
      <div className="ea-screen" data-test="data-aggregate-detail">
        <Breadcrumbs items={[
          { label: 'Data', to: '/data' },
          { label: 'Aggregate', to: '/data/aggregate' },
          { label: valueId.slice(0, 8) },
        ]} />
        <ErrorBlock title="Row not found"
                     testId="err-data-aggregate-detail">{err}</ErrorBlock>
      </div>
    );
  }
  if (!detail) {
    return <LoadingBlock testId="loading" />;
  }

  const r = detail.row;
  // §2.3.115 R-AL — same scope-check pattern as DataTeiDetail.
  const edgeOuId   = edgeOu?.orgUnitId   ?? null;
  const edgeOuName = edgeOu?.orgUnitDisplayName ?? null;
  const edgeOuPath = edgeOu?.orgUnitPath ?? null;
  const inScope    = isInEdgeOrgUnitScope(r.orgUnitUid, edgeOuPath);
  return (
    <div className="ea-screen" data-test="data-aggregate-detail">
      <Breadcrumbs items={[
        { label: 'Data',       to: '/data' },
        { label: 'Aggregate',  to: '/data/aggregate' },
        { label: r.dataElementName ?? r.dataElementUid },
      ]} />
      <SyncStatusBar
        tone={inScope ? 'info' : 'warning'}
        title={r.dataElementName ?? 'Aggregate value'}
        statusLabel={inScope ? `v${r.valueVersion}` : 'Out of bound OU'}
        subtitle={
          <>
            <span>Local aggregate value</span>
            <span>·</span>
            <span>{r.periodIso}</span>
            <span>·</span>
            <span>{r.orgUnitName ?? r.orgUnitUid}</span>
            {!inScope && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--der-warning-ink)' }}>
                  Edge is bound to <strong>{edgeOuName ?? edgeOuId}</strong>
                </span>
              </>
            )}
          </>
        }
        actions={
          <Link to="/data/aggregate"
                 className="ea-btn ea-btn--ghost ea-btn--sm">
            <UiIcon icon="aggregate" size={14} />
            <span>Back to Aggregate</span>
          </Link>
        }
      />

      {!inScope && (
        <OutOfScopeBanner
          rowOrgUnit={r.orgUnitUid}
          rowOrgUnitName={r.orgUnitName}
          edgeOuId={edgeOuId}
          edgeOuName={edgeOuName}
          entityKindLabel="data value" />
      )}

      <Panel title="Row">
        <dl className="ea-def-list">
          <DefRow label="Value">
            <strong style={{ fontSize: 15 }}>{r.valueText}</strong>
          </DefRow>
          {r.comment && (
            <DefRow label="Comment">{r.comment}</DefRow>
          )}
          <DefRow label="Data element">
            {r.dataElementName
              ? <>
                  <div>{r.dataElementName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {r.dataElementUid}
                  </div>
                </>
              : <span className="ea-mono">{r.dataElementUid}</span>}
          </DefRow>
          <DefRow label="Dataset">
            {r.dataSetName
              ? <>
                  <div>{r.dataSetName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {r.dataSetUid}
                  </div>
                </>
              : <span className="ea-mono">{r.dataSetUid ?? '—'}</span>}
          </DefRow>
          <DefRow label="Org unit">
            {r.orgUnitName
              ? <>
                  <div>{r.orgUnitName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {r.orgUnitUid}
                  </div>
                </>
              : <span className="ea-mono">{r.orgUnitUid}</span>}
          </DefRow>
          <DefRow label="Period">
            <span className="ea-mono">{r.periodIso}</span>
          </DefRow>
          <DefRow label="Category option combo">
            <span className="ea-mono" style={{ fontSize: 11 }}>
              {r.categoryOptionComboUid}
            </span>
          </DefRow>
          <DefRow label="Attribute option combo">
            <span className="ea-mono" style={{ fontSize: 11 }}>
              {r.attributeOptionComboUid}
            </span>
          </DefRow>
          <DefRow label="Captured">
            <>
              {r.submittedByUsername ?? r.submittedBy ?? '—'}
              <span className="ea-text-muted" style={{ marginLeft: 8 }}>
                · {r.submittedAt ? `${fmtDate(r.submittedAt)} (${fmtAgo(r.submittedAt)})` : '—'}
              </span>
            </>
          </DefRow>
          <DefRow label="Workflow run">
            <WorkflowRunLink
              runId={r.workflowRunId}
              name={r.workflowName}
              bk={r.workflowBusinessKey}
              kind={r.workflowKind} />
          </DefRow>
          <DefRow label="Value ID">
            <span className="ea-mono" style={{ fontSize: 11 }}>{r.valueId}</span>
          </DefRow>
        </dl>
      </Panel>

      <JournalPanel entries={detail.journal} />
    </div>
  );
}

/* ─── Shared row helpers used by all three detail pages ────────── */

export function DefRow({ label, children }:
  { label: string; children: React.ReactNode }
): JSX.Element {
  return (
    <div className="ea-def-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function WorkflowRunLink(
  { runId, name, bk, kind }:
    { runId: string | null;
      name: string | null;
      bk: string | null;
      kind: 'USER' | 'SYSTEM' | null }
): JSX.Element {
  if (!runId) {
    return <span className="ea-text-muted" style={{ fontStyle: 'italic' }}>
      untagged
    </span>;
  }
  return (
    <Link to={`/workflows/monitoring/runs/${runId}`}
          style={{ textDecoration: 'none',
                     color: 'var(--der-primary-ink)' }}>
      {kind === 'SYSTEM' && (
        <span className="ea-chip ea-chip--neutral"
              style={{ marginRight: 6 }}>SYS</span>
      )}
      <span>{name ?? runId.slice(0, 8)}</span>
      {bk && (
        <div className="ea-mono ea-text-muted"
             style={{ fontSize: 10, marginTop: 2 }}>
          {bk}
        </div>
      )}
    </Link>
  );
}

export function JournalPanel(
  { entries }: { entries: ReadonlyArray<edgeApi.JournalHistoryEntry> }
): JSX.Element {
  return (
    <Panel title={`Sync history · ${entries.length}`}>
      {entries.length === 0 ? (
        <p className="ea-text-muted" style={{ margin: 0 }}>
          No outbox entries yet — this row has never been queued for
          Central DHIS2. It may be a brand-new local write, or it may
          have been pulled down from Central and attached to its
          CENTRAL_DOWNLOAD system workflow run (which doesn&apos;t journal).
        </p>
      ) : (
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="journal-history">
            <thead><tr>
              <th style={{ width: 130 }}>Logged</th>
              <th style={{ width: 170 }}>State</th>
              <th style={{ width: 70, textAlign: 'right' }}>Attempts</th>
              <th>Last error / notes</th>
              <th style={{ width: 160 }}>Operation ID</th>
            </tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.operationId}>
                  <td className="ea-text-muted"
                      title={e.updatedAt ?? e.createdAt ?? ''}>
                    {e.updatedAt
                      ? fmtAgo(e.updatedAt)
                      : e.createdAt ? fmtAgo(e.createdAt) : '—'}
                  </td>
                  <td>
                    <Link to={`/sync/attention/${e.operationId}`}
                          style={{ textDecoration: 'none' }}>
                      <span className={`ea-chip ea-chip--${
                        toneForState(e.state)}`}>
                        {humaniseState(e.state)}
                      </span>
                    </Link>
                  </td>
                  <td className="ea-text-muted"
                      style={{ textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums' }}>
                    {e.attemptCount}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {e.lastError ?? (
                      e.nextHopOrgUnitUid
                        ? <>Next hop: <span className="ea-mono">
                            {e.nextHopOrgUnitUid}
                          </span></>
                        : <span className="ea-text-muted">—</span>
                    )}
                  </td>
                  <td className="ea-mono"
                      style={{ fontSize: 10 }} title={e.operationId}>
                    {e.operationId.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function toneForState(state: edgeApi.LocalDataSyncState)
  : 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (state) {
    case 'CENTRAL_ACCEPTED': return 'success';
    case 'CENTRAL_REJECTED':
    case 'QUARANTINED':      return 'danger';
    case 'CONFLICT_REVIEW':
    case 'REQUIRES_APPROVAL':
    case 'RETRYABLE':
    case 'UNKNOWN_OUTCOME':  return 'warning';
    case 'PENDING':
    case 'IN_FLIGHT':        return 'info';
    default:                 return 'neutral';
  }
}

export function humaniseState(state: edgeApi.LocalDataSyncState): string {
  switch (state) {
    case 'PENDING':           return 'Pending push';
    case 'IN_FLIGHT':         return 'Sending…';
    case 'RETRYABLE':         return 'Retrying';
    case 'CENTRAL_ACCEPTED':  return 'Synced';
    case 'CENTRAL_REJECTED':  return 'Rejected';
    case 'CONFLICT_REVIEW':   return 'Conflict';
    case 'REQUIRES_APPROVAL': return 'Awaiting approval';
    case 'QUARANTINED':       return 'Quarantined';
    case 'UNKNOWN_OUTCOME':   return 'Unknown';
    default:                  return state;
  }
}
