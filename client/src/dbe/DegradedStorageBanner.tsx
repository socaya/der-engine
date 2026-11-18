import { useEffect, useState } from 'react';
import { Button, NoticeBox } from '@dhis2/ui';

import { storageStatus, type StorageStatus,
  requestPersistentStorage } from './storage';
import {
  installHintForBrowser,
  installPromptReady,
  onInstallPromptChange,
  promptInstall,
} from './pwaInstall';

/**
 * Banner surfaced in {@code DerShell} whenever this origin doesn't
 * have persistent-storage grant. Explains the real risk — "clear
 * browsing data" could wipe your queued submissions — and offers
 * one of two action paths depending on what the browser allows:
 *
 * <ol>
 *   <li>If we captured a {@code beforeinstallprompt} event, show
 *       a native-prompt "Install DER" button that triggers the
 *       browser's own install dialog. Chrome + Edge path.</li>
 *   <li>Otherwise show a browser-specific text hint ("in Safari
 *       tap Share → Add to Home Screen", etc.) so the operator can
 *       find the install affordance without us guessing. Also
 *       offers "Request persistence" to retry the API (Firefox's
 *       path — it just prompts the user with a native dialog).</li>
 * </ol>
 *
 * Hidden entirely when persistence is granted.
 */
export function DegradedStorageBanner(): JSX.Element | null {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [canPrompt, setCanPrompt] = useState<boolean>(installPromptReady());
  const [installing, setInstalling] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    storageStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    const off = onInstallPromptChange(setCanPrompt);
    return () => { cancelled = true; off(); };
  }, []);

  if (!status) return null;
  if (status.persistent) return null;

  const handleInstall = async (): Promise<void> => {
    setInstalling(true);
    setFeedback(null);
    try {
      const outcome = await promptInstall();
      setFeedback(outcome === 'accepted'
        ? 'Installed. Persistent storage will activate on next launch.'
        : 'Install dismissed. You can re-install later from the browser menu.');
    } catch (ex) {
      setFeedback(`Install failed: ${(ex as Error).message}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleRetry = async (): Promise<void> => {
    setRetrying(true);
    setFeedback(null);
    try {
      const granted = await requestPersistentStorage();
      if (granted) {
        setFeedback('Persistent storage granted. This banner will disappear.');
        setStatus({ ...status, persistent: true });
      } else {
        setFeedback('Browser declined. Install the PWA (steps below) to try again.');
      }
    } catch (ex) {
      setFeedback(`Request failed: ${(ex as Error).message}`);
    } finally {
      setRetrying(false);
    }
  };

  if (!status.browserSupported) {
    return (
      <NoticeBox warning title="Limited offline storage">
        This browser doesn’t support persistent storage. Queued
        offline submissions may be lost if you clear browsing data
        or the browser evicts storage under pressure. For full
        offline protection, use Chrome, Edge, or Firefox.
      </NoticeBox>
    );
  }

  const pct = Math.round(status.pressureRatio * 100);

  return (
    <NoticeBox warning title="Install DER for full offline protection">
      <p>
        The browser hasn’t granted DER persistent storage, so clearing
        browsing data or storage pressure could evict queued offline
        submissions. Fix it:
      </p>
      <div className="der-degraded-actions">
        {canPrompt && (
          <Button small primary loading={installing} onClick={handleInstall}>
            Install DER
          </Button>
        )}
        <Button small secondary loading={retrying} onClick={handleRetry}>
          Request persistence
        </Button>
      </div>
      {!canPrompt && (
        <p className="der-degraded-hint">
          <strong>How to install:</strong> {installHintForBrowser()}
        </p>
      )}
      {feedback && (
        <p className="der-degraded-feedback">{feedback}</p>
      )}
      {status.quota > 0 && (
        <p className="der-degraded-usage">
          Current usage: <strong>{pct}%</strong> of {Math.round(status.quota / 1_048_576)} MB.
        </p>
      )}
    </NoticeBox>
  );
}
