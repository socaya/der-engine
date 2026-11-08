import { useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent } from 'react';
import type { CaptureApi, EventRow } from '../../shared/types';
import type { CaptureField, CaptureFormSection,
  CaptureProgramRule, CaptureProgramRuleVariable }
  from '../../shared/model';
import { parseStageForm } from '../../shared/parser';
import { enrichRulesWithActions, parseProgramRules }
  from '../../shared/rules';
import { evaluateRules, type RuleEffectSet, type RuleWarning }
  from '../../shared/ruleEngine';
import { SheetCell } from '../../shared/SheetCell';
import { openDatePicker, openDatePickerOnFocus }
  from '../../shared/openDatePicker';
import { navEvent } from '../../shared/routing';

/**
 * Event (WITHOUT_REGISTRATION) spreadsheet-mode page.
 *
 * <p>Renders every event for the program × OU as a row in a grid
 * where each column is one data element from the stage form.
 * Operators type directly into cells — the keyboard model matches
 * Excel / Google Sheets: Tab moves to the next column, Shift+Tab
 * to the previous, Enter moves down one row (into the next row's
 * same column), Esc blurs the cell.</p>
 *
 * <p>Per-row auto-save: 800 ms after the last keystroke in a row,
 * {@code submitEvent} fires with that row's full values. The
 * leftmost status column shows {@code idle / saving / saved /
 * err} so the operator always knows whether the central sync has
 * their row. New rows wait for at least one non-empty value
 * before their first save, so an accidental "+ New row" click
 * doesn't leave an orphan blank event behind.</p>
 */

const SAVE_DEBOUNCE_MS = 800;

interface SheetRow {
  /** DHIS2 UID when the row has been saved at least once; null
   *  for a locally-created row that hasn't been saved yet. */
  eventUid: string | null;
  /** Stable React key — preserved across every re-render of the
   *  same row so the browser keeps focus inside the cell the
   *  operator is typing in. */
  localKey: string;
  occurredAt: string;
  status: string | null;
  values: Record<string, string>;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'err';
  saveMsg?: string;
}

export function EventSheetPage(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string;
  },
): JSX.Element {
  const [stageUid, setStageUid] = useState<string>('');
  const [sections, setSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [rules, setRules] =
    useState<readonly CaptureProgramRule[]>([]);
  const [ruleVars, setRuleVars] =
    useState<readonly CaptureProgramRuleVariable[]>([]);
  const [load, setLoad] =
    useState<'loading' | 'idle' | 'err'>('loading');
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  /** Selection rectangle — {anchor, focus} with inclusive bounds.
   *  anchor is the cell the operator started from (click target);
   *  focus is where they Shift-extended to. One-cell selections
   *  have anchor === focus. null means nothing is selected and
   *  single-cell edit mode is active. */
  const [selection, setSelection] = useState<{
    anchor: { row: number; col: number };
    focus: { row: number; col: number };
  } | null>(null);
  /** Fill-drag in progress — the operator mousedowned on the handle
   *  and is extending the selection. The extend rectangle is shown
   *  as a preview outline; on mouseup the extended cells get
   *  populated with the anchor cell's value. Null means no fill
   *  drag is active. */
  const [fillDrag, setFillDrag] = useState<null | {
    source: { row: number; col: number };
    extend: { row: number; col: number };
  }>(null);

  /** Column widths keyed by field UID; persisted in sessionStorage
   *  per program so the next time the operator opens the same
   *  program's sheet, their resize decisions stick. Unspecified
   *  columns fall back to the auto-table default. */
  const colWidthsKey = 'cap:sheet-cols:' + programUid;
  const [colWidths, setColWidths] =
    useState<Record<string, number>>(() => {
      if (typeof sessionStorage === 'undefined') return {};
      try {
        const raw = sessionStorage.getItem(colWidthsKey);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    });
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(colWidthsKey, JSON.stringify(colWidths));
    } catch { /* quota exceeded or similar — silently skip */ }
  }, [colWidths, colWidthsKey]);
  /** per-row save-timer handles, keyed by row index */
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  /** Live rows snapshot — React 18 defers functional setState until
   *  the next commit, so reading state inside a setState callback
   *  is unreliable. saveRow reads this ref instead. */
  const rowsRef = useRef<SheetRow[]>([]);
  /** Undo stack — each entry is a batch of (localKey, fieldId,
   *  oldValue) tuples captured just before a mutation. Ctrl+Z pops
   *  the most recent batch and restores every tuple in it.
   *  Capped at 50 batches so long sessions don't balloon memory.
   *  Keyed by localKey, not rowIdx, so indices shifting (e.g. row
   *  deletes) don't reach back for the wrong row. */
  const undoStack = useRef<Array<Array<{
    localKey: string; fieldId: string; oldValue: string;
  }>>>([]);
  /** Redo stack — undoLastBatch pushes here; redoLastBatch pops.
   *  Cleared on every new mutation per the standard Excel/GSheet
   *  contract (branching the history isn't worth the model cost). */
  const redoStack = useRef<Array<Array<{
    localKey: string; fieldId: string; oldValue: string;
  }>>>([]);
  const UNDO_MAX = 50;

  // Load stage form + events + program rules in parallel.
  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    (async () => {
      try {
        const [stageRes, evRes, rawRules, rawVars, rawActions] =
          await Promise.all([
          api.listCaptureProgramStages(programUid),
          api.listCaptureProgramEvents(programUid, orgUnitUid, 200),
          api.listProgramRules(programUid).catch(() => []),
          api.listProgramRuleVariables(programUid).catch(() => []),
          api.listProgramRuleActions().catch(() => []),
        ]);
        if (cancelled) return;
        const firstStage = stageRes.stages[0];
        if (!firstStage) {
          setLoad('err');
          setLoadMsg('This program has no stages — '
            + 'spreadsheet mode needs at least one stage.');
          return;
        }
        setStageUid(firstStage.stageUid);
        const form = await api.getCaptureStageForm(programUid,
          firstStage.stageUid);
        if (cancelled) return;
        const parsed = parseStageForm(firstStage.stageUid, form);
        setSections(parsed.sections);
        // Parse rules + enrich with resolved actions (handles the
        // id-only stub shape the DER mirror sometimes returns).
        const enriched = enrichRulesWithActions(rawRules, rawActions);
        const parsedRules = parseProgramRules(enriched, rawVars);
        setRules(parsedRules.rules);
        setRuleVars(parsedRules.variables);
        setRows((evRes.events ?? []).map((e, i) => {
          const uid = e.eventUid ?? e.event ?? null;
          return {
            eventUid: uid,
            localKey: uid ?? ('seed-' + i),
            occurredAt: ((e.occurredDate ?? e.occurredAt ?? e.eventDate
              ?? '') as string).slice(0, 10),
            status: e.status ?? 'ACTIVE',
            values: toValueMap(e),
            saveState: 'saved',
          };
        }));
        setLoad('idle');
      } catch (err) {
        if (!cancelled) {
          setLoad('err');
          setLoadMsg((err as Error).message ?? 'Failed to load');
        }
      }
    })();
    return () => {
      cancelled = true;
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, [programUid, orgUnitUid]);

  // Keep rowsRef in sync with the rendered state so saveRow always
  // reads the latest values + eventUid, even when React's state
  // commits are batched past our setRows updater call.
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const allFields = useMemo<readonly CaptureField[]>(() => {
    const fs: CaptureField[] = [];
    for (const s of sections) for (const f of s.fields) fs.push(f);
    return fs;
  }, [sections]);

  /** Per-row rule evaluation. Memoised so unaffected rows don't
   *  re-run when the operator edits a different row. Each row's
   *  effect set drives (a) which cells grey out (HIDEFIELD),
   *  (b) per-row required overrides (SETMANDATORYFIELD),
   *  (c) inline warning / error markers (SHOWWARNING / SHOWERROR),
   *  (d) whether the row can post at all (any errors → save blocked). */
  const rowEffects = useMemo<ReadonlyArray<RuleEffectSet>>(() => {
    if (rules.length === 0) {
      return rows.map(() => ({
        hiddenFieldIds: new Set<string>(),
        hiddenSectionIds: new Set<string>(),
        mandatoryFieldIds: new Set<string>(),
        assignedValues: new Map<string, string>(),
        warnings: [] as readonly RuleWarning[],
        issues: [],
      }));
    }
    return rows.map((r) => evaluateRules(rules, ruleVars, r.values));
  }, [rows, rules, ruleVars]);

  /** Does row i have any blocking rule-error? Guards save. */
  function rowHasErrors(idx: number): boolean {
    return rowEffects[idx]?.warnings.some(
      (w) => w.severity === 'error') ?? false;
  }

  /** Fire a save for the given row index. Called from the debounce
   *  timer and from onCommit (blur/change) for immediate persistence. */
  const saveRow = useCallback(async (rowIndex: number): Promise<void> => {
    const latest = rowsRef.current[rowIndex];
    if (!latest) return;
    // Block the save when any program rule emits an error for this
    // row. Matches DHIS2 Capture: SHOWERROR actions are hard-fail
    // gates, not just inline markers.
    const effects = rowEffects[rowIndex];
    const errors = effects?.warnings.filter(
      (w) => w.severity === 'error') ?? [];
    if (errors.length > 0) {
      const msg = errors.map((e) => e.message).join('; ');
      setRows((prev) => {
        const r = prev[rowIndex];
        if (!r) return prev;
        const copy = [...prev];
        copy[rowIndex] = { ...r, saveState: 'err',
          saveMsg: 'Rule error: ' + msg };
        return copy;
      });
      return;
    }
    setRows((prev) => {
      const r = prev[rowIndex];
      if (!r) return prev;
      const copy = [...prev];
      copy[rowIndex] = { ...r, saveState: 'saving', saveMsg: undefined };
      return copy;
    });
    try {
      // ASSIGN rule outputs merge in on top of typed values so the
      // saved event includes everything DHIS2 would compute client-
      // side. Operator-typed values take precedence — ASSIGN never
      // overwrites a cell the operator has already filled (parity
      // with DHIS2 Capture's ASSIGN semantics when a value exists).
      const merged: Record<string, string> = { ...latest.values };
      if (effects?.assignedValues) {
        for (const [k, v] of effects.assignedValues.entries()) {
          if (!merged[k] || merged[k].trim() === '') merged[k] = v;
        }
      }
      const dataValues = Object.entries(merged)
        .filter(([, v]) => v != null && v.trim() !== '')
        .map(([dataElement, value]) => ({ dataElement, value }));
      if (dataValues.length === 0 && !latest.eventUid) {
        // Brand-new row with no values yet — don't create an empty
        // event. Return to idle state so a later keystroke triggers
        // another save attempt.
        setRows((prev) => {
          const copy = [...prev];
          const r = copy[rowIndex];
          if (r) copy[rowIndex] = { ...r, saveState: 'idle' };
          return copy;
        });
        return;
      }
      const result = await api.submitEvent({
        program: programUid,
        programStage: stageUid,
        orgUnit: orgUnitUid,
        occurredAt: new Date(latest.occurredAt + 'T00:00:00Z').toISOString(),
        dataValues,
        event: latest.eventUid ?? undefined,
        status: latest.status ?? 'ACTIVE',
      }) as unknown;
      // DHIS2 /api/events reply shape varies; try common keys.
      const newUid = latest.eventUid
        ?? extractEventUid(result);
      setRows((prev) => {
        const copy = [...prev];
        const r = copy[rowIndex];
        if (r) {
          copy[rowIndex] = { ...r, eventUid: newUid ?? r.eventUid,
            saveState: 'saved', saveMsg: undefined };
        }
        return copy;
      });
    } catch (err) {
      const msg = (err as Error).message ?? 'Save failed';
      setRows((prev) => {
        const copy = [...prev];
        const r = copy[rowIndex];
        if (r) copy[rowIndex] = { ...r, saveState: 'err', saveMsg: msg };
        return copy;
      });
    }
  }, [api, programUid, stageUid, orgUnitUid, rowEffects]);

  const scheduleSave = useCallback((rowIndex: number): void => {
    const existing = timers.current.get(rowIndex);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      timers.current.delete(rowIndex);
      void saveRow(rowIndex);
    }, SAVE_DEBOUNCE_MS);
    timers.current.set(rowIndex, t);
  }, [saveRow]);

  /** Push an undo batch onto the stack, trimming at UNDO_MAX.
   *  Clears the redo stack — a new mutation invalidates any
   *  forward history (standard spreadsheet contract). */
  function pushUndo(batch: Array<{
    localKey: string; fieldId: string; oldValue: string;
  }>): void {
    if (batch.length === 0) return;
    undoStack.current.push(batch);
    if (undoStack.current.length > UNDO_MAX) {
      undoStack.current.splice(0,
        undoStack.current.length - UNDO_MAX);
    }
    redoStack.current.length = 0;
  }

  function updateCell(rowIndex: number, deUid: string, v: string): void {
    const snap = rowsRef.current[rowIndex];
    if (snap) {
      const oldValue = snap.values[deUid] ?? '';
      if (oldValue !== v) {
        pushUndo([{ localKey: snap.localKey, fieldId: deUid,
          oldValue }]);
      }
    }
    setRows((prev) => {
      const copy = [...prev];
      const r = copy[rowIndex];
      if (!r) return prev;
      copy[rowIndex] = {
        ...r,
        values: { ...r.values, [deUid]: v },
        saveState: 'dirty',
      };
      return copy;
    });
    scheduleSave(rowIndex);
  }

  function updateOccurredAt(rowIndex: number, v: string): void {
    setRows((prev) => {
      const copy = [...prev];
      const r = copy[rowIndex];
      if (!r) return prev;
      copy[rowIndex] = { ...r, occurredAt: v, saveState: 'dirty' };
      return copy;
    });
    scheduleSave(rowIndex);
  }

  function addRow(): void {
    setRows((prev) => [...prev, {
      eventUid: null,
      localKey: 'new-' + Date.now() + '-'
        + Math.random().toString(36).slice(2, 6),
      occurredAt: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
      values: {},
      saveState: 'idle',
    }]);
  }

  async function deleteRow(rowIndex: number): Promise<void> {
    const r = rows[rowIndex];
    if (!r) return;
    if (r.eventUid) {
      // eslint-disable-next-line no-alert
      if (!confirm('Delete row ' + (r.eventUid.slice(0, 8)) + '…?')) return;
      try { await api.deleteEvent(r.eventUid); }
      catch (err) {
        // eslint-disable-next-line no-alert
        alert('Delete failed: ' + ((err as Error).message ?? 'unknown'));
        return;
      }
    }
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
  }

  /** Fill the active cell's value down through every subsequent
   *  row in the same column. Mirrors Excel / Google Sheets Ctrl+D
   *  with a simple contract: the active cell is the source, every
   *  row below is the target, each affected row auto-saves via
   *  the existing debounced pipeline.
   *
   *  <p>Hidden cells for a particular row (via HIDEFIELD) are
   *  skipped — operators don't want a fill-down to populate cells
   *  a program rule says should not apply.</p> */
  function fillDown(sourceRow: number, fieldId: string): number {
    // Count BEFORE calling setRows: React 18 strict mode re-invokes
    // functional updaters, so a counter inside the updater double-
    // or zero-counts (second pass sees the already-updated state).
    const snapshot = rowsRef.current;
    const sourceValue = snapshot[sourceRow]?.values[fieldId] ?? '';
    const targetRowIndexes: number[] = [];
    for (let i = sourceRow + 1; i < snapshot.length; i++) {
      if (rowEffects[i]?.hiddenFieldIds.has(fieldId)) continue;
      if (snapshot[i]?.values[fieldId] === sourceValue) continue;
      targetRowIndexes.push(i);
    }
    if (targetRowIndexes.length === 0) return 0;
    const targetSet = new Set(targetRowIndexes);
    // Record undo batch BEFORE mutating so Ctrl+Z restores every
    // cell to its pre-fill-down value in one shot.
    pushUndo(targetRowIndexes.map((i) => ({
      localKey: snapshot[i]!.localKey,
      fieldId,
      oldValue: snapshot[i]!.values[fieldId] ?? '',
    })));
    setRows((prev) => {
      const copy = [...prev];
      for (const i of targetSet) {
        const r = copy[i];
        if (!r) continue;
        copy[i] = {
          ...r,
          values: { ...r.values, [fieldId]: sourceValue },
          saveState: 'dirty',
        };
      }
      return copy;
    });
    // Debounced save per row — leverages the per-row timer map so
    // the fire schedule is the same as a manual keystroke.
    for (const i of targetRowIndexes) scheduleSave(i);
    return targetRowIndexes.length;
  }

  /** Clear every cell in the current selection rectangle. Skips
   *  hidden cells (program rules decide those shouldn't apply to
   *  the row). Records ONE undo batch for the whole clear so
   *  Ctrl+Z restores the entire range in one step. */
  function clearSelection(): void {
    if (!selection) return;
    const r0 = Math.min(selection.anchor.row, selection.focus.row);
    const r1 = Math.max(selection.anchor.row, selection.focus.row);
    const c0 = Math.min(selection.anchor.col, selection.focus.col);
    const c1 = Math.max(selection.anchor.col, selection.focus.col);
    const snap = rowsRef.current;
    const batch: Array<{ localKey: string; fieldId: string;
      oldValue: string }> = [];
    const touchedRowIdxs = new Set<number>();
    for (let r = r0; r <= r1; r++) {
      const row = snap[r];
      if (!row) continue;
      for (let c = c0; c <= c1; c++) {
        const f = allFields[c];
        if (!f) continue;
        if (rowEffects[r]?.hiddenFieldIds.has(f.id)) continue;
        const oldValue = row.values[f.id] ?? '';
        if (oldValue === '') continue;
        batch.push({ localKey: row.localKey, fieldId: f.id,
          oldValue });
        touchedRowIdxs.add(r);
      }
    }
    if (batch.length === 0) return;
    pushUndo(batch);
    setRows((prev) => {
      const copy = [...prev];
      for (const i of touchedRowIdxs) {
        const row = copy[i];
        if (!row) continue;
        const next: Record<string, string> = { ...row.values };
        for (let c = c0; c <= c1; c++) {
          const f = allFields[c];
          if (!f) continue;
          if (rowEffects[i]?.hiddenFieldIds.has(f.id)) continue;
          delete next[f.id];
        }
        copy[i] = { ...row, values: next, saveState: 'dirty' };
      }
      return copy;
    });
    for (const i of touchedRowIdxs) scheduleSave(i);
    // eslint-disable-next-line no-console
    console.log('[sheet] clear-selection',
      { cells: batch.length, rows: touchedRowIdxs.size });
  }

  /** Serialize the selection rectangle to a TSV string. Row order
   *  matches the sheet (top to bottom), column order matches the
   *  grid. Hidden cells are serialised as empty string so the
   *  rectangle stays rectangular (pasting back preserves layout). */
  function serializeSelectionAsTsv(
    sel: NonNullable<typeof selection>,
  ): string {
    const r0 = Math.min(sel.anchor.row, sel.focus.row);
    const r1 = Math.max(sel.anchor.row, sel.focus.row);
    const c0 = Math.min(sel.anchor.col, sel.focus.col);
    const c1 = Math.max(sel.anchor.col, sel.focus.col);
    const lines: string[] = [];
    const snap = rowsRef.current;
    for (let r = r0; r <= r1; r++) {
      const cells: string[] = [];
      const row = snap[r];
      for (let c = c0; c <= c1; c++) {
        const f = allFields[c];
        if (!f || !row) { cells.push(''); continue; }
        if (rowEffects[r]?.hiddenFieldIds.has(f.id)) {
          cells.push('');
        } else {
          cells.push(row.values[f.id] ?? '');
        }
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }

  /** True when (row, col) is inside the current selection rectangle. */
  function inSelection(row: number, col: number): boolean {
    if (!selection) return false;
    const r0 = Math.min(selection.anchor.row, selection.focus.row);
    const r1 = Math.max(selection.anchor.row, selection.focus.row);
    const c0 = Math.min(selection.anchor.col, selection.focus.col);
    const c1 = Math.max(selection.anchor.col, selection.focus.col);
    return row >= r0 && row <= r1 && col >= c0 && col <= c1;
  }

  /** Begin a column-resize drag on the right edge of a header
   *  cell. Captures the starting width via getBoundingClientRect
   *  (works whether the column uses stored width or auto) and
   *  attaches window-level move/up handlers so the drag continues
   *  cleanly when the cursor leaves the header cell. */
  function startColResize(e: MouseEvent<HTMLElement>,
      fieldId: string): void {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest('th');
    if (!th) return;
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;
    document.body.classList.add('cap-sheet__resizing');
    function onMove(ev: globalThis.MouseEvent): void {
      const next = Math.max(60, Math.round(
        startWidth + (ev.clientX - startX)));
      setColWidths((prev) => ({ ...prev, [fieldId]: next }));
    }
    function onUp(): void {
      document.body.classList.remove('cap-sheet__resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Cell click handler — records the anchor (and optionally
   *  extends focus with Shift held). Standard Excel semantics. */
  function onCellMouseDown(e: MouseEvent<HTMLElement>,
      row: number, col: number): void {
    if (col < 0) return; // status + date columns aren't selectable.
    if (e.shiftKey && selection) {
      setSelection({ anchor: selection.anchor,
        focus: { row, col } });
    } else {
      // A fresh click starts a one-cell selection. Keeping it set
      // (instead of null) lets Shift+Arrow extend immediately.
      setSelection({ anchor: { row, col }, focus: { row, col } });
    }
  }

  /** Start a drag-fill operation. Records the source anchor cell,
   *  attaches window-level mousemove/mouseup so the drag follows
   *  the cursor even past the cell boundary. On mouseup the
   *  extended rectangle fills with the source's value. */
  function startFillDrag(e: MouseEvent<HTMLElement>,
      sourceRow: number, sourceCol: number): void {
    e.preventDefault();
    e.stopPropagation();
    setFillDrag({ source: { row: sourceRow, col: sourceCol },
      extend: { row: sourceRow, col: sourceCol } });
    document.body.classList.add('cap-sheet__fill-dragging');
    function cellCoordAt(x: number, y: number): { row: number;
        col: number } | null {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const td = (el as HTMLElement).closest<HTMLElement>(
        '[data-cell-coord]');
      if (!td) return null;
      const coord = td.getAttribute('data-cell-coord');
      if (!coord) return null;
      const [rs, cs] = coord.split(':');
      const row = Number(rs); const col = Number(cs);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
      // Date column (-1) is not fillable; clamp to col 0.
      return { row, col: col < 0 ? 0 : col };
    }
    function onMove(ev: globalThis.MouseEvent): void {
      const next = cellCoordAt(ev.clientX, ev.clientY);
      if (!next) return;
      setFillDrag({ source: { row: sourceRow, col: sourceCol },
        extend: next });
    }
    function onUp(ev: globalThis.MouseEvent): void {
      document.body.classList.remove('cap-sheet__fill-dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const end = cellCoordAt(ev.clientX, ev.clientY)
        ?? { row: sourceRow, col: sourceCol };
      setFillDrag(null);
      commitFillDrag(sourceRow, sourceCol, end.row, end.col);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Commit the drag-fill: write the source cell's value into every
   *  cell in the extended rectangle (excluding the source itself).
   *  Hidden cells are skipped. One undo batch for the whole block;
   *  per-row debounced saves. */
  function commitFillDrag(srcRow: number, srcCol: number,
      endRow: number, endCol: number): void {
    const snap = rowsRef.current;
    const srcField = allFields[srcCol];
    if (!srcField) return;
    const sourceValue = snap[srcRow]?.values[srcField.id] ?? '';
    const r0 = Math.min(srcRow, endRow);
    const r1 = Math.max(srcRow, endRow);
    const c0 = Math.min(srcCol, endCol);
    const c1 = Math.max(srcCol, endCol);
    const batch: Array<{ localKey: string; fieldId: string;
      oldValue: string }> = [];
    const touchedRowIdxs = new Set<number>();
    for (let r = r0; r <= r1; r++) {
      const row = snap[r];
      if (!row) continue;
      for (let c = c0; c <= c1; c++) {
        if (r === srcRow && c === srcCol) continue;
        const f = allFields[c];
        if (!f) continue;
        if (rowEffects[r]?.hiddenFieldIds.has(f.id)) continue;
        const oldValue = row.values[f.id] ?? '';
        if (oldValue === sourceValue) continue;
        batch.push({ localKey: row.localKey, fieldId: f.id,
          oldValue });
        touchedRowIdxs.add(r);
      }
    }
    if (batch.length === 0) {
      // No cells changed; promote the extend rectangle to the
      // selection anyway so the operator can continue acting on
      // what they just dragged.
      setSelection({ anchor: { row: srcRow, col: srcCol },
        focus: { row: endRow, col: endCol } });
      return;
    }
    pushUndo(batch);
    setRows((prev) => {
      const copy = [...prev];
      for (const i of touchedRowIdxs) {
        const row = copy[i];
        if (!row) continue;
        const next: Record<string, string> = { ...row.values };
        for (let c = c0; c <= c1; c++) {
          if (i === srcRow && c === srcCol) continue;
          const f = allFields[c];
          if (!f) continue;
          if (rowEffects[i]?.hiddenFieldIds.has(f.id)) continue;
          if (sourceValue === '') delete next[f.id];
          else next[f.id] = sourceValue;
        }
        copy[i] = { ...row, values: next, saveState: 'dirty' };
      }
      return copy;
    });
    for (const i of touchedRowIdxs) scheduleSave(i);
    // Promote the filled rectangle to the active selection so the
    // operator sees what they just produced.
    setSelection({ anchor: { row: srcRow, col: srcCol },
      focus: { row: endRow, col: endCol } });
    // eslint-disable-next-line no-console
    console.log('[sheet] fill-drag commit',
      { cells: batch.length, rows: touchedRowIdxs.size });
  }

  /** True when (row, col) is inside the active drag-fill preview. */
  function inFillPreview(row: number, col: number): boolean {
    if (!fillDrag) return false;
    const r0 = Math.min(fillDrag.source.row, fillDrag.extend.row);
    const r1 = Math.max(fillDrag.source.row, fillDrag.extend.row);
    const c0 = Math.min(fillDrag.source.col, fillDrag.extend.col);
    const c1 = Math.max(fillDrag.source.col, fillDrag.extend.col);
    return row >= r0 && row <= r1 && col >= c0 && col <= c1;
  }

  /** Rectangular paste — split the TSV text into a grid, map each
   *  cell into (startRow+r, startCol+c), update values in one
   *  setRows + one undo batch. Columns beyond the sheet are
   *  dropped. New rows are appended as needed when the paste
   *  extends past the current row count — matches Excel's
   *  "paste past the end expands the sheet" behaviour.
   *
   *  <p>Hidden cells (per row program rules) are skipped so a
   *  paste never populates cells a rule said shouldn't apply.</p> */
  function pasteBlockAt(startRow: number, startCol: number,
      tsv: string): void {
    const text = tsv.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    const rows2d = text.split('\n').map((line) => line.split('\t'));
    if (rows2d.length === 0) return;
    const snap = rowsRef.current;
    const needed = startRow + rows2d.length - snap.length;
    // Append new rows if the paste overflows the current sheet.
    if (needed > 0) {
      setRows((prev) => {
        const extra: SheetRow[] = [];
        for (let i = 0; i < needed; i++) {
          extra.push({
            eventUid: null,
            localKey: 'paste-' + Date.now() + '-'
              + Math.random().toString(36).slice(2, 6) + '-' + i,
            occurredAt: new Date().toISOString().slice(0, 10),
            status: 'ACTIVE',
            values: {},
            saveState: 'idle',
          });
        }
        return [...prev, ...extra];
      });
    }
    // Build the undo batch + the index set of rows to save.
    const undoBatch: Array<{ localKey: string; fieldId: string;
      oldValue: string }> = [];
    const touchedRowIdxs = new Set<number>();
    const liveSnap = [...snap]; // snapshot BEFORE the row append;
    // the new rows are appended by the setRows above and will
    // be present by the time the next setRows reads prev.
    for (let r = 0; r < rows2d.length; r++) {
      const rowIdx = startRow + r;
      for (let c = 0; c < rows2d[r]!.length; c++) {
        const colIdx = startCol + c;
        const field = allFields[colIdx];
        if (!field) continue; // past the right edge of the sheet
        // Hidden-cell guard uses the snapshot's effects when
        // available; newly-appended rows have no effects yet
        // so they're always writable.
        if (rowEffects[rowIdx]?.hiddenFieldIds.has(field.id)) continue;
        const existing = liveSnap[rowIdx];
        const oldValue = existing?.values[field.id] ?? '';
        const newValue = rows2d[r]![c]!;
        if (oldValue === newValue) continue;
        undoBatch.push({
          localKey: existing?.localKey
            ?? 'paste-pending-' + rowIdx,
          fieldId: field.id, oldValue,
        });
        touchedRowIdxs.add(rowIdx);
      }
    }
    pushUndo(undoBatch);
    // Commit the values into the rows (including any newly
    // appended ones) via one setRows call.
    setRows((prev) => {
      const copy = [...prev];
      for (let r = 0; r < rows2d.length; r++) {
        const rowIdx = startRow + r;
        const row = copy[rowIdx];
        if (!row) continue;
        const next: Record<string, string> = { ...row.values };
        let changed = false;
        for (let c = 0; c < rows2d[r]!.length; c++) {
          const colIdx = startCol + c;
          const field = allFields[colIdx];
          if (!field) continue;
          if (rowEffects[rowIdx]?.hiddenFieldIds.has(field.id)) continue;
          const nv = rows2d[r]![c]!;
          if (next[field.id] === nv) continue;
          next[field.id] = nv;
          changed = true;
        }
        if (changed) {
          copy[rowIdx] = { ...row, values: next, saveState: 'dirty' };
        }
      }
      return copy;
    });
    for (const i of touchedRowIdxs) scheduleSave(i);
    // eslint-disable-next-line no-console
    console.log('[sheet] paste', { startRow, startCol,
      rowsAffected: touchedRowIdxs.size,
      cells: undoBatch.length });
  }

  /** Shared swap-batch helper — applies a batch of
   *  (localKey, fieldId, newValue) tuples to the rows and returns
   *  the inverse batch (each tuple's previous value) so the caller
   *  can push it onto the opposite stack. */
  function applyBatch(batch: Array<{
    localKey: string; fieldId: string; oldValue: string;
  }>): { inverse: Array<{ localKey: string; fieldId: string;
      oldValue: string }>; touchedRowIdxs: Set<number> } {
    const snap = rowsRef.current;
    const touchedKeys = new Set(batch.map((b) => b.localKey));
    const touchedRowIdxs = new Set<number>();
    const inverse: Array<{ localKey: string; fieldId: string;
      oldValue: string }> = [];
    for (let i = 0; i < snap.length; i++) {
      const r = snap[i];
      if (!r || !touchedKeys.has(r.localKey)) continue;
      for (const b of batch) {
        if (b.localKey !== r.localKey) continue;
        inverse.push({ localKey: b.localKey, fieldId: b.fieldId,
          oldValue: r.values[b.fieldId] ?? '' });
      }
      touchedRowIdxs.add(i);
    }
    setRows((prev) => {
      const copy = [...prev];
      for (let i = 0; i < copy.length; i++) {
        const r = copy[i];
        if (!r || !touchedKeys.has(r.localKey)) continue;
        const nextValues: Record<string, string> = { ...r.values };
        for (const b of batch) {
          if (b.localKey !== r.localKey) continue;
          if (b.oldValue === '') {
            delete nextValues[b.fieldId];
          } else {
            nextValues[b.fieldId] = b.oldValue;
          }
        }
        copy[i] = { ...r, values: nextValues, saveState: 'dirty' };
      }
      return copy;
    });
    return { inverse, touchedRowIdxs };
  }

  /** Pop the most recent undo batch and restore each cell. The
   *  affected rows flip to dirty + auto-save via the existing
   *  debounced pipeline so the central store matches what the
   *  operator now sees on screen. */
  function undoLastBatch(): number {
    const batch = undoStack.current.pop();
    if (!batch || batch.length === 0) return 0;
    const { inverse, touchedRowIdxs } = applyBatch(batch);
    redoStack.current.push(inverse);
    if (redoStack.current.length > UNDO_MAX) {
      redoStack.current.splice(0,
        redoStack.current.length - UNDO_MAX);
    }
    for (const i of touchedRowIdxs) scheduleSave(i);
    return batch.length;
  }

  /** Pop the most recent redo batch and re-apply. Symmetric with
   *  undoLastBatch: pushes the inverse onto the undo stack so the
   *  operator can flip back and forth. */
  function redoLastBatch(): number {
    const batch = redoStack.current.pop();
    if (!batch || batch.length === 0) return 0;
    const { inverse, touchedRowIdxs } = applyBatch(batch);
    undoStack.current.push(inverse);
    if (undoStack.current.length > UNDO_MAX) {
      undoStack.current.splice(0,
        undoStack.current.length - UNDO_MAX);
    }
    for (const i of touchedRowIdxs) scheduleSave(i);
    return batch.length;
  }

  // Keyboard navigation + fill-down. Tab / Shift+Tab move between
  // cells (native). Enter moves down one row in the same column.
  // Ctrl+D (or Cmd+D on macOS) fires fill-down from the active cell.
  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-cell-coord]');
    if (!cell) return;
    const coord = cell.getAttribute('data-cell-coord');
    if (!coord) return;
    const [rowStr, colStr] = coord.split(':');
    const row = Number(rowStr); const col = Number(colStr);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    // Escape — behaviour depends on where focus is:
    //   • inside an input  → blur back to the containing cell td
    //     so arrow keys resume cell-grid navigation (Excel style).
    //   • already on a cell → clear the selection.
    if (e.key === 'Escape') {
      const inInput = target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT';
      if (inInput) {
        e.preventDefault();
        target.blur();
        cell.focus();
        return;
      }
      if (selection) {
        e.preventDefault();
        setSelection(null);
        // eslint-disable-next-line no-console
        console.log('[sheet] deselect');
      }
      return;
    }
    // F2 — enter edit mode (focus the input inside the active cell).
    // Excel/Sheets parity: keyboard-first operators toggle between
    // cell-grid navigation and in-cell editing with F2 / Esc.
    if (e.key === 'F2') {
      const input = cell.querySelector<HTMLInputElement
        | HTMLSelectElement | HTMLTextAreaElement>(
        'input,select,textarea');
      if (input) {
        e.preventDefault();
        input.focus();
        if ('select' in input && typeof input.select === 'function') {
          input.select();
        }
      }
      return;
    }
    // Arrow keys WITHOUT Shift — move the focused cell. Only fires
    // when focus is on the td itself, NOT inside an input (inputs
    // need arrow keys for cursor navigation). Esc from an input
    // blurs to the td so the operator can re-enter cell-grid
    // navigation from inside the sheet.
    const isInputFocus = target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT';
    if (!isInputFocus && !e.shiftKey && !e.ctrlKey && !e.metaKey
        && (e.key === 'ArrowUp' || e.key === 'ArrowDown'
            || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const colMax = allFields.length - 1;
      const rowMax = rowsRef.current.length - 1;
      const dRow = e.key === 'ArrowUp' ? -1
        : e.key === 'ArrowDown' ? 1 : 0;
      const dCol = e.key === 'ArrowLeft' ? -1
        : e.key === 'ArrowRight' ? 1 : 0;
      // When moving into the data-column range (col >= 0) use the
      // field index; left/right clamp to 0..colMax, up/down to
      // the row bounds.
      const nextRow = Math.max(0, Math.min(rowMax, row + dRow));
      const nextCol = Math.max(0, Math.min(colMax,
        col < 0 ? Math.max(0, dCol) : col + dCol));
      const next = document.querySelector<HTMLElement>(
        `[data-cell-coord="${nextRow}:${nextCol}"]`);
      if (next) {
        next.focus();
        setSelection({ anchor: { row: nextRow, col: nextCol },
          focus: { row: nextRow, col: nextCol } });
      }
      return;
    }
    // Ctrl+Z / Cmd+Z — undo. Ctrl+Shift+Z — redo.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        const n = redoLastBatch();
        // eslint-disable-next-line no-console
        console.log('[sheet] redo', { cellsReapplied: n });
      } else {
        const n = undoLastBatch();
        // eslint-disable-next-line no-console
        console.log('[sheet] undo', { cellsReverted: n });
      }
      return;
    }
    // Ctrl+Y / Cmd+Y — alternate redo shortcut (Windows style).
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      const n = redoLastBatch();
      // eslint-disable-next-line no-console
      console.log('[sheet] redo', { cellsReapplied: n });
      return;
    }
    // Ctrl+C / Cmd+C over a multi-cell selection — build TSV of
    // the selection rectangle and write to the clipboard. Single-
    // cell selections fall through so the browser's native input
    // copy honours the cursor's text selection.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c'
        && !e.shiftKey && selection
        && !(selection.anchor.row === selection.focus.row
             && selection.anchor.col === selection.focus.col)) {
      if (typeof navigator === 'undefined'
          || !navigator.clipboard?.writeText) return;
      e.preventDefault();
      const tsv = serializeSelectionAsTsv(selection);
      void navigator.clipboard.writeText(tsv);
      // eslint-disable-next-line no-console
      console.log('[sheet] copy', { bytes: tsv.length });
      return;
    }
    // Delete / Backspace over a multi-cell selection — clear every
    // non-hidden cell in the rectangle, record ONE undo batch,
    // schedule the affected rows for save. Single-cell selections
    // fall through so the browser's native input delete still
    // handles cursor-text editing.
    if ((e.key === 'Delete' || e.key === 'Backspace')
        && selection
        && !(selection.anchor.row === selection.focus.row
             && selection.anchor.col === selection.focus.col)) {
      e.preventDefault();
      clearSelection();
      return;
    }
    // Ctrl+A / Cmd+A — select-all the data grid. Native "select
    // all text" inside an input wins first; a second press
    // (or Ctrl+A fired from a non-input focus like a th) grabs
    // the whole sheet.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'
        && !e.shiftKey) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT';
      // If the cursor is inside an input with a non-empty value,
      // let the native Ctrl+A work once. If the operator fires
      // Ctrl+A again (same input) we escalate to grid-select-all.
      if (inInput && !selection) {
        // First press — browser's select-all-text handles it.
        // Set a one-cell selection at the active cell so the
        // SECOND press (which lands here with selection set) can
        // escalate.
        return;
      }
      if (allFields.length === 0 || rowsRef.current.length === 0) return;
      e.preventDefault();
      setSelection({
        anchor: { row: 0, col: 0 },
        focus: { row: rowsRef.current.length - 1,
          col: allFields.length - 1 },
      });
      return;
    }
    // Shift+Arrow — extend selection in that direction. Base case
    // when nothing is selected yet: seed anchor at current cell.
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown'
        || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        && col >= 0) {
      const colMax = allFields.length - 1;
      const rowMax = rowsRef.current.length - 1;
      const current = selection ?? {
        anchor: { row, col }, focus: { row, col },
      };
      const dRow = e.key === 'ArrowUp' ? -1
        : e.key === 'ArrowDown' ? 1 : 0;
      const dCol = e.key === 'ArrowLeft' ? -1
        : e.key === 'ArrowRight' ? 1 : 0;
      const nextFocus = {
        row: Math.max(0, Math.min(rowMax,
          current.focus.row + dRow)),
        col: Math.max(0, Math.min(colMax,
          current.focus.col + dCol)),
      };
      e.preventDefault();
      setSelection({ anchor: current.anchor, focus: nextFocus });
      return;
    }
    // Ctrl+V / Cmd+V — intercept paste only when the clipboard
    // text contains newlines or tabs (block paste). Single-value
    // paste falls through to the browser's native input handling
    // so the cursor position is honoured. Reading the clipboard
    // is async + requires user-gesture permission; on refusal we
    // fall through silently.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v'
        && !e.shiftKey && col >= 0) {
      if (typeof navigator === 'undefined'
          || !navigator.clipboard?.readText) return;
      // Peek the clipboard — if it's single-value, let the native
      // paste proceed. Otherwise prevent + handle as block.
      e.preventDefault();
      void navigator.clipboard.readText().then((text) => {
        if (text == null) return;
        if (!text.includes('\t') && !text.includes('\n')) {
          // Single-value paste — delegate to updateCell so the
          // active cell takes the value through the normal
          // undo + save pipeline.
          const field = allFields[col];
          if (!field) return;
          updateCell(row, field.id, text);
          return;
        }
        pasteBlockAt(row, col, text);
      });
      return;
    }
    // Ctrl+D / Cmd+D — fill down the active cell. The browser's
    // default Ctrl+D (bookmark) is suppressed.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      if (col < 0) return; // skip the date column
      const field = allFields[col];
      if (!field) return;
      e.preventDefault();
      const n = fillDown(row, field.id);
      // Visual flash: briefly flag the source cell so operators see
      // what just happened. Peel the class off after the CSS
      // animation completes (300 ms).
      cell.classList.add('cap-sheet__cell--filldown-flash');
      setTimeout(() =>
        cell.classList.remove('cap-sheet__cell--filldown-flash'), 300);
      // eslint-disable-next-line no-console
      console.log('[sheet] fill-down', { row, field: field.id,
        rowsFilled: n });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = document.querySelector<HTMLElement>(
        `[data-cell-coord="${row + 1}:${col}"]`);
      if (next) {
        next.focus();
        // Select the input inside the cell if it's a text input.
        const input = next.querySelector<HTMLInputElement
          | HTMLSelectElement>('input,select');
        input?.focus();
      }
    }
  }

  if (load === 'loading') {
    return <p className="cap-sub" data-test="ev-sheet-loading">
      Loading events + stage schema…
    </p>;
  }
  if (load === 'err') {
    return <div className="cap-strip cap-strip--err"
                data-test="ev-sheet-err">{loadMsg
                  ?? 'Could not open spreadsheet mode'}</div>;
  }

  const savingCount = rows.filter((r) =>
    r.saveState === 'saving' || r.saveState === 'dirty').length;
  const ruleErrorCount = rowEffects.reduce((n, eff) =>
    n + eff.warnings.filter((w) => w.severity === 'error').length, 0);
  const ruleWarnCount = rowEffects.reduce((n, eff) =>
    n + eff.warnings.filter((w) => w.severity === 'warning').length, 0);

  return (
    <>
      <div className="cap-section-head" data-test="ev-sheet-head">
        <h2 className="cap-section-head__title">Events — spreadsheet mode</h2>
        <span className="cap-section-head__count"
              data-test="ev-sheet-status">
          {rows.length} row{rows.length === 1 ? '' : 's'}
          {savingCount > 0 && <> · <em>{savingCount} saving</em></>}
          {ruleErrorCount > 0 && (
            <> · <span className="cap-sheet__count-err"
                        data-test="ev-sheet-rule-errors">
              {ruleErrorCount} rule error{ruleErrorCount === 1 ? '' : 's'}
            </span></>
          )}
          {ruleWarnCount > 0 && (
            <> · <span className="cap-sheet__count-warn"
                        data-test="ev-sheet-rule-warnings">
              {ruleWarnCount} warning{ruleWarnCount === 1 ? '' : 's'}
            </span></>
          )}
        </span>
        <span className="cap-section-head__rule" />
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="ev-sheet-back-to-rows"
                onClick={() => navEvent.list(programUid)}
                title="Switch back to row view (one event per row with details)">
          Row view
        </button>
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="ev-sheet-add-row"
                onClick={addRow}
                title="Append a blank row at the bottom of the sheet">
          + New row
        </button>
      </div>
      <p className="cap-sub" style={{ marginLeft: 14, marginTop: -6 }}>
        Type directly into cells — rows save automatically
        ~1&nbsp;second after your last keystroke. <strong>Tab</strong>
        / <strong>Shift+Tab</strong> move between cells, <strong>Enter
        </strong> jumps down to the next row, <strong>Ctrl+D</strong>
        fills the active cell's value down through every row below.
        <strong>Shift+Click</strong> / <strong>Shift+Arrow</strong>
        extend the selection; <strong>Ctrl+A</strong> selects every
        cell. <strong>Delete</strong> clears the selected range.
        <strong>Ctrl+C</strong> copies the selection as tab-separated
        rows; <strong>Ctrl+V</strong> pastes clipboard TSV as a block.
        <strong>Ctrl+Z</strong> undoes, <strong>Ctrl+Shift+Z</strong>
        redoes. Drag the blue square at the bottom-right of the
        selection to fill a rectangle with the anchor cell's value.
        <strong>Esc</strong> blurs an input back to the cell (so
        arrow keys move between cells) or deselects when focus is
        already on a cell. <strong>F2</strong> re-enters edit mode.
        Drag a column header's right edge to resize — widths
        persist per program.
      </p>

      <div className="cap-sheet-wrap" data-test="ev-sheet"
           onKeyDown={onGridKeyDown}>
        <table className="cap-sheet">
          <thead>
            <tr>
              <th scope="col" className="cap-sheet__status-col"
                  title="Per-row save state">&nbsp;</th>
              <th scope="col" className="cap-sheet__date-col">Event date</th>
              {allFields.map((f) => (
                <th key={f.id} scope="col" title={f.id}
                    style={colWidths[f.id]
                      ? { width: colWidths[f.id] + 'px',
                          minWidth: colWidths[f.id] + 'px' }
                      : undefined}>
                  {f.label}
                  {f.required && <span className="cap-input__req"> *</span>}
                  <span className="cap-sheet__col-resize"
                        role="separator" aria-orientation="vertical"
                        title={'Drag to resize this column'}
                        data-test={'ev-sheet-col-resize-' + f.id}
                        onMouseDown={(e) =>
                          startColResize(e, f.id)} />
                </th>
              ))}
              <th scope="col" className="cap-sheet__actions-col">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => {
              const effects = rowEffects[rowIdx];
              const ruleWarnings = effects?.warnings ?? [];
              const errorCount = ruleWarnings.filter(
                (w) => w.severity === 'error').length;
              const warnCount = ruleWarnings.length - errorCount;
              const warningsByField = new Map<string,
                readonly RuleWarning[]>();
              for (const w of ruleWarnings) {
                if (!w.fieldId) continue;
                const list = warningsByField.get(w.fieldId) ?? [];
                warningsByField.set(w.fieldId, [...list, w]);
              }
              const tooltipLines: string[] = [];
              if (r.saveMsg) tooltipLines.push(r.saveMsg);
              else switch (r.saveState) {
                case 'saving': tooltipLines.push('Saving to edge…'); break;
                case 'saved': tooltipLines.push(r.eventUid
                  ? 'Saved on edge'
                  : 'Empty row (not yet saved)'); break;
                case 'dirty': tooltipLines.push('Typing…'); break;
                case 'err': tooltipLines.push(r.saveMsg ?? 'Save failed');
                  break;
                default: tooltipLines.push('Idle');
              }
              if (errorCount > 0 || warnCount > 0) {
                tooltipLines.push('');
                tooltipLines.push('Program-rule notes:');
                for (const w of ruleWarnings) {
                  tooltipLines.push((w.severity === 'error'
                    ? '• ERROR: ' : '• warn:  ') + w.message);
                }
              }
              return (
              <tr key={r.localKey}
                  className={'cap-sheet__row cap-sheet__row--'
                    + r.saveState
                    + (errorCount > 0 ? ' cap-sheet__row--rule-err' : '')
                    + (errorCount === 0 && warnCount > 0
                      ? ' cap-sheet__row--rule-warn' : '')}
                  data-test={'ev-sheet-row-' + rowIdx}
                  data-rule-errors={errorCount}
                  data-rule-warnings={warnCount}>
                <td className="cap-sheet__status-cell"
                    title={tooltipLines.join('\n')}>
                  {statusDot(r.saveState)}
                  {(errorCount > 0 || warnCount > 0) && (
                    <span className={'cap-sheet__rule-badge '
                      + (errorCount > 0
                        ? 'cap-sheet__rule-badge--err'
                        : 'cap-sheet__rule-badge--warn')}
                          data-test={'ev-sheet-row-' + rowIdx + '-rulebadge'}>
                      {errorCount + warnCount}
                    </span>
                  )}
                </td>
                <td className="cap-sheet__date-cell"
                    data-cell-coord={rowIdx + ':-1'}
                    tabIndex={-1}>
                  <input type="date"
                         className="cap-sheet__cell-input"
                         value={r.occurredAt}
                         onChange={(e) =>
                           updateOccurredAt(rowIdx, e.target.value)}
                         onClick={openDatePicker}
                         onFocus={openDatePickerOnFocus}
                         data-test={'ev-sheet-row-' + rowIdx + '-date'} />
                </td>
                {allFields.map((f, colIdx) => {
                  const hidden = effects?.hiddenFieldIds.has(f.id)
                    ?? false;
                  const mandatory = f.required
                    || (effects?.mandatoryFieldIds.has(f.id) ?? false);
                  const cellWarnings = warningsByField.get(f.id) ?? [];
                  const cellHasError = cellWarnings.some(
                    (w) => w.severity === 'error');
                  const cellHasWarn = cellWarnings.length > 0
                    && !cellHasError;
                  // ASSIGN output — live computed value overlays
                  // the typed value only when the typed value is
                  // empty. Flag the cell visually so operators know
                  // the value came from a rule, not their keystrokes.
                  const typedValue = r.values[f.id] ?? '';
                  const assignedValue = effects?.assignedValues.get(f.id);
                  const effectiveValue = (typedValue.trim() === ''
                    && assignedValue != null)
                    ? assignedValue : typedValue;
                  const isAssigned = typedValue.trim() === ''
                    && assignedValue != null
                    && assignedValue.trim() !== '';
                  return (
                  <td key={f.id}
                      data-cell-coord={rowIdx + ':' + colIdx}
                      tabIndex={-1}
                      onMouseDown={(e) =>
                        onCellMouseDown(e, rowIdx, colIdx)}
                      className={
                        (hidden ? 'cap-sheet__cell--hidden ' : '')
                        + (cellHasError ? 'cap-sheet__cell--err ' : '')
                        + (cellHasWarn ? 'cap-sheet__cell--warn ' : '')
                        + (isAssigned ? 'cap-sheet__cell--assigned ' : '')
                        + (inSelection(rowIdx, colIdx)
                          ? 'cap-sheet__cell--selected ' : '')
                        + (selection
                          && selection.anchor.row === rowIdx
                          && selection.anchor.col === colIdx
                            ? 'cap-sheet__cell--anchor ' : '')
                        + (inFillPreview(rowIdx, colIdx)
                          ? 'cap-sheet__cell--fill-preview ' : '')
                      }
                      title={cellWarnings.length > 0
                        ? cellWarnings.map((w) =>
                          (w.severity === 'error' ? 'ERROR: ' : 'warn: ')
                          + w.message).join('\n')
                        : hidden ? 'Hidden by a program rule for this row'
                        : isAssigned
                        ? 'Computed by an ASSIGN program rule — type a '
                          + 'value to override.'
                        : undefined}>
                    {hidden ? (
                      <span className="cap-sheet__cell-hidden-marker"
                            aria-hidden="true">—</span>
                    ) : (
                      <SheetCell api={api}
                                 field={mandatory !== f.required
                                   ? { ...f, required: mandatory } : f}
                                 value={effectiveValue}
                                 onChange={(v) =>
                                   updateCell(rowIdx, f.id, v)}
                                 onCommit={() => {
                                   const t = timers.current.get(rowIdx);
                                   if (t) clearTimeout(t);
                                   timers.current.delete(rowIdx);
                                   void saveRow(rowIdx);
                                 }} />
                    )}
                    {selection
                      && rowIdx === Math.max(selection.anchor.row,
                          selection.focus.row)
                      && colIdx === Math.max(selection.anchor.col,
                          selection.focus.col) && (
                      <span className="cap-sheet__fill-handle"
                            role="button"
                            aria-label={'Drag to fill a range with '
                              + 'the selection value'}
                            title={'Drag to fill cells with the '
                              + 'anchor cell\'s value.'}
                            data-test={'ev-sheet-fill-handle-'
                              + selection.anchor.row + '-'
                              + selection.anchor.col}
                            onMouseDown={(ev) =>
                              startFillDrag(ev,
                                selection.anchor.row,
                                selection.anchor.col)} />
                    )}
                  </td>
                  );
                })}
                <td className="cap-sheet__actions-cell">
                  <button type="button"
                          className="cap-sheet__row-del"
                          title="Delete this row"
                          data-test={'ev-sheet-row-' + rowIdx + '-del'}
                          onClick={() => { void deleteRow(rowIdx); }}>
                    ×
                  </button>
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="cap-sheet__empty"
                    colSpan={allFields.length + 3}>
                  No events yet — click <strong>+ New row</strong> above
                  to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function toValueMap(e: EventRow): Record<string, string> {
  const out: Record<string, string> = {};
  if (e.dataValues) for (const [k, v] of Object.entries(e.dataValues)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

function extractEventUid(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const direct = r.event ?? r.eventUid ?? r.uid;
  if (typeof direct === 'string') return direct;
  // DHIS2 import summary shape: { importSummaries: [ { reference: UID } ] }
  const summaries = r.importSummaries ?? r.imported ?? r.bundleReport;
  if (Array.isArray(summaries) && summaries[0]) {
    const first = summaries[0] as Record<string, unknown>;
    const ref = first.reference ?? first.uid;
    if (typeof ref === 'string') return ref;
  }
  // Tracker import-report shape.
  const bundle = (r.bundleReport
    ?? ((r.response as Record<string, unknown>)
      ?.bundleReport)) as Record<string, unknown> | undefined;
  const typeReportMap = bundle?.typeReportMap as
    Record<string, { objectReports?: Array<Record<string, unknown>> }>
    | undefined;
  const evReports = typeReportMap?.EVENT?.objectReports;
  if (evReports && evReports[0] && typeof evReports[0].uid === 'string') {
    return evReports[0].uid as string;
  }
  return null;
}

function statusDot(state: SheetRow['saveState']): JSX.Element {
  const map: Record<SheetRow['saveState'], string> = {
    idle: 'idle', dirty: 'dirty', saving: 'saving',
    saved: 'saved', err: 'err',
  };
  return <span className={'cap-sheet__dot cap-sheet__dot--' + map[state]}
                aria-hidden="true" />;
}
