import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDbForTests, clearAll, count, enqueue, listByKind } from './queue';
import { drainOfflineQueue } from './replay';

function makeFetch(statusByOrder: number[]): typeof fetch {
  let i = 0;
  return vi.fn().mockImplementation(async () => {
    const status = statusByOrder[Math.min(i, statusByOrder.length - 1)];
    i++;
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => { __resetDbForTests(); });
afterEach(async () => { try { await clearAll(); } catch { /* ignore */ } });

describe('drainOfflineQueue', () => {
  it('replays entries FIFO, removes on 2xx', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: { v: 1 } });
    await enqueue({ kind: 'aggregate', url: '/x', body: { v: 2 } });
    const drained = await drainOfflineQueue({
      fetchImpl: makeFetch([200, 200]),
    });
    expect(drained).toBe(2);
    expect(await count()).toBe(0);
  });

  it('stops on 4xx + bumps attempts on the failing row', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: { v: 1 } });
    await enqueue({ kind: 'aggregate', url: '/x', body: { v: 2 } });
    const drained = await drainOfflineQueue({
      fetchImpl: makeFetch([400]),
    });
    expect(drained).toBe(0);
    expect(await count()).toBe(2);
    const rows = await listByKind('aggregate');
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].lastError).toBe('HTTP 400');
  });

  it('stops + bumps attempts on network failure', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: { v: 1 } });
    const dead: typeof fetch = vi.fn()
      .mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const drained = await drainOfflineQueue({ fetchImpl: dead });
    expect(drained).toBe(0);
    const rows = await listByKind('aggregate');
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].lastError).toBe('offline');
  });

  it('non-Error rejection is coerced to string', async () => {
    await enqueue({ kind: 'aggregate', url: '/x', body: { v: 1 } });
    const dead: typeof fetch = vi.fn()
      .mockRejectedValue('nope') as unknown as typeof fetch;
    await drainOfflineQueue({ fetchImpl: dead });
    const rows = await listByKind('aggregate');
    expect(rows[0].lastError).toBe('nope');
  });

  it('empty queue returns 0 without touching fetch', async () => {
    const f = vi.fn() as unknown as typeof fetch;
    const drained = await drainOfflineQueue({ fetchImpl: f });
    expect(drained).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it('honors maxEntries cap', async () => {
    for (let i = 0; i < 5; i++) {
      await enqueue({ kind: 'aggregate', url: '/x', body: { v: i } });
    }
    const drained = await drainOfflineQueue({
      maxEntries: 2, fetchImpl: makeFetch([200, 200]),
    });
    expect(drained).toBe(2);
    expect(await count()).toBe(3);
  });
});
