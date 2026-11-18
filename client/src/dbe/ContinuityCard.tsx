import { Card, Tag } from '@dhis2/ui';

import { useContinuity } from './continuity';

/**
 * Detailed breakdown of the DBE continuity envelope. Renders on the
 * Peers screen beneath the mesh sessions card so operators have one
 * place to understand "am I offline-safe right now?".
 *
 * <p>Layout: a dl grid with one row per metric. Keeps the component
 * accessible + prints nicely when operators screenshot a problem.</p>
 */
export function ContinuityCard(): JSX.Element | null {
  const snap = useContinuity();
  if (!snap) return null;

  const persistTag = snap.storage.persistent
    ? <Tag className="der-continuity-ok">Persistent</Tag>
    : <Tag className="der-continuity-warn">Best-effort</Tag>;
  const serverTag = snap.serverReachable
    ? <Tag className="der-continuity-ok">Reachable</Tag>
    : <Tag className="der-continuity-warn">Unreachable</Tag>;
  const pressurePct = Math.round(snap.storage.pressureRatio * 100);

  return (
    <Card>
      <div className="der-continuity-head">
        <h2>Continuity</h2>
        <Tag className={`der-continuity-level der-continuity-${snap.level}`}>
          {snap.level}
        </Tag>
      </div>
      <dl className="der-continuity-grid">
        <dt>DER server</dt>
        <dd>
          {serverTag}
          {snap.lastServerOkAt && (
            <span className="der-continuity-muted">
              &nbsp;last ok {new Date(snap.lastServerOkAt).toLocaleTimeString()}
            </span>
          )}
        </dd>

        <dt>Queued submissions</dt>
        <dd>{snap.queued}</dd>

        <dt>Persistent storage</dt>
        <dd>
          {persistTag}
          {snap.storage.quota > 0 && (
            <span className="der-continuity-muted">
              &nbsp;{pressurePct}% of {Math.round(snap.storage.quota / 1_048_576)} MB
            </span>
          )}
        </dd>

        <dt>App-shell cache</dt>
        <dd>{snap.dbeShellCacheEntries.toLocaleString()} entries</dd>

        <dt>API mirror cache</dt>
        <dd>{snap.dbeApiMirrorEntries.toLocaleString()} entries</dd>

        <dt>Last prefetch</dt>
        <dd>
          {snap.prefetchLastRunAt
            ? <>
                {new Date(snap.prefetchLastRunAt).toLocaleTimeString()}
                <span className="der-continuity-muted">
                  &nbsp;({snap.prefetchLastCached} cached)
                </span>
              </>
            : <span className="der-continuity-muted">never</span>}
        </dd>
      </dl>
      {snap.level === 'offline' && (
        <p className="der-continuity-footer">
          DER server is unreachable and the local cache is empty —
          this browser can't render DHIS2 apps right now. Reconnect
          to a network with DER reachability, or open an installed
          DHIS2 app while online at least once to prime the cache.
        </p>
      )}
    </Card>
  );
}
