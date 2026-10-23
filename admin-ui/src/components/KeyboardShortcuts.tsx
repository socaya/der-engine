import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * C4: global keyboard shortcuts.
 *   g + h  → Overview
 *   g + j  → Jobs
 *   g + c  → Conflicts (journal)
 *   g + m  → Metadata
 *   g + d  → Devices
 *   g + a  → Apps
 *   g + u  → Users
 *   g + s  → Settings
 *   /      → focus the first search input on the page
 *   ?      → open the help modal
 * Shortcuts are ignored while an input/textarea/contentEditable is focused.
 */

const G_MAP: Record<string, string> = {
  h: '/',
  j: '/sync/jobs',
  c: '/journal/conflicts',
  m: '/metadata',
  d: '/devices',
  a: '/apps',
  u: '/provisioning/users',
  s: '/settings',
  o: '/compat', // o = overview compat
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function KeyboardShortcuts(): JSX.Element {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [gPending, setGPending] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (isTyping(e.target)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }
      if (e.key === 'Escape') {
        setShowHelp(false);
        setGPending(false);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        const search = document.querySelector(
          'input[type="search"], input[type="text"]',
        ) as HTMLInputElement | null;
        search?.focus();
        return;
      }
      if (!gPending && e.key === 'g') {
        setGPending(true);
        setTimeout(() => setGPending(false), 1500);
        return;
      }
      if (gPending && G_MAP[e.key]) {
        navigate(G_MAP[e.key]);
        setGPending(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gPending, navigate]);

  if (!showHelp) return <></>;

  return (
    <div
      className="ea-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ea-help-title"
      data-test="help-overlay"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="ea-help-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ea-help-head">
          <h2 id="ea-help-title">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            aria-label="Close"
            data-test="help-close"
          >
            ✕
          </button>
        </div>
        <dl className="ea-help-dl">
          <dt><kbd>?</kbd></dt><dd>Open / close this help</dd>
          <dt><kbd>/</kbd></dt><dd>Focus the first search field on the page</dd>
          <dt><kbd>Esc</kbd></dt><dd>Dismiss modals or blur the active input</dd>
          <dt><kbd>g</kbd> <kbd>h</kbd></dt><dd>Overview</dd>
          <dt><kbd>g</kbd> <kbd>j</kbd></dt><dd>Jobs</dd>
          <dt><kbd>g</kbd> <kbd>c</kbd></dt><dd>Conflicts</dd>
          <dt><kbd>g</kbd> <kbd>m</kbd></dt><dd>Metadata</dd>
          <dt><kbd>g</kbd> <kbd>d</kbd></dt><dd>Devices</dd>
          <dt><kbd>g</kbd> <kbd>a</kbd></dt><dd>Apps</dd>
          <dt><kbd>g</kbd> <kbd>u</kbd></dt><dd>Users</dd>
          <dt><kbd>g</kbd> <kbd>o</kbd></dt><dd>Compatibility</dd>
          <dt><kbd>g</kbd> <kbd>s</kbd></dt><dd>Settings</dd>
        </dl>
      </div>
    </div>
  );
}
