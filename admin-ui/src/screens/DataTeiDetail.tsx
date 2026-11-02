import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Breadcrumbs, Panel, SyncStatusBar,
  fmtAgo, fmtDate,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';
import { DefRow, WorkflowRunLink } from './DataAggregateDetail';
import { PayloadLineageDrawer } from '../components/PayloadLineageDrawer';
import { useOrgUnit } from '../components/OrgUnitContext';

/**
 * §2.3.92 R-C/2.2 — `/data/tracker/tei/:teiUid`: full detail for one
 * tracked entity. TEI header + attributes table + all enrolments
 * and all stage events across those enrolments.
 */
export function DataTeiDetail(): JSX.Element {
  const { teiUid = '' } = useParams();
  const [detail, setDetail]
    = useState<edgeApi.LocalTeiDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lineageOpen, setLineageOpen] = useState(false);
  const { binding: edgeOu } = useOrgUnit();

  useEffect(() => {
    edgeApi.getLocalTei(teiUid)
      .then((d) => { setDetail(d); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [teiUid]);

  // Parse attributes JSON once; keep stable through re-renders.
  const attrs = useMemo(() => {
    if (!detail?.tei.attributes) return {} as Record<string, string>;
    try {
      return JSON.parse(detail.tei.attributes) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  }, [detail?.tei.attributes]);

  if (err) {
    return (
      <div className="ea-screen" data-test="data-tei-detail">
        <Breadcrumbs items={[
          { label: 'Data', to: '/data' },
          { label: 'Tracker', to: '/data/tracker' },
          { label: teiUid },
        ]} />
        <ErrorBlock title="TEI not found"
                     testId="err-data-tei-detail">{err}</ErrorBlock>
      </div>
    );
  }
  if (!detail) {
    return <LoadingBlock testId="loading" />;
  }

  const t = detail.tei;
  const attrEntries = Object.entries(attrs);

  // §2.3.114 R-AK — OU-scope check: is this TEI's org unit inside
  // the edge's bound subtree? The server's EdgeOrgUnitBinding carries
  // a `/`-joined path; a row's OU is in-scope if it appears in that
  // path (or if the edge is unbound — then every row is in-scope).
  const edgeOuId   = edgeOu?.orgUnitId   ?? null;
  const edgeOuName = edgeOu?.orgUnitDisplayName ?? null;
  const edgeOuPath = edgeOu?.orgUnitPath ?? null;
  const inScope    = !edgeOuId
                 || !edgeOuPath
                 || edgeOuPath.split('/').some((seg) => seg === t.orgUnitUid);
  const scopeTone: 'info' | 'warning' = inScope ? 'info' : 'warning';

  return (
    <div className="ea-screen" data-test="data-tei-detail">
      {lineageOpen && (
        <PayloadLineageDrawer kind="tei" rowId={t.teiUid}
                               onClose={() => setLineageOpen(false)} />
      )}
      <Breadcrumbs items={[
        { label: 'Data',    to: '/data' },
        { label: 'Tracker', to: '/data/tracker' },
        { label: t.teType ?? 'TEI' },
        { label: t.teiUid },
      ]} />
      <SyncStatusBar
        tone={scopeTone}
        title={t.teTypeName ?? t.teType ?? 'Tracked entity'}
        statusLabel={inScope ? `v${t.version}` : 'Out of bound OU'}
        subtitle={
          <>
            <span className="ea-mono">{t.teiUid}</span>
            <span>·</span>
            <span>{t.orgUnitName ?? t.orgUnitUid}</span>
            {t.updatedAt && (
              <>
                <span>·</span>
                <span>Updated {fmtAgo(t.updatedAt)}</span>
              </>
            )}
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
          <>
            <button type="button"
                     className="ea-btn ea-btn--primary ea-btn--sm"
                     onClick={() => setLineageOpen(true)}
                     data-test="tei-lineage-open">
              <UiIcon icon="external" size={14} />
              <span>Lineage</span>
            </button>
            <Link to={`/data/tracker?teiUid=${encodeURIComponent(t.teiUid)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="tei" size={14} />
              <span>Browse tracker rows</span>
            </Link>
            <Link to="/data/tracker"
                   className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="external" size={14} />
              <span>Back to Tracker</span>
            </Link>
          </>
        }
      />

      {!inScope && (
        <div data-test="tei-out-of-scope"
             style={{
               padding: '10px 14px', marginBottom: 10,
               background: 'var(--der-warning-wash, #fff7ed)',
               border: '1px solid var(--der-warning-ink, #c2410c)',
               borderRadius: 6, fontSize: 12,
               color: 'var(--der-ink-900)',
             }}>
          <strong>Out-of-scope record.</strong>{' '}
          This TEI is captured at <strong>{t.orgUnitName ?? t.orgUnitUid}</strong>
          {' '}({t.orgUnitUid}), which is outside the OU this edge is
          bound to{' '}
          (<strong>{edgeOuName ?? edgeOuId}</strong>
          {edgeOuId ? ` · ${edgeOuId}` : ''}).{' '}
          Possible causes: data from a previous OU binding, a referral
          ingested before the current binding, or a bypass of the OU
          scope interceptor. The row is still shown so operators can
          triage; it will keep syncing to Central with its stored OU.{' '}
          <Link to="/integration/organisation-unit"
                 data-cross-module="Settings">
            Change edge OU binding →
          </Link>
        </div>
      )}

      <Panel title="Tracked entity">
        <dl className="ea-def-list">
          <DefRow label="Type">
            {t.teTypeName
              ? <>
                  <div>{t.teTypeName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {t.teType}
                  </div>
                </>
              : <span className="ea-mono">{t.teType}</span>}
          </DefRow>
          <DefRow label="Org unit">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                {t.orgUnitName
                  ? <>
                      <div>{t.orgUnitName}</div>
                      <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                        {t.orgUnitUid}
                      </div>
                    </>
                  : <span className="ea-mono">{t.orgUnitUid}</span>}
              </div>
              {!inScope && (
                <span className="ea-chip ea-chip--warning"
                      title={edgeOuName ?? edgeOuId ?? 'edge unbound'}>
                  Out of bound OU
                </span>
              )}
            </div>
          </DefRow>
          <DefRow label="Capture workflow">
            <WorkflowRunLink
              runId={t.workflowRunId}
              name={t.workflowName}
              bk={t.workflowBusinessKey}
              kind={t.workflowKind} />
          </DefRow>
          <DefRow label="DHIS2 UID">
            <span className="ea-mono" style={{ fontSize: 11 }}>{t.teiUid}</span>
          </DefRow>
          <DefRow label="Timeline">
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap',
                           fontSize: 12 }}>
              <span>
                <span className="ea-text-muted">Created </span>
                <span className="ea-mono">
                  {t.createdAt ? fmtDate(t.createdAt) : '—'}
                </span>
              </span>
              <span>
                <span className="ea-text-muted">Updated </span>
                <span className="ea-mono">
                  {t.updatedAt ? fmtDate(t.updatedAt) : '—'}
                </span>
                {t.updatedAt && (
                  <span className="ea-text-muted">
                    {' '}· {fmtAgo(t.updatedAt)}
                  </span>
                )}
              </span>
              <span>
                <span className="ea-text-muted">Version </span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t.version}
                </strong>
              </span>
            </div>
          </DefRow>
        </dl>
      </Panel>

      <Panel title={`Attributes · ${attrEntries.length}`}>
        {attrEntries.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No attributes recorded for this TEI.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="tei-attributes">
              <thead><tr>
                <th>Attribute (UID)</th>
                <th>Value</th>
              </tr></thead>
              <tbody>
                {attrEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td className="ea-mono" style={{ fontSize: 11 }}>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Enrolments · ${detail.enrolments.length}`}>
        {detail.enrolments.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            This TEI has no enrolments yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="tei-enrolments">
              <thead><tr>
                <th style={{ width: 140 }}>Enrollment UID</th>
                <th>Program</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 110 }}>Enrolled</th>
                <th style={{ width: 110 }}>Incident</th>
                <th style={{ width: 180 }}>Workflow</th>
                <th style={{ width: 50, textAlign: 'right' }}>v</th>
              </tr></thead>
              <tbody>
                {detail.enrolments.map((e) => (
                  <tr key={e.enrollmentUid}>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {e.enrollmentUid}
                    </td>
                    <td>
                      {e.programName
                        ? <>
                            <div style={{ fontWeight: 500 }}>{e.programName}</div>
                            <div className="ea-mono ea-text-muted"
                                 style={{ fontSize: 10 }}>
                              {e.programUid}
                            </div>
                          </>
                        : <span className="ea-mono"
                                style={{ fontSize: 11 }}>
                            {e.programUid}
                          </span>}
                    </td>
                    <td>
                      <span className={`ea-chip ea-chip--${
                        e.status === 'COMPLETED' ? 'success' : 'info'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {e.enrollmentDate ?? '—'}
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {e.incidentDate ?? '—'}
                    </td>
                    <td>
                      <WorkflowRunLink
                        runId={e.workflowRunId}
                        name={e.workflowName}
                        bk={null}
                        kind={e.workflowKind} />
                    </td>
                    <td className="ea-text-muted"
                        style={{ textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums' }}>
                      {e.version}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Tracker events · ${detail.trackerEvents.length}`}>
        {detail.trackerEvents.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No stage events recorded for this TEI.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="tei-tracker-events">
              <thead><tr>
                <th style={{ width: 140 }}>Event UID</th>
                <th>Program · Stage</th>
                <th style={{ width: 140 }}>Enrollment</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 110 }}>Occurred</th>
                <th style={{ width: 110 }}>Updated</th>
                <th style={{ width: 50, textAlign: 'right' }}>v</th>
              </tr></thead>
              <tbody>
                {detail.trackerEvents.map((e) => (
                  <tr key={e.eventUid}>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {e.eventUid}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {e.programName ?? e.programUid}
                      </div>
                      <div className="ea-text-muted" style={{ fontSize: 11 }}>
                        {e.programStageName ?? e.programStageUid}
                      </div>
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {e.enrollmentUid ?? '—'}
                    </td>
                    <td>
                      <span className={`ea-chip ea-chip--${
                        chipToneForStatus(e.status)}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {e.occurredDate ?? '—'}
                    </td>
                    <td className="ea-text-muted"
                        title={e.updatedAt ?? ''}>
                      {e.updatedAt ? fmtAgo(e.updatedAt) : '—'}
                    </td>
                    <td className="ea-text-muted"
                        style={{ textAlign: 'right',
                                  fontVariantNumeric: 'tabular-nums' }}>
                      {e.version}
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

function chipToneForStatus(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'ACTIVE':    return 'info';
    case 'OVERDUE':   return 'danger';
    case 'SKIPPED':   return 'warning';
    case 'SCHEDULED': return 'warning';
    case 'VISITED':   return 'neutral';
    default:          return 'neutral';
  }
}
