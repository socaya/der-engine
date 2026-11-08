import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

import { EventWorkflow } from './features/EventWorkflow';
import { TrackerWorkflow } from './features/TrackerWorkflow';
import type { ProgramOpt, CaptureApi } from './shared/types';
import { CAPTURE_STYLES } from './shared/styles';
import { DirtyProvider, useAnyDirty } from './shared/DirtyContext';

/**
 * DER Capture — unified Tracker + Event capture app.
 *
 * <p>Requirements doc §1: "Build one Capture app". Tracker and
 * Event flows share one shell, one metadata adapter, one form
 * engine, one permission layer. The mode is derived from the
 * selected program's {@code programType} (never a user toggle).</p>
 *
 * <p>Layout mirrors the Data Entry app (sticky top toolbar with
 * title + info + online pill + context fields; content area
 * below; sticky action footer) so operators have one muscle
 * memory across both modules.</p>
 */
export default function CaptureApp(): JSX.Element {
  return (
    <DirtyProvider>
      <CaptureAppInner />
    </DirtyProvider>
  );
}

function CaptureAppInner(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi() as unknown as CaptureApi;

  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [programUid, setProgramUid] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Hash-based internal route lets the app expose deep links like
  // #/event and #/tracker without pulling a router in. Reserved
  // for G4+ (tracker list, TEI dashboard, enrolment create).
  const [hashRoute, setHashRoute] = useState<string>(() =>
    (typeof window !== 'undefined' ? window.location.hash.slice(1) : '')
    || '/');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = (): void => setHashRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Alt-key hotkeys — mirrors the Data Entry app so operators have
  // one keyboard-first muscle memory across Capture + Data Entry:
  //   • Alt+I  — toggle the About dataset popover
  //   • Alt+S  — click the currently-visible Save/Submit button
  //   • Alt+C  — click Complete (tracker stage editor only)
  // Modifier-only guard (no Meta / Ctrl / Shift); ev.code match so
  // macOS Option-layer dead-keys don't swallow the shortcut.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (!ev.altKey || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      if (ev.code === 'KeyI') {
        ev.preventDefault();
        setInfoOpen((v) => !v);
      } else if (ev.code === 'KeyS') {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-test="ce-submit-btn"]:not([disabled]),'
          + '[data-test="tr-editor-submit"]:not([disabled])');
        if (btn) { ev.preventDefault(); btn.click(); }
      } else if (ev.code === 'KeyC') {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-test="tr-editor-complete"]:not([disabled]),'
          + '[data-test="ce-complete"]:not([disabled])');
        if (btn) { ev.preventDefault(); btn.click(); }
      } else if (ev.code === 'KeyN') {
        // "+ Add event" in the tracker stage pane. No-op outside
        // the tracker dashboard — the selector simply misses.
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-test="tr-add-event"]:not([disabled])');
        if (btn) { ev.preventDefault(); btn.click(); }
      } else if (ev.code === 'KeyF') {
        // Focus the tracker search input. On the event side there
        // is no filter yet, so the selector misses and the shortcut
        // is a no-op — avoids silently hijacking Alt+F on pages
        // where it has nothing to focus.
        const input = document.querySelector<HTMLInputElement>(
          '[data-test="tr-search-input"]');
        if (input) { ev.preventDefault(); input.focus(); input.select(); }
      } else if (ev.code === 'KeyB') {
        // Back from TEI dashboard to the working list, or from the
        // stage editor back to the stage pane. First match wins;
        // the selector misses are no-ops on screens where neither
        // button is visible.
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-test="tr-editor-cancel"]:not([disabled]),'
          + '[data-test="tr-dash-back"]:not([disabled])');
        if (btn) { ev.preventDefault(); btn.click(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Fetch programs once the device is OU-bound.
  useEffect(() => {
    if (!ou.bound) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listPrograms(ou.orgUnitUid);
        if (cancelled) return;
        setPrograms(list.map((p) => ({
          id: p.id, displayName: p.displayName,
          programType: p.programType,
        })));
        // Auto-select the only assigned program so the operator
        // doesn't have to think when the facility runs one program.
        if (list.length === 1) setProgramUid(list[0].id);
      } catch (err) {
        if (!cancelled) {
          setLoadError('Failed to load programs: ' + (err as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ou.bound, ou.orgUnitUid, api]);

  const program = useMemo(
    () => programs.find((p) => p.id === programUid) ?? null,
    [programs, programUid]);
  // Derive the mode from metadata — never a toggle (§1, §22.5).
  const mode: 'event' | 'tracker' | null = program
    ? (program.programType === 'WITH_REGISTRATION' ? 'tracker' : 'event')
    : null;

  return (
    <ScreenCard dataTest="der-capture">
      <style>{CAPTURE_STYLES}</style>

      {/* Sticky top toolbar — mirrors the Data Entry layout:
       *   row 1: brand strip (icon + title + info + online + dirty)
       *   row 2: Bound OU + Program + Mode fields with labels
       *          stacked above each control. */}
      <div className="cap-toolbar" role="toolbar"
           aria-label="Capture toolbar">
        <div className="cap-toolbar__brand">
          <span className="cap-toolbar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <rect x="4" y="5" width="16" height="16" rx="3"
                    fill="none" stroke="#147CD7" strokeWidth="1.8"/>
              <rect x="9" y="3" width="6" height="4" rx="1"
                    fill="#147CD7"/>
              <path d="M8 12 l2.2 2.2 L16 8.4"
                    fill="none" stroke="#1E8E4A" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <h1 className="cap-toolbar__title">Capture</h1>
          <button type="button"
                  className="cap-toolbar__info-btn"
                  data-test="cap-info-btn"
                  aria-label="About Capture"
                  title="About Capture (Alt+I)"
                  onClick={() => setInfoOpen((v) => !v)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="8" cy="8" r="7" fill="none"
                      stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="4.5" r="0.9" fill="currentColor" />
              <rect x="7" y="7" width="2" height="5" rx="1"
                    fill="currentColor"/>
            </svg>
          </button>
          <span style={{ flex: 1 }} />
          <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
            {online.isOnline
              ? 'online' : `offline (${online.queuedCount} queued)`}
          </StatusPill>
          <DirtyChip />
        </div>

        <div className="cap-toolbar__fields">
          <label className="cap-toolbar__field cap-toolbar__field--ou">
            <span className="cap-toolbar__field-label">Bound OU</span>
            <span className="cap-toolbar__ou-value"
                  data-test="cap-bound-ou"
                  title={ou.orgUnitPath}>
              {ou.orgUnitDisplayName || ou.orgUnitUid || '—'}
            </span>
          </label>

          <label className="cap-toolbar__field">
            <span className="cap-toolbar__field-label">Program</span>
            <select className="cap-toolbar__select"
                    value={programUid}
                    onChange={(e) => setProgramUid(e.target.value)}
                    data-test="cap-program-select"
                    disabled={!ou.bound || programs.length === 0}>
              <option value="">
                {programs.length === 0 ? 'No programs assigned'
                  : 'Select a program…'}
              </option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="cap-toolbar__field">
            <span className="cap-toolbar__field-label">Mode</span>
            {mode ? (
              <span className={'cap-toolbar__mode '
                  + 'cap-toolbar__mode--' + mode}
                    data-test="cap-mode-chip"
                    title={mode === 'tracker'
                      ? 'Program requires registration — tracker workflow'
                      : 'Standalone event program — event workflow'}>
                {mode === 'tracker' ? 'Tracker' : 'Event'}
              </span>
            ) : (
              <span className="cap-toolbar__mode cap-toolbar__mode--empty"
                    data-test="cap-mode-chip">
                —
              </span>
            )}
          </div>
        </div>
      </div>

      {!ou.bound && (
        <div className="cap-strip cap-strip--err" data-test="cap-ou-missing">
          Device is not bound to an organisation unit — ask an admin
          to complete provisioning before capturing records.
        </div>
      )}
      {loadError && (
        <div className="cap-strip cap-strip--err" data-test="cap-load-err">
          {loadError}
        </div>
      )}

      {/* Signed-in subheader — matches the Data Entry chrome. */}
      <p className="cap-sub">
        Signed in as <strong>{auth.displayName}</strong>
        {program && (
          <>
            {' · Program '}
            <code className="cap-sub__code">{program.displayName}</code>
          </>
        )}
      </p>

      {/* Content area — mode-aware. Shared form engine, shared
       *  edge-write contract; the Tracker and Event components
       *  are thin wrappers that orchestrate workflow-specific
       *  context around the common form engine. */}
      {!program && ou.bound && programs.length > 0 && (
        <div className="cap-empty" data-test="cap-pick-program">
          <h2 className="cap-empty__title">Pick a program to begin</h2>
          <p className="cap-empty__body">
            You have <strong>{programs.length}</strong>{' '}
            program{programs.length === 1 ? '' : 's'} assigned to this
            organisation unit. The capture mode (Tracker or Event) is
            derived from the program type — no toggle is needed.
          </p>
        </div>
      )}
      {!program && ou.bound && programs.length === 0 && (
        <div className="cap-empty" data-test="cap-no-programs">
          <h2 className="cap-empty__title">No programs assigned</h2>
          <p className="cap-empty__body">
            Your bound organisation unit{' '}
            <code className="cap-sub__code" title={ou.orgUnitPath}>
              {ou.orgUnitDisplayName || ou.orgUnitUid}
            </code>{' '}
            isn't in any program's{' '}
            <code>organisationUnits</code> assignment on this DHIS2
            server. Ask an administrator to open the program in the
            DHIS2 Maintenance app and tick this OU under
            <em> Access → Organisation units</em>, then refresh.
          </p>
          <p className="cap-empty__body" style={{ fontSize: 12,
            color: '#6e7a8a' }}>
            <strong>Tech hint:</strong> admin can verify with{' '}
            <code>
              GET /api/programs?fields=id,organisationUnits[id]
            </code>
            {' '}and check that{' '}
            <code>{ou.orgUnitUid || '—'}</code> appears on at least
            one program.
          </p>
        </div>
      )}
      {program && mode === 'event' && (
        <EventWorkflow api={api} programUid={program.id}
                        orgUnitUid={ou.orgUnitUid}
                        orgUnitDisplayName={ou.orgUnitDisplayName} />
      )}
      {program && mode === 'tracker' && (
        <TrackerWorkflow api={api} programUid={program.id}
                          orgUnitUid={ou.orgUnitUid}
                          orgUnitDisplayName={ou.orgUnitDisplayName}
                          hashRoute={hashRoute} />
      )}

      {infoOpen && (
        <CaptureInfoPopover onClose={() => setInfoOpen(false)}
                             program={program} mode={mode} />
      )}
    </ScreenCard>
  );
}

function DirtyChip(): JSX.Element | null {
  const dirty = useAnyDirty();
  if (!dirty) return null;
  return (
    <span className="cap-dirty-chip"
          data-test="cap-dirty-chip"
          role="status"
          aria-live="polite"
          aria-label="Unsaved changes in the current form"
          title="You have unsaved changes in the current form.">
      <span className="cap-dirty-chip__dot" aria-hidden="true" />
      Unsaved changes
    </span>
  );
}

function CaptureInfoPopover(
  { onClose, program, mode }:
  { onClose: () => void;
    program: ProgramOpt | null;
    mode: 'event' | 'tracker' | null },
): JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="cap-info-backdrop"
         role="dialog" aria-modal="true" aria-label="About Capture"
         data-test="cap-info-popover"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cap-info" ref={dialogRef}>
        <header className="cap-info__head">
          <h3 className="cap-info__title">About Capture</h3>
          <button type="button"
                  className="cap-info__close"
                  aria-label="Close"
                  onClick={onClose}>×</button>
        </header>
        <div className="cap-info__body">
          <p>
            DER Capture is one app covering both <strong>Tracker</strong>{' '}
            (registration + enrolment + repeatable stages) and{' '}
            <strong>Event</strong> (standalone events) programs. The
            mode is derived from the program's <code>programType</code>,
            not a user toggle.
          </p>
          {program && (
            <dl className="cap-info__dl">
              <div><dt>Program</dt><dd>{program.displayName}</dd></div>
              <div><dt>Program UID</dt><dd><code>{program.id}</code></dd></div>
              <div><dt>Mode</dt>
                <dd>{mode === 'tracker' ? 'Tracker (WITH_REGISTRATION)'
                  : 'Event (WITHOUT_REGISTRATION)'}</dd></div>
            </dl>
          )}
          <section data-test="cap-info-shortcuts">
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: '#6e7a8a' }}>
              Keyboard shortcuts
            </h4>
            <dl className="cap-info__dl">
              <div><dt><kbd>Alt + S</kbd></dt>
                <dd>Save the current form</dd></div>
              <div><dt><kbd>Alt + C</kbd></dt>
                <dd>Mark the event Complete (tracker stage editor)</dd></div>
              <div><dt><kbd>Alt + N</kbd></dt>
                <dd>Add a new event on the active stage</dd></div>
              <div><dt><kbd>Alt + F</kbd></dt>
                <dd>Focus the tracker working-list search</dd></div>
              <div><dt><kbd>Alt + B</kbd></dt>
                <dd>Back to previous view (closes editor or dashboard)</dd></div>
              <div><dt><kbd>Alt + I</kbd></dt>
                <dd>Show / hide this panel</dd></div>
              <div><dt><kbd>Esc</kbd></dt>
                <dd>Close any open drawer</dd></div>
            </dl>
          </section>
          <p className="cap-info__note">
            Edits are committed to the facility edge first. Central
            sync is a separate step — the status footer distinguishes
            <em> Saved on edge</em> from <em>Synced to Central</em>.
          </p>
        </div>
      </div>
    </div>
  );
}
