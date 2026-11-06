import { useEffect, useState } from 'react';

/**
 * Observes the browser's `navigator.onLine` + `online`/`offline` events.
 *
 * Note: `navigator.onLine` is "I have a network interface" — not "central
 * DHIS2 is reachable". For the latter, the device client already polls
 * `/edge-api/v1/system/health` via the OfflineBanner path. This hook is
 * the browser-level signal that governs whether the offline-capture
 * queue intercepts writes or passes them through.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}
