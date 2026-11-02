import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Breadcrumbs, Panel, SyncStatusBar,
  fmtAgo,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';
import { DefRow, WorkflowRunLink } from './DataAggregateDetail';

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

  return (
    <div className="ea-screen" data-test="data-tei-detail">
      <Breadcrumbs items={[
        { label: 'Data',    to: '/data' },
        { label: 'Tracker', to: '/data/tracker' },
        { label: t.teType ?? 'TEI' },
        { label: t.teiUid },
      ]} />
      <SyncStatusBar
        tone="info"
        title={t.teTypeName ?? t.teType ?? 'Tracked entity'}
        statusLabel={`v${t.version}`}
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
          </>
        }
        actions={
          <>
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
            {t.orgUnitName
              ? <>
                  <div>{t.orgUnitName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {t.orgUnitUid}
                  </div>
                </>
              : <span className="ea-mono">{t.orgUnitUid}</span>}
          </DefRow>
          <DefRow label="Workflow run (origin)">
            <WorkflowRunLink
              runId={t.workflowRunId}
              name={t.workflowName}
              bk={t.workflowBusinessKey}
              kind={t.workflowKind} />
          </DefRow>
          <DefRow label="TEI UID">
            <span className="ea-mono" style={{ fontSize: 11 }}>{t.teiUid}</span>
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
