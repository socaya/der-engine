import { useCallback, useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel, fmtAgo } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/** Relationships subsystem diagnostics (spec §REL-S-015 / §REL-S-016,
 *  server slice D6). Admin-only view of:
 *   - Metadata inventory (how many relationship types catalogued,
 *     split by sourceSystem class, how many carry directional names)
 *   - Instance inventory (live + soft-deleted rows, grouped by
 *     sync_status × rel_class)
 *   - Attention queue (the N most recent rows in FAILED / BLOCKED /
 *     CONFLICT with enough context for triage)
 *
 *  The endpoint is read-only. A "Refresh" affordance re-runs the
 *  fetch on demand (no polling — relationships volume on a single
 *  edge is low enough that stale-on-visit is acceptable). */
export function RelationshipDiagnostics(): JSX.Element {
  const [data, setData] =
    useState<edgeApi.RelationshipDiagnostics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  /** Per-panel selection sets for bulk actions. Separate so an
   *  operator can't accidentally apply a tombstone action to an
   *  attention row and vice versa. */
  const [selAttn, setSelAttn] = useState<Set<string>>(new Set());
  const [selTomb, setSelTomb] = useState<Set<string>>(new Set());

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true); setErr(null);
    try {
      setData(await edgeApi.relationshipDiagnostics(50));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload().catch(() => undefined); }, [reload]);

  async function doBulk(
    action: 'retry' | 'ack' | 'purge',
    uids: ReadonlyArray<string>,
    clearFn: () => void,
  ): Promise<void> {
    if (uids.length === 0) return;
    const fn = action === 'retry' ? edgeApi.relationshipBulkRetry
             : action === 'ack'   ? edgeApi.relationshipBulkAck
             :                      edgeApi.relationshipBulkPurge;
    setActionBusy('bulk:' + action);
    setActionMsg(null); setActionErr(null);
    try {
      const res = await fn(uids);
      let msg = `bulk ${action}: ${res.succeeded}/${res.total} ok`;
      if (res.failed > 0) {
        const errs = res.results.filter((r) => !r.ok)
          .slice(0, 3)
          .map((r) => `${r.relationshipUid}:${r.error ?? '?'}`)
          .join(', ');
        msg += ` · ${res.failed} failed (${errs}`
          + (res.failed > 3 ? ', …' : '') + ')';
      }
      setActionMsg(msg);
      clearFn();
      await reload();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  }

  async function doAction(
    action: 'retry' | 'ack' | 'purge', uid: string,
  ): Promise<void> {
    const fn = action === 'retry' ? edgeApi.relationshipRetry
             : action === 'ack'   ? edgeApi.relationshipAck
             :                      edgeApi.relationshipPurge;
    setActionBusy(action + ':' + uid);
    setActionMsg(null); setActionErr(null);
    try {
      const res = await fn(uid);
      setActionMsg(`${res.action} on ${res.relationshipUid}`
        + (res.syncStatus ? ` → ${res.syncStatus}` : '')
        + (res.purgedRowCount !== undefined
          ? ` (purged ${res.purgedRowCount} row`
            + (res.purgedRowCount === 1 ? '' : 's') + ')'
          : ''));
      await reload();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  }

  if (loading && !data) {
    return <LoadingBlock testId="reldiag-loading" />;
  }
  if (err && !data) {
    return (
      <ErrorBlock testId="reldiag-err"
                   title="Could not load relationship diagnostics">
        {err}
      </ErrorBlock>
    );
  }
  if (!data) return <></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column',
      gap: 16, padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'baseline',
        gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          Relationships diagnostics
        </h1>
        <span style={{ color: '#5b6478', fontSize: 13 }}>
          as of {fmtAgo(data.asOf)}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button"
                data-test="reldiag-refresh"
                onClick={() => { void reload(); }}
                disabled={loading}
                style={{ padding: '6px 14px', fontSize: 13,
                  background: '#147cd7', color: '#fff',
                  border: 0, borderRadius: 3, cursor: 'pointer' }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <Panel title="Metadata inventory">
        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16 }}>
          <StatCard label="Types catalogued"
                     value={String(data.metadata.total)} />
          <StatCard label="With directional names"
                     value={`${data.metadata.withDirectionalNames}`
                       + ` / ${data.metadata.total}`}
                     hint="Admins should set fromToName / toFromName
                       in DHIS2 for operator-friendly labels." />
          <StatCard label="By class" value={
            data.metadata.byClass.map((r) => `${r.relClass}: ${r.count}`)
              .join(' · ') || 'none'} />
        </div>
      </Panel>

      <Panel title="Instance inventory">
        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16, marginBottom: 12 }}>
          <StatCard label="Live rows"
                     value={String(data.instances.live)} />
          <StatCard label="Soft-deleted tombstones"
                     value={String(data.instances.softDeleted)}
                     hint={data.instances.softDeleted > 0
                       ? 'Awaiting central DELETE then purge.'
                       : 'None — all deletes have purged.'} />
          <StatCard label="States in use" value={
            Array.from(new Set(data.instances.byStatusAndClass
              .map((r) => r.syncStatus))).join(' · ') || 'none'} />
        </div>
        {data.instances.byStatusAndClass.length === 0 ? (
          <p style={{ color: '#5b6478' }}>No relationship rows yet.</p>
        ) : (
          <table data-test="reldiag-instances-table"
                 style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left',
                borderBottom: '1px solid #d9dde6' }}>
                <th style={{ padding: '8px 10px', fontSize: 13 }}>
                  Sync status
                </th>
                <th style={{ padding: '8px 10px', fontSize: 13 }}>
                  Class
                </th>
                <th style={{ padding: '8px 10px', fontSize: 13,
                  textAlign: 'right' }}>
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {data.instances.byStatusAndClass.map((r) => (
                <tr key={r.syncStatus + '/' + r.relClass}
                    style={{ borderBottom: '1px solid #ebeef3' }}>
                  <td style={{ padding: '8px 10px', fontSize: 13 }}>
                    <SyncPill status={r.syncStatus} />
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13,
                    color: '#5b6478' }}>
                    {r.relClass}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums' }}>
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {(actionMsg || actionErr) && (
        <div style={{ padding: '10px 14px', borderRadius: 4,
          background: actionErr ? '#fde3e3' : '#e3f7eb',
          color: actionErr ? '#c13030' : '#1b8243',
          fontSize: 13 }}
             data-test="reldiag-action-status">
          {actionErr ?? actionMsg}
        </div>
      )}

      <Panel title={`Attention queue (${data.attention.length})`}
             action={data.attention.length === 0 ? undefined : (
               <span style={{ color: '#5b6478', fontSize: 13 }}>
                 Showing the 50 most recent FAILED / BLOCKED /
                 CONFLICT rows. Retry re-enqueues the drain;
                 Acknowledge marks SYNCED without a central
                 round-trip.
               </span>)}>
        {selAttn.size > 0 && (
          <BulkBar count={selAttn.size}
                    actions={[
                      { kind: 'retry', label: 'Retry selected' },
                      { kind: 'ack',   label: 'Acknowledge selected' },
                    ]}
                    busy={actionBusy}
                    onApply={(k) => doBulk(k,
                      Array.from(selAttn),
                      () => setSelAttn(new Set()))}
                    onClear={() => setSelAttn(new Set())} />
        )}
        {data.attention.length === 0 ? (
          <p style={{ color: '#5b6478' }}>
            Nothing needs attention — all live rows are SYNCED,
            PENDING or LOCAL.
          </p>
        ) : (
          <table data-test="reldiag-attention-table"
                 style={{ width: '100%', borderCollapse: 'collapse',
                   fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left',
                borderBottom: '1px solid #d9dde6' }}>
                <th style={{ padding: '8px 10px', width: 28 }}>
                  <input type="checkbox"
                         data-test="reldiag-attn-selectall"
                         checked={selAttn.size > 0
                           && selAttn.size === data.attention.length}
                         ref={(el) => {
                           if (el) el.indeterminate = selAttn.size > 0
                             && selAttn.size < data.attention.length;
                         }}
                         onChange={(e) => setSelAttn(
                           e.target.checked
                             ? new Set(data.attention.map(
                                 (r) => r.relationshipUid))
                             : new Set())} />
                </th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Type</th>
                <th style={{ padding: '8px 10px' }}>From</th>
                <th style={{ padding: '8px 10px' }}>To</th>
                <th style={{ padding: '8px 10px' }}>Class</th>
                <th style={{ padding: '8px 10px' }}>Updated</th>
                <th style={{ padding: '8px 10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.attention.map((r) => (
                <tr key={r.relationshipUid}
                    style={{ borderBottom: '1px solid #ebeef3',
                      background: selAttn.has(r.relationshipUid)
                        ? '#eef4fa' : undefined }}>
                  <td style={{ padding: '8px 10px' }}>
                    <input type="checkbox"
                           data-test={'reldiag-attn-sel-'
                             + r.relationshipUid}
                           checked={selAttn.has(r.relationshipUid)}
                           onChange={(e) => {
                             const next = new Set(selAttn);
                             if (e.target.checked) {
                               next.add(r.relationshipUid);
                             } else {
                               next.delete(r.relationshipUid);
                             }
                             setSelAttn(next);
                           }} />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <SyncPill status={r.syncStatus} />
                  </td>
                  <td style={{ padding: '8px 10px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    color: '#5b6478' }}>
                    {r.relationshipType}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: '#5b6478' }}>
                      {r.fromEntityType}
                    </span>
                    {' '}
                    <code style={{ fontSize: 12 }}>
                      {r.fromEntityUid}
                    </code>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: '#5b6478' }}>
                      {r.toEntityType}
                    </span>
                    {' '}
                    <code style={{ fontSize: 12 }}>
                      {r.toEntityUid}
                    </code>
                  </td>
                  <td style={{ padding: '8px 10px',
                    color: '#5b6478' }}>
                    {r.relClass}
                  </td>
                  <td style={{ padding: '8px 10px',
                    color: '#5b6478' }}>
                    {fmtAgo(r.updatedAt)}
                  </td>
                  <td style={{ padding: '8px 10px',
                    whiteSpace: 'nowrap' }}>
                    <ActionButton kind="retry"
                                   uid={r.relationshipUid}
                                   busy={actionBusy}
                                   onClick={doAction} />
                    {' '}
                    <ActionButton kind="ack"
                                   uid={r.relationshipUid}
                                   busy={actionBusy}
                                   onClick={doAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={`Soft-deleted tombstones (${data.tombstones.length})`}
             action={data.tombstones.length === 0 ? undefined : (
               <span style={{ color: '#5b6478', fontSize: 13 }}>
                 Rows unlinked by the operator but not yet
                 physically purged (usually waiting on a
                 central DELETE round-trip). Purge removes the
                 row from the device.
               </span>)}>
        {selTomb.size > 0 && (
          <BulkBar count={selTomb.size}
                    actions={[
                      { kind: 'purge', label: 'Purge selected' },
                    ]}
                    busy={actionBusy}
                    onApply={(k) => doBulk(k,
                      Array.from(selTomb),
                      () => setSelTomb(new Set()))}
                    onClear={() => setSelTomb(new Set())} />
        )}
        {data.tombstones.length === 0 ? (
          <p style={{ color: '#5b6478' }}>
            No tombstones — every unlinked row has been
            physically purged.
          </p>
        ) : (
          <table data-test="reldiag-tombstones-table"
                 style={{ width: '100%', borderCollapse: 'collapse',
                   fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left',
                borderBottom: '1px solid #d9dde6' }}>
                <th style={{ padding: '8px 10px', width: 28 }}>
                  <input type="checkbox"
                         data-test="reldiag-tomb-selectall"
                         checked={selTomb.size > 0
                           && selTomb.size === data.tombstones.length}
                         ref={(el) => {
                           if (el) el.indeterminate = selTomb.size > 0
                             && selTomb.size < data.tombstones.length;
                         }}
                         onChange={(e) => setSelTomb(
                           e.target.checked
                             ? new Set(data.tombstones.map(
                                 (r) => r.relationshipUid))
                             : new Set())} />
                </th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Type</th>
                <th style={{ padding: '8px 10px' }}>From</th>
                <th style={{ padding: '8px 10px' }}>To</th>
                <th style={{ padding: '8px 10px' }}>Deleted</th>
                <th style={{ padding: '8px 10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.tombstones.map((r) => (
                <tr key={r.relationshipUid}
                    style={{ borderBottom: '1px solid #ebeef3',
                      background: selTomb.has(r.relationshipUid)
                        ? '#eef4fa' : undefined }}>
                  <td style={{ padding: '8px 10px' }}>
                    <input type="checkbox"
                           data-test={'reldiag-tomb-sel-'
                             + r.relationshipUid}
                           checked={selTomb.has(r.relationshipUid)}
                           onChange={(e) => {
                             const next = new Set(selTomb);
                             if (e.target.checked) {
                               next.add(r.relationshipUid);
                             } else {
                               next.delete(r.relationshipUid);
                             }
                             setSelTomb(next);
                           }} />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <SyncPill status={r.syncStatus} />
                  </td>
                  <td style={{ padding: '8px 10px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    color: '#5b6478' }}>
                    {r.relationshipType}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: '#5b6478' }}>
                      {r.fromEntityType}
                    </span>
                    {' '}
                    <code style={{ fontSize: 12 }}>
                      {r.fromEntityUid}
                    </code>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: '#5b6478' }}>
                      {r.toEntityType}
                    </span>
                    {' '}
                    <code style={{ fontSize: 12 }}>
                      {r.toEntityUid}
                    </code>
                  </td>
                  <td style={{ padding: '8px 10px',
                    color: '#5b6478' }}>
                    {fmtAgo(r.deletedAt)}
                  </td>
                  <td style={{ padding: '8px 10px',
                    whiteSpace: 'nowrap' }}>
                    <ActionButton kind="purge"
                                   uid={r.relationshipUid}
                                   busy={actionBusy}
                                   onClick={doAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

/** Bulk-action bar above the attention / tombstone tables.
 *  Renders only when the parent panel has a non-empty selection
 *  set. One button per applicable action plus a Clear button. */
function BulkBar({ count, actions, busy, onApply, onClear }: {
  count: number;
  actions: ReadonlyArray<{
    kind: 'retry' | 'ack' | 'purge';
    label: string;
  }>;
  busy: string | null;
  onApply: (kind: 'retry' | 'ack' | 'purge') => Promise<void>;
  onClear: () => void;
}): JSX.Element {
  const anyBusy = busy !== null;
  return (
    <div data-test="reldiag-bulkbar"
         style={{ display: 'flex', alignItems: 'center',
           gap: 10, padding: '8px 12px', marginBottom: 10,
           background: '#eef4fa',
           border: '1px solid #cde0f3',
           borderRadius: 4, fontSize: 13 }}>
      <strong>{count} selected</strong>
      <span style={{ flex: 1 }} />
      {actions.map((a) => {
        const thisBusy = busy === 'bulk:' + a.kind;
        return (
          <button key={a.kind} type="button"
                  data-test={`reldiag-bulk-${a.kind}`}
                  disabled={anyBusy}
                  onClick={() => { void onApply(a.kind); }}
                  style={{ padding: '4px 12px', fontSize: 13,
                    border: '1px solid #147cd7',
                    background: thisBusy ? '#cde0f3' : '#fff',
                    color: '#147cd7', borderRadius: 3,
                    cursor: anyBusy ? 'default' : 'pointer' }}>
            {thisBusy ? '…' : a.label}
          </button>
        );
      })}
      <button type="button"
              data-test="reldiag-bulk-clear"
              disabled={anyBusy}
              onClick={onClear}
              style={{ padding: '4px 10px', fontSize: 13,
                border: 0, background: 'transparent',
                color: '#5b6478',
                cursor: anyBusy ? 'default' : 'pointer' }}>
        Clear
      </button>
    </div>
  );
}

function ActionButton({ kind, uid, busy, onClick }: {
  kind: 'retry' | 'ack' | 'purge';
  uid: string;
  busy: string | null;
  onClick: (k: 'retry' | 'ack' | 'purge', u: string)
    => Promise<void>;
}): JSX.Element {
  const isBusy = busy === kind + ':' + uid;
  const label = kind === 'retry' ? 'Retry'
              : kind === 'ack'   ? 'Acknowledge'
              :                    'Purge';
  const title = kind === 'retry'
      ? 'Re-enqueue a drain attempt for this relationship.'
      : kind === 'ack'
      ? 'Mark SYNCED without a central round-trip — use when '
        + 'central already has this row.'
      : 'Physically delete this soft-deleted tombstone.';
  return (
    <button type="button"
            data-test={`reldiag-${kind}-${uid}`}
            title={title}
            disabled={busy !== null}
            onClick={() => { void onClick(kind, uid); }}
            style={{ padding: '3px 10px', fontSize: 12,
              border: '1px solid #d9dde6',
              background: isBusy ? '#f8f9fb' : '#fff',
              color: '#101a32', borderRadius: 3,
              cursor: busy === null ? 'pointer' : 'default' }}>
      {isBusy ? '…' : label}
    </button>
  );
}

function StatCard({ label, value, hint }: {
  label: string; value: string; hint?: string;
}): JSX.Element {
  return (
    <div style={{ background: '#f8f9fb',
      border: '1px solid #ebeef3', borderRadius: 4,
      padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color: '#5b6478' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500,
        color: '#101a32', marginTop: 4,
        fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 12, color: '#5b6478',
          marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

function SyncPill({ status }: { status: string }): JSX.Element {
  const [bg, fg] =
      status === 'SYNCED'   ? ['#e3f7eb', '#1b8243']
    : status === 'PENDING'  ? ['#fef0d8', '#9b5a00']
    : status === 'LOCAL'    ? ['#eef0f5', '#5b6478']
    : status === 'FAILED'   ? ['#fde3e3', '#c13030']
    : status === 'BLOCKED'  ? ['#fde3e3', '#c13030']
    : status === 'CONFLICT' ? ['#fef0d8', '#9b5a00']
    : ['#eef0f5', '#5b6478'];
  return (
    <span style={{ display: 'inline-block',
      background: bg, color: fg,
      padding: '1px 8px', borderRadius: 10,
      fontSize: 12, fontWeight: 500 }}>
      {status}
    </span>
  );
}
