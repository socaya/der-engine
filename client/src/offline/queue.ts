/**
 * Offline-first capture queue.
 *
 * When the device loses WAN or edge connectivity, aggregate submissions
 * (and any other POST we choose to route through here) are stashed in
 * IndexedDB instead of hitting the network. A replay pass on reconnect
 * drains them in insertion order.
 *
 * Notes:
 *   - The queue is FIFO on an auto-increment key so order survives
 *     browser restarts.
 *   - Entries are keyed to a logical "kind" (aggregate | event | tracker)
 *     so screens can report their own pending counts without reading
 *     every row.
 *   - The payload is the exact JSON body the server would receive, so a
 *     drain is just `fetch(url, { method: 'POST', body })`.
 */
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

export type QueueKind = 'aggregate' | 'event' | 'tracker';

export interface QueueEntry {
  readonly id: number;
  readonly kind: QueueKind;
  readonly url: string;
  readonly method: 'POST' | 'PUT';
  readonly body: unknown;
  readonly createdAt: string;
  readonly attempts: number;
  readonly lastError?: string;
}

interface DerOfflineSchema extends DBSchema {
  queue: {
    key: number;
    value: Omit<QueueEntry, 'id'>;
    indexes: { 'by-kind': QueueKind; 'by-createdAt': string };
  };
}

const DB_NAME = 'der-offline-v1';
const STORE = 'queue';

let dbPromise: Promise<IDBPDatabase<DerOfflineSchema>> | null = null;

function db(): Promise<IDBPDatabase<DerOfflineSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DerOfflineSchema>(DB_NAME, 1, {
      upgrade(upgradeDb) {
        const store = upgradeDb.createObjectStore(STORE,
          { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-kind', 'kind');
        store.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

/** Only call from tests. Closes any open connection + clears the
 *  module-level singleton so fake-indexeddb picks up a fresh handle
 *  on the next access.  Without the explicit close(), the prior
 *  transactions on the stale handle emit InvalidStateError when
 *  they fire during the next test's event loop. */
export function __resetDbForTests(): void {
  if (dbPromise) {
    dbPromise.then((d) => { try { d.close(); } catch { /* ignore */ } })
             .catch(() => undefined);
  }
  dbPromise = null;
}

export async function enqueue(entry: {
  kind: QueueKind;
  url: string;
  method?: 'POST' | 'PUT';
  body: unknown;
}): Promise<number> {
  const d = await db();
  const row: Omit<QueueEntry, 'id'> = {
    kind: entry.kind,
    url: entry.url,
    method: entry.method ?? 'POST',
    body: entry.body,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  return d.add(STORE, row) as unknown as Promise<number>;
}

export async function listByKind(kind: QueueKind): Promise<QueueEntry[]> {
  const d = await db();
  // keyPath 'id' + autoIncrement — the generated key is written back
  // onto the stored value, so the row already carries its own id.
  const rows = await d.getAllFromIndex(STORE, 'by-kind', kind);
  return rows as unknown as QueueEntry[];
}

export async function count(kind?: QueueKind): Promise<number> {
  const d = await db();
  if (kind) {
    return d.countFromIndex(STORE, 'by-kind', kind);
  }
  return d.count(STORE);
}

export async function peekOldest(): Promise<QueueEntry | null> {
  const d = await db();
  const tx = d.transaction(STORE, 'readonly');
  const cursor = await tx.store.openCursor();
  if (!cursor) return null;
  const value = cursor.value as Omit<QueueEntry, 'id'>;
  return { ...value, id: cursor.key as number };
}

export async function remove(id: number): Promise<void> {
  const d = await db();
  await d.delete(STORE, id);
}

export async function markAttempt(id: number, error?: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  const row = await tx.store.get(id);
  if (!row) { await tx.done; return; }
  // `id` lives on the value via keyPath + autoIncrement, so put() takes
  // only the value — passing the key explicitly would throw DataError.
  await tx.store.put({
    ...(row as Omit<QueueEntry, 'id'> & { id?: number }),
    id,
    attempts: ((row as QueueEntry).attempts ?? 0) + 1,
    lastError: error,
  } as never);
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear(STORE);
}
