import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useOrgUnitBinding, useOnlineStatus, useDerApi, useDevice,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

import { DistributedWorkflowPanel, programFromWorkflow } from
  './features/DistributedWorkflowPanel';
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
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const device = useDevice();
  const api = useDerApi() as unknown as CaptureApi;

  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [programUid, setProgramUid] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** DER device workflows — fetched once on mount. The toolbar
   *  strip filters at render time to the currently-selected
   *  program; the "assigned to this device" check considers
   *  defaultDeviceId + step.ownerDeviceId regardless of program.
   *  When nothing is assigned, we fall through to plain tracker /
   *  event capture (user: 'if there are no workflow defined,
   *  normal program processes are displayed'). */
  const [workflows, setWorkflows] = useState<ReadonlyArray<{
    workflowId: string; displayName: string;
    boundMetadataKind: string; boundMetadataId: string | null;
    defaultDeviceId: string | null;
    steps: ReadonlyArray<{
      stepId: string; ordinal: number;
      displayName: string;
      ownerRole: string | null;
      ownerDeviceId: string | null;
    }>;
  }>>([]);

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

  // Fetch assigned device workflows once on mount. These are
  // config-driven DER capture workflows; when present, the
  // operator can launch one instead of the plain tracker/event
  // flow. Silent on error — the UI simply falls back to the
  // normal capture experience.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureWorkflows();
        if (cancelled) return;
        setWorkflows((r.workflows ?? [])
          .filter((w) => w.enabled !== false)
          .map((w) => ({ workflowId: w.workflowId,
            displayName: w.displayName,
            boundMetadataKind: w.boundMetadataKind ?? '',
            boundMetadataId: w.boundMetadataId ?? null,
            defaultDeviceId: w.defaultDeviceId ?? null,
            steps: ((w as unknown as { steps?: ReadonlyArray<{
              stepId: string; ordinal: number; displayName: string;
              ownerRole?: string | null;
              ownerDeviceId?: string | null }> }).steps ?? [])
              .map((s) => ({
                stepId: s.stepId, ordinal: s.ordinal,
                displayName: s.displayName,
                ownerRole: s.ownerRole ?? null,
                ownerDeviceId: s.ownerDeviceId ?? null })) })));
      } catch {
        if (!cancelled) setWorkflows([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
  }, [ou.bound, ou.orgUnitUid]);

  const program = useMemo(
    () => programs.find((p) => p.id === programUid) ?? null,
    [programs, programUid]);
  // Derive the mode from metadata — never a toggle (§1, §22.5).
  const mode: 'event' | 'tracker' | null = program
    ? (program.programType === 'WITH_REGISTRATION' ? 'tracker' : 'event')
    : null;

  // Workflows assigned specifically to THIS device (not program-
  // scoped). Match either defaultDeviceId or any step's
  // ownerDeviceId. If any match, we're in distributed-workflow
  // mode and surface the assignment prominently.
  const myDeviceId = device.deviceId;
  const deviceAssignedWorkflows = useMemo(() => {
    if (!myDeviceId) return [] as typeof workflows;
    return workflows.filter((w) =>
      w.defaultDeviceId === myDeviceId
      || w.steps.some((s) => s.ownerDeviceId === myDeviceId));
  }, [workflows, myDeviceId]);

  // When the device is step-assigned to a PROGRAM-bound workflow,
  // auto-select that program so the normal tracker/event form
  // renders without the operator having to pick again. Only fires
  // once per assignment transition so an operator can still switch
  // programs manually afterwards.
  useEffect(() => {
    if (programUid !== '') return;
    if (deviceAssignedWorkflows.length === 0) return;
    for (const w of deviceAssignedWorkflows) {
      const pid = programFromWorkflow(w);
      if (pid && programs.some((p) => p.id === pid)) {
        setProgramUid(pid);
        return;
      }
    }
  }, [deviceAssignedWorkflows, programs, programUid]);

  // Program stage IDs so the workflow filter can include
  // PROGRAM_STAGE / PROGRAM_STAGE_SECTION bindings, not just
  // whole-program ones (distributed workflow config lives at
  // several metadata levels per DER server).
  const [programStageIds, setProgramStageIds] =
    useState<ReadonlyArray<string>>([]);
  useEffect(() => {
    setProgramStageIds([]);
    if (!programUid) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureProgramStages(programUid);
        if (cancelled) return;
        setProgramStageIds(r.stages.map((s) => s.stageUid));
      } catch {
        if (!cancelled) setProgramStageIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [programUid]);

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
          <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
            {online.isOnline
              ? 'online' : `offline (${online.queuedCount} queued)`}
          </StatusPill>
          <DirtyChip />
          {/* Bound OU lives on the brand row, flush right — same
           *  placement as the Data Entry app (§DER-STYLE-002). */}
          <span className="cap-toolbar__ou-wrap">
            <span className="cap-toolbar__ou-label">Bound OU</span>
            <span className="cap-toolbar__ou-value"
                  data-test="cap-bound-ou"
                  title={ou.orgUnitPath}>
              {ou.orgUnitDisplayName || ou.orgUnitUid
                || 'Not bound to an OU'}
            </span>
          </span>
        </div>

        <div className="cap-toolbar__fields">
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

          {/* Distributed workflows allocated to this device for
           *  the selected program (or any of its stages /
           *  sections). Display-only — the operator captures
           *  normally below and the DER server stamps each write
           *  with the workflow run. */}
          {program && (() => {
            const stageIdSet = new Set(programStageIds);
            const related = workflows.filter((w) => {
              if (w.boundMetadataKind === 'PROGRAM'
                && w.boundMetadataId === program.id) return true;
              if ((w.boundMetadataKind === 'PROGRAM_STAGE'
                || w.boundMetadataKind === 'PROGRAM_STAGE_SECTION')
                && w.boundMetadataId
                && stageIdSet.has(w.boundMetadataId)) return true;
              return false;
            });
            if (related.length === 0) return null;
            return (
              <div className="cap-toolbar__field cap-toolbar__field--wf"
                   data-test="cap-workflows">
                <span className="cap-toolbar__field-label">
                  Allocated workflows
                </span>
                <div className="cap-wf-chips">
                  {related.slice(0, 4).map((w) => (
                    <span key={w.workflowId}
                          className="cap-wf-chip"
                          data-test={'cap-wf-' + w.workflowId}
                          title={'This device is allocated workflow '
                            + w.displayName
                            + '. Captures below contribute to its '
                            + 'current run.'}>
                      {w.displayName}
                    </span>
                  ))}
                  {related.length > 4 && (
                    <span className="cap-wf-chip cap-wf-chip--more">
                      +{related.length - 4}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
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


      {/* Distributed-workflow mode: when this device has been
       *  assigned to specific workflow step(s), replace the
       *  plain tracker/event content with the assignment panel.
       *  The device sees only what it is meant to capture, with
       *  previous-step data as read-only context (the DER run
       *  API's upstreamContext). Normal program flows stay
       *  available as a fallback link. */}
      {deviceAssignedWorkflows.length > 0 && (
        <DistributedWorkflowPanel
          api={api}
          workflows={deviceAssignedWorkflows}
          myDeviceId={myDeviceId ?? ''} />
      )}

      {/* Content area — mode-aware. Shared form engine, shared
       *  edge-write contract; the Tracker and Event components
       *  are thin wrappers that orchestrate workflow-specific
       *  context around the common form engine. Rendered only
       *  when NO device-assigned workflow is active — otherwise
       *  the panel above owns the screen. */}
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
                             program={program} mode={mode}
                             deviceId={device.deviceId}
                             deviceStatus={device.status}
                             assignedWorkflowCount={
                               deviceAssignedWorkflows.length} />
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
  { onClose, program, mode, deviceId, deviceStatus,
    assignedWorkflowCount }:
  { onClose: () => void;
    program: ProgramOpt | null;
    mode: 'event' | 'tracker' | null;
    deviceId: string | null;
    deviceStatus: string | null;
    assignedWorkflowCount: number },
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
          <section data-test="cap-info-device">
            <h4 style={{ margin: '4px 0 6px 0', fontSize: 12,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: '#6e7a8a' }}>
              Device
            </h4>
            <dl className="cap-info__dl">
              <div><dt>Device UID</dt>
                <dd>
                  {deviceId ? <code>{deviceId}</code>
                    : <em>enrolling…</em>}
                </dd></div>
              <div><dt>Status</dt>
                <dd>{deviceStatus ?? 'enrolling…'}</dd></div>
              <div><dt>Assigned workflows</dt>
                <dd>{assignedWorkflowCount === 0
                  ? 'none (operator picks programs normally)'
                  : assignedWorkflowCount + ' step-assigned to '
                    + 'this device'}</dd></div>
            </dl>
          </section>
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
