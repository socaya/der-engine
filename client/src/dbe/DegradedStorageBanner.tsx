import { useEffect, useState } from 'react';
import { NoticeBox } from '@dhis2/ui';

import { storageStatus, type StorageStatus } from './storage';

/**
 * Banner surfaced in {@code DerShell} whenever this origin doesn't
 * have persistent-storage grant. Communicates the real risk —
 * "clear browsing data" could wipe your queued submissions — in a
 * way an operator can act on (install the PWA, confirm the browser
 * dialog).
 *
 * <p>Hidden when persistence is granted; shown with varied messaging
 * for supported-but-not-granted vs unsupported-browser cases so the
 * operator doesn't see a spurious warning on a browser that can't
 * do better.</p>
 */
export function DegradedStorageBanner(): JSX.Element | null {
  const [status, setStatus] = useState<StorageStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    storageStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => { cancelled = true; };
  }, []);

  if (!status) return null;
  if (status.persistent) return null;

  if (!status.browserSupported) {
    return (
      <NoticeBox warning title="Limited offline storage">
        This browser doesn’t support persistent storage. Queued
        offline submissions may be lost if you clear browsing data
        or if the browser evicts storage under pressure. For
        full offline protection, use Chrome, Edge, or Firefox.
      </NoticeBox>
    );
  }

  const pct = Math.round(status.pressureRatio * 100);
  return (
    <NoticeBox warning title="Install DER for full offline protection">
      The browser hasn’t granted DER persistent storage, so clearing
      browsing data or storage pressure could evict queued offline
      submissions. Add DER to your home screen (or confirm the
      browser’s persistent-storage prompt) to prevent data loss.
      {status.quota > 0 && (
        <> Current usage: <strong>{pct}%</strong> of available quota.</>
      )}
    </NoticeBox>
  );
}
