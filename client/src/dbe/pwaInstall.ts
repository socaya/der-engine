/**
 * Captures the browser's {@code beforeinstallprompt} event so the
 * DegradedStorageBanner can offer a real Install button instead of
 * just text instructions. Browsers only fire this event when their
 * PWA eligibility criteria are met (HTTPS, valid manifest, SW
 * registered, not already installed) — on devices that don't fire
 * it, the banner falls back to a textual guide.
 *
 * <p>Chrome/Edge fire {@code beforeinstallprompt}. Safari never
 * does (iOS requires the operator to pick "Add to Home Screen" from
 * the share sheet). Firefox never fires it either (address-bar
 * house icon is the install affordance).</p>
 */

type BeforeInstallPromptEvent = Event & {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
};

let captured: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(ready: boolean) => void>();

/** Install the event listener exactly once. Safe to call every app
 *  boot; a second call is a no-op. Must run before the browser fires
 *  the event — called from main.tsx at module load. */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  // Idempotent guard — a hot-reload during dev could add duplicate
  // listeners otherwise.
  if ((window as unknown as { __derInstallCaptured?: boolean })
      .__derInstallCaptured) {
    return;
  }
  (window as unknown as { __derInstallCaptured?: boolean })
    .__derInstallCaptured = true;

  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    captured = ev as BeforeInstallPromptEvent;
    for (const l of listeners) l(true);
  });
  window.addEventListener('appinstalled', () => {
    captured = null;
    for (const l of listeners) l(false);
  });
}

/** True when we're holding a prompt event ready to fire. UI uses this
 *  to swap "Install" button for a "how to install" help link. */
export function installPromptReady(): boolean {
  return captured !== null;
}

/** Subscribe to prompt-ready state changes. Returns an unregister
 *  callback. Fires once synchronously with the current state so
 *  components initialise correctly. */
export function onInstallPromptChange(
  listener: (ready: boolean) => void,
): () => void {
  listeners.add(listener);
  listener(captured !== null);
  return () => { listeners.delete(listener); };
}

/** Fire the browser's native install prompt. Returns the user's
 *  choice. Throws if no prompt was captured — callers should gate
 *  with {@link installPromptReady}. */
export async function promptInstall(): Promise<'accepted' | 'dismissed'> {
  if (!captured) {
    throw new Error('no install prompt captured yet');
  }
  await captured.prompt();
  const { outcome } = await captured.userChoice;
  captured = null;
  for (const l of listeners) l(false);
  return outcome;
}

/** Best-effort browser detection so the fallback text can tell the
 *  operator exactly where to find the "Add to Home Screen" item.
 *  Deliberately coarse — it's a UX hint, not a security boundary. */
export function installHintForBrowser(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'In Safari, tap the Share button (square with an arrow), '
      + 'then choose “Add to Home Screen”.';
  }
  if (ua.includes('firefox')) {
    return 'In Firefox, tap the address bar’s house icon, '
      + 'then choose “Install”.';
  }
  if (ua.includes('edg/')) {
    return 'In Edge, open the three-dot menu → Apps → “Install DER”.';
  }
  if (ua.includes('chrome')) {
    return 'In Chrome, open the three-dot menu → “Install DER” '
      + '(or look for the install icon in the address bar).';
  }
  return 'Use your browser’s “Install app” or “Add to Home Screen” '
    + 'option (usually under the main menu).';
}
