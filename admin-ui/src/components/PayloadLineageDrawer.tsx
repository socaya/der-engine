import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { UiIcon } from './UiIcon';

/**
 * §2.3.101 R-K — Per-row payload lineage drawer.
 *
 * Shows two things for a single Data row (aggregate value / event /
 * TEI):
 *
 *   1. the DHIS2 envelope Central would receive for just that row —
 *      the DataValueSet / events / tracker shape, same format the
 *      sync worker POSTs;
 *   2. the full operation_journal history for the row's entity_ref —
 *      every attempt, state transition, error, next-hop OU.
 *
 * Opens from a "Lineage" action on each Data table row.
 */
export function PayloadLineageDrawer(
  { kind, rowId, onClose }:
    {
      kind: 'aggregate' | 'event' | 'tei' | 'enrollment' | 'tracker-event';
      rowId: string;
      onClose(): void;
    },
): JSX.Element {
  const [body, setBody] = useState<edgeApi.RowPayloadLineage<unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const loader
      = kind === 'aggregate'     ? edgeApi.aggregateRowPayload(rowId)
      : kind === 'event'         ? edgeApi.eventRowPayload(rowId)
      : kind === 'enrollment'    ? edgeApi.enrollmentRowPayload(rowId)
      : kind === 'tracker-event' ? edgeApi.trackerEventRowPayload(rowId)
      :                            edgeApi.teiRowPayload(rowId);
    loader
      .then((r) => { if (alive) setBody(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [kind, rowId, refreshKey]);

  async function retryStream(streamKey: string,
                                entries: edgeApi.JournalEntry[]): Promise<void> {
    const ids = entries
        .filter((e) => isRetryable(e.state))
        .map((e) => e.operationId);
    if (ids.length === 0) return;
    setRetryBusy(streamKey);
    try {
      await edgeApi.retryBatch(ids);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryBusy(null);
    }
  }

  async function copy(): Promise<void> {
    if (!body) return;
    const text = JSON.stringify(body.payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }

  const title = `Row lineage — ${
    kind === 'aggregate'     ? 'Data value'
      : kind === 'event'         ? 'Event'
      : kind === 'enrollment'    ? 'Enrolment'
      : kind === 'tracker-event' ? 'Stage event'
      :                            'Tracked entity'
  }`;

  return (
    <div role="dialog" aria-modal="true" aria-label={title}
         data-test="payload-lineage-drawer"
         style={{
           position: 'fixed', inset: 0, zIndex: 1100,
           display: 'flex', alignItems: 'stretch',
           justifyContent: 'flex-end',
           background: 'rgba(15, 23, 42, 0.45)',
         }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
             background: 'var(--der-raised)',
             width: 'min(680px, 94vw)',
             boxShadow: '-10px 0 30px rgba(0,0,0,0.2)',
             borderLeft: '1px solid var(--der-border)',
             display: 'flex', flexDirection: 'column',
           }}>
        <header style={{ padding: '12px 16px',
                          borderBottom: '1px solid var(--der-border)',
                          display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>{title}</h2>
          <span className="ea-mono ea-text-muted" style={{ fontSize: 11 }}>
            {rowId}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button"
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     onClick={() => { copy().catch(() => undefined); }}
                     disabled={!body}
                     data-test="payload-lineage-copy">
              <UiIcon icon="copy" size={14} />
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button type="button"
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     onClick={onClose}
                     data-test="payload-lineage-close">
              Close
            </button>
          </div>
        </header>
        {body?.endpoint && (
          <div style={{ padding: '10px 16px',
                         fontSize: 12,
                         color: 'var(--der-ink-500)' }}>
            POST to <span className="ea-mono" style={{ fontSize: 11 }}>
              {body.endpoint}
            </span>
            {body.counts && (
              <span style={{ marginLeft: 10 }}>
                — TE <strong>{body.counts.trackedEntities}</strong>,
                {' '}Enrol <strong>{body.counts.enrollments}</strong>,
                {' '}Events <strong>{body.counts.events}</strong>
              </span>
            )}
          </div>
        )}
        <div style={{ flex: '1 1 auto',
                       overflow: 'auto',
                       padding: '0 16px 16px' }}>
          {err && (
            <pre data-test="payload-lineage-error"
                 style={{ color: 'var(--der-danger-ink)',
                           whiteSpace: 'pre-wrap',
                           fontSize: 12 }}>
              {err}
            </pre>
          )}
          {body && (
            <>
              <h3 style={{ fontSize: 12,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            color: 'var(--der-ink-500)',
                            margin: '10px 0 6px' }}>
                DHIS2 payload
              </h3>
              <pre className="ea-mono"
                   data-test="payload-lineage-body"
                   style={{ fontSize: 11, lineHeight: 1.45,
                             background: 'var(--der-canvas, #f8fafc)',
                             padding: 12, borderRadius: 6,
                             border: '1px solid var(--der-border)',
                             whiteSpace: 'pre-wrap',
                             wordBreak: 'break-word' }}>
                {JSON.stringify(body.payload, null, 2)}
              </pre>
              {body.journalByStream ? (
                <>
                  {body.journalByStream.trackedEntity && (
                    <JournalGroup
                      label="Tracked-entity journal"
                      streamKey="trackedEntity"
                      entries={body.journalByStream.trackedEntity}
                      busy={retryBusy === 'trackedEntity'}
                      onRetry={retryStream} />
                  )}
                  {body.journalByStream.enrollments && (
                    <JournalGroup
                      label="Enrolment journal"
                      streamKey="enrollments"
                      entries={body.journalByStream.enrollments}
                      busy={retryBusy === 'enrollments'}
                      onRetry={retryStream} />
                  )}
                  {body.journalByStream.events && (
                    <JournalGroup
                      label="Stage-event journal"
                      streamKey="events"
                      entries={body.journalByStream.events}
                      busy={retryBusy === 'events'}
                      onRetry={retryStream} />
                  )}
                  {body.journalByStream.dataValues && (
                    <JournalGroup
                      label="Data-value journal"
                      streamKey="dataValues"
                      entries={body.journalByStream.dataValues}
                      busy={retryBusy === 'dataValues'}
                      onRetry={retryStream} />
                  )}
                </>
              ) : (
                <JournalGroup
                  label={`Operation journal (${body.journal.length})`}
                  streamKey="all"
                  entries={body.journal}
                  busy={retryBusy === 'all'}
                  onRetry={retryStream} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** §2.3.105 R-Y — a journal entry is "retry-eligible" if it's in a
 *  non-terminal non-pending state. Mirrors
 *  OperationJournalRepository.requeuePending{,ByIds} on the server. */
export function isRetryable(s: string): boolean {
  return s === 'RETRYABLE' || s === 'CENTRAL_REJECTED'
      || s === 'CONFLICT_REVIEW' || s === 'QUARANTINED'
      || s === 'UNKNOWN_OUTCOME';
}

/** §2.3.103 R-R — one heading + journal table per entity-type stream.
 *  Rendered three times for the TEI drawer; once for the single-row
 *  drawers. §2.3.105 R-Y adds a per-stream Retry button that targets
 *  only this stream's retry-eligible operation ids. */
function JournalGroup(
  { label, streamKey, entries, busy, onRetry }:
    { label: string;
      streamKey: string;
      entries: edgeApi.JournalEntry[];
      busy: boolean;
      onRetry(streamKey: string, entries: edgeApi.JournalEntry[]): void },
): JSX.Element {
  const tone = (s: string): string =>
      s === 'CENTRAL_ACCEPTED' ? 'success'
    : s === 'CONFLICT_REVIEW' || s === 'CENTRAL_REJECTED'
       || s === 'QUARANTINED' ? 'danger'
    : s === 'RETRYABLE' ? 'warning'
    : 'info';
  const retryCount = entries.filter((e) => isRetryable(e.state)).length;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline',
                     gap: 10, margin: '18px 0 6px' }}>
        <h3 style={{ fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      color: 'var(--der-ink-500)',
                      margin: 0 }}>
          {label} ({entries.length})
        </h3>
        {retryCount > 0 && (
          <button type="button"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   onClick={() => onRetry(streamKey, entries)}
                   disabled={busy}
                   data-test={`journal-group-retry-${streamKey}`}
                   style={{ marginLeft: 'auto' }}>
            {busy ? 'Retrying…' : `Retry ${retryCount}`}
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="ea-text-muted" style={{ fontSize: 12 }}>
          No outbox entry.
        </p>
      ) : (
        <table className="ea-table ea-table--dense">
          <thead><tr>
            <th>State</th>
            <th style={{ textAlign: 'right' }}>Att.</th>
            <th>Updated</th>
            <th>Error</th>
          </tr></thead>
          <tbody>
            {entries.map((j) => (
              <tr key={j.operationId}>
                <td>
                  <span className={`ea-chip ea-chip--${tone(j.state)}`}>
                    {j.state}
                  </span>
                </td>
                <td style={{ textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums' }}>
                  {j.attemptCount}
                </td>
                <td className="ea-text-muted" style={{ fontSize: 11 }}>
                  {j.updatedAt?.slice(0, 19).replace('T', ' ') ?? '—'}
                </td>
                <td style={{ fontSize: 11,
                              color: j.lastError ? 'var(--der-danger-ink)' : 'inherit',
                              maxWidth: 240,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis' }}
                    title={j.lastError ?? ''}>
                  {j.lastError ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
