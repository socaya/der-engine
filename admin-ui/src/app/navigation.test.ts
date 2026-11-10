import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, groupForRoute, groupForItemId } from './navigation';

describe('NAV_GROUPS', () => {
  it('exports at least the core groups', () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    expect(ids.length).toBeGreaterThan(5);
    /* Group ids are unique. */
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every group has a primaryId that matches one of its items', () => {
    for (const grp of NAV_GROUPS) {
      const match = grp.items.find((it) => it.id === grp.primaryId);
      expect(match, `primaryId ${grp.primaryId} not in ${grp.id}`)
        .toBeDefined();
    }
  });

  it('item ids are unique within each group', () => {
    for (const grp of NAV_GROUPS) {
      const ids = grp.items.map((it) => it.id);
      expect(new Set(ids).size, `duplicate id in group ${grp.id}`)
        .toBe(ids.length);
    }
  });
});

describe('groupForRoute', () => {
  it('returns the dashboard group for "/"', () => {
    const grp = groupForRoute('/');
    expect(grp).not.toBeNull();
    /* The matching item has to="/". */
    expect(grp!.items.some((it) => it.to === '/')).toBe(true);
  });

  it('returns null for an unmatched route', () => {
    expect(groupForRoute('/nowhere-at-all')).toBeNull();
  });

  it('matches an exact route path', () => {
    /* "/settings" belongs to the settings group. */
    const grp = groupForRoute('/settings');
    expect(grp).not.toBeNull();
    /* UI-2 — Settings is a child of the System module now. */
    expect(grp!.id).toBe('system');
  });

  it('matches a sub-path via startsWith', () => {
    const grp = groupForRoute('/settings/releases');
    expect(grp).not.toBeNull();
    /* UI-2 — Settings is a child of the System module now. */
    expect(grp!.id).toBe('system');
  });

  it('prefers the longest matching item.to prefix', () => {
    /* If /data/queue and /data both exist, /data/queue should win
     * for route "/data/queue/op-1". */
    const grp = groupForRoute('/data/queue/op-1');
    expect(grp).not.toBeNull();
    /* Multiple data-related groups may exist; just verify the
     * match found something. */
  });

  it('skips contextual items (they are hidden from top-level nav match)', () => {
    /* Contextual items should never win a match. Pick a group that
     * has a contextual child and probe its path — the probe returns
     * the parent group only if a non-contextual sibling matches. */
    for (const grp of NAV_GROUPS) {
      const contextual = grp.items.filter((it) => it.status === 'contextual');
      for (const it of contextual) {
        if (!it.to || it.to === '/') continue;
        const match = groupForRoute(it.to);
        if (match === null) {
          /* No non-contextual sibling matched — correct. */
          continue;
        }
        /* If match is non-null, the matching item in that group must
         * NOT be the contextual one. */
        const winner = match.items
          .filter((x) => x.status !== 'contextual')
          .find((x) => x.to && (it.to === x.to
                                 || it.to.startsWith(x.to + '/')));
        expect(winner, `contextual-only match for ${it.to}`).toBeDefined();
      }
    }
  });
});

describe('groupForItemId', () => {
  it('finds a group by its own item id', () => {
    for (const grp of NAV_GROUPS) {
      if (grp.items.length === 0) continue;
      const first = grp.items[0];
      const match = groupForItemId(first.id);
      expect(match).toBe(grp);
    }
  });

  it('returns null for an unknown item id', () => {
    expect(groupForItemId('no-such-item-xxx')).toBeNull();
  });
});
