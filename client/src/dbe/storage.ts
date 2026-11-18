/**
 * DBE Tier-2 storage helpers (ADR-0040).
 *
 * Primary job: request + report on the browser's persistent-storage
 * grant so a user clearing their browser cache doesn't silently wipe
 * the clinic's IndexedDB. Secondary: quota reporting for the
 * degraded-mode banner + the Peers screen continuity card.
 *
 * <p>This module has no React dependencies so the service worker +
 * plain-TS entry points (DPP SSE subscriber, etc.) can import
 * without pulling in the UI layer.</p>
 */

export interface StorageStatus {
  /** True once {@code navigator.storage.persist()} has returned true
   *  for this origin. Means the browser will NOT silently evict our
   *  IndexedDB under storage pressure and "Clear browsing data"
   *  prompts the user origin-by-origin rather than wiping us flat. */
  readonly persistent: boolean;
  /** Bytes currently used by this origin across every storage
   *  mechanism (IDB, Cache Storage, OPFS, localStorage). */
  readonly usage: number;
  /** Bytes the browser is willing to give us. Varies by device
   *  free space + browser heuristics. */
  readonly quota: number;
  /** usage / quota — convenience for banner rendering. */
  readonly pressureRatio: number;
  /** True when the browser is a known persistence-friendly vendor
   *  (Chrome/Edge/Firefox). Safari + legacy browsers need extra
   *  care; UI shows a different message for those. */
  readonly browserSupported: boolean;
  /** Whether we're running inside the installed PWA window (CSS
   *  display-mode: standalone) or still in a browser tab. Chrome +
   *  Edge only grant persistence when the user is accessing from
   *  the installed app — a new install viewed in the original
   *  browser tab still fails {@link StorageStatus#persistent}. */
  readonly standalone: boolean;
  /** Status of the Notifications permission. On Chrome/Edge a
   *  granted notifications permission is one of the side-channel
   *  signals that trips persistence-eligibility. We offer it as a
   *  fallback path when install alone isn't enough to grant. */
  readonly notificationsPermission: NotificationPermission | 'unsupported';
}

/**
 * Ask the browser to mark this origin's storage as persistent.
 * Idempotent — safe to call every launch. Returns the final grant
 * state so callers can gate degraded-mode behaviour without
 * re-querying.
 *
 * <p>Chrome / Edge auto-grant for PWA-installed origins and for
 * origins with high engagement scores. Firefox always prompts the
 * user with a persistent-storage dialog. Safari grants post-Add-to-
 * Home-Screen; without install, DBE storage is capped at 7 days
 * without engagement.</p>
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage || typeof storage.persist !== 'function') {
    return false;
  }
  try {
    if (typeof storage.persisted === 'function') {
      const already = await storage.persisted();
      if (already) {
        return true;
      }
    }
    return await storage.persist();
  } catch {
    return false;
  }
}

/** Read-only snapshot of the current storage posture. Used by the
 *  degraded-mode banner + the Peers continuity card. */
export async function storageStatus(): Promise<StorageStatus> {
  const storage = navigator.storage;
  const supported = !!storage && typeof storage.persist === 'function';
  let persistent = false;
  let usage = 0;
  let quota = 0;

  if (supported) {
    try {
      if (typeof storage.persisted === 'function') {
        persistent = await storage.persisted();
      }
      if (typeof storage.estimate === 'function') {
        const est = await storage.estimate();
        usage = est.usage ?? 0;
        quota = est.quota ?? 0;
      }
    } catch {
      // Opaque storage error — treat as degraded.
    }
  }

  return {
    persistent,
    usage,
    quota,
    pressureRatio: quota > 0 ? usage / quota : 0,
    browserSupported: supported,
    standalone: isStandalone(),
    notificationsPermission: notificationsPermission(),
  };
}

/** True when the page is running in the installed PWA shell —
 *  display-mode:standalone on Chrome/Edge/Android, or the iOS
 *  navigator.standalone flag. Chrome's persistence heuristic
 *  requires standalone before it'll grant. */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) {
      return true;
    }
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) {
      return true;
    }
    // iOS doesn't implement display-mode; falls back to a vendor
    // flag on the navigator.
    if ((navigator as unknown as { standalone?: boolean }).standalone) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function notificationsPermission(): NotificationPermission | 'unsupported' {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/** Ask the user for Notifications permission. On Chrome + Edge a
 *  granted Notifications permission is one of the side-channels
 *  that trips persistence-eligibility — a useful fallback when
 *  install alone isn't enough. Returns the final permission state
 *  regardless of whether it was already granted. */
export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

const CHANNEL_NAME = 'der-dbe';

/**
 * Lazy singleton {@link BroadcastChannel} for cross-tab DBE
 * coordination. Opens on first access, closes automatically on
 * unload. Consumers subscribe via {@link onDbeMessage} rather than
 * touching the raw channel.
 */
let channel: BroadcastChannel | null = null;

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'function') return null;
  channel = new BroadcastChannel(CHANNEL_NAME);
  window.addEventListener('beforeunload', () => {
    channel?.close();
    channel = null;
  });
  return channel;
}

/** Event taxonomy — strongly typed so handlers don't drift. */
export type DbeEvent =
  | { kind: 'metadata.synced'; fingerprint: string; at: string }
  | { kind: 'queue.enqueued';  entryId: number; url: string }
  | { kind: 'queue.drained';   drained: number; remaining: number }
  | { kind: 'session.opened';  sessionId: string; remoteDevice: string }
  | { kind: 'session.closed';  sessionId: string };

export function broadcast(event: DbeEvent): void {
  ensureChannel()?.postMessage(event);
}

export function onDbeMessage(
  handler: (event: DbeEvent) => void,
): () => void {
  const ch = ensureChannel();
  if (!ch) return () => undefined;
  const listener = (msg: MessageEvent<DbeEvent>): void => handler(msg.data);
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}
