import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetDbForTests,
  clearAll,
  count,
  enqueue,
  listByKind,
  markAttempt,
  peekOldest,
  remove,
} from './queue';

// fake-indexeddb/auto is registered in src/test/setup.ts.

beforeEach(() => { __resetDbForTests(); });
afterEach(async () => {
  try { await clearAll(); } catch { /* db may not be open */ }
});

describe('offline queue', () => {
  it('enqueue + peekOldest returns rows in FIFO order', async () => {
    await enqueue({ kind: 'aggregate', url: '/api/dataValueSets', body: { v: 1 } });
    await enqueue({ kind: 'aggregate', url: '/api/dataValueSets', body: { v: 2 } });
    const first = await peekOldest();
    expect(first?.body).toEqual({ v: 1 });
  });

  it('count() reports total + per-kind', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: {} });
    await enqueue({ kind: 'event', url: '/y', body: {} });
    expect(await count()).toBe(2);
    expect(await count('aggregate')).toBe(1);
    expect(await count('event')).toBe(1);
  });

  it('remove(id) deletes the row', async () => {
    const id = await enqueue({ kind: 'aggregate', url: '/x', body: {} });
    expect(await count()).toBe(1);
    await remove(id);
    expect(await count()).toBe(0);
  });

  it('markAttempt bumps attempts + records lastError', async () => {
    const id = await enqueue({ kind: 'aggregate', url: '/x', body: {} });
    await markAttempt(id, 'HTTP 500');
    const rows = await listByKind('aggregate');
    const row = rows.find((r) => r.id === id);
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toBe('HTTP 500');
  });

  it('markAttempt on unknown id is a no-op', async () => {
    await expect(markAttempt(9999)).resolves.toBeUndefined();
  });

  it('peekOldest returns null on empty queue', async () => {
    expect(await peekOldest()).toBeNull();
  });

  it('listByKind returns only matching kind', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: {} });
    await enqueue({ kind: 'event', url: '/y', body: {} });
    const agg = await listByKind('aggregate');
    expect(agg).toHaveLength(1);
    expect(agg[0].kind).toBe('aggregate');
  });

  it('clearAll empties the store', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: {} });
    await enqueue({ kind: 'event', url: '/y', body: {} });
    await clearAll();
    expect(await count()).toBe(0);
  });

  it('enqueue default method is POST', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: {} });
    const rows = await listByKind('aggregate');
    expect(rows[0].method).toBe('POST');
  });
});
