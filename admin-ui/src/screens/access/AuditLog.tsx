import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, usePaged, TablePager, SyncStatusBar, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

export function AuditEvents(): JSX.Element {
  const [params] = useSearchParams();
  const category      = params.get('category');
  const deviceFilter  = params.get('device');
  const peerFilter    = params.get('peer');
  const correlationId = params.get('correlationId');
  // When any network-specific filter is present we switch the data
  // source from /activity/recent (which lacks device/peer fields) to
  // /network/events (which carries the full shape per spec §29).
  const networkMode = Boolean(category === 'network' || deviceFilter || peerFilter || correlationId);

  const [sysRows, setSysRows] = useState<edgeApi.ActivityEntry[] | null>(null);
  const [netRows, setNetRows] = useState<edgeApi.NetworkEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function reload(): Promise<void> {
    try {
      if (networkMode) {
        setNetRows(((await edgeApi.networkEvents(200)) as { events: edgeApi.NetworkEvent[] }).events);
      } else {
        setSysRows((await edgeApi.recentActivity(100)).entries);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  // Why: reload closes over state; re-run only when networkMode changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [networkMode]);

  // Hooks must stay above every early-return. Compute both filtered
  // datasets up front and feed usePaged whichever is active.
  const qLower = query.trim().toLowerCase();
  const netFiltered = (netRows ?? []).filter((e) => {
    if (deviceFilter && e.deviceId !== deviceFilter) return false;
    if (peerFilter   && e.nodeId   !== peerFilter)   return false;
    if (correlationId && e.correlationId !== correlationId) return false;
    if (qLower && !(e.eventType.toLowerCase().includes(qLower)
               || (e.reason ?? '').toLowerCase().includes(qLower)
               || (e.deviceId ?? '').toLowerCase().includes(qLower)
               || (e.nodeId ?? '').toLowerCase().includes(qLower))) return false;
    return true;
  });
  const sysFiltered = qLower
    ? (sysRows ?? []).filter((r) => r.eventType.toLowerCase().includes(qLower))
    : (sysRows ?? []);
  const pagedNet = usePaged(netFiltered, 50);
  const pagedSys = usePaged(sysFiltered, 50);

  if (err) return <ErrorBlock title="Audit load failed" testId="err-audit">{err}</ErrorBlock>;
  if (networkMode && !netRows) return <LoadingBlock testId="loading" />;
  if (!networkMode && !sysRows) return <LoadingBlock testId="loading" />;

  if (networkMode) {
    const filtered = netFiltered;
    const paged = pagedNet;
    const failure = filtered.filter((e) => e.outcome === 'FAILURE').length;
    const filterPills: string[] = [];
    if (category === 'network') filterPills.push('network');
    if (deviceFilter)  filterPills.push(`device=${deviceFilter}`);
    if (peerFilter)    filterPills.push(`peer=${peerFilter.slice(0, 8)}…`);
    if (correlationId) filterPills.push(`correlation=${correlationId.slice(0, 8)}…`);
    return (
      <div className="ea-screen" data-test="audit-events">
        <SyncStatusBar
          tone={failure > 0 ? 'warning' : 'success'}
          title="Network audit"
          statusLabel={`${filtered.length} events`}
          subtitle={
            <>
              <span>Filtered view from /edge-api/v1/network/events.</span>
              {filterPills.length > 0 && (<><span>·</span>
                <span className="ea-mono" style={{ color: 'var(--der-ink-700)' }}>
                  {filterPills.join(' · ')}
                </span></>)}
            </>
          }
          actions={
            <>
              <Link to="/audit/events" className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-cross-module="Security">
                <UiIcon icon="refresh" size={14} /><span>Clear filter</span>
              </Link>
              <Link to="/network/diagnostics" className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-cross-module="Network">
                <UiIcon icon="diagnostics" size={14} /><span>Diagnostics</span>
              </Link>
            </>
          }
        />
        <Panel title="Timeline"
               action={<input className="ea-input" style={{ maxWidth: 260 }} type="search"
                               placeholder="Filter by event type / device / reason"
                               value={query} onChange={(e) => setQuery(e.target.value)} />}>
          {filtered.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
              No network events match this filter.
            </p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr>
                  <th>Observed</th><th>Event</th><th>Interface</th>
                  <th>Device / node</th><th>Actor</th><th>Outcome</th><th>Reason</th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((e) => (
                    <tr key={e.eventId}>
                      <td className="ea-mono">{fmtDate(e.observedAt)}</td>
                      <td style={{ fontWeight: 500 }}>{e.eventType}</td>
                      <td className="ea-mono ea-text-muted">{e.interfaceName ?? '—'}</td>
                      <td className="ea-mono ea-text-muted" style={{ fontSize: 13 }}>
                        {e.deviceId ?? e.nodeId ?? '—'}
                      </td>
                      <td className="ea-mono ea-text-muted">{e.actor ?? '—'}</td>
                      <td>
                        <Status tone={e.outcome === 'SUCCESS' ? 'success'
                                       : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                          {e.outcome}
                        </Status>
                      </td>
                      <td className="ea-text-muted">{e.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePager {...paged.pagerProps} />
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const paged = pagedSys;
  const success = (sysRows ?? []).filter((r) => r.outcome === 'SUCCESS').length;
  const failure = (sysRows ?? []).filter((r) => r.outcome === 'FAILURE').length;
  return (
    <div className="ea-screen" data-test="audit-events">
      <SyncStatusBar
        tone={failure > 0 ? 'warning' : 'success'}
        title="Alerts & activity"
        statusLabel={`${(sysRows ?? []).length} events`}
        subtitle={
          <>
            <span>Audit stream for every security-relevant event handled by this edge.</span>
            <span>·</span>
            <span>Success <strong>{success}</strong></span>
            {failure > 0 && (<><span>·</span><span>Failures <strong style={{ color: 'var(--der-danger-ink)' }}>{failure}</strong></span></>)}
          </>
        }
      />
      <Panel title="Timeline"
             action={<input className="ea-input" style={{ maxWidth: 240 }} type="search"
                             placeholder="Filter by event type"
                             value={query} onChange={(e) => setQuery(e.target.value)} />}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr><th>Observed</th><th>Event</th><th>Outcome</th><th>User</th></tr></thead>
            <tbody>
              {paged.rows.map((e) => (
                <tr key={e.auditId}>
                  <td className="ea-mono">{fmtDate(e.observedAt)}</td>
                  <td>{e.eventType}</td>
                  <td>
                    <Status tone={
                      e.outcome === 'SUCCESS' ? 'success'
                      : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                      {e.outcome}
                    </Status>
                  </td>
                  <td className="ea-mono">{'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePager {...paged.pagerProps} />
        </div>
      </Panel>
    </div>
  );
}

export function SecurityAuditTrail(): JSX.Element {
  const [events, setEvents] = useState<edgeApi.AuditEventRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Filters are owned by this screen; the applied filter is the one
   * the current page was fetched with. Editing before Apply doesn't
   * refetch. */
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftEventTypes, setDraftEventTypes] = useState<Set<string>>(new Set());
  const [draftActor, setDraftActor] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [applied, setApplied] = useState<edgeApi.AuditEventsQuery>({});

  function load(cursor: string | null, filters: edgeApi.AuditEventsQuery): void {
    setLoading(true); setErr(null);
    edgeApi.listAuditEvents({ ...filters, cursor: cursor ?? undefined, pageSize: 100 })
      .then((r) => {
        setEvents(r.events);
        setNextCursor(r.nextCursor);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(null, applied); }, [applied]);

  function toIsoOrEmpty(local: string): string | undefined {
    if (!local) return undefined;
    /* HTML datetime-local produces 'YYYY-MM-DDTHH:MM' (no seconds, no
     * tz). Treat as local wall-clock; convert to UTC Instant. */
    const d = new Date(local);
    if (Number.isNaN(d.valueOf())) return undefined;
    return d.toISOString();
  }

  function quickRange(hours: number): void {
    const now = new Date();
    const from = new Date(now.getTime() - hours * 3600_000);
    const fmt = (d: Date): string =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString().slice(0, 16);
    setDraftFrom(fmt(from));
    setDraftTo(fmt(now));
  }

  function applyFilters(): void {
    const next: edgeApi.AuditEventsQuery = {
      from: toIsoOrEmpty(draftFrom),
      to: toIsoOrEmpty(draftTo),
      eventTypes: draftEventTypes.size > 0 ? Array.from(draftEventTypes) : undefined,
      actorUserId: draftActor.trim() || undefined,
      subjectUserId: draftSubject.trim() || undefined,
    };
    setPrevCursors([]); setCurrentCursor(null);
    setApplied(next);
  }

  function clearFilters(): void {
    setDraftFrom(''); setDraftTo(''); setDraftEventTypes(new Set());
    setDraftActor(''); setDraftSubject('');
    setPrevCursors([]); setCurrentCursor(null);
    setApplied({});
  }

  function toggleType(t: string): void {
    const next = new Set(draftEventTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    setDraftEventTypes(next);
  }

  function nextPage(): void {
    if (!nextCursor) return;
    setPrevCursors((prev) => [...prev, currentCursor ?? '']);
    setCurrentCursor(nextCursor);
    load(nextCursor, applied);
  }

  function prevPage(): void {
    if (prevCursors.length === 0) return;
    const prev = prevCursors[prevCursors.length - 1];
    setPrevCursors((p) => p.slice(0, -1));
    const resumeCursor = prev === '' ? null : prev;
    setCurrentCursor(resumeCursor);
    load(resumeCursor, applied);
  }

  function exportCsv(): void {
    window.location.assign(edgeApi.auditEventsCsvUrl(applied));
  }

  /* Collect the event types seen on the current page as the multiselect
   * options. For a fresh deployment this will start empty; once the page
   * populates, the operator can narrow from there. A richer version
   * would hit a dedicated /distinct-event-types endpoint. */
  const knownTypes = Array.from(new Set((events ?? []).map((e) => e.eventType))).sort();

  if (err && !events) return <ErrorBlock title="Audit trail failed"
                                          testId="err-audit-trail">{err}</ErrorBlock>;
  const activeFilterCount = [
    applied.from, applied.to, applied.actorUserId, applied.subjectUserId,
  ].filter(Boolean).length + (applied.eventTypes?.length ?? 0);

  return (
    <div className="ea-screen" data-test="audit-trail">
      <SyncStatusBar
        tone="info"
        title="Audit trail"
        statusLabel={events == null ? 'Loading…'
          : `${events.length} row${events.length === 1 ? '' : 's'} · page ${prevCursors.length + 1}`}
        subtitle={
          <>
            <span>security_audit stream · hash-chained</span>
            {activeFilterCount > 0 && (<><span>·</span>
              <span>{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>
            </>)}
          </>
        }
        actions={
          <>
            <Link to="/audit/verify" className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Security"
                  data-test="audit-trail-open-verify">
              <UiIcon icon="audit" size={14} />
              <span>Hash chain</span>
            </Link>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="audit-trail-export-csv"
                    onClick={exportCsv}>
              <UiIcon icon="restore" size={14} />
              <span>Export CSV</span>
            </button>
          </>
        }
      />

      <Panel title="Filters"
             action={
               <div style={{ display: 'flex', gap: 6 }}>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-quick-24h"
                         onClick={() => quickRange(24)}>Last 24h</button>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-quick-7d"
                         onClick={() => quickRange(24 * 7)}>Last 7d</button>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-quick-30d"
                         onClick={() => quickRange(24 * 30)}>Last 30d</button>
               </div>
             }>
        <div className="ea-audit-filters">
          <label className="ea-field">
            <span className="ea-field-label">From</span>
            <input type="datetime-local" className="ea-input"
                   data-test="audit-trail-from"
                   value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
          </label>
          <label className="ea-field">
            <span className="ea-field-label">To</span>
            <input type="datetime-local" className="ea-input"
                   data-test="audit-trail-to"
                   value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
          </label>
          <label className="ea-field">
            <span className="ea-field-label">Actor uid</span>
            <input className="ea-input ea-mono"
                   data-test="audit-trail-actor"
                   value={draftActor}
                   placeholder="UUID"
                   onChange={(e) => setDraftActor(e.target.value)} />
          </label>
          <label className="ea-field">
            <span className="ea-field-label">Subject uid</span>
            <input className="ea-input ea-mono"
                   data-test="audit-trail-subject"
                   value={draftSubject}
                   placeholder="UUID"
                   onChange={(e) => setDraftSubject(e.target.value)} />
          </label>
        </div>
        {knownTypes.length > 0 && (
          <div className="ea-field" style={{ marginTop: 8 }}>
            <span className="ea-field-label">Event types (seen on this page)</span>
            <div className="ea-inline-list" data-test="audit-trail-types">
              {knownTypes.map((t) => {
                const active = draftEventTypes.has(t);
                return (
                  <li key={t}
                      className={'ea-mono' + (active ? ' ea-chip--primary' : '')}
                      data-test={`audit-trail-type-${t}`}
                      onClick={() => toggleType(t)}
                      style={{ cursor: 'pointer',
                               background: active ? 'var(--der-primary-soft)' : undefined,
                               borderColor: active ? 'var(--der-primary)' : undefined }}>
                    {t}
                  </li>
                );
              })}
            </div>
          </div>
        )}
        <div className="ea-mapping-form-actions">
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-test="audit-trail-clear"
                  onClick={clearFilters}>Clear</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  data-test="audit-trail-apply"
                  onClick={applyFilters}>Apply</button>
        </div>
      </Panel>

      {err && (
        <ErrorBlock title="Audit page failed"
                     testId="err-audit-trail-page">{err}</ErrorBlock>
      )}

      <Panel title="Events"
             action={
               <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-prev"
                         disabled={prevCursors.length === 0 || loading}
                         onClick={prevPage}>← Prev</button>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-next"
                         disabled={nextCursor == null || loading}
                         onClick={nextPage}>Next →</button>
               </div>
             }>
        {events == null
          ? <LoadingBlock testId="audit-trail-loading" />
          : events.length === 0
            ? <EmptyBlock title="No events"
                           testId="audit-trail-empty">
                No audit events match this filter.
              </EmptyBlock>
            : (
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense"
                       data-test="audit-trail-table">
                  <thead><tr>
                    <th>Observed</th>
                    <th>Event</th>
                    <th>Outcome</th>
                    <th>Actor</th>
                    <th>Subject</th>
                    <th>Client</th>
                  </tr></thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.auditId}
                          data-test={`audit-trail-row-${e.auditId}`}>
                        <td className="ea-mono" style={{ fontSize: 12 }}>
                          {new Date(e.observedAt).toLocaleString()}
                        </td>
                        <td className="ea-mono">{e.eventType}</td>
                        <td>
                          <Status tone={e.outcome === 'SUCCESS' ? 'success'
                            : e.outcome === 'ERROR' ? 'danger' : 'warning'}>
                            {e.outcome}
                          </Status>
                        </td>
                        <td className="ea-mono ea-text-muted"
                            style={{ fontSize: 11 }}>
                          {e.actorUserId?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="ea-mono ea-text-muted"
                            style={{ fontSize: 11 }}>
                          {e.subjectUserId?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="ea-mono ea-text-muted"
                            style={{ fontSize: 12 }}>
                          {e.clientIp ?? '—'}
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

