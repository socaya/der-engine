import { useEffect, useMemo, useState } from 'react';
import { Button } from '@dhis2/ui';

import {
  installPromptReady,
  onInstallPromptChange,
  promptInstall,
} from './pwaInstall';
import {
  requestPersistentStorage,
  storageStatus,
  type StorageStatus,
} from './storage';

/**
 * Full-screen blocking modal that gates the DER client until the
 * operator either (a) installs the PWA / gets persistent storage,
 * or (b) explicitly accepts the risk that queued submissions may be
 * evicted.
 *
 * <p>Design intent: a clinic tablet on first launch MUST make a
 * deliberate decision about storage durability before any work
 * starts — otherwise the operator fills in forms, queues them
 * offline, then loses them when the browser clears its cache. The
 * modal replaces the old topbar chip + banner-above-app, both of
 * which were easy to ignore.</p>
 *
 * <p>Platform-aware install path:
 * <ul>
 *   <li>Chrome / Edge (any OS) — one-click "Install DER" button
 *       backed by the captured {@code beforeinstallprompt} event.
 *       Native browser install dialog fires immediately.</li>
 *   <li>Safari iOS / iPadOS — visual guide for Share → Add to
 *       Home Screen. Operator confirms via "I've installed" button
 *       which re-probes persistence on next launch.</li>
 *   <li>Safari macOS 17+ — Dock install via menu bar; guide + same
 *       confirm pattern.</li>
 *   <li>Firefox — "Request persistence" button triggers the
 *       browser's native persistent-storage dialog (Firefox's
 *       equivalent of PWA install for grant purposes).</li>
 *   <li>Fallback — operator-chosen folder backup instructions via
 *       File System Access (Chrome/Edge) or OS file manager
 *       (Safari/Firefox).</li>
 * </ul></p>
 *
 * <p>Styled with DER tokens from app-sdk/tokens.css — brand palette,
 * surface + ink levels, motion curves. Full-screen scrim covers the
 * app behind; modal centers with elevation shadow. Reduced-motion
 * safe (the backdrop fade honours prefers-reduced-motion).</p>
 */
export function InstallBlocker(): JSX.Element | null {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [canPrompt, setCanPrompt] = useState<boolean>(installPromptReady());
  const [installing, setInstalling] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean>(() =>
    readAcknowledged());

  useEffect(() => {
    let cancelled = false;
    const tick = async (): Promise<void> => {
      const s = await storageStatus();
      if (!cancelled) setStatus(s);
    };
    void tick();
    const off = onInstallPromptChange(setCanPrompt);
    return () => { cancelled = true; off(); };
  }, []);

  const platform = useMemo(() => detectPlatform(), []);

  if (!status) return null;
  // Persistent-storage granted → never block.
  if (status.persistent) return null;
  // Browser can't do persistence at all (ancient browser) → show a
  // warning but don't block (user can't do anything about it).
  if (!status.browserSupported) return null;
  // Operator explicitly accepted the risk → honour until they clear
  // storage (the acknowledgment lives in localStorage).
  if (acknowledged) return null;

  const handleInstall = async (): Promise<void> => {
    setInstalling(true);
    setFeedback(null);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        // Browser will fire 'appinstalled' + eventually grant
        // persistence on next load. Re-poll storage to pick up the
        // change if it happens immediately.
        const s = await storageStatus();
        setStatus(s);
        setFeedback('Installed. Persistent storage will activate shortly.');
      } else {
        setFeedback('Install dismissed. Try "Request persistence" or '
          + 'the manual steps for your device.');
      }
    } catch (ex) {
      setFeedback(`Install failed: ${(ex as Error).message}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleRequest = async (): Promise<void> => {
    setRequesting(true);
    setFeedback(null);
    try {
      const granted = await requestPersistentStorage();
      if (granted) {
        const s = await storageStatus();
        setStatus(s);
        setFeedback('Persistent storage granted.');
      } else {
        setFeedback('Browser declined. Install via the steps below '
          + 'and try again.');
      }
    } catch (ex) {
      setFeedback(`Request failed: ${(ex as Error).message}`);
    } finally {
      setRequesting(false);
    }
  };

  const handleAcknowledge = (): void => {
    writeAcknowledged();
    setAcknowledged(true);
  };

  const handleIveInstalled = async (): Promise<void> => {
    // User says they've installed via the manual steps — re-probe
    // persistence. Browsers auto-grant on next PWA-origin load, so
    // this is a hint for them to refresh.
    const s = await storageStatus();
    setStatus(s);
    if (!s.persistent) {
      setFeedback('Still no persistence — try reloading the page '
        + 'from the installed app (home-screen icon).');
    }
  };

  return (
    <div className="der-install-scrim" role="dialog"
      aria-modal="true" aria-labelledby="der-install-title">
      <div className="der-install-modal">
        <div className="der-install-hero">
          <svg className="der-install-icon" viewBox="0 0 48 48" aria-hidden="true">
            <defs>
              <linearGradient id="derInstallGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--der-brand-500)" />
                <stop offset="100%" stopColor="var(--der-brand-700)" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="22" fill="url(#derInstallGrad)" />
            <path d="M24 12 L24 30 M16 22 L24 30 L32 22"
              fill="none" stroke="white" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 36 L36 36" fill="none" stroke="white"
              strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h1 id="der-install-title" className="der-install-title">
            Install DER for offline-safe clinic use
          </h1>
          <p className="der-install-subtitle">
            Installing DER on this device guarantees your queued
            submissions survive browser restarts, cache clears, and
            storage pressure. Without install, the browser may evict
            offline data at any time.
          </p>
        </div>

        <PlatformGuide platform={platform} canPrompt={canPrompt} />

        {feedback && (
          <div className="der-install-feedback">{feedback}</div>
        )}

        <div className="der-install-actions">
          {canPrompt && (
            <Button primary large loading={installing}
              onClick={handleInstall}>
              Install DER
            </Button>
          )}
          {!canPrompt && platform.kind !== 'ios' && (
            <Button primary large loading={requesting}
              onClick={handleRequest}>
              Request persistence
            </Button>
          )}
          {!canPrompt && (
            <Button large secondary onClick={handleIveInstalled}>
              I’ve installed — re-check
            </Button>
          )}
        </div>

        <button type="button"
          className="der-install-ack"
          onClick={handleAcknowledge}>
          Continue without installing — I understand my offline work
          may be lost if the browser clears its storage.
        </button>
      </div>
    </div>
  );
}

// ---- helpers ----

const ACK_KEY = 'der.install.ack';

function readAcknowledged(): boolean {
  try {
    return window.localStorage.getItem(ACK_KEY) === '1';
  } catch { return false; }
}

function writeAcknowledged(): void {
  try { window.localStorage.setItem(ACK_KEY, '1'); } catch { /* ignore */ }
}

interface Platform {
  readonly kind: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown';
  readonly browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'unknown';
  readonly label: string;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  const kind: Platform['kind'] =
    /android/.test(ua) ? 'android'
    : /iphone|ipad|ipod/.test(ua) ? 'ios'
    : /windows|win64|win32/.test(ua) ? 'windows'
    : /macintosh|mac os x/.test(ua) ? 'macos'
    : /linux/.test(ua) ? 'linux'
    : 'unknown';
  const browser: Platform['browser'] =
    ua.includes('edg/') ? 'edge'
    : /firefox|fxios/.test(ua) ? 'firefox'
    : ua.includes('chrome') ? 'chrome'
    : /safari/.test(ua) && kind !== 'android' ? 'safari'
    : 'unknown';
  const labels: Record<Platform['kind'], string> = {
    android: 'Android', ios: 'iOS / iPadOS', windows: 'Windows',
    macos: 'macOS', linux: 'Linux', unknown: 'this device',
  };
  return { kind, browser, label: labels[kind] };
}

interface PlatformGuideProps {
  readonly platform: Platform;
  readonly canPrompt: boolean;
}

/** Visual, step-by-step guide per OS + browser. Keeps the copy
 *  short + concrete so a nurse can follow it without help. */
function PlatformGuide({ platform, canPrompt }: PlatformGuideProps): JSX.Element {
  if (canPrompt) {
    return (
      <ol className="der-install-steps">
        <li>
          <span className="der-install-step-num">1</span>
          <div>
            <strong>Click “Install DER” below.</strong>{' '}
            Your browser will show its own install dialog.
          </div>
        </li>
        <li>
          <span className="der-install-step-num">2</span>
          <div>
            <strong>Confirm the install.</strong>{' '}
            DER will add itself to your {platform.label} apps.
          </div>
        </li>
        <li>
          <span className="der-install-step-num">3</span>
          <div>
            <strong>Reopen from your {platform.label} apps list.</strong>{' '}
            That grants persistent storage automatically — this
            screen won’t show again.
          </div>
        </li>
      </ol>
    );
  }
  switch (platform.kind) {
    case 'ios':
      return (
        <ol className="der-install-steps">
          <li>
            <span className="der-install-step-num">1</span>
            <div>Tap the <strong>Share</strong> button at the bottom
              of Safari (square with the arrow pointing up).</div>
          </li>
          <li>
            <span className="der-install-step-num">2</span>
            <div>Scroll down and tap <strong>Add to Home Screen</strong>.</div>
          </li>
          <li>
            <span className="der-install-step-num">3</span>
            <div>Tap <strong>Add</strong>. Then open DER from your
              home-screen icon — this screen won’t show again.</div>
          </li>
        </ol>
      );
    case 'android':
      return (
        <ol className="der-install-steps">
          <li>
            <span className="der-install-step-num">1</span>
            <div>Open your browser’s menu (three dots, top-right).</div>
          </li>
          <li>
            <span className="der-install-step-num">2</span>
            <div>Tap <strong>Install app</strong> (or “Add to Home
              screen”).</div>
          </li>
          <li>
            <span className="der-install-step-num">3</span>
            <div>Confirm. DER appears in your app drawer —
              reopen from there.</div>
          </li>
        </ol>
      );
    case 'windows':
    case 'macos':
    case 'linux':
      return (
        <ol className="der-install-steps">
          <li>
            <span className="der-install-step-num">1</span>
            <div>Look for the install icon in your address bar
              (a small computer with a down-arrow), or open the
              three-dot browser menu.</div>
          </li>
          <li>
            <span className="der-install-step-num">2</span>
            <div>Choose <strong>Install DER</strong>.</div>
          </li>
          <li>
            <span className="der-install-step-num">3</span>
            <div>Reopen DER from{' '}
              {platform.kind === 'windows' ? 'Start menu'
                : platform.kind === 'macos' ? 'Launchpad'
                : 'Applications'}.</div>
          </li>
        </ol>
      );
    default:
      return (
        <p className="der-install-fallback">
          Use your browser’s <strong>Install app</strong> option
          (usually in the main menu). After install, reopen from
          your apps list.
        </p>
      );
  }
}
