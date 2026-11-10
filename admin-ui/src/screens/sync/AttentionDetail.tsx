import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, entityTypeLabel, metadataResourceForEntity, dataModuleRouteForEntity, dataModuleLabelForEntity, SyncStatusBar, BackLink } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ResponseBody } from '../../components/ResponseBody';
import { InlineLoading, LoadingBlock } from '../../components/ScreenStates';
import { problemFor, priorityFor } from './AttentionList';

type ConflictStrategy = 'ACCEPT' | 'REJECT' | 'REJOURNAL';

const STRATEGY_LABELS: Record<ConflictStrategy,
    { title: string; summary: string }> = {
  ACCEPT: {
    title: 'Accept local',
    summary: 'Mark the local version as applied without pushing it again. Central keeps whatever it currently has.',
  },
  REJECT: {
    title: 'Reject local',
    summary: 'Discard the local version. The record is marked as rejected and will not be retried.',
  },
  REJOURNAL: {
    title: 'Retry (re-journal)',
    summary: 'Clone this operation as a fresh PENDING entry so the sync worker tries again on the next drain tick.',
  },
};

export function AttentionDetailScreen(): JSX.Element {
  const { operationId } = useParams<{ operationId: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<edgeApi.ConflictRow | null>(null);
  const [strategy, setStrategy] = useState<ConflictStrategy | null>(null);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const all = await edgeApi.listConflicts(500);
        const match = all.find((r) => r.operationId === operationId);
        if (!match) { setErr('Attention item not found.'); return; }
        setRow(match);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [operationId]);

  /* Rationale is required for the two finalising paths (ACCEPT/REJECT)
   * because the DB stores it on resolve for operator-audit purposes.
   * REJOURNAL ignores the rationale server-side, so we don't enforce it
   * there. Min 10 chars to force a real explanation. */
  function rationaleOk(): boolean {
    if (strategy === 'REJOURNAL') return true;
    return rationale.trim().length >= 10;
  }

  async function submit(): Promise<void> {
    if (!row || !strategy || !rationaleOk()) return;
    const label = STRATEGY_LABELS[strategy].title.toLowerCase();
    if (!window.confirm(
      `${STRATEGY_LABELS[strategy].title} on `
      + `${entityTypeLabel(row.entityType)} "${row.entityRef}"?\n\n`
      + `This resolution is recorded in the audit log and ${label} cannot be undone.`)) return;
    setBusy(true); setActionErr(null);
    try {
      if (strategy === 'REJOURNAL') {
        await edgeApi.reJournalConflict(row.operationId);
      } else {
        const outcome = strategy === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        await edgeApi.resolveConflict(row.operationId, outcome, rationale.trim());
      }
      navigate('/sync/attention');
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (err) return (
    <div className="ea-screen">
      <BackLink to="/sync/attention" label="Back to attention list" />
      <SyncStatusBar tone="danger" title="Not found" statusLabel="Error"
                     subtitle={<span>{err}</span>} />
    </div>
  );
  if (!row) return <LoadingBlock testId="loading" />;
  const problem = problemFor(row);
  const prio = priorityFor(row);
  return (
    <div className="ea-screen" data-test="conflict-detail">
      <BackLink to="/sync/attention" label="Back to attention list" />
      <SyncStatusBar
        tone={prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info'}
        title={`${entityTypeLabel(row.entityType)} · ${row.entityRef}`}
        statusLabel={prio + ' priority'}
        subtitle={<span>{problem.label}</span>}
        actions={
          <>
            {/* §2.3.80 R-B/1 — deep-link to the DHIS2 metadata schema
                that defines this entity. Resolves nothing for generic
                METADATA ops (returns null), so we only render when a
                mapping exists. */}
            {(() => {
              const res = metadataResourceForEntity(row.entityType);
              if (!res) return null;
              return (
                <Link to={`/dhis2/metadata?resource=${res}`}
                       className="ea-btn ea-btn--ghost ea-btn--sm"
                       title={`Open DHIS2 metadata · ${res}`}>
                  <UiIcon icon="metadata" size={14} />
                  <span>DHIS2 metadata</span>
                </Link>
              );
            })()}
            {/* §2.3.91 R-D/1 — backlink to the Data module where the
                failing row lives locally. For TEI/enrolment ops we
                carry the entityRef as a teiUid so the Tracker browse
                opens scoped. */}
            {(() => {
              const route = dataModuleRouteForEntity(row.entityType);
              if (!route) return null;
              const et = row.entityType?.toUpperCase() ?? '';
              let to = route;
              if (et === 'TRACKED_ENTITY' || et === 'TRACKED_ENTITY_INSTANCE'
                  || et === 'TEI') {
                to = `${route}?teiUid=${encodeURIComponent(row.entityRef)}`;
              }
              return (
                <Link to={to}
                       className="ea-btn ea-btn--ghost ea-btn--sm"
                       title={`Open the Data module row that produced this operation`}>
                  <UiIcon icon="activity" size={14} />
                  <span>{dataModuleLabelForEntity(row.entityType)}</span>
                </Link>
              );
            })()}
          </>
        }
      />
      <Panel title="Problem">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{problem.label}</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--der-ink-700)', lineHeight: 1.5 }}>
          {problem.summary}
        </p>
      </Panel>
      <Panel title="Resolution">
        {actionErr && (
          <div className="ea-callout ea-callout--danger"
               role="alert" data-test="conflict-resolve-err">{actionErr}</div>
        )}
        <fieldset className="ea-field" data-test="conflict-strategy">
          <legend className="ea-field-label">Strategy</legend>
          <div className="ea-radio-group">
            {(['ACCEPT', 'REJECT', 'REJOURNAL'] as const).map((s) => (
              <label key={s} className="ea-radio">
                <input type="radio" name="conflict-strategy"
                       data-test={`conflict-strategy-${s.toLowerCase()}`}
                       value={s} checked={strategy === s}
                       onChange={() => setStrategy(s)} />
                <span>
                  <strong>{STRATEGY_LABELS[s].title}</strong>
                  <span className="ea-text-muted" style={{ marginLeft: 8 }}>
                    — {STRATEGY_LABELS[s].summary}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {strategy && strategy !== 'REJOURNAL' && (
          <div className="ea-field">
            <label className="ea-field-label" htmlFor="conflict-rationale">
              Rationale
            </label>
            <textarea id="conflict-rationale"
                      data-test="conflict-rationale"
                      className="ea-input"
                      rows={3}
                      value={rationale}
                      maxLength={2000}
                      onChange={(e) => setRationale(e.target.value)} />
            <span className="ea-field-hint">
              {rationale.trim().length < 10
                ? `Min 10 chars (${rationale.trim().length} entered).`
                : `${rationale.trim().length} chars.`}
            </span>
          </div>
        )}

        {strategy && (
          <div className="ea-callout ea-callout--info"
               data-test="conflict-preview">
            <strong>Preview:</strong> {STRATEGY_LABELS[strategy].summary}
          </div>
        )}

        <div className="ea-mapping-form-actions">
          <button type="button" className="ea-btn ea-btn--primary"
                  data-test="conflict-submit"
                  disabled={busy || strategy == null || !rationaleOk()}
                  onClick={() => { submit().catch(() => undefined); }}>
            {busy ? 'Submitting…' : 'Resolve conflict'}
          </button>
        </div>
      </Panel>
      <TeiUidMigrationPanel row={row}
                             onMigrated={() => navigate('/sync/attention')} />
      <Panel title="Record">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Entity type</dt>
            <dd>{entityTypeLabel(row.entityType)} <span className="ea-mono ea-text-muted">({row.entityType})</span></dd></div>
          <div className="ea-def-row"><dt>Entity ref</dt><dd className="ea-mono">{row.entityRef}</dd></div>
          <div className="ea-def-row"><dt>Priority</dt>
            <dd><span className={'ea-chip ea-chip--'
                + (prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info')}>{prio}</span></dd></div>
          <div className="ea-def-row"><dt>Attempts</dt><dd className="ea-mono">{row.attemptCount}</dd></div>
          <div className="ea-def-row"><dt>First queued</dt><dd className="ea-mono">{fmtDate(row.createdAt)}</dd></div>
          <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(row.createdAt)}</dd></div>
          <div className="ea-def-row"><dt>Operation ID</dt>
            <dd className="ea-mono" style={{ fontSize: 10 }}>{row.operationId}</dd></div>
        </dl>
      </Panel>
      <CentralValuePanel operationId={row.operationId} localPayload={row.payload} />
    </div>
  );
}

/** SM-3a — surfaced on attention rows whose central rejection was
 *  caused by a legacy UUID-shaped TEI UID ("UID must be an
 *  alphanumeric string of 11 characters…"). Lets the operator mint
 *  a DHIS2-shaped UID for the TEI + requeue every row that was
 *  stuck on it, without a shell / SQL trip.
 *
 *  <p>Only renders when the row's error signals the UID shape or
 *  when the TEI UID carried in the entity_ref / payload is itself
 *  a UUID. For non-TRACKED_ENTITY entity types we read teiUid from
 *  the payload (ENROLLMENT, PROGRAM_STAGE_EVENT payloads carry
 *  it).</p> */
function TeiUidMigrationPanel(
  { row, onMigrated }:
    { row: edgeApi.ConflictRow; onMigrated: () => void },
): JSX.Element | null {
  const [newUid, setNewUid] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<edgeApi.TeiMigrateResult | null>(null);

  const legacyTeiUid: string | null = (() => {
    const isLegacy = (s: string | null | undefined): boolean =>
      !!s && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
    if (isLegacy(row.entityRef)
        && row.entityType.toUpperCase() === 'TRACKED_ENTITY') {
      return row.entityRef;
    }
    const p = row.payload ?? {};
    const candidates = ['teiUid', 'trackedEntity', 'trackedEntityUid'];
    for (const k of candidates) {
      const v = (p as Record<string, unknown>)[k];
      if (typeof v === 'string' && isLegacy(v)) return v;
    }
    return null;
  })();

  const errorMentionsUidShape = !!row.lastError
      && /UID must be an alphanumeric string of 11 characters/i
        .test(row.lastError);

  if (!legacyTeiUid && !errorMentionsUidShape) return null;
  if (!legacyTeiUid) return null;

  async function run(): Promise<void> {
    if (!legacyTeiUid) return;
    if (!window.confirm(
        `Migrate TEI UID\n  from ${legacyTeiUid}\n  to   `
      + `${newUid.trim() || '(server-minted)'}\n\n`
      + 'This rewrites the UID across every table + journal row that '
      + 'references it, and re-queues any rows stuck on the legacy '
      + 'UID. The change is transactional but irreversible.')) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await edgeApi.migrateTeiUid(legacyTeiUid,
          newUid.trim() || undefined);
      setPreview(res);
      setTimeout(() => onMigrated(), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Legacy UID migration">
      <p className="ea-text-muted" style={{ margin: '0 0 10px',
                                             fontSize: 12 }}>
        This TEI's UID is a 36-char UUID left over from a pre-fix
        install. Central rejects it on every drain. Mint a valid
        DHIS2 UID to unblock sync for this TEI and everything that
        references it.
      </p>
      <div style={{ fontSize: 12, marginBottom: 10 }}>
        <strong>Legacy UID:</strong>{' '}
        <code>{legacyTeiUid}</code>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center',
                       flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, minWidth: 100 }}>New UID</span>
        <input value={newUid}
               onChange={(e) => setNewUid(e.target.value)}
               placeholder="(leave blank to let the server mint one)"
               data-test="tei-migrate-newuid"
               style={{ flex: 1, minWidth: 220, padding: '4px 8px',
                         fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                         fontSize: 13,
                         border: '1px solid var(--der-border-soft, #cbd5e1)',
                         borderRadius: 4 }} />
      </label>
      {err && (
        <div className="ea-callout ea-callout--danger"
             role="alert"
             data-test="tei-migrate-err"
             style={{ marginBottom: 8 }}>{err}</div>
      )}
      {preview && (
        <div className="ea-callout ea-callout--info"
             data-test="tei-migrate-ok"
             style={{ marginBottom: 8 }}>
          <strong>Migrated.</strong> {preview.oldUid} → {preview.newUid}.{' '}
          {Object.entries(preview.affected).map(
            ([k, v]) => `${k}=${v}`).join(', ')}.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button"
                className="ea-btn ea-btn--primary"
                data-test="tei-migrate-run"
                disabled={busy}
                onClick={() => { void run(); }}>
          {busy ? 'Migrating…' : 'Migrate TEI UID'}
        </button>
      </div>
    </Panel>
  );
}

/** Phase 13.4 — side-by-side payload comparison. Local payload left,
 *  central's response right. Collapses gracefully when central has
 *  never responded (fresh CONFLICT_REVIEW from pull-time collision
 *  rather than drain-time rejection). */
function CentralValuePanel(
  { operationId, localPayload }:
    { operationId: string; localPayload: Record<string, unknown> | null | undefined },
): JSX.Element | null {
  const [central, setCentral] = useState<edgeApi.ConflictCentralResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    edgeApi.fetchConflictCentralResponse(operationId)
      .then((r) => { if (alive) setCentral(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [operationId]);
  if (err) return (
    <Panel title="Central value" >
      <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>Failed to load: {err}</p>
    </Panel>
  );
  if (!central) return (
    <Panel title="Central value">
      <InlineLoading />
    </Panel>
  );
  const hasCentral = central.lastResponse != null
    || (central.lastResponseRaw != null && central.lastResponseRaw.length > 0);
  return (
    <Panel title="Side-by-side payload">
      {!hasCentral && (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
          Central hasn&apos;t produced a response for this row yet — the conflict was
          raised at pull time (central&apos;s version differs from the operator&apos;s
          in-flight edit) rather than at drain time (central rejected the push).
          Only the local payload shown.
        </p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasCentral ? '1fr 1fr' : '1fr',
        gap: 12, marginTop: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4,
                         color: 'var(--der-ink-500)',
                         textTransform: 'uppercase' }}>Local</div>
          <pre className="ea-mono" style={{ fontSize: 11, lineHeight: 1.4,
                                              background: 'var(--der-canvas, #f8fafc)',
                                              padding: 10, borderRadius: 6,
                                              border: '1px solid var(--der-border)',
                                              whiteSpace: 'pre-wrap',
                                              wordBreak: 'break-word',
                                              margin: 0 }}>
            {JSON.stringify(localPayload ?? {}, null, 2)}
          </pre>
        </div>
        {hasCentral && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4,
                           color: 'var(--der-ink-500)',
                           textTransform: 'uppercase' }}>Central</div>
            <pre className="ea-mono" style={{ fontSize: 11, lineHeight: 1.4,
                                                background: 'var(--der-canvas, #f8fafc)',
                                                padding: 10, borderRadius: 6,
                                                border: '1px solid var(--der-border)',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                margin: 0 }}>
              {central.lastResponse != null
                ? JSON.stringify(central.lastResponse, null, 2)
                : central.lastResponseRaw}
            </pre>
          </div>
        )}
      </div>
      {central.lastError && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--der-ink-700)' }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Last error:</strong>
          <ResponseBody text={central.lastError} />
        </div>
      )}
    </Panel>
  );
}

