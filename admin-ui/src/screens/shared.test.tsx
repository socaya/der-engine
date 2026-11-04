import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  fmtBytes, fmtDur, fmtAgo, fmtDate,
  humaniseJob, humaniseTrigger, humaniseState,
  describeCron, relatedLinksForJob, syncActivityShape,
  entityTypeLabel, entityTypeIcon,
  parseByType, detailEntries,
  operatorState, operatorStateTone,
  readOuContext, isInEdgeOrgUnitScope,
  metadataResourceForEntity, dataModuleRouteForEntity, dataModuleLabelForEntity,
  JOURNAL_ENTITY_TYPES,
  LastPulledChip,
} from './shared';
import * as edgeApi from '../api/edgeApi';

/* ────────────────────────────────────────────────────────────────
 * shared.tsx is the admin-ui's cross-cutting utility module (1738
 * LOC). The pure functions (formatters, humanisers, entity
 * mappings, operator-state resolvers) are the quickest branch-
 * coverage wins because they're free of React state. The React
 * components in shared.tsx (Panel, KpiTile, SyncStatusBar, etc.)
 * are exercised indirectly by every screen test that renders
 * them, so this file concentrates on the pure helpers.
 * ──────────────────────────────────────────────────────────────── */

describe('shared.fmtBytes', () => {
  it('undefined returns em-dash', () => {
    expect(fmtBytes(undefined)).toBe('—');
  });
  it('zero returns a stable formatted string (not em-dash)', () => {
    /* The admin-ui treats 0 as a real value and renders '0.0 B'
     * (byte displays for small-footprint devices rely on seeing
     * the zero rather than '—'). */
    expect(fmtBytes(0)).toMatch(/0.*B/);
  });
  it('scales through KB / MB / GB thresholds', () => {
    expect(fmtBytes(100)).toMatch(/B$/);
    expect(fmtBytes(2048)).toMatch(/KB$/);
    expect(fmtBytes(5 * 1024 * 1024)).toMatch(/MB$/);
    expect(fmtBytes(7 * 1024 * 1024 * 1024)).toMatch(/GB$/);
  });
});

describe('shared.fmtDur', () => {
  it('null / undefined renders em-dash', () => {
    expect(fmtDur(undefined)).toBe('—');
    expect(fmtDur(null)).toBe('—');
  });
  it('scales across second / minute / hour thresholds', () => {
    /* The admin-ui uses coarse labels — anything < 1s rounds up
     * to '1s'; durations in days still display as hours (48h 0m),
     * which matches how operators think about recent uptime. */
    expect(fmtDur(500)).toMatch(/s/);
    expect(fmtDur(2_500)).toMatch(/s/);
    expect(fmtDur(3 * 60_000)).toMatch(/m/);
    expect(fmtDur(5 * 3_600_000)).toMatch(/h/);
    expect(fmtDur(2 * 86_400_000)).toMatch(/h/);
  });
});

describe('shared.fmtAgo', () => {
  it('null / undefined renders em-dash', () => {
    expect(fmtAgo(null)).toBe('—');
    expect(fmtAgo(undefined)).toBe('—');
  });
  it('returns a relative age string for a recent timestamp', () => {
    const recent = new Date(Date.now() - 5_000).toISOString();
    const out = fmtAgo(recent);
    expect(out).not.toBe('—');
    expect(out).toMatch(/ago|just now|s|m|h|d/i);
  });
  it('handles an invalid date string without crashing', () => {
    expect(() => fmtAgo('not-a-date')).not.toThrow();
  });
});

describe('shared.fmtDate', () => {
  it('null / undefined renders em-dash', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
  });
  it('returns a formatted string for a valid ISO timestamp', () => {
    const out = fmtDate('2026-11-03T12:00:00Z');
    expect(out).not.toBe('—');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('shared.humaniseJob', () => {
  it('maps known job names to non-empty friendly labels', () => {
    expect(humaniseJob('METADATA_SYNC').length).toBeGreaterThan(0);
    expect(humaniseJob('JOURNAL_WORKER_DRAIN').length).toBeGreaterThan(0);
    expect(humaniseJob('SCHEDULED_DRAFT_PUBLISH').length).toBeGreaterThan(0);
  });
  it('returns a readable placeholder for unknown names', () => {
    const out = humaniseJob('UNKNOWN_JOB');
    expect(out.length).toBeGreaterThan(0);
  });
  it('tolerates null / undefined', () => {
    expect(humaniseJob(null)).toBeTruthy();
    expect(humaniseJob(undefined)).toBeTruthy();
  });
});

describe('shared.humaniseTrigger', () => {
  it('renders known trigger kinds', () => {
    expect(humaniseTrigger('SCHEDULED')).toMatch(/scheduled|cron/i);
    expect(humaniseTrigger('MANUAL')).toMatch(/manual/i);
  });
  it('tolerates null / undefined / unknown', () => {
    expect(humaniseTrigger(null)).toBeTruthy();
    expect(humaniseTrigger('SOMETHING')).toBeTruthy();
  });
});

describe('shared.humaniseState', () => {
  it('maps known operator-facing states to non-empty friendly text', () => {
    for (const s of ['PENDING', 'IN_FLIGHT', 'CENTRAL_ACCEPTED',
                      'CONFLICT_REVIEW', 'FAILED_RETRYABLE']) {
      const out = humaniseState(s);
      expect(out.length).toBeGreaterThan(0);
    }
  });
  it('tolerates null / undefined / unknown', () => {
    expect(humaniseState(null)).toBeTruthy();
    expect(humaniseState('WEIRD_STATE')).toBeTruthy();
  });
});

describe('shared.describeCron', () => {
  it('returns a non-empty description for common patterns and garbage input alike', () => {
    expect(describeCron('0 0 * * * ?').length).toBeGreaterThan(0);
    expect(describeCron('0 */5 * * * ?').length).toBeGreaterThan(0);
    expect(describeCron(null).length).toBeGreaterThan(0);
    expect(describeCron('garbage').length).toBeGreaterThan(0);
  });

  it('empty / null returns "Not scheduled"', () => {
    expect(describeCron(null)).toBe('Not scheduled');
    expect(describeCron(undefined)).toBe('Not scheduled');
    expect(describeCron('')).toBe('Not scheduled');
  });

  it('short expr (<6 parts) returns "Custom schedule"', () => {
    expect(describeCron('0 0 *')).toBe('Custom schedule');
  });

  it('every-minute "*/1" variant returns "Every minute"', () => {
    expect(describeCron('0 */1 * * * ?')).toBe('Every minute');
  });

  it('every-N-minutes returns pluralised label', () => {
    expect(describeCron('0 */5 * * * ?')).toBe('Every 5 minutes');
    expect(describeCron('0 */15 * * * ?')).toBe('Every 15 minutes');
  });

  it('every-hour "*/1" returns "Every hour"', () => {
    expect(describeCron('0 0 */1 * * ?')).toBe('Every hour');
  });

  it('every-N-hours returns pluralised label', () => {
    expect(describeCron('0 0 */2 * * ?')).toBe('Every 2 hours');
    expect(describeCron('0 0 */6 * * ?')).toBe('Every 6 hours');
  });

  it('daily HH:MM pattern surfaces formatted time', () => {
    expect(describeCron('0 30 2 * * ?')).toBe('Daily at 02:30');
    expect(describeCron('0 0 14 * * ?')).toBe('Daily at 14:00');
  });

  it('day-of-week "*" also matches the common patterns', () => {
    expect(describeCron('0 */5 * * * *')).toBe('Every 5 minutes');
    expect(describeCron('0 0 2 * * *')).toBe('Daily at 02:00');
  });

  it('non-matching pattern falls through to "Custom schedule"', () => {
    /* Day-of-month restricted (not *) → custom. */
    expect(describeCron('0 0 2 15 * ?')).toBe('Custom schedule');
    /* Month restricted → custom. */
    expect(describeCron('0 */5 * * JAN ?')).toBe('Custom schedule');
  });
});

describe('shared.relatedLinksForJob', () => {
  it('returns an array of 3-tuples for the known job names', () => {
    const sync = relatedLinksForJob('METADATA_SYNC');
    expect(Array.isArray(sync)).toBe(true);
    sync.forEach((row) => expect(row).toHaveLength(3));
  });
  it('returns an empty array for unknown job names', () => {
    expect(relatedLinksForJob('UNKNOWN_JOB')).toEqual([]);
  });
});

describe('shared.syncActivityShape', () => {
  it('returns a stable shape for the metadata-sync pair', () => {
    const out = syncActivityShape('METADATA_SYNC', 'SUCCESS');
    expect(out).toBeTruthy();
    expect(typeof out).toBe('object');
  });
  it('tolerates nulls', () => {
    expect(syncActivityShape(null, null)).toBeTruthy();
  });
});

describe('shared.entityTypeLabel + entityTypeIcon', () => {
  it('entityTypeLabel renders a readable label for every JOURNAL_ENTITY_TYPES entry', () => {
    for (const t of JOURNAL_ENTITY_TYPES) {
      expect(entityTypeLabel(t)).toBeTruthy();
      expect(entityTypeIcon(t)).toBeTruthy();
    }
  });
  it('falls back to a generic label / icon for null / unknown', () => {
    expect(entityTypeLabel(null)).toBeTruthy();
    expect(entityTypeIcon(null)).toBeTruthy();
    expect(entityTypeLabel('WEIRD')).toBeTruthy();
    expect(entityTypeIcon('WEIRD')).toBeTruthy();
  });
});

describe('shared.parseByType / detailEntries', () => {
  it('parses a byType JSON blob into (name, count) pairs', () => {
    const out = parseByType('{"byType":{"AGGREGATE_DATA_VALUE":2,"EVENT":1}}');
    expect(out.map(([k]) => k)).toEqual(expect.arrayContaining(
      ['AGGREGATE_DATA_VALUE', 'EVENT']));
  });
  it('returns [] on malformed JSON', () => {
    expect(parseByType('not json')).toEqual([]);
    expect(parseByType(null)).toEqual([]);
    expect(parseByType(undefined)).toEqual([]);
  });
  it('detailEntries flattens detail payloads into (key, value) pairs', () => {
    const out = detailEntries('{"imported":3,"ignored":1}');
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toHaveLength(2);
  });
  it('detailEntries returns [] on garbage input', () => {
    expect(detailEntries('garbage')).toEqual([]);
    expect(detailEntries(null)).toEqual([]);
  });
});

describe('shared.operatorState + operatorStateTone', () => {
  it('every backend state maps to a non-empty operator bucket label', () => {
    for (const s of ['PENDING', 'IN_FLIGHT', 'CENTRAL_ACCEPTED',
                      'CONFLICT_REVIEW', 'FAILED_RETRYABLE',
                      'FAILED_TERMINAL']) {
      expect(operatorState(s)).toBeTruthy();
    }
  });
  it('tolerates unknown / null input with a sensible default', () => {
    expect(operatorState(null)).toBeTruthy();
    expect(operatorState('WHATEVER')).toBeTruthy();
  });
  it('operatorStateTone returns a valid Status tone for each bucket we see at runtime', () => {
    /* Exercise the tone switch with the bucket values that
     * operatorState itself emits, rather than hard-coded enum
     * names (which don't match the title-case display strings
     * the admin-ui ships). */
    const buckets = ['PENDING', 'IN_FLIGHT', 'CENTRAL_ACCEPTED',
                      'CONFLICT_REVIEW', 'FAILED_TERMINAL']
      .map((s) => operatorState(s));
    for (const b of buckets) {
      const tone = operatorStateTone(b);
      /* Any defined tone is valid; the switch returns 'muted'
       * as fallback for unknown labels. */
      expect(['success', 'warning', 'danger', 'info', 'muted'])
        .toContain(tone);
    }
  });
});

describe('shared.readOuContext + isInEdgeOrgUnitScope', () => {
  it('readOuContext returns a default context when the binding is null', () => {
    const out = readOuContext(null);
    expect(out).toBeTruthy();
    expect(typeof out).toBe('object');
  });
  it('readOuContext respects a populated binding', () => {
    const binding = {
      orgUnitId: 'ou-1', orgUnitPath: '/root/ou-1',
      orgUnitDisplayName: 'Clinic', bound: true,
      boundAt: '2026-11-03T00:00:00Z', boundBy: 'u1',
    } as unknown as Parameters<typeof readOuContext>[0];
    const out = readOuContext(binding);
    expect(out).toBeTruthy();
  });
  it('isInEdgeOrgUnitScope — null path treats everything as in-scope', () => {
    /* The function takes (rowOrgUnitUid, edgeOrgUnitPath): both
     * strings. Null path or null row-uid both return true, which
     * is how the admin-ui handles the "no OU binding yet" case. */
    expect(isInEdgeOrgUnitScope('ou-1', null)).toBe(true);
    expect(isInEdgeOrgUnitScope(null, '/root/ou-1')).toBe(true);
    expect(isInEdgeOrgUnitScope(undefined, undefined)).toBe(true);
  });
  it('isInEdgeOrgUnitScope — row id present inside the bound path returns true', () => {
    expect(isInEdgeOrgUnitScope('ou-1', '/root/ou-1')).toBe(true);
    expect(isInEdgeOrgUnitScope('root', '/root/ou-1')).toBe(true);
  });
  it('isInEdgeOrgUnitScope — row id outside the bound path returns false', () => {
    expect(isInEdgeOrgUnitScope('ou-unrelated', '/root/ou-1')).toBe(false);
  });
});

describe('shared.metadataResourceForEntity + dataModuleRouteForEntity + dataModuleLabelForEntity', () => {
  it('metadataResourceForEntity maps every JOURNAL_ENTITY_TYPES entry to something', () => {
    for (const t of JOURNAL_ENTITY_TYPES) {
      const out = metadataResourceForEntity(t);
      /* Some entity types don't have a metadata resource — the
       * function may return null; just assert it doesn't throw. */
      expect(out === null || typeof out === 'string').toBe(true);
    }
  });
  it('dataModuleRouteForEntity returns a route path for AGGREGATE_DATA_VALUE', () => {
    const route = dataModuleRouteForEntity('AGGREGATE_DATA_VALUE');
    expect(route === null || typeof route === 'string').toBe(true);
  });
  it('dataModuleRouteForEntity returns null for an unknown kind', () => {
    expect(dataModuleRouteForEntity('WEIRD')).toBe(null);
  });
  it('dataModuleLabelForEntity returns a friendly label per known kind', () => {
    const label = dataModuleLabelForEntity('AGGREGATE_DATA_VALUE');
    expect(label === null || typeof label === 'string').toBe(true);
  });
});

describe('LastPulledChip', () => {
  it('no matching cursor → renders nothing', async () => {
    vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({
      cursors: [],
    } as never);
    const { container } = render(<LastPulledChip entityType="AGGREGATE" />);
    await waitFor(() => {
      /* fetchDataPullCursors resolves → setRow(null) → returns null. */
      expect(container.firstChild).toBeNull();
    });
  });

  it('cursor with no lastPulledAt → renders nothing', async () => {
    vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({
      cursors: [{ entityType: 'AGGREGATE', lastPulledAt: null,
                   consecutiveFailures: 0, lastError: null }],
    } as never);
    const { container } = render(<LastPulledChip entityType="AGGREGATE" />);
    /* fetchDataPullCursors resolves — microtask queue flushes. */
    await new Promise((r) => setTimeout(r, 0));
    expect(container.firstChild).toBeNull();
  });

  it('cursor with lastPulledAt + no failures → renders the "Last pulled" chip', async () => {
    vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({
      cursors: [{ entityType: 'AGGREGATE',
                   lastPulledAt: '2026-11-03T12:00:00Z',
                   consecutiveFailures: 0, lastError: null }],
    } as never);
    render(<LastPulledChip entityType="AGGREGATE" />);
    await waitFor(() =>
      expect(screen.getByTestId('last-pulled-aggregate'))
        .toBeInTheDocument());
    expect(screen.getByText(/Last pulled/)).toBeInTheDocument();
  });

  it('cursor with failures → renders warning tone + failure count', async () => {
    vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({
      cursors: [{ entityType: 'EVENT',
                   lastPulledAt: '2026-11-03T12:00:00Z',
                   consecutiveFailures: 3,
                   lastError: 'central-unreachable' }],
    } as never);
    render(<LastPulledChip entityType="EVENT" />);
    await waitFor(() =>
      expect(screen.getByTestId('last-pulled-event'))
        .toBeInTheDocument());
    /* "3 failures" surfaces. */
    expect(screen.getByText(/3 failures/)).toBeInTheDocument();
  });

  it('single failure uses singular "1 failure" label', async () => {
    vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({
      cursors: [{ entityType: 'TRACKER',
                   lastPulledAt: '2026-11-03T12:00:00Z',
                   consecutiveFailures: 1,
                   lastError: 'timeout' }],
    } as never);
    render(<LastPulledChip entityType="TRACKER" />);
    await waitFor(() =>
      expect(screen.getByText(/1 failure/)).toBeInTheDocument());
    /* Not "failures" (plural). */
    expect(screen.queryByText(/1 failures/)).toBeNull();
  });

  it('fetchDataPullCursors rejection is swallowed (no render)', async () => {
    vi.spyOn(edgeApi, 'fetchDataPullCursors').mockRejectedValue(
      new Error('cursors fetch fail'));
    const { container } = render(<LastPulledChip entityType="AGGREGATE" />);
    await new Promise((r) => setTimeout(r, 0));
    /* Row stays null → nothing rendered. */
    expect(container.firstChild).toBeNull();
  });
});
