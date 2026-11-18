import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@dhis2/ui';

import {
  installPromptReady,
  onInstallPromptChange,
  promptInstall,
} from './pwaInstall';
import {
  isStandalone,
  requestNotifications,
  requestPersistentStorage,
  storageStatus,
  type StorageStatus,
} from './storage';

/**
 * Full-screen blocking modal that gates the DER client until the
 * operator has a storage path the browser will honour under memory
 * pressure + "clear browsing data". Walks through three concrete
 * recovery steps (install → open from app → grant notifications)
 * tailored to the actual browser state, since persistence is a
 * multi-signal heuristic on Chrome/Edge — install alone often isn't
 * enough.
 *
 * <p>Decision tree the modal walks:
 * <pre>
 *   persistent granted ────────────────► unmount (modal hidden)
 *   acknowledged dismissal ────────────► unmount
 *   NOT standalone ───► Step A: install PWA + open from installed icon
 *   standalone + no notifications ───► Step B: grant notifications so
 *                                       Chrome/Edge trip the persistence
 *                                       heuristic.
 *   standalone + notifications + still denied ───► Step C: diagnose +
 *                                                   operator override
 * </pre></p>
 *
 * <p>Styled with DER tokens (brand palette + surface + ink +
 * motion). Full-screen scrim covers the app behind; modal centers
 * with elevation shadow. Reduced-motion safe.</p>
 */
export function InstallBlocker(): JSX.Element | null {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [canPrompt, setCanPrompt] = useState<boolean>(installPromptReady());
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean>(readAcknowledged());

  const refresh = useCallback(async () => {
    const s = await storageStatus();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void storageStatus().then((s) => { if (!cancelled) setStatus(s); });
    const off = onInstallPromptChange(setCanPrompt);
    return () => { cancelled = true; off(); };
  }, []);

  const platform = useMemo(() => detectPlatform(), []);

  if (!status) return null;
  if (status.persistent) return null;
  if (!status.browserSupported) return null;
  if (acknowledged) return null;

  const stage = decideStage(status, canPrompt);

  const handleInstall = async (): Promise<void> => {
    setBusy('install');
    setFeedback(null);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        setFeedback('Installed. Close this tab, then open DER from your '
          + platformAppsLocation(platform) + ' to activate persistence.');
      } else {
        setFeedback('Install dismissed. Follow the manual steps below.');
      }
    } catch (ex) {
      setFeedback(`Install failed: ${(ex as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleNotifications = async (): Promise<void> => {
    setBusy('notifications');
    setFeedback(null);
    try {
      const result = await requestNotifications();
      if (result === 'granted') {
        // Chrome/Edge trip the persistence grant on the next persist()
        // call after notifications are granted — re-request immediately.
        const granted = await requestPersistentStorage();
        const s = await refresh();
        if (granted || s.persistent) {
          setFeedback('Persistence granted — you are protected.');
        } else {
          setFeedback('Notifications granted but persistence still '
            + 'declined. Try the Diagnose panel below.');
        }
      } else {
        setFeedback(`Notifications ${result}. Some browsers require them `
          + 'to grant persistence.');
      }
    } catch (ex) {
      setFeedback(`Notifications request failed: ${(ex as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleRequest = async (): Promise<void> => {
    setBusy('request');
    setFeedback(null);
    try {
      const granted = await requestPersistentStorage();
      const s = await refresh();
      if (granted || s.persistent) {
        setFeedback('Persistence granted.');
      } else {
        setFeedback('Browser declined. Follow the next step below.');
      }
    } catch (ex) {
      setFeedback(`Request failed: ${(ex as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleRecheck = async (): Promise<void> => {
    setBusy('recheck');
    const s = await refresh();
    setBusy(null);
    if (s.persistent) {
      setFeedback('Confirmed — you are protected.');
    } else {
      setFeedback('Still no persistence. Try the next step.');
    }
  };

  const handleAcknowledge = (): void => {
    writeAcknowledged();
    setAcknowledged(true);
  };

  return (
    <div className="der-install-scrim" role="dialog"
      aria-modal="true" aria-labelledby="der-install-title">
      <div className="der-install-modal">
        <div className="der-install-hero">
          <InstallIcon />
          <h1 id="der-install-title" className="der-install-title">
            Protect your offline data
          </h1>
          <p className="der-install-subtitle">
            Without persistent storage, DER's queued submissions can
            be erased by the browser at any time. Finish one of the
            steps below to secure your clinic data.
          </p>
        </div>

        <StageContent stage={stage} platform={platform}
          canPrompt={canPrompt} status={status} />

        {feedback && (
          <div className="der-install-feedback">{feedback}</div>
        )}

        <div className="der-install-actions">
          {stage === 'install' && canPrompt && (
            <Button primary large loading={busy === 'install'}
              onClick={handleInstall}>
              Install DER
            </Button>
          )}
          {stage === 'install' && !canPrompt && (
            <Button primary large loading={busy === 'request'}
              onClick={handleRequest}>
              Request persistence
            </Button>
          )}
          {stage === 'open-installed' && (
            <Button large secondary loading={busy === 'recheck'}
              onClick={handleRecheck}>
              I’m in the installed app — re-check
            </Button>
          )}
          {stage === 'notifications' && (
            <Button primary large loading={busy === 'notifications'}
              onClick={handleNotifications}>
              Enable notifications &amp; grant persistence
            </Button>
          )}
          {stage === 'diagnose' && (
            <Button primary large loading={busy === 'request'}
              onClick={handleRequest}>
              Request persistence again
            </Button>
          )}
        </div>

        <DiagnosePanel status={status} platform={platform}
          canPrompt={canPrompt} />

        <button type="button" className="der-install-ack"
          onClick={handleAcknowledge}>
          Continue without installing — I understand my offline work
          may be lost if the browser clears its storage.
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

type Stage = 'install' | 'open-installed' | 'notifications' | 'diagnose';

function decideStage(status: StorageStatus, canPrompt: boolean): Stage {
  // iOS Safari + Firefox all skip directly to the install path —
  // they don't have Chrome's notification-based heuristic.
  if (!status.standalone) {
    // Still in a browser tab. Install (if not already) + open from
    // the installed app icon.
    if (canPrompt) return 'install';
    return 'install';
  }
  // We're in standalone mode but persistence still denied. On
  // Chrome/Edge, notifications-granted is the most reliable
  // side-signal.
  if (status.notificationsPermission !== 'granted'
      && status.notificationsPermission !== 'unsupported') {
    return 'notifications';
  }
  // Last-resort — just ask again with a diagnose panel so the
  // operator can see the full state.
  return 'diagnose';
}

const ACK_KEY = 'der.install.ack';
function readAcknowledged(): boolean {
  try { return window.localStorage.getItem(ACK_KEY) === '1'; }
  catch { return false; }
}
function writeAcknowledged(): void {
  try { window.localStorage.setItem(ACK_KEY, '1'); }
  catch { /* ignore */ }
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

function platformAppsLocation(platform: Platform): string {
  switch (platform.kind) {
    case 'android': return 'app drawer';
    case 'ios': return 'home screen';
    case 'windows': return 'Start menu';
    case 'macos': return 'Launchpad';
    case 'linux': return 'Applications menu';
    default: return 'app list';
  }
}

interface StageContentProps {
  stage: Stage;
  platform: Platform;
  canPrompt: boolean;
  status: StorageStatus;
}

function StageContent({ stage, platform, canPrompt, status }: StageContentProps): JSX.Element {
  if (stage === 'install') {
    return (
      <>
        <StepHeader
          title={canPrompt ? 'Step 1 of 2 — Install DER'
            : 'Step 1 of 2 — Install DER from your browser menu'} />
        <PlatformInstallSteps platform={platform} canPrompt={canPrompt} />
      </>
    );
  }
  if (stage === 'open-installed') {
    return (
      <>
        <StepHeader title="Step 2 of 2 — Open DER from the installed app" />
        <ol className="der-install-steps">
          <li>
            <span className="der-install-step-num">1</span>
            <div>Close this browser tab.</div>
          </li>
          <li>
            <span className="der-install-step-num">2</span>
            <div>Open DER from your <strong>{platformAppsLocation(platform)}</strong>.</div>
          </li>
          <li>
            <span className="der-install-step-num">3</span>
            <div>Sign in again if prompted. Persistent storage
              activates automatically in the installed app.</div>
          </li>
        </ol>
      </>
    );
  }
  if (stage === 'notifications') {
    return (
      <>
        <StepHeader title="Almost there — grant notifications to activate persistence" />
        <p className="der-install-explain">
          You're running the installed app ✓ but {platform.browser === 'chrome' || platform.browser === 'edge' ? 'Chrome' : 'your browser'} needs
          one more signal before it grants persistent storage.
          Granting notifications permission (used only for critical
          sync alerts) satisfies the check.
        </p>
        <p className="der-install-explain-muted">
          DER only uses notifications for sync failures and peer
          reconnection prompts — never for marketing.
        </p>
      </>
    );
  }
  return (
    <>
      <StepHeader title="Persistence still declined — diagnose below" />
      <p className="der-install-explain">
        Your browser is refusing persistent storage despite the
        installed app running. Check the diagnostic panel below;
        the engagement score typically builds over a few sessions
        and persistence grants automatically. For now you can
        continue — queued data is still safe for the current
        browser session.
      </p>
      <p className="der-install-explain-muted">
        Running in standalone: {status.standalone ? 'yes' : 'no'} ·
        Notifications: {status.notificationsPermission} ·
        Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'other'}
      </p>
    </>
  );
}

function StepHeader({ title }: { title: string }): JSX.Element {
  return <div className="der-install-stage-title">{title}</div>;
}

function PlatformInstallSteps({ platform, canPrompt }: { platform: Platform; canPrompt: boolean }): JSX.Element {
  if (canPrompt) {
    return (
      <ol className="der-install-steps">
        <li>
          <span className="der-install-step-num">1</span>
          <div>Click <strong>Install DER</strong> below. Your
            browser will show its own install dialog.</div>
        </li>
        <li>
          <span className="der-install-step-num">2</span>
          <div>Confirm. DER adds itself to your
            {' '}<strong>{platformAppsLocation(platform)}</strong>.</div>
        </li>
        <li>
          <span className="der-install-step-num">3</span>
          <div>Close this tab and reopen DER from the installed icon.</div>
        </li>
      </ol>
    );
  }
  switch (platform.kind) {
    case 'ios':
      return (
        <ol className="der-install-steps">
          <li><span className="der-install-step-num">1</span>
            <div>Tap the <strong>Share</strong> button at the bottom
              of Safari.</div></li>
          <li><span className="der-install-step-num">2</span>
            <div>Scroll down and tap
              <strong> Add to Home Screen</strong>.</div></li>
          <li><span className="der-install-step-num">3</span>
            <div>Tap <strong>Add</strong>, then open DER from the
              new home-screen icon.</div></li>
        </ol>
      );
    case 'android':
      return (
        <ol className="der-install-steps">
          <li><span className="der-install-step-num">1</span>
            <div>Open your browser's menu (three dots, top-right).</div></li>
          <li><span className="der-install-step-num">2</span>
            <div>Tap <strong>Install app</strong> (or "Add to Home
              screen").</div></li>
          <li><span className="der-install-step-num">3</span>
            <div>Confirm. Reopen DER from your app drawer.</div></li>
        </ol>
      );
    default:
      return (
        <ol className="der-install-steps">
          <li><span className="der-install-step-num">1</span>
            <div>Look for the install icon in your address bar OR
              open the three-dot browser menu.</div></li>
          <li><span className="der-install-step-num">2</span>
            <div>Choose <strong>Install DER</strong>.</div></li>
          <li><span className="der-install-step-num">3</span>
            <div>Reopen DER from{' '}
              <strong>{platformAppsLocation(platform)}</strong>.</div></li>
        </ol>
      );
  }
}

interface DiagnosePanelProps {
  status: StorageStatus;
  platform: Platform;
  canPrompt: boolean;
}

/** Collapsible diagnostic surface — operators can expand to see the
 *  exact state of every signal that feeds persistence. Mostly for
 *  debugging in the field without opening devtools. */
function DiagnosePanel({ status, platform, canPrompt }: DiagnosePanelProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <details className="der-install-diagnose"
      open={open} onToggle={(ev) =>
        setOpen((ev.target as HTMLDetailsElement).open)}>
      <summary>Diagnose storage state</summary>
      <dl>
        <dt>Persistent storage</dt>
        <dd>{status.persistent ? 'granted' : 'not granted'}</dd>
        <dt>Running as installed app</dt>
        <dd>{isStandalone() ? 'yes (standalone)' : 'no (browser tab)'}</dd>
        <dt>Install prompt captured</dt>
        <dd>{canPrompt ? 'yes' : 'no — use manual steps'}</dd>
        <dt>Notifications permission</dt>
        <dd>{status.notificationsPermission}</dd>
        <dt>Platform</dt>
        <dd>{platform.label} · {platform.browser}</dd>
        <dt>Storage quota</dt>
        <dd>
          {status.quota > 0
            ? `${Math.round(status.usage / 1024)} KB of ${Math.round(status.quota / 1_048_576)} MB`
            : 'not reported'}
        </dd>
      </dl>
    </details>
  );
}

function InstallIcon(): JSX.Element {
  return (
    <svg className="der-install-icon" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="derInstallGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--der-brand-500, #0d2e5c)" />
          <stop offset="100%" stopColor="var(--der-brand-700, #082148)" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#derInstallGrad)" />
      <path d="M24 12 L24 30 M16 22 L24 30 L32 22"
        fill="none" stroke="white" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 36 L36 36" fill="none" stroke="white"
        strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
