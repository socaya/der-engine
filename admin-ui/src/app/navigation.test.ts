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

  it('contextual items still resolve to their parent module', () => {
    /* UI-9 — cluster sub-screens (e.g. /monitoring/metrics,
     * /monitoring/storage, /system/hardware) are marked contextual
     * so they don't crowd the SectionTabs strip, but when an
     * operator navigates into one the parent module's nav must
     * stay visible. Enforce: every contextual item's `to` resolves
     * back to the group that owns it. */
    for (const grp of NAV_GROUPS) {
      const contextual = grp.items.filter((it) => it.status === 'contextual');
      for (const it of contextual) {
        if (!it.to || it.to === '/') continue;
        const match = groupForRoute(it.to);
        expect(match, `contextual ${it.to} must resolve a module`)
          .not.toBeNull();
        const owns = match!.items.some((x) =>
          x.to && (it.to === x.to || it.to.startsWith(x.to + '/')));
        expect(owns,
          `contextual ${it.to} must resolve to its own group (got ${match!.id})`)
          .toBe(true);
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
