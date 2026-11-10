import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, usePaged, TablePager, SyncStatusBar, Status, RelatedMenu } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { MetadataTabBar } from '../../components/MetadataTabBar';

export function DriftInspector(): JSX.Element {
  const [d, setD] = useState<edgeApi.DriftResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  async function reload(refresh = false): Promise<void> {
    try {
      setRefreshing(refresh);
      setD(await edgeApi.drift(refresh));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const perEntity = Object.entries(d?.perEntity ?? {});
  const rowSummaries = perEntity.map(([k, v]) => ({
    entity: k,
    added: v.added.length,
    removed: v.removed.length,
    changed: v.changed.length,
    net: v.added.length + v.removed.length + v.changed.length,
  }));
  const paged = usePaged(rowSummaries, 50);
  const expanded = expandedEntity
    ? d?.perEntity?.[expandedEntity] ?? null
    : null;

  if (err) return <ErrorBlock title="Drift probe failed" testId="err-drift">{err}</ErrorBlock>;
  if (!d) return <LoadingBlock testId="loading" />;

  const equal = d.fingerprintFrom === d.fingerprintTo;
  const totalAdded = rowSummaries.reduce((a, r) => a + r.added, 0);
  const totalRemoved = rowSummaries.reduce((a, r) => a + r.removed, 0);
  const totalModified = rowSummaries.reduce((a, r) => a + r.changed, 0);
  const totalChanged = totalAdded + totalRemoved + totalModified;

  return (
    <div className="ea-screen" data-test="drift-hub">
      <MetadataTabBar />
      <SyncStatusBar
        tone={equal ? 'success' : 'warning'}
        title="Metadata changes"
        statusLabel={equal ? 'In sync' : 'Drift detected'}
        subtitle={
          <>
            <span>Central → DER (one-way)</span>
            <InfoPopover label="About metadata drift">
              <p>
                DHIS2 is the source of truth. This probe hashes DER&apos;s
                mirrored resources against Central&apos;s.
              </p>
              <p>
                A mismatch simply means the next metadata-sync pull will
                update DER. Nothing is ever written back to Central.
              </p>
            </InfoPopover>
            <span>·</span>
            <span>Added <strong style={{ color: 'var(--der-ink-900)' }}>{totalAdded}</strong></span>
            <span>·</span>
            <span>Removed <strong style={{ color: 'var(--der-ink-900)' }}>{totalRemoved}</strong></span>
            <span>·</span>
            <span>Modified <strong style={{ color: 'var(--der-ink-900)' }}>{totalModified}</strong></span>
            <span>·</span>
            <span>Entities <strong style={{ color: 'var(--der-ink-900)' }}>{rowSummaries.length}</strong></span>
            <span>·</span>
            <span>Snapshot <strong style={{ color: 'var(--der-ink-900)' }}>{d.snapshotTo ?? '—'}</strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={refreshing}
                  onClick={() => { reload(true).catch(() => undefined); }}
                  data-test="drift-refresh">
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Refreshing…' : 'Recompute drift'}</span>
          </button>
        }
      />

      <Panel title="Fingerprints"
             action={<Status tone={equal ? 'success' : 'warning'}>{equal ? 'Identical' : 'Different'}</Status>}>
        <div className="ea-drift">
          <div className="ea-drift-side">
            <div className="ea-text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Mirror</div>
            <div className="ea-mono" style={{ wordBreak: 'break-all' }}>{d.fingerprintFrom ?? '—'}</div>
          </div>
          <div className="ea-drift-sep" style={{ color: equal ? 'var(--der-success-ink)' : 'var(--der-warning-ink)',
                                                   fontSize: 20, fontWeight: 700 }}>
            {equal ? '=' : '≠'}
          </div>
          <div className="ea-drift-side">
            <div className="ea-text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Central</div>
            <div className="ea-mono" style={{ wordBreak: 'break-all' }}>{d.fingerprintTo ?? '—'}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Per-entity breakdown"
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>
               {totalChanged.toLocaleString()} delta{totalChanged === 1 ? '' : 's'}
             </span>}>
        {rowSummaries.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No per-entity drift recorded.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable"
                   data-test="drift-table">
              <thead><tr>
                <th>Entity</th><th>Added</th><th>Removed</th><th>Changed</th><th>Net</th>
              </tr></thead>
              <tbody>
                {paged.rows.map((r) => {
                  const active = r.entity === expandedEntity;
                  return (
                    <tr key={r.entity}
                        data-test={`drift-row-${r.entity}`}
                        onClick={() => setExpandedEntity(active ? null : r.entity)}
                        className={active ? 'ea-row-selected' : ''}
                        style={{ cursor: 'pointer' }}>
                      <td>{r.entity}</td>
                      <td className="ea-mono" style={{ color: r.added ? 'var(--der-success-ink)' : undefined }}>{r.added}</td>
                      <td className="ea-mono" style={{ color: r.removed ? 'var(--der-danger-ink)' : undefined }}>{r.removed}</td>
                      <td className="ea-mono" style={{ color: r.changed ? 'var(--der-warning-ink)' : undefined }}>{r.changed}</td>
                      <td className="ea-mono">{r.net}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>

      {expandedEntity && expanded && (
        <Panel title={`Drift detail — ${expandedEntity}`}
               action={
                 <div style={{ display: 'flex', gap: 8 }}>
                   <Link to={`/dhis2/metadata?resource=${encodeURIComponent(expandedEntity)}`}
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-cross-module="DHIS2"
                         data-test="drift-detail-open-metadata">
                     <UiIcon icon="metadata" size={14} />
                     <span>Open in metadata browser</span>
                   </Link>
                   <button type="button"
                           className="ea-btn ea-btn--ghost ea-btn--sm"
                           data-test="drift-detail-close"
                           onClick={() => setExpandedEntity(null)}>
                     Close
                   </button>
                 </div>
               }>
          <dl className="ea-def-list"
              data-test={`drift-detail-${expandedEntity}`}>
            <div className="ea-def-row">
              <dt>Snapshot pair</dt>
              <dd className="ea-mono">
                {d.snapshotFrom ?? '—'} → {d.snapshotTo ?? '—'}
              </dd>
            </div>
            <div className="ea-def-row">
              <dt>Reconciliation</dt>
              <dd className="ea-text-muted">
                Next metadata-sync pull reconciles these IDs. No write-back to Central.
              </dd>
            </div>
          </dl>
          <div className="ea-drift-detail-grid">
            <DriftDetailColumn
              title="Added"
              tone="success"
              ids={expanded.added}
              testId="drift-detail-added" />
            <DriftDetailColumn
              title="Removed"
              tone="danger"
              ids={expanded.removed}
              testId="drift-detail-removed" />
            <DriftDetailColumn
              title="Changed"
              tone="warning"
              ids={expanded.changed}
              testId="drift-detail-changed" />
          </div>
        </Panel>
      )}

      {/* §2.3.107 R-AB — the two cross-module jumps (Metadata Sync,
          Sync History) move into a labelled Related menu so the
          operator sees which module they're entering before clicking.
          The intra-module link (Metadata browser) stays as a plain
          button alongside. */}
      <Panel title="Related">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap',
                       padding: 14, alignItems: 'center' }}>
          <Link to="/dhis2/metadata" className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="DHIS2">
            <UiIcon icon="metadata" size={14} />
            <span>Metadata browser</span>
          </Link>
          <RelatedMenu dataTest="metadata-related" items={[
            { label: 'Metadata sync', module: 'DHIS2', to: '/dhis2/metadata-sync' },
            { label: 'Sync history',  module: 'Sync', to: '/sync/history' },
          ]} />
        </div>
      </Panel>
    </div>
  );
}

/** One column of the per-entity drift detail grid. Shows the first 20
 *  IDs with a +N more collapse — avoids dumping 5000 dataElement UIDs
 *  into the DOM on large drifts. */
function DriftDetailColumn(
  { title, tone, ids, testId }:
    { title: string; tone: 'success' | 'danger' | 'warning';
      ids: string[]; testId: string },
): JSX.Element {
  const limit = 20;
  const shown = ids.slice(0, limit);
  const overflow = Math.max(0, ids.length - limit);
  return (
    <div className="ea-drift-detail-col" data-test={testId}>
      <div className="ea-subheading">
        <Status tone={tone}>{title}</Status>
        <span className="ea-text-muted"
              style={{ marginLeft: 6, fontSize: 11 }}>
          {ids.length}
        </span>
      </div>
      {ids.length === 0 ? (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
          None.
        </p>
      ) : (
        <ul className="ea-inline-list">
          {shown.map((id) => (
            <li key={id} className="ea-mono"
                data-test={`${testId}-id-${id}`}>{id}</li>
          ))}
          {overflow > 0 && (
            <li className="ea-text-muted"
                data-test={`${testId}-more`}>+{overflow} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Quiet info-hint — subtle `i` button that opens a native <details>
 *  popover with the explainer. Keeps the screen header short on first
 *  read; the detail is one click away. */
function InfoPopover({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <details className="ea-info-popover" style={{ position: 'relative', display: 'inline-flex' }}>
      <summary className="ea-info-popover-trigger" aria-label={label}
               title={label}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </summary>
      <div className="ea-info-popover-body" role="tooltip">
        <div className="ea-info-popover-title">{label}</div>
        {children}
      </div>
    </details>
  );
}

