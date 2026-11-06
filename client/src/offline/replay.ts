import { markAttempt, peekOldest, remove } from './queue';

/**
 * Drain-all of the offline queue in FIFO order.
 *
 * Call this when the browser transitions back online, or when the
 * user hits a "retry queued submissions" button. For each entry:
 *
 *   - replay the exact POST/PUT the operator originally issued
 *     (the body + URL are preserved verbatim in the queue row);
 *   - on 2xx, remove the entry;
 *   - on 4xx/5xx or network failure, bump its attempt counter and
 *     leave it in the queue so the next drain retries it.
 *
 * Returns the number of entries successfully drained. Callers may
 * use this for a simple toast ("N offline entries synced"). The
 * loop is bounded by {@link maxEntries} to keep a very large queue
 * from blocking the UI forever on one tick.
 */
export async function drainOfflineQueue(
  { maxEntries = 100, fetchImpl = fetch }:
  { maxEntries?: number; fetchImpl?: typeof fetch } = {},
): Promise<number> {
  let drained = 0;
  for (let i = 0; i < maxEntries; i++) {
    const entry = await peekOldest();
    if (!entry) break;
    try {
      const resp = await fetchImpl(entry.url, {
        method: entry.method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json',
                   Accept: 'application/json' },
        body: JSON.stringify(entry.body),
      });
      if (resp.ok) {
        await remove(entry.id);
        drained++;
      } else {
        await markAttempt(entry.id, `HTTP ${resp.status}`);
        break; // don't hammer on the same failure
      }
    } catch (err) {
      await markAttempt(entry.id,
        err instanceof Error ? err.message : String(err));
      break;
    }
  }
  return drained;
}
