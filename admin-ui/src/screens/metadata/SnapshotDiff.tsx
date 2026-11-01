import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * §2.3.29 — pairwise snapshot diff view. Pulls the counters endpoint
 * for an overview, then the per-UID endpoint per selected resource.
 */

const RESOURCES = [
  'programs', 'dataElements', 'dataSets', 'programStages',
  'programRules', 'trackedEntityAttributes', 'trackedEntityTypes',
  'organisationUnits', 'categoryOptionCombos',
] as const;

export interface SnapshotDiffProps {
  api?: Pick<typeof edgeApi, 'snapshotCounterDiff' | 'snapshotResourceDiff'>;
  aOverride?: number;
  bOverride?: number;
}

export function SnapshotDiff({ api = edgeApi, aOverride, bOverride }:
    SnapshotDiffProps = {}): JSX.Element {
  const params = useParams();
  const a = aOverride ?? Number(params.a);
  const b = bOverride ?? Number(params.b);
  const [counters, setCounters] = useState<edgeApi.SnapshotDiffCounters | null>(null);
  const [resource, setResource] = useState<string>('programs');
  const [resDiff, setResDiff] = useState<edgeApi.SnapshotResourceDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!a || !b) return;
    api.snapshotCounterDiff(a, b)
      .then(setCounters)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [a, b, api]);

  useEffect(() => {
    if (!a || !b || !resource) return;
    setResDiff(null);
    api.snapshotResourceDiff(a, b, resource)
      .then(setResDiff)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [a, b, resource, api]);

  if (error) {
    return <ErrorBlock title="Diff load failed"
                        testId="diff-error">{error}</ErrorBlock>;
  }
  if (!counters) {
    return <LoadingBlock testId="diff-loading" />;
  }
  return (
    <div className="ea-screen" data-test="diff-root">
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="diff-heading">
            Diff · #{a} → #{b}
          </h1>
        </div>
        <div className="ea-screen-header-right">
          <Link to="/metadata/snapshots" className="ea-btn ea-btn--ghost ea-btn--sm">
            ← All snapshots
          </Link>
        </div>
      </header>

      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Headline counters</h2>
            <p>Per-resource row totals in each snapshot + the delta.</p>
          </div>
          <table className="ea-table ea-table--dense" data-test="diff-counters">
            <thead>
              <tr>
                <th>Resource</th>
                <th style={{ textAlign: 'right' }}>#{a}</th>
                <th style={{ textAlign: 'right' }}>#{b}</th>
                <th style={{ textAlign: 'right' }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(counters.deltas).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontWeight: 500 }}>{k}</td>
                  <td style={{ textAlign: 'right' }}>{v.a}</td>
                  <td style={{ textAlign: 'right' }}>{v.b}</td>
                  <td style={{ textAlign: 'right',
                                color: v.delta === 0 ? 'var(--der-ink-500)'
                                      : v.delta > 0 ? '#1f7a1f' : '#b02a37' }}>
                    {v.delta > 0 ? `+${v.delta}` : v.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Per-UID changes</h2>
            <p>Pick a resource to see which entities were added, removed, or changed.</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Resource</span>
              <select className="ea-input" data-test="diff-resource"
                       value={resource}
                       onChange={(e) => setResource(e.target.value)}>
                {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          {resDiff == null ? (
            <LoadingBlock testId="diff-resource-loading" />
          ) : (
            <DiffGroups diff={resDiff} />
          )}
        </div>
      </section>
    </div>
  );
}

function DiffGroups({ diff }: { diff: edgeApi.SnapshotResourceDiff }): JSX.Element {
  const total = diff.added.length + diff.removed.length + diff.changed.length;
  const empty = total === 0;
  if (empty) {
    return (
      <p className="ea-text-muted" data-test="diff-empty"
          style={{ margin: 0 }}>
        No per-UID changes recorded between these snapshots for{' '}
        <code className="ea-mono">{diff.resource}</code>. (This can also
        mean one or both snapshots pre-date row-versioning — V060 only
        starts tracking from the first sync after it landed.)
      </p>
    );
  }
  return (
    <div className="ea-diff-groups" data-test="diff-groups">
      <DiffGroup label="Added" tone="success"
                  items={diff.added} testIdPrefix="diff-added" />
      <DiffGroup label="Removed" tone="error"
                  items={diff.removed} testIdPrefix="diff-removed" />
      <DiffGroup label="Changed" tone="warning"
                  items={diff.changed} testIdPrefix="diff-changed" />
    </div>
  );
}

function DiffGroup({ label, tone, items, testIdPrefix }:
                     { label: string;
                       tone: 'success' | 'error' | 'warning';
                       items: { id: string; displayName: string | null }[];
                       testIdPrefix: string }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section className={`ea-diff-group ea-diff-group--${tone}`}
              data-test={`${testIdPrefix}-section`}>
      <h3>{label} ({items.length})</h3>
      <ul>
        {items.slice(0, 100).map((it) => (
          <li key={it.id} data-test={`${testIdPrefix}-${it.id}`}>
            <span style={{ fontWeight: 500 }}>
              {it.displayName ?? <em className="ea-text-muted">no mirror row</em>}
            </span>
            <span className="ea-mono ea-text-muted" style={{ marginLeft: 6, fontSize: 11 }}>
              {it.id}
            </span>
          </li>
        ))}
        {items.length > 100 && (
          <li className="ea-text-muted" style={{ fontStyle: 'italic' }}>
            …and {items.length - 100} more.
          </li>
        )}
      </ul>
    </section>
  );
}

export const SnapshotDiffResources = RESOURCES;
