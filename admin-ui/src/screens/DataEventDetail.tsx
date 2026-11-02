import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Breadcrumbs, Panel, SyncStatusBar,
  fmtDate, fmtAgo,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';
import { DefRow, WorkflowRunLink, JournalPanel } from './DataAggregateDetail';

/**
 * §2.3.92 R-C/2.2 — `/data/events/:eventId`: full row detail for one
 * locally-stored event. Shows event header, all data-element values,
 * workflow lineage, and outbox journal history.
 */
export function DataEventDetail(): JSX.Element {
  const { eventId = '' } = useParams();
  const [detail, setDetail]
    = useState<edgeApi.LocalEventDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    edgeApi.getLocalEvent(eventId)
      .then((d) => { setDetail(d); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [eventId]);

  if (err) {
    return (
      <div className="ea-screen" data-test="data-event-detail">
        <Breadcrumbs items={[
          { label: 'Data', to: '/data' },
          { label: 'Events', to: '/data/events' },
          { label: eventId.slice(0, 8) },
        ]} />
        <ErrorBlock title="Event not found"
                     testId="err-data-event-detail">{err}</ErrorBlock>
      </div>
    );
  }
  if (!detail) {
    return <LoadingBlock testId="loading" />;
  }

  const r = detail.row;
  return (
    <div className="ea-screen" data-test="data-event-detail">
      <Breadcrumbs items={[
        { label: 'Data',   to: '/data' },
        { label: 'Events', to: '/data/events' },
        { label: r.programName
                   ? `${r.programName} · ${r.eventId.slice(0, 8)}`
                   : r.eventId.slice(0, 8) },
      ]} />
      <SyncStatusBar
        tone={r.status === 'COMPLETED' ? 'success' : 'info'}
        title={r.programStageName ?? r.programName ?? 'Event'}
        statusLabel={r.status}
        subtitle={
          <>
            <span>Local event</span>
            {r.occurredAt && (
              <>
                <span>·</span>
                <span>{fmtDate(r.occurredAt)} ({fmtAgo(r.occurredAt)})</span>
              </>
            )}
            <span>·</span>
            <span>{r.orgUnitName ?? r.orgUnitUid}</span>
          </>
        }
        actions={
          <Link to="/data/events"
                 className="ea-btn ea-btn--ghost ea-btn--sm">
            <UiIcon icon="event" size={14} />
            <span>Back to Events</span>
          </Link>
        }
      />

      <Panel title="Row">
        <dl className="ea-def-list">
          <DefRow label="Program">
            {r.programName
              ? <>
                  <div>{r.programName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {r.programUid}
                  </div>
                </>
              : <span className="ea-mono">{r.programUid}</span>}
          </DefRow>
          <DefRow label="Program stage">
            {r.programStageName
              ? <>
                  <div>{r.programStageName}</div>
                  <div className="ea-mono ea-text-muted" style={{ fontSize: 10 }}>
                    {r.programStageUid}
                  </div>
                </>
              : <span className="ea-mono">{r.programStageUid}</span>}
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
          <DefRow label="Status">
            <span className={`ea-chip ea-chip--${
              r.status === 'COMPLETED' ? 'success' : 'info'}`}>
              {r.status}
            </span>
          </DefRow>
          {r.enrollmentId && (
            <DefRow label="Enrollment">
              <span className="ea-mono" style={{ fontSize: 11 }}>
                {r.enrollmentId}
              </span>
            </DefRow>
          )}
          <DefRow label="Occurred at">
            {r.occurredAt ? (
              <>{fmtDate(r.occurredAt)}
                <span className="ea-text-muted" style={{ marginLeft: 6 }}>
                  ({fmtAgo(r.occurredAt)})
                </span>
              </>
            ) : '—'}
          </DefRow>
          <DefRow label="Captured by">
            {r.createdByUsername ?? r.createdBy ?? '—'}
          </DefRow>
          <DefRow label="Workflow run">
            <WorkflowRunLink
              runId={r.workflowRunId}
              name={r.workflowName}
              bk={r.workflowBusinessKey}
              kind={r.workflowKind} />
          </DefRow>
          <DefRow label="Version">
            <span className="ea-mono"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>
              {r.eventVersion}
            </span>
          </DefRow>
          <DefRow label="Event ID">
            <span className="ea-mono" style={{ fontSize: 11 }}>{r.eventId}</span>
          </DefRow>
        </dl>
      </Panel>

      <Panel title={`Data values · ${detail.dataValues.length}`}>
        {detail.dataValues.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            This event has no data values recorded yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="event-data-values">
              <thead><tr>
                <th>Data element</th>
                <th style={{ width: '40%' }}>Value</th>
              </tr></thead>
              <tbody>
                {detail.dataValues.map((dv) => (
                  <tr key={dv.dataElementUid}>
                    <td>
                      {dv.dataElementName
                        ? <>
                            <div>{dv.dataElementName}</div>
                            <div className="ea-mono ea-text-muted"
                                 style={{ fontSize: 10 }}>
                              {dv.dataElementUid}
                            </div>
                          </>
                        : <span className="ea-mono"
                                style={{ fontSize: 11 }}>
                            {dv.dataElementUid}
                          </span>}
                    </td>
                    <td className="ea-mono">
                      {dv.valueText || <span className="ea-text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <JournalPanel entries={detail.journal} />
    </div>
  );
}
