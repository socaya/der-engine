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

  /* §2.3.122 R-AQ/followup — document-level Escape handler so the
   * key works even if the drawer backdrop never got keyboard
   * focus. Idempotent — cleaned up on unmount. */
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
         /* §2.3.122 R-AQ/followup — backdrop click-to-close removed.
          * Operators reported "Lineage not opening"; actual behaviour
          * was open-then-immediate-close triggered by a second click
          * landing on the backdrop (dark area around the right-side
          * panel). On mice that chatter or trackpads where a single
          * tap sometimes registers twice, this looked like no
          * reaction. Esc + the Close button are the only ways to
          * dismiss now. */
         onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
         tabIndex={-1}>
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
            {/* §2.3.113 R-AJ — the column was labelled "Error" but
                the stored value is the last Central response
                (OK envelope on success, error envelope on reject).
                Renamed + rendered expandably. */}
            <th>Response</th>
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
                <td style={{ fontSize: 11, maxWidth: 360 }}>
                  <ResponseCell state={j.state} lastError={j.lastError} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** §2.3.113 R-AJ — expandable Central-response cell.
 *
 *  The server stores Central's response envelope in `last_error`
 *  regardless of outcome (OK on success, error on reject), so the
 *  cell can't just render the raw text with danger styling. This
 *  component:
 *
 *   - renders a short status summary line (parsing the envelope
 *     when possible),
 *   - tones it muted / danger based on the operation's state,
 *   - exposes the full JSON via a `<details>` disclosure so
 *     operators can always see Central's exact body without hover-
 *     dependent tooltips, truncation, or a modal.
 */
function ResponseCell(
  { state, lastError }:
    { state: string; lastError: string | null },
): JSX.Element {
  if (!lastError) {
    return <span className="ea-text-muted">—</span>;
  }
  const bad = state === 'CENTRAL_REJECTED'
            || state === 'CONFLICT_REVIEW'
            || state === 'QUARANTINED'
            || state === 'UNKNOWN_OUTCOME';
  const summary = summariseEnvelope(lastError, bad);
  return (
    <details>
      <summary style={{ cursor: 'pointer',
                         color: bad ? 'var(--der-danger-ink)'
                                    : 'var(--der-ink-500)',
                         listStyle: 'revert',
                         whiteSpace: 'nowrap',
                         overflow: 'hidden',
                         textOverflow: 'ellipsis',
                         maxWidth: 360,
                         display: 'inline-block' }}
                title="Click to show the full Central response">
        {summary}
      </summary>
      <pre className="ea-mono"
           style={{ marginTop: 6,
                     padding: 8,
                     background: 'var(--der-canvas, #f8fafc)',
                     border: '1px solid var(--der-border)',
                     borderRadius: 4,
                     fontSize: 10, lineHeight: 1.4,
                     whiteSpace: 'pre-wrap',
                     wordBreak: 'break-word',
                     maxWidth: 480,
                     maxHeight: 220,
                     overflow: 'auto' }}>
        {prettyJson(lastError)}
      </pre>
    </details>
  );
}

/** Best-effort one-line summary of a Central response envelope.
 *  Falls back to the raw string if parsing fails. */
function summariseEnvelope(raw: string, bad: boolean): string {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const status = (o.httpStatus as string | undefined)
                ?? (o.status as string | undefined);
    const code = o.httpStatusCode as number | undefined;
    const message = o.message as string | undefined;
    const prefix = bad ? 'Rejected' : 'OK';
    const parts: string[] = [prefix];
    if (code) parts.push(String(code));
    if (status && status !== 'OK') parts.push(status);
    if (message) parts.push('· ' + message);
    return parts.join(' ');
  } catch {
    return raw.length > 120 ? raw.slice(0, 117) + '…' : raw;
  }
}

/** Pretty-print JSON for the expanded body; fallback to the raw
 *  string if it isn't JSON. */
function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
