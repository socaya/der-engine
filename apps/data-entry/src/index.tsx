import { useEffect, useRef, useState,
  type FormEvent, type RefObject } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

type Mode = 'structured' | 'custom';

/**
 * DER-dispatched Aggregate data-entry app (C-UI-5c / 5f).
 *
 *   • Structured mode — minimal single-DE form that posts via
 *     useDerApi().submitAggregate. For datasets whose form is
 *     SECTION or DEFAULT, or when the operator wants a quick path.
 *   • Custom mode (C-UI-5f) — renders `dataEntryForm.htmlCode`
 *     exactly as DHIS2 does, loading the legacy DHIS2 Data Entry
 *     JS bundle (jQuery + dhis2.de.js + helpers) from the server's
 *     /legacy-custom-forms/ static root. The vendor JS handles
 *     autosave + validation + indicator evaluation; globals are
 *     seeded from the app's auth + OU context before the scripts
 *     execute.
 */
export default function DataEntryApp(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi();

  const [mode, setMode] = useState<Mode>('custom');
  const [datasetList, setDatasetList] = useState<Array<{
    id: string; label: string; periodType?: string; formType?: string;
  }>>([]);
  const [dataSet, setDataSet] = useState('');
  const [period, setPeriod] = useState('');
  const [dataElement, setDataElement] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [formInfo, setFormInfo] = useState<{
    hasCustomForm: boolean; formId?: string; displayName?: string;
    formType?: string; periodType?: string;
    openFuturePeriods?: number;
  } | null>(null);
  const customRoot = useRef<HTMLDivElement | null>(null);
  // AttributeOptionCombo selections for non-default categoryCombos.
  // Keyed on category id → option id. Mirrored to hidden inputs +
  // dhis2.de.currentCategorySelections on every change so form.js's
  // getCurrentCategorySelections reads consistent state.
  const [aocSelections, setAocSelections] = useState<Record<string, string>>({});
  // Ref-mirror so the save-on-blur handler (attached once per
  // form render) always reads the operator's latest AOC pick.
  const aocSelectionsRef = useRef<Record<string, string>>({});
  const [aocCategories, setAocCategories] = useState<Array<{
    id: string; name: string; options: Array<{ id: string; name: string }>;
  }>>([]);
  // FR-06-06 — "Complete" marker state for the current
  // (dataSet, orgUnit, period) triple. `null` → unknown / still
  // loading; false → open for edits; true → the operator has
  // marked the registration complete. Toggled via the button below
  // the form card.
  const [completion, setCompletion] =
    useState<{ completed: boolean; completedAt?: string } | null>(null);
  const [completionBusy, setCompletionBusy] = useState(false);
  // Set of period ids already marked complete for the active
  // (dataSet, OU). Refreshed when either changes + whenever the
  // current period's completion flips.
  const [completedPeriods, setCompletedPeriods] =
    useState<Set<string>>(new Set());
  const [touchedPeriods, setTouchedPeriods] =
    useState<Set<string>>(new Set());
  // DE filter — narrows the visible tbody rows to those whose
  // row-label matches the typed substring. Driven by an input
  // in the toolbar; applied via a DOM walk after every keystroke.
  const [deFilter, setDeFilter] = useState('');
  // Bump after every successful form render so SectionNavigator
  // re-scrapes the headers of the freshly-injected #contentDiv.
  const [formRenderVersion, setFormRenderVersion] = useState(0);
  // Slice 28 — issues list from the last Validate run. When non-
  // empty the drawer auto-opens; operators can close it + reopen
  // from the "N issues" pill next to Validate.
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const totalCellsRef = useRef(0);
  // FR-07 — details drawer. Tracks the currently-focused cell and
  // re-reads its metadata from the hydrated dhis2.de shim as the
  // operator navigates.
  const [details, setDetails] = useState<CellDetails | null>(null);
  // Form-level central-sync state for the (dataSet, orgUnit, period, aoc)
  // tuple. Powers the DER + DHIS2 logos on the cell-details strip —
  // DER lights as soon as a cell lands locally; DHIS2 lights once the
  // drain worker publishes the envelope and central accepts it.
  const [formSyncState, setFormSyncState] =
    useState<FormSyncState>({ localSaved: false, central: null });
  // Monotonic bump — any successful save triggers a refetch of the
  // form-sync-state so the DHIS2 logo turns on without the operator
  // having to click around.
  const [saveTick, setSaveTick] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Dataset summary for the toolbar info popover: filled after the
  // meta effect resolves so the info button can render without
  // re-fetching + without re-walking the full DataSetBundle on open.
  const [formSummary, setFormSummary] = useState<{
    description?: string;
    sectionCount: number;
    dataElementCount: number;
    compulsoryCount: number;
    validationRuleCount: number;
    indicatorCount: number;
  } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  // "?" opens shortcuts when the operator isn't typing into an
  // input. A capture-phase listener keeps this out of the cell's
  // own input stream.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== '?') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Dirty-form guard — attachSaveOnBlur stamps `data-dirty="1"` on
  // cells whose current value differs from the last successfully
  // saved value. If any remain dirty when the operator tries to
  // close the tab / navigate away, trigger the browser's native
  // "Changes you made may not be saved" dialog. Clean forms unload
  // silently.
  useEffect(() => {
    const beforeUnload = (ev: BeforeUnloadEvent): void => {
      const root = customRoot.current;
      if (!root) return;
      if (!root.querySelector('input[data-dirty="1"]')) return;
      ev.preventDefault();
      // Chrome ignores the string but requires returnValue to be
      // truthy; Firefox/Safari honour it in some versions.
      ev.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  // §Operator policy — the operator picks whether custom DHIS2
  // forms render through DER's design language ('der', the
  // default stripped-and-restyled path) or faithfully using the
  // author's own HTML/CSS ('author', no strip, no decoration
  // hide). Persisted in localStorage so the next visit opens in
  // the chosen mode.
  const [customFormMode, setCustomFormMode] =
    useState<'der' | 'author'>(() => {
      try {
        const v = window.localStorage.getItem('der-de-custom-form-mode');
        return v === 'author' ? 'author' : 'der';
      } catch { return 'der'; }
    });
  useEffect(() => {
    try { window.localStorage.setItem('der-de-custom-form-mode', customFormMode); }
    catch { /* non-persistent env */ }
  }, [customFormMode]);
  // Compact-by-default, remembered in localStorage so operators
  // don't have to re-pick on every visit.
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    try {
      return (window.localStorage.getItem('der-de-density') as
        'compact' | 'comfortable') ?? 'compact';
    } catch { return 'compact'; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('der-de-density', density); }
    catch { /* non-persistent env */ }
  }, [density]);

  // Hydrate the dataset picker whenever the bound OU resolves —
  // operators only see datasets assigned to their facility on
  // Central DHIS2. Prevents entry on (dataSet, orgUnit) pairs the
  // central side will reject with E8022 "Data set not usable with
  // org unit" (the root cause of every CONFLICT_REVIEW envelope
  // the admin outbox was accumulating).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ou.bound || !ou.orgUnitUid) {
        setDatasetList([]);
        return;
      }
      try {
        const r = await api.listDataSets(ou.orgUnitUid);
        if (cancelled) return;
        const list = (r.dataSets ?? []).map((d) => ({
          id: d.id,
          label: d.displayName ?? d.name ?? d.id,
          periodType: d.periodType,
          formType: d.formType,
        })).sort((a, b) => a.label.localeCompare(b.label));
        setDatasetList(list);
      } catch { /* mirror unreachable — picker stays empty */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ou.bound, ou.orgUnitUid]);

  // Whenever the dataset UID changes, peek at the dataset's form
  // metadata so the UI can offer "Switch to custom form" when the
  // dataset actually has one.
  useEffect(() => {
    if (dataSet.trim() === '') {
      setFormInfo(null);
      setAocCategories([]);
      setAocSelections({});
      aocSelectionsRef.current = {};
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meta = await api.getDataSetMeta(dataSet.trim()) as {
          displayName?: string; name?: string;
          formType?: string; periodType?: string;
          openFuturePeriods?: number;
          dataEntryForm?: { id: string } | null;
        };
        if (cancelled) return;
        const hasCustomForm = (!!meta.dataEntryForm && meta.formType === 'CUSTOM')
          || meta.formType === 'SECTION';
        setFormInfo({
          hasCustomForm,
          formId: meta.dataEntryForm?.id,
          displayName: meta.displayName ?? meta.name,
          formType: meta.formType,
          periodType: meta.periodType,
          openFuturePeriods: meta.openFuturePeriods ?? 0,
        });
        setMode(hasCustomForm ? 'custom' : 'structured');

        // Load the dataset's attribute-category combo NOW (before
        // the operator picks a period) so a non-default AOC (e.g.
        // "Partner × Funder") can be chosen alongside the dataset.
        // DHIS2's own Data Entry app does this too — AOC is a
        // dataset-level dimension, not a form-level one.
        try {
          const full = await api.getDataSetFormMetadata(dataSet.trim());
          if (cancelled) return;
          const enriched = await enrichDataSetBundle(full as DataSetBundle, api);
          if (cancelled) return;
          const cats = (enriched.categoryCombo?.categories ?? [])
            .filter((c) => (c.categoryOptions?.length ?? 0) > 1)
            .map((c) => ({
              id: c.id, name: c.name ?? c.id,
              options: (c.categoryOptions ?? [])
                .map((o) => ({ id: o.id, name: o.name ?? o.id })),
            }));
          setAocCategories(cats);
          const seed: Record<string, string> = {};
          for (const c of cats) if (c.options[0]) seed[c.id] = c.options[0].id;
          setAocSelections(seed);
          aocSelectionsRef.current = seed;
        } catch { /* mirror unreachable — leave AOC empty */ }
      } catch { if (!cancelled) setFormInfo(null); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet]);

  // Mount the DHIS2 custom form when the user switches to custom
  // mode and the dataset has one. Loads vendor scripts in sequence,
  // seeds DHIS2 globals + hidden selectors, then injects htmlCode.
  useEffect(() => {
    if (mode !== 'custom' || !formInfo?.hasCustomForm) return;
    // SECTION datasets carry metadata but no `dataEntryForm.id` —
    // the renderer synthesises the table from `sections[]`. Only
    // reject CUSTOM when the mirror doesn't know the form id.
    if (formInfo.formType === 'CUSTOM' && !formInfo.formId) return;
    const root = customRoot.current;
    if (!root) return;
    let cancelled = false;

    (async () => {
      setStatus({ kind: 'submitting' });
      try {
        // Always pull the dataset metadata first — it drives both
        // the AOC picker + globals hydration regardless of form
        // type.
        const metaRaw = await api.getDataSetFormMetadata(dataSet.trim()) as DataSetBundle;
        if (cancelled) return;
        // DER's mirror serves `/api/dataSets/{uid}` with the DHIS2
        // `fields=:all` payload, which expands scalars but leaves
        // every nested reference (sections.dataElements,
        // dataSetElements.dataElement, categoryCombo) as a bare
        // `{id}`. Enrich the payload once-per-form-load against the
        // local registries so renderSectionForm has names,
        // valueTypes, and COCs to work with. One-shot module cache
        // keeps dataset switches snappy.
        const meta = await enrichDataSetBundle(metaRaw, api);
        if (cancelled) return;
        // formType === 'CUSTOM' → fetch the dataset's htmlCode
        // from DHIS2. formType === 'SECTION' → synthesise the
        // DHIS2 section-form table from the metadata we already
        // have. Either way `formHtml` is injected via
        // `applyFormAssets` into #contentDiv.
        //
        // If the custom-form HTML isn't in the mirror yet (common
        // when the dataset was created in DHIS2 after the last
        // metadata sync), silently fall back to the SECTION-rendered
        // form so the operator can still capture values.
        let formHtml = '';
        if (formInfo.formType === 'CUSTOM' && formInfo.formId) {
          try {
            const form = await api.getDataEntryFormHtml(formInfo.formId) as {
              htmlCode?: string;
            };
            formHtml = form.htmlCode ?? '';
          } catch (fetchErr) {
            formHtml = '';
            // eslint-disable-next-line no-console
            console.warn('[data-entry] custom htmlCode fetch failed; '
              + 'falling back to SECTION render', fetchErr);
          }
          if (!formHtml.trim()) formHtml = renderSectionForm(meta);
        } else if (formInfo.formType === 'SECTION') {
          formHtml = renderSectionForm(meta);
        }
        if (cancelled) return;
        // Fetch validation rules alongside dataset metadata. The
        // mirror may not have any; empty list keeps the globals
        // clean without surfacing an error. Best-effort — a
        // validationRules endpoint failure must NOT block form
        // rendering, since most installations run without any.
        const vrResp = await api.listValidationRules(dataSet.trim()).catch(() => ({ validationRules: [] }));
        if (cancelled) return;
        // Derive the AOC picker list — only categories with more
        // than one option (i.e. non-default) need an operator
        // selection.
        const cats = (meta.categoryCombo?.categories ?? [])
          .filter((c) => (c.categoryOptions?.length ?? 0) > 1)
          .map((c) => ({
            id: c.id, name: c.name ?? c.id,
            options: (c.categoryOptions ?? [])
              .map((o) => ({ id: o.id, name: o.name ?? o.id })),
          }));
        setAocCategories(cats);
        // Seed selections with the first option so the form always
        // has a complete AOC even before the operator interacts.
        const seed: Record<string, string> = {};
        for (const c of cats) if (c.options[0]) seed[c.id] = c.options[0].id;
        setAocSelections(seed);
        aocSelectionsRef.current = seed;
        // Clear any previous render — we rebuild hidden selectors
        // + content on every form load.
        root.replaceChildren();
        // Seed hidden selectors DHIS2's form.js reads via jQuery.
        for (const [id, val] of [
          ['selectedDataSetId', dataSet.trim()],
          ['selectedPeriodId', period.trim()],
          ['selectedOrganisationUnitId', ou.orgUnitUid ?? ''],
        ] as const) {
          const i = document.createElement('input');
          i.type = 'hidden'; i.id = id; i.value = val;
          root.appendChild(i);
        }
        // Hidden AOC selectors — form.js reads `#category-<catId>`
        // when deriving the current attributeOptionCombo on save.
        for (const [catId, optId] of Object.entries(seed)) {
          const i = document.createElement('input');
          i.type = 'hidden';
          i.id = `category-${catId}`;
          i.value = optId;
          i.setAttribute('data-der-category', catId);
          root.appendChild(i);
        }
        // The form's content lands here — DHIS2's entry.js expects
        // #contentDiv as the root selector.
        const content = document.createElement('div');
        content.id = 'contentDiv';
        root.appendChild(content);
        // Global DHIS2 namespace — seed selections + metadata so
        // form.js / entry.js can resolve indicators, option sets,
        // category combos, data-element definitions. Mirrors the
        // shim DHIS2's own aggregate-data-entry-app writes before
        // custom forms load (loadCustomFormShim.js).
        hydrateDhis2Globals({
          dataSetId: dataSet.trim(),
          periodId: period.trim(),
          orgUnitId: ou.orgUnitUid ?? '',
          meta,
          aocSelections: seed,
          validationRules: vrResp.validationRules ?? [],
        });
        // Freeze a compact summary for the info popover. Uses meta
        // we already have in hand so the panel can render without
        // touching the network on open.
        setFormSummary({
          description: meta.description,
          sectionCount: meta.sections?.length ?? 0,
          dataElementCount: meta.dataSetElements?.length ?? 0,
          compulsoryCount: meta.compulsoryDataElementOperands?.length ?? 0,
          validationRuleCount: vrResp.validationRules?.length ?? 0,
          indicatorCount: meta.indicators?.length ?? 0,
        });

        // Vendor CSS baseline (DHIS2's own stack) first so the form
        // renders styled on first paint.
        for (const href of VENDOR_STYLES) loadStyle(href);
        for (const src of VENDOR_SCRIPTS) {
          if (document.querySelector(`script[data-der-custom-form="${src}"]`)) continue;
          await loadScript(src);
        }
        // Finalise the DHIS2 shim after the vendor stack is in
        // place — $ and dhis2.period classes exist now, so we can
        // create the period picker + wire ajaxSetup.
        finaliseDhis2Shim();
        // Process the dataset's own htmlCode — everything DHIS2
        // custom-form authors can embed:
        //   <link rel="stylesheet" href="…">   — stylesheets
        //   <style>…</style>                    — inline CSS
        //   <script src="…">                    — remote scripts
        //   <script>…</script>                  — inline JS
        // The remaining DOM (inputs, tables, labels) gets appended
        // to #contentDiv. Relative `src`/`href` are rewritten to
        // `/legacy-custom-forms/…` so DHIS2's "../javascripts/…"
        // references resolve through our server.
        await applyFormAssets(content, formHtml,
          { stripStyles: customFormMode === 'der' });
        // Pre-populate existing dataValues the operator (or a
        // previous device) has already captured. Done after
        // applyFormAssets so the `<input name="<de>-<coc>-val">`
        // targets exist. Best-effort — no values is fine.
        await prefillExistingValues(
          content, dataSet.trim(), period.trim(),
          ou.orgUnitUid ?? '', api);
        // Hook save-on-blur on every data-value input in the
        // form. We don't trust DHIS2 entry.js's internal save
        // path to wire correctly against DER's emulated API —
        // posting ourselves is deterministic + lets us surface a
        // per-cell visual cue.
        attachSaveOnBlur(
          content,
          () => dataSet.trim(),
          () => period.trim(),
          () => ou.orgUnitUid ?? '',
          () => ({ ...aocSelectionsRef.current }),
          api,
          (s) => {
            // Local save lands immediately; bump saveTick so the
            // form-sync-state poll re-fetches and the DHIS2 logo
            // lights once the drain worker ships the envelope.
            setFormSyncState((prev) => ({
              ...prev,
              localSaved: true,
              // Transient: central now needs re-confirmation.
              central: prev.central === 'CENTRAL_ACCEPTED' && s === 'saved'
                ? 'PENDING' : prev.central,
            }));
            setSaveTick((n) => n + 1);
          });
        // Optimistic touch — the first typed value in this
        // period gets a ● marker on the picker without waiting
        // for the next batch-refresh.
        content.addEventListener('blur', (ev) => {
          const t = ev.target as HTMLInputElement | null;
          if (t && t.tagName === 'INPUT'
            && /-val$/.test(t.getAttribute('name') ?? '')
            && t.value.trim() !== '') {
            const pe = period.trim();
            setTouchedPeriods((prev) => prev.has(pe) ? prev
              : new Set(prev).add(pe));
          }
        }, true);
        attachKeyboardNav(content);
        attachColumnPaste(content, setStatus);
        attachMatrixTotals(content);
        attachRowTotals(content);
        attachDetailsSpy(content, meta, setDetails);
        // §FR-09 — mark every (de, coc) listed in
        // compulsoryDataElementOperands so runValidation + the
        // CSS rule can surface missing-compulsory cells.
        markCompulsoryCells(content, meta);
        annotateValueTypes(content, meta);
        attachLiveValidation(content);
        annotateAriaLabels(content, meta);
        // Live indicator calc — attaches an input listener that
        // re-evaluates every indicator formula whenever a DE value
        // changes. Does an initial pass against prefilled values.
        attachIndicatorEngine(content, meta);
        setFormRenderVersion((v) => v + 1);
        // A successful render needs no toast; save-on-blur paints
        // per-cell status, the save-state pill tallies totals,
        // and the sticky action bar carries Validate / Complete.
        setStatus({ kind: 'idle' });
      } catch (e) {
        setStatus({ kind: 'error',
          message: `custom form failed to render: ${(e as Error).message}` });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, formInfo, dataSet, period, ou.orgUnitUid, customFormMode]);

  const canSubmit = ou.bound
    && dataSet.trim() !== ''
    && period.trim() !== ''
    && dataElement.trim() !== ''
    && value.trim() !== ''
    && status.kind !== 'submitting';

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus({ kind: 'submitting' });
    try {
      await api.submitAggregate({
        dataSet, period, orgUnit: ou.orgUnitUid,
        dataValues: [{ dataElement, value }],
      });
      setStatus({ kind: 'ok',
        message: `Submitted ${dataElement}=${value} for ${period}.` });
      setDataElement(''); setValue('');
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Submission failed' });
    }
  }

  const periodReady = period.trim() !== '';
  const datasetReady = dataSet.trim() !== '';
  const formReady = datasetReady && periodReady && ou.bound;

  // Apply the DE filter: walks every tbody row in #contentDiv,
  // hides rows whose first `.dataElementCell` (or title cell)
  // text doesn't include the filter substring (case-insensitive).
  useEffect(() => {
    const root = customRoot.current;
    if (!root) return;
    const q = deFilter.trim().toLowerCase();
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>(
      'tbody tr'));
    for (const r of rows) {
      if (!q) { r.style.display = ''; continue; }
      // Row label: prefer the .dataElementCell td, else the first
      // non-input td.
      const labelCell = r.querySelector('.dataElementCell')
        ?? r.querySelector('td');
      const text = (labelCell?.textContent ?? '').toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    }
  }, [deFilter, formRenderVersion]);

  // Poll the form's outbox envelope state so the cell-details strip
  // can light the DHIS2 logo once the drain worker publishes the
  // form. Refetches whenever the context changes or a save succeeds
  // (saveTick). While the envelope is still PENDING / IN_FLIGHT we
  // re-poll on a short interval so the UI flips to "Synced" without
  // the operator having to interact.
  useEffect(() => {
    const ouUid = ou.orgUnitUid ?? '';
    if (!dataSet.trim() || !ouUid || !period.trim()) {
      // Bail-out branch intentionally sets state via an equality
      // check — useDerApi() returns a fresh object identity on every
      // render, and if we unconditionally setState here the pre-
      // dataset mount loops forever (each state write triggers a
      // re-render which re-runs the effect which re-sets state).
      setFormSyncState((s) =>
        s.central == null && !s.updatedAt ? s : { ...s, central: null });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async (): Promise<void> => {
      try {
        const r = await (api as unknown as {
          readAggregateFormSyncState: (ds: string, ou: string, p: string) =>
            Promise<{ state: FormSyncState['central']; updatedAt?: string }>;
        }).readAggregateFormSyncState(dataSet.trim(), ouUid, period.trim());
        if (cancelled) return;
        setFormSyncState((s) => ({
          localSaved: s.localSaved || r.state != null,
          central: r.state,
          updatedAt: r.updatedAt,
        }));
        const stillInFlight = r.state === 'PENDING'
          || r.state === 'IN_FLIGHT'
          || r.state === 'RETRYABLE';
        if (stillInFlight) {
          timer = setTimeout(() => void tick(), 4000);
        }
      } catch { /* offline or endpoint miss — leave logos as-is */ }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // api intentionally omitted — useDerApi() returns a fresh object
    // on every render; depending on it would reinstate the mount
    // loop above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet, period, ou.orgUnitUid, saveTick]);

  // Batch-fetch completion state for every period that appears
  // in the picker so the dropdown can prefix a ✓ to already-
  // complete periods. Runs when dataset / OU / periodType
  // changes.
  useEffect(() => {
    if (!dataSet.trim() || !ou.bound || !formInfo?.periodType) {
      setCompletedPeriods(new Set());
      setTouchedPeriods(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const periods = buildPeriodOptions(
        formInfo.periodType, formInfo.openFuturePeriods ?? 0,
      ).map((o) => o.id);
      // One readAggregateValues() per period in parallel — DER's
      // mirror answers these in milliseconds; 25 periods max per
      // picker, fine on LAN.
      const [compOutcomes, touchOutcomes] = await Promise.all([
        Promise.all(periods.map(async (pe) => {
          try {
            const r = await api.getCompletion(
              dataSet.trim(), ou.orgUnitUid ?? '', pe);
            return r.completed ? pe : null;
          } catch { return null; }
        })),
        Promise.all(periods.map(async (pe) => {
          try {
            const r = await api.readAggregateValues(
              ou.orgUnitUid ?? '', pe, 1);
            return (r.dataValues?.length ?? 0) > 0 ? pe : null;
          } catch { return null; }
        })),
      ]);
      if (cancelled) return;
      setCompletedPeriods(new Set(
        compOutcomes.filter((p): p is string => p !== null)));
      setTouchedPeriods(new Set(
        touchOutcomes.filter((p): p is string => p !== null)));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet, ou.orgUnitUid, formInfo?.periodType]);

  // Load the completion marker whenever the form key tuple changes.
  // Covers both the initial load and switching between periods.
  useEffect(() => {
    if (!formReady) { setCompletion(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const rec = await api.getCompletion(
          dataSet.trim(), ou.orgUnitUid ?? '', period.trim());
        if (cancelled) return;
        setCompletion({
          completed: Boolean(rec.completed),
          completedAt: rec.completedAt,
        });
      } catch { if (!cancelled) setCompletion({ completed: false }); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet, period, ou.orgUnitUid, formReady]);

  function runValidateNow(): void {
    runValidation(customRoot.current, setStatus, (xs, total) => {
      setIssues(xs);
      totalCellsRef.current = total;
      // Always open the modal — success or issue list, same path.
      setIssuesOpen(true);
    });
  }

  // Count of cells whose current value differs from the last saved
  // one (attachSaveOnBlur stamps `data-dirty="1"` on typing, clears
  // on successful save). Polled on an input-event + 1s interval so
  // the Save-all chip reflects reality without React state coupling.
  const [dirtyCount, setDirtyCount] = useState(0);
  useEffect(() => {
    const scan = (): void => {
      const root = customRoot.current;
      setDirtyCount(root ? root.querySelectorAll('input[data-dirty="1"]').length : 0);
    };
    scan();
    const root = customRoot.current;
    const h = () => scan();
    root?.addEventListener('input', h, true);
    root?.addEventListener('blur', h, true);
    const iv = window.setInterval(scan, 1000);
    return () => {
      root?.removeEventListener('input', h, true);
      root?.removeEventListener('blur', h, true);
      window.clearInterval(iv);
    };
  }, [formRenderVersion]);

  function saveAllNow(): void {
    const root = customRoot.current;
    if (!root) return;
    const dirty = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[data-dirty="1"]'));
    for (const inp of dirty) {
      inp.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }

  async function toggleCompletion(): Promise<void> {
    if (!formReady || completionBusy) return;
    const next = !(completion?.completed);
    // Gate "Mark complete" on compulsory coverage — DHIS2 does
    // the same server-side; surface it here so operators get
    // immediate feedback instead of a 409 on save.
    if (next) {
      const root = customRoot.current;
      if (root) {
        const missing: HTMLInputElement[] = [];
        for (const i of Array.from(
            root.querySelectorAll<HTMLInputElement>(
              'input[data-compulsory="1"]'))) {
          if (i.value.trim() === '') missing.push(i);
        }
        if (missing.length > 0) {
          setStatus({ kind: 'error',
            message: `Can't mark complete — ${missing.length} compulsory `
              + `value${missing.length === 1 ? '' : 's'} still missing. `
              + 'Run Validate to jump to them.' });
          missing[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }
    setCompletionBusy(true);
    try {
      const rec = await api.markCompletion({
        dataSet: dataSet.trim(),
        orgUnit: ou.orgUnitUid ?? '',
        period: period.trim(),
        completed: next,
      });
      setCompletion({
        completed: Boolean(rec.completed), completedAt: rec.completedAt,
      });
      // Keep the picker's ✓ marks in sync — add on complete,
      // drop on reopen.
      setCompletedPeriods((prev) => {
        const nxt = new Set(prev);
        if (rec.completed) nxt.add(period.trim());
        else nxt.delete(period.trim());
        return nxt;
      });
      setStatus({ kind: 'ok',
        message: rec.completed
          ? 'Dataset marked complete.'
          : 'Dataset reopened.' });
    } catch (err) {
      setStatus({ kind: 'error',
        message: `Completion failed: ${(err as Error).message}` });
    } finally { setCompletionBusy(false); }
  }

  // Alt+V / Alt+C hotkeys. Modifier-only guard (no Meta / Ctrl /
  // Shift) + ev.code match so macOS Option-layer dead-keys don't
  // break the shortcut. Override even when focus is in a cell —
  // the operator is almost always typing.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (!ev.altKey || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      if (ev.code === 'KeyV') {
        ev.preventDefault();
        runValidateNow();
      } else if (ev.code === 'KeyC') {
        ev.preventDefault();
        void toggleCompletion();
      } else if (ev.code === 'KeyS') {
        ev.preventDefault();
        saveAllNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // runValidateNow / toggleCompletion re-create each render, so
    // the re-attach is intentional — ensures the handlers close
    // over the latest state (customRoot, issues, completion flag).
  });

  return (
    <ScreenCard dataTest="der-aggregate-entry">
      <style>{APP_STYLES}</style>

      {/* Single toolbar — title + online + OU subtitle + Data set +
       *  AOC + Period in one sticky line. No chips, no cards, no
       *  decorative tints — just inline labels + selects. */}
      <div className="der-de-toolbar" data-test="der-de-toolbar">
        <div className="der-de-toolbar__head">
          <span className="der-de-toolbar__brand" aria-hidden="true">
            <svg viewBox="0 0 128 128" width="26" height="26">
              <rect x="18" y="22" width="92" height="84" rx="6"
                    fill="#e6f1fb" stroke="#147CD7" stroke-width="5" />
              <line x1="18" y1="44" x2="110" y2="44"
                    stroke="#147CD7" stroke-width="5" />
              <line x1="30" y1="60" x2="80" y2="60"
                    stroke="#147CD7" stroke-width="3" />
              <line x1="30" y1="76" x2="90" y2="76"
                    stroke="#147CD7" stroke-width="3" />
              <line x1="30" y1="92" x2="70" y2="92"
                    stroke="#147CD7" stroke-width="3" />
            </svg>
          </span>
          <h1 className="der-de-toolbar__title">Aggregate data entry</h1>
          {formInfo && formSummary && (
            <button type="button"
                    className="der-de-toolbar__info-btn"
                    data-test="de-info-btn"
                    aria-label="About this dataset"
                    title="About this dataset"
                    onClick={() => setInfoOpen((v) => !v)}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="none"
                        stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="4.5" r="0.9" fill="currentColor" />
                <path d="M8 7v5" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" />
              </svg>
            </button>
          )}
          <span className={'der-de-toolbar__status '
            + (online.isOnline ? 'der-de-toolbar__status--on'
              : 'der-de-toolbar__status--off')}
                aria-label={online.isOnline ? 'Online' : 'Offline'}>
            {online.isOnline ? 'online'
              : `offline · ${online.queuedCount} queued`}
          </span>
          <span className="der-de-toolbar__ou-wrap">
            <span className="der-de-toolbar__ou-label">Bound OU</span>
            <span className="der-de-toolbar__ou"
                  title={ou.orgUnitPath || ou.orgUnitUid || ''}
                  data-test="de-toolbar-ou">
              {ou.orgUnitDisplayName || ou.orgUnitUid || 'Not bound to an OU'}
            </span>
          </span>
        </div>
        <div className="der-de-toolbar__picks">
          <label className="der-de-toolbar__field">
            <span className="der-de-toolbar__field-label">Data set</span>
            <select className="der-de-toolbar__select"
                    value={dataSet}
                    onChange={(e) => { setDataSet(e.target.value); setPeriod(''); }}
                    data-test="der-de-dataset-picker">
              <option value="">Select a data set…</option>
              {datasetList.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          {aocCategories.map((c) => (
            <label key={c.id} className="der-de-toolbar__field"
                   data-test="de-aoc-chip">
              <span className="der-de-toolbar__field-label">{c.name}</span>
              <select className="der-de-toolbar__select"
                      value={aocSelections[c.id] ?? ''}
                      onChange={(e) => {
                        const next = { ...aocSelections, [c.id]: e.target.value };
                        setAocSelections(next);
                        aocSelectionsRef.current = next;
                        syncAocToDom(customRoot.current, next);
                      }}
                      data-test="de-aoc-select">
                <option value="">Select…</option>
                {c.options.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
          ))}
          <label className="der-de-toolbar__field der-de-toolbar__field--period">
            <span className="der-de-toolbar__field-label">
              Period{formInfo?.periodType ? ` · ${formInfo.periodType}` : ''}
            </span>
            <span className="der-de-period-wrap">
              {renderPeriodPicker(formInfo?.periodType, period, setPeriod,
                completedPeriods, touchedPeriods,
                formInfo?.openFuturePeriods ?? 0)}
            </span>
          </label>
          <label className="der-de-toolbar__field der-de-toolbar__field--filter">
            <span className="der-de-toolbar__field-label">Filter data elements</span>
            <span className="der-de-toolbar__filter">
              <input className="der-de-toolbar__filter-input"
                     type="search"
                     placeholder="type to narrow rows…"
                     value={deFilter}
                     onChange={(e) => setDeFilter(e.target.value)}
                     data-test="de-filter-input" />
              {deFilter && (
                <button type="button"
                        className="der-de-toolbar__filter-clear"
                        aria-label="Clear filter"
                        data-test="de-filter-clear"
                        onClick={() => setDeFilter('')}>×</button>
              )}
            </span>
          </label>
          <div className="der-de-toolbar__cell-info">
            <CellLiveStrip root={customRoot} details={details}
                            formVersion={formRenderVersion}
                            formSync={formSyncState}
                            onClear={(inputName) => {
                              const root = customRoot.current;
                              if (!root) return;
                              const input = root.querySelector<HTMLInputElement>(
                                `input[name="${inputName}"]`);
                              if (!input) return;
                              input.value = '';
                              // Local clear only — fire input so live
                              // validation + row totals react immediately,
                              // but DON'T dispatch blur. The DER server
                              // rejects empty writes as "value required";
                              // firing a POST here would just paint the
                              // cell red. Operator types a new value and
                              // the natural blur saves normally.
                              input.dispatchEvent(new Event('input', { bubbles: true }));
                              input.focus();
                            }} />
          </div>
        </div>
      </div>

      {status.kind === 'ok' && (
        <div style={okStrip} data-test="de-ok">{status.message}</div>
      )}
      {status.kind === 'error' && (
        <div style={errorStrip} data-test="de-err">{status.message}</div>
      )}

      {!ou.bound && (
        <div style={{ padding: 16, color: '#8a2525' }}>
          Device is not bound to an organisation unit — ask an admin
          to complete provisioning before capturing data.
        </div>
      )}

      {ou.bound && !datasetReady && (
        <div className="der-de-placeholder">
          Pick a data set to begin.
        </div>
      )}

      {ou.bound && datasetReady && !periodReady && (
        <div className="der-de-placeholder">
          Pick a period to load the {formInfo?.formType === 'SECTION'
            ? 'section' : 'data entry'} form.
        </div>
      )}

      {formReady && mode === 'structured' && (
        <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>Data element UID
            <input value={dataElement} onChange={(e) => setDataElement(e.target.value)}
                   style={inputStyle} />
          </label>
          <label>Value
            <input value={value} onChange={(e) => setValue(e.target.value)}
                   inputMode="decimal" style={inputStyle} />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={!canSubmit} style={primaryBtn}>
              {status.kind === 'submitting' ? 'Submitting…' : 'Submit value'}
            </button>
          </div>
        </form>
      )}

      {formReady && mode === 'custom' && (
        <div className={`der-de-form-card der-de-density-${density}`}>
          <div className="der-de-form-split">
            <SectionNavigator targetRef={customRoot} formVersion={formRenderVersion} />
            <div ref={customRoot}
                 data-test="der-de-custom-form"
                 className="der-de-custom-form" />
          </div>
        </div>
      )}
      {formReady && mode === 'custom' && (
        <div className="der-de-actionbar" data-test="de-actionbar">
          <SaveStatePill root={customRoot} formVersion={formRenderVersion} />
          <button type="button"
                  className="der-de-density-btn"
                  data-test="de-density-toggle"
                  aria-label={`Switch to ${density === 'compact'
                    ? 'comfortable' : 'compact'} density`}
                  title={`Density: ${density}. Click to switch.`}
                  onClick={() => setDensity((d) =>
                    d === 'compact' ? 'comfortable' : 'compact')}>
            {density === 'compact' ? '⇕ Compact' : '⇔ Comfortable'}
          </button>
          <button type="button"
                  className="der-de-density-btn"
                  data-test="de-formmode-toggle"
                  aria-label={`Switch to ${customFormMode === 'der'
                    ? 'faithful author' : 'DER'} layout`}
                  title={`Custom-form layout: ${customFormMode === 'der'
                    ? 'DER (stripped + restyled)'
                    : 'Author (faithful to DHIS2 central design)'}. `
                    + 'Click to switch; reload the form for changes to take effect.'}
                  onClick={() => setCustomFormMode((m) =>
                    m === 'der' ? 'author' : 'der')}>
            {customFormMode === 'der' ? '⚙ DER layout' : '⚙ Author layout'}
          </button>
          {completion && (
            <span className="der-de-completion-pill"
                  data-test="de-completion-status">
              {completion.completed
                ? `Complete${completion.completedAt
                    ? ' · ' + new Date(completion.completedAt).toLocaleString()
                    : ''}`
                : 'Open for edits'}
            </span>
          )}
          {dirtyCount > 0 && (
            <button type="button"
                    onClick={saveAllNow}
                    className="der-de-saveall-btn"
                    data-test="de-saveall-btn"
                    title="Flush all unsaved cells to the DER mirror (Alt+S)">
              Save all · {dirtyCount}
            </button>
          )}
          <button type="button"
                  onClick={runValidateNow}
                  style={secondaryBtn}
                  data-test="de-validate-btn">
            Validate
          </button>
          {issues.length > 0 && !issuesOpen && (
            <button type="button"
                    onClick={() => setIssuesOpen(true)}
                    className="der-de-issues-chip"
                    data-test="de-issues-chip">
              {issues.length} issue{issues.length === 1 ? '' : 's'}
            </button>
          )}
          <button type="button"
                  onClick={() => setShortcutsOpen((v) => !v)}
                  className="der-de-density-btn"
                  data-test="de-shortcuts-toggle"
                  title="Show keyboard shortcuts (?)"
                  aria-label="Show keyboard shortcuts">
            ⌨ Shortcuts
          </button>
          <button type="button"
                  onClick={toggleCompletion}
                  disabled={completionBusy}
                  style={completion?.completed ? secondaryBtn : primaryBtn}
                  data-test="de-complete-btn">
            {completionBusy
              ? 'Saving…'
              : completion?.completed ? 'Reopen' : 'Mark complete'}
          </button>
        </div>
      )}
      <ShortcutsPopover open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)} />
      <InfoPopover open={infoOpen}
        onClose={() => setInfoOpen(false)}
        formInfo={formInfo}
        summary={formSummary} />
      <ValidationIssuesModal
        open={issuesOpen}
        issues={issues}
        totalCells={totalCellsRef.current}
        onClose={() => setIssuesOpen(false)}
        onPick={(iss) => {
          const el = customRoot.current?.querySelector<HTMLInputElement>(
            `input[name="${iss.inputName}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
            el.select();
          }
          setIssuesOpen(false);
        }}
      />
    </ScreenCard>
  );
}

/**
 * DHIS2 2.44 legacy custom-form vendor bundle — mirrors the list in
 * `aggregate-data-entry-app/src/plugin-legacy-custom-forms/content/
 * external-scripts.js` so custom forms behave the same way they do
 * in DHIS2's own Data Entry app. Loaded SEQUENTIALLY (async=false).
 */
const VENDOR_SCRIPTS = [
  '/legacy-custom-forms/javascripts/jQuery/jquery.min.js',
  '/legacy-custom-forms/javascripts/jQuery/placeholders.jquery.min.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.utils.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.ext.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.metadata.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.tablesorter.min.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.upload-1.0.2.min.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.dhisAjaxSelect.js',
  '/legacy-custom-forms/javascripts/jQuery/ui/jquery-ui.min.js',
  '/legacy-custom-forms/javascripts/jQuery/ui/jquery.blockUI.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.validate.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.validate.ext.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.cookie.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.glob.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.date.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.tmpl.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.autogrow.js',
  '/legacy-custom-forms/javascripts/jQuery/jquery.fileupload.min.js',
  '/legacy-custom-forms/javascripts/bootstrap.min.js',
  '/legacy-custom-forms/javascripts/dhis2/dhis2.util.js',
  '/legacy-custom-forms/javascripts/dhis2/dhis2.array.js',
  '/legacy-custom-forms/javascripts/dhis2/dhis2.select.js',
  '/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.min.js',
  '/legacy-custom-forms/javascripts/jQuery/calendars/jquery.calendars.plus.min.js',
  '/legacy-custom-forms/javascripts/select2.min.js',
  '/legacy-custom-forms/javascripts/floatThead/jquery.floatThead.min.js',
  '/legacy-custom-forms/javascripts/dhis2/dhis2.period.js',
  '/legacy-custom-forms/javascripts/dhis2/dhis2.validation.js',
  '/legacy-custom-forms/javascripts/data-entry/form.js',
  '/legacy-custom-forms/javascripts/data-entry/entry.js',
];

const VENDOR_STYLES = [
  '/legacy-custom-forms/javascripts/jQuery/ui/css/redmond/jquery-ui.css',
  '/legacy-custom-forms/css/light_blue.css',
  '/legacy-custom-forms/css/widgets.css',
  '/legacy-custom-forms/css/select2/select2.css',
  '/legacy-custom-forms/css/dhis-web-dataentry.css',
  '/legacy-custom-forms/css/bootstrap/bootstrap.min.css',
  '/legacy-custom-forms/css/plugin-styles.css',
];

/** Shape of the dataset metadata bundle returned by
 *  `getDataSetFormMetadata`. Kept narrow to the fields DHIS2
 *  form.js / entry.js actually read. */
interface DataSetBundle {
  id: string; name?: string; displayName?: string;
  description?: string;
  periodType?: string;
  formType?: string;
  version?: number;
  categoryCombo?: {
    id: string; name?: string;
    categories?: Array<{ id: string; name?: string;
      categoryOptions?: Array<{ id: string; name?: string }> }>;
    categoryOptionCombos?: Array<{ id: string; name?: string;
      categoryOptions?: Array<{ id: string; name?: string }> }>;
  };
  dataSetElements?: Array<{
    dataElement?: {
      id: string; name?: string; formName?: string; valueType?: string;
      optionSet?: { id: string; name?: string;
        options?: Array<{ id: string; code?: string; name?: string;
          displayName?: string }> };
      categoryCombo?: { id: string; name?: string;
        categoryOptionCombos?: Array<{ id: string; name?: string }> };
    };
  }>;
  indicators?: Array<{
    id: string; name?: string;
    numerator?: string; denominator?: string;
    indicatorType?: { id: string; factor?: number };
  }>;
  /** DHIS2's list of (dataElement, categoryOptionCombo) pairs
   *  that MUST have a value before the dataset can be marked
   *  complete. dimensionItem is "<deId>.<cocId>". */
  compulsoryDataElementOperands?: Array<{ dimensionItem: string }>;
  dataEntryForm?: { id: string; name?: string } | null;
  sections?: Array<{
    id: string; name?: string; sortOrder?: number;
    // Post-enrichment, `dataElements[]` carries the full DE row —
    // name, formName, valueType, categoryCombo — so
    // renderSectionForm can group + label cells without a separate
    // `dataSetElements[]` lookup. Pre-enrichment, only `{id}` is
    // guaranteed.
    dataElements?: Array<{
      id: string; name?: string; formName?: string;
      valueType?: string;
      categoryCombo?: DataSetBundle['categoryCombo'];
    }>;
    indicators?: Array<{ id: string }>;
    greyedFields?: Array<{
      dataElement?: { id: string };
      categoryOptionCombo?: { id: string };
    }>;
  }>;
}

/**
 * Render a DHIS2-section-form HTML body from the dataset's metadata.
 *   • One <h3> + <table> per section, in sortOrder.
 *   • Within each section group data elements by their
 *     categoryCombo so cells share column headers (DHIS2's own
 *     renderer does the same).
 *   • Cell id/name = `<deId>-<cocId>-val` so entry.js's autosave +
 *     validation + indicator wiring recognises the inputs.
 *   • Greyed fields render as a disabled `—` cell, matching
 *     DHIS2's section form.
 */
interface EnrichRegistryEntry {
  id: string;
  name?: string;
  displayName?: string;
  formName?: string;
  valueType?: string;
  categoryCombo?: { id: string };
}

interface CatComboRegistryEntry {
  id: string;
  name?: string;
  displayName?: string;
  categories?: Array<{
    id: string; name?: string; displayName?: string;
    categoryOptions?: Array<{ id: string; name?: string;
      displayName?: string }>;
  }>;
  categoryOptionCombos?: Array<{ id: string; name?: string }>;
}

interface CocRegistryEntry {
  id: string;
  name?: string;
  displayName?: string;
  categoryCombo?: { id: string };
  categoryOptions?: Array<{ id: string }>;
}

interface EnrichApi {
  listAllDataElements: () => Promise<EnrichRegistryEntry[]>;
  listAllCategoryCombos: () => Promise<CatComboRegistryEntry[]>;
  listAllCategoryOptionCombos: () => Promise<CocRegistryEntry[]>;
}

let deRegistryPromise: Promise<Map<string, EnrichRegistryEntry>> | null = null;
let ccRegistryPromise: Promise<Map<string, CatComboRegistryEntry>> | null = null;
let cocByCcPromise: Promise<Map<string, CocRegistryEntry[]>> | null = null;

/**
 * Walk the dataset bundle and replace every bare `{id}` reference
 * on `sections.dataElements`, `dataSetElements.dataElement`,
 * nested `categoryCombo`, `categories`, `categoryOptionCombos`
 * with the full object from the local registries. Idempotent — an
 * already-expanded payload passes through unchanged.
 *
 * The three registries are cached at module scope; a dataset
 * switch pays the enrichment cost once per session.
 */
async function enrichDataSetBundle(
  meta: DataSetBundle,
  api: EnrichApi,
): Promise<DataSetBundle> {
  if (!deRegistryPromise) {
    deRegistryPromise = api.listAllDataElements().then((xs) =>
      new Map(xs.map((x) => [x.id, x])));
  }
  if (!ccRegistryPromise) {
    ccRegistryPromise = api.listAllCategoryCombos().then((xs) =>
      new Map(xs.map((x) => [x.id, x])));
  }
  if (!cocByCcPromise) {
    cocByCcPromise = api.listAllCategoryOptionCombos().then((xs) => {
      const by = new Map<string, CocRegistryEntry[]>();
      for (const x of xs) {
        const ccId = x.categoryCombo?.id;
        if (!ccId) continue;
        const bucket = by.get(ccId);
        if (bucket) bucket.push(x);
        else by.set(ccId, [x]);
      }
      return by;
    });
  }
  const [des, ccs, cocsByCc] = await Promise.all([
    deRegistryPromise, ccRegistryPromise, cocByCcPromise,
  ]);

  const expandCc = (cc: { id: string } | undefined):
    DataSetBundle['categoryCombo'] | undefined => {
    if (!cc?.id) return undefined;
    const reg = ccs.get(cc.id);
    const cocs = cocsByCc.get(cc.id) ?? [];
    if (!reg) return cc as DataSetBundle['categoryCombo'];
    return {
      id: reg.id,
      name: reg.name ?? reg.displayName,
      // Category-option combos come from a different mirror table
      // than categoryCombos (dedicated metadata_category_option_
      // combo). Group them by cc.id on the client.
      categoryOptionCombos: cocs.map((c) => ({
        id: c.id, name: c.name ?? c.displayName,
        categoryOptions: c.categoryOptions ?? [],
      })),
      // Pass through the full category tree — the deepened
      // CATEGORY_COMBO_PATH sync mask (slice 20 + 30) now puts
      // `categories[id,name,categoryOptions[id,name]]` into the
      // mirror, so renderSectionForm's nested-header branch can
      // emit proper DHIS2-style Age × Sex headers instead of a
      // flat COC-name row.
      categories: (reg.categories ?? []).map((c) => ({
        id: c.id,
        name: (c as { name?: string; displayName?: string }).name
          ?? (c as { displayName?: string }).displayName,
        categoryOptions: ((c as {
          categoryOptions?: Array<{ id: string; name?: string;
            displayName?: string }>;
        }).categoryOptions ?? []).map((o) => ({
          id: o.id, name: o.name ?? o.displayName,
        })),
      })),
    };
  };

  const expandDe = (ref: { id: string }): { id: string;
    name?: string; formName?: string; valueType?: string;
    categoryCombo?: DataSetBundle['categoryCombo'] } => {
    const reg = des.get(ref.id);
    if (!reg) return ref;
    return {
      id: reg.id,
      name: reg.name ?? reg.displayName,
      formName: reg.formName,
      valueType: reg.valueType,
      categoryCombo: expandCc(reg.categoryCombo),
    };
  };

  return {
    ...meta,
    categoryCombo: expandCc(meta.categoryCombo) ?? meta.categoryCombo,
    dataSetElements: (meta.dataSetElements ?? []).map((dse) => ({
      ...dse,
      dataElement: dse.dataElement ? expandDe(dse.dataElement) : undefined,
    })),
    sections: (meta.sections ?? []).map((s) => ({
      ...s,
      dataElements: (s.dataElements ?? []).map((d) => expandDe(d)),
    })),
  };
}

function renderSectionForm(meta: DataSetBundle): string {
  const dataElementsById: Record<string, {
    id: string; name?: string; formName?: string;
    categoryCombo?: {
      id: string; name?: string;
      categories?: Array<{ id: string; name?: string;
        categoryOptions?: Array<{ id: string; name?: string }> }>;
      categoryOptionCombos?: Array<{ id: string; name?: string }>;
    };
  }> = {};
  for (const dse of meta.dataSetElements ?? []) {
    if (dse.dataElement) dataElementsById[dse.dataElement.id] = dse.dataElement;
  }
  const indicatorsById: Record<string, {
    id: string; name?: string;
  }> = {};
  for (const i of meta.indicators ?? []) indicatorsById[i.id] = i;

  // DER's mirror sometimes serves sections as bare `{id}` refs
  // without dataElements/name/sortOrder (DHIS2's `fields=:all`
  // doesn't descend into section membership). When that happens,
  // synthesise a single pseudo-section that owns every DE on the
  // dataset — the operator still gets a working table grouped by
  // categoryCombo. The server-side sync-path lift that fills in
  // real section membership ships in a later slice.
  let sections = (meta.sections ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const sectionsHaveMembership = sections.some(
    (s) => (s.dataElements?.length ?? 0) > 0);
  if (!sectionsHaveMembership) {
    const allDes = (meta.dataSetElements ?? [])
      .map((dse) => dse.dataElement)
      .filter((d): d is NonNullable<typeof d> => Boolean(d));
    sections = [{
      id: meta.id, name: meta.displayName ?? meta.name ?? 'Data entry',
      sortOrder: 0, dataElements: allDes, indicators: [], greyedFields: [],
    }];
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const parts: string[] = [];
  for (const section of sections) {
    const greyed = new Set<string>();
    for (const g of section.greyedFields ?? []) {
      if (g.dataElement?.id && g.categoryOptionCombo?.id) {
        greyed.add(`${g.dataElement.id}:${g.categoryOptionCombo.id}`);
      }
    }
    parts.push(`<h3 class="formSection">${esc(section.name ?? '')}</h3>`);
    // Group DEs by categoryCombo id so a section with mixed combos
    // renders one subtable per combo (DHIS2 behaviour).
    const groups = new Map<string, {
      cc: { id: string; name?: string;
        categories?: Array<{ id: string; name?: string;
          categoryOptions?: Array<{ id: string; name?: string }> }>;
        categoryOptionCombos?: Array<{ id: string; name?: string }> };
      des: Array<{ id: string; name?: string; formName?: string }>;
    }>();
    for (const deRef of section.dataElements ?? []) {
      const de = dataElementsById[deRef.id];
      if (!de?.categoryCombo) continue;
      const ccId = de.categoryCombo.id;
      let group = groups.get(ccId);
      if (!group) {
        group = { cc: de.categoryCombo, des: [] };
        groups.set(ccId, group);
      }
      group.des.push(de);
    }
    for (const group of groups.values()) {
      const cocs = group.cc.categoryOptionCombos ?? [];
      const cats = group.cc.categories ?? [];
      // Wrap every table in a scroll container so wide multi-
      // dimensional disaggregations (Age × Sex × Status) scroll
      // horizontally without dragging the sticky dataElement
      // labels along. The inner <thead> and `.dataElementCell`
      // cells carry position:sticky so column + row names remain
      // visible as the grid moves.
      parts.push('<div class="der-de-table-scroll">');
      parts.push(`<table class="sectionTable" cellspacing="0">`);
      // Nested column headers: one <tr> per category, each cell
      // spans the width of its options' slice across COCs. For a
      // categoryCombo of (Sex × Age) with 2 × 3 options the first
      // row has 2 cells (Sex) each spanning 3 COCs; second row has
      // 6 cells (Age) each spanning 1. If we can't derive the
      // nesting (missing metadata), fall back to a single flat row.
      const nestedHeaders = buildNestedHeaders(cats, cocs);
      // Slice 55 — surface a live row-sum column on matrix sections
      // (2+ COCs per row). Single-COC sections skip the column
      // because the total would just mirror the lone value.
      const withRowTotal = cocs.length >= 2;
      parts.push('<thead>');
      if (nestedHeaders.length > 0) {
        for (let i = 0; i < nestedHeaders.length; i++) {
          parts.push('<tr>');
          if (i === 0) {
            parts.push(`<th class="dataElementCell" rowspan="${nestedHeaders.length}">`
              + 'Data elements' + '</th>');
          }
          for (const h of nestedHeaders[i] ?? []) {
            parts.push(`<th colspan="${h.span}">${esc(h.label)}</th>`);
          }
          if (i === 0 && withRowTotal) {
            parts.push(`<th class="der-de-row-total-cell" `
              + `rowspan="${nestedHeaders.length}">Total</th>`);
          }
          parts.push('</tr>');
        }
      } else {
        parts.push('<tr>');
        parts.push(`<th class="dataElementCell">${'Data elements'}</th>`);
        for (const c of cocs) parts.push(`<th>${esc(c.name ?? '')}</th>`);
        if (withRowTotal) {
          parts.push('<th class="der-de-row-total-cell">Total</th>');
        }
        parts.push('</tr>');
      }
      parts.push('</thead><tbody>');
      for (const de of group.des) {
        parts.push('<tr>');
        parts.push(`<td class="dataElementCell" id="${esc(de.id)}-cell">`
          + esc(de.formName ?? de.name ?? de.id) + '</td>');
        for (const c of cocs) {
          const name = `${de.id}-${c.id}-val`;
          if (greyed.has(`${de.id}:${c.id}`)) {
            parts.push('<td class="greyed">—</td>');
          } else {
            parts.push(`<td><input type="text" id="${esc(name)}"`
              + ` name="${esc(name)}" dataelementid="${esc(de.id)}"`
              + ` optioncomboid="${esc(c.id)}"></td>`);
          }
        }
        if (withRowTotal) {
          parts.push(`<td class="der-de-row-total-cell" `
            + `data-de-row-total="${esc(de.id)}">—</td>`);
        }
        parts.push('</tr>');
      }
      // Indicator rows — one per indicator in the section. Input
      // name="indicator" + indicatorid attribute is what
      // entry.js's updateIndicators() queries. Span across COCs
      // + the trailing row-total column so the row still spans
      // the full table.
      for (const iref of section.indicators ?? []) {
        const ind = indicatorsById[iref.id];
        if (!ind) continue;
        const span = withRowTotal ? cocs.length + 1 : cocs.length;
        parts.push('<tr class="indicatorRow">');
        parts.push(`<td class="dataElementCell">${esc(ind.name ?? ind.id)}</td>`);
        parts.push(`<td colspan="${span}">`
          + `<input type="text" name="indicator" indicatorid="${esc(ind.id)}"`
          + ' readonly></td>');
        parts.push('</tr>');
      }
      parts.push('</tbody></table></div>');
    }
  }
  return parts.join('\n');
}

/**
 * Given a categoryCombo's categories (ordered) and its
 * categoryOptionCombos (also ordered — DHIS2 uses lexicographic
 * product of category option ids), build the nested header rows
 * DHIS2's section form renders.
 *
 * Returns [] if the metadata is incomplete (e.g. categories empty
 * or options missing) so the renderer falls back to flat headers.
 */
function buildNestedHeaders(
  cats: Array<{ id: string; name?: string;
    categoryOptions?: Array<{ id: string; name?: string }> }>,
  cocs: Array<{ id: string; name?: string;
    categoryOptions?: Array<{ id: string; name?: string }> }>,
): Array<Array<{ label: string; span: number }>> {
  if (cats.length === 0 || cocs.length === 0) return [];
  // Resolve each option-id to (category.id, option.name) so we
  // can read coc.categoryOptions regardless of order.
  const optionCat = new Map<string, { catId: string; name: string }>();
  for (const cat of cats) {
    for (const opt of cat.categoryOptions ?? []) {
      optionCat.set(opt.id, {
        catId: cat.id,
        name: opt.name ?? opt.id,
      });
    }
  }
  // For each coc (in server order — the same order the table
  // body iterates when emitting cells), build an array of option
  // labels indexed by category depth. A missing option (ref not
  // in the option map) falls back to the coc's own name.
  const depth = cats.length;
  const perCoc: string[][] = cocs.map((coc) => {
    const row: string[] = new Array(depth).fill('');
    for (const o of coc.categoryOptions ?? []) {
      const resolved = optionCat.get(o.id);
      if (!resolved) continue;
      const d = cats.findIndex((c) => c.id === resolved.catId);
      if (d >= 0) row[d] = resolved.name;
    }
    return row;
  });
  // Every row must be fully populated; if any coc has a blank
  // cell at some depth, we can't trust the mapping — fall back
  // to the flat COC-name header row via returning [].
  for (const r of perCoc) {
    if (r.some((v) => v === '')) return [];
  }
  // Emit one header row per category depth, coalescing
  // consecutive cocs with the same label at (0..d) into a single
  // <th colspan>. This matches the header-to-column alignment
  // DHIS2's section form uses.
  const rows: Array<Array<{ label: string; span: number }>> = [];
  for (let d = 0; d < depth; d++) {
    const cells: Array<{ label: string; span: number }> = [];
    for (let i = 0; i < perCoc.length;) {
      const cur = perCoc[i]!;
      let j = i + 1;
      // Coalesce while every depth 0..d matches the current coc.
      while (j < perCoc.length) {
        const nxt = perCoc[j]!;
        let same = true;
        for (let k = 0; k <= d; k++) {
          if (cur[k] !== nxt[k]) { same = false; break; }
        }
        if (!same) break;
        j++;
      }
      cells.push({ label: cur[d] ?? '', span: j - i });
      i = j;
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Populate the globals DHIS2 form.js + entry.js read. Mirrors the
 * aggregate-data-entry-app's `loadCustomFormShim` — any of these
 * that aren't populated lead to silent null-derefs inside form.js.
 */
function hydrateDhis2Globals(args: {
  dataSetId: string; periodId: string; orgUnitId: string;
  meta: DataSetBundle;
  aocSelections?: Record<string, string>;
  validationRules?: Array<{
    id: string; name: string;
    importance?: string; operator?: string; periodType?: string;
    leftSide?: unknown; rightSide?: unknown;
  }>;
}): void {
  const g = globalThis as unknown as { dhis2?: Record<string, unknown>;
    DHIS2_BASE_URL?: string; $?: { ajaxSetup?: (o: object) => void } };
  g.dhis2 = g.dhis2 ?? {};
  const dhis2 = g.dhis2 as Record<string, Record<string, unknown>>;
  dhis2.de = dhis2.de ?? {};
  const de = dhis2.de;

  de.currentDataSetId = args.dataSetId;
  de.currentOrganisationUnitId = args.orgUnitId;
  de.currentPeriodId = args.periodId;
  de.currentCategorySelections = { ...(args.aocSelections ?? {}) };

  const meta = args.meta ?? {};
  // Category + categoryCombo keyed by id.
  const categories: Record<string, unknown> = {};
  const categoryCombos: Record<string, unknown> = {};
  if (meta.categoryCombo) {
    categoryCombos[meta.categoryCombo.id] = meta.categoryCombo;
    for (const c of meta.categoryCombo.categories ?? []) {
      categories[c.id] = c;
    }
  }
  de.categories = categories;
  de.categoryCombos = categoryCombos;

  // Data elements + option sets keyed by id.
  const dataElements: Record<string, unknown> = {};
  const optionSets: Record<string, unknown> = {};
  for (const dse of meta.dataSetElements ?? []) {
    const d = dse.dataElement;
    if (!d) continue;
    dataElements[d.id] = d;
    if (d.optionSet) optionSets[d.optionSet.id] = d.optionSet;
    if (d.categoryCombo) categoryCombos[d.categoryCombo.id] = d.categoryCombo;
  }
  de.dataElements = dataElements;
  de.optionSets = optionSets;

  // Indicator formulas — entry.js's updateIndicators reads
  // `dhis2.de.indicatorFormulas[<id>]`. Shape matches:
  //   { explodedNumerator, denominator }
  // DER's /api/indicators returns raw expressions; we pass them
  // through — entry.js's `generateExpression` tolerates undefined
  // `explodedNumerator` by falling through to the string form.
  const indicatorFormulas: Record<string, unknown> = {};
  for (const i of meta.indicators ?? []) {
    indicatorFormulas[i.id] = {
      explodedNumerator: i.numerator,
      denominator: i.denominator,
      factor: i.indicatorType?.factor ?? 1,
    };
  }
  de.indicatorFormulas = indicatorFormulas;

  // Validation rules — DHIS2 entry.js reads `dhis2.de.validationRules`
  // as an id-keyed map. When no rules are synced (fresh mirror /
  // dataset with none), the map is empty and the validate button
  // becomes a no-op rather than crashing.
  const validationRules: Record<string, unknown> = {};
  for (const r of args.validationRules ?? []) validationRules[r.id] = r;
  de.validationRules = validationRules;
  // DHIS2 also expects `lockExceptions` + `emptyOrganisationUnits`
  // + `significantZeros` on the namespace. DER doesn't mirror lock
  // exceptions yet — ship an empty array so entry.js's lock-aware
  // save paths treat every (ds,pe,ou) as unlocked. `significantZeros`
  // is per-data-element and comes from dataSetElements; derive on
  // demand rather than preload.
  de.lockExceptions = [];
  de.emptyOrganisationUnits = [];
  de.significantZeros = [];

  // Dataset registry — form.js's getSelections() queries
  // dhis2.de.dataSets[<id>].
  de.dataSets = {
    [meta.id]: {
      id: meta.id, name: meta.name ?? meta.displayName ?? '',
      periodType: meta.periodType,
      categoryCombo: meta.categoryCombo?.id,
      periodId: args.periodId,
    },
  };

  // AJAX base — custom-form authors sometimes write `$.get('/api/...')`
  // relative URLs that should hit DER's emulated endpoints. jQuery
  // resolves them against window.location by default (same origin),
  // which is what we want; but publish the explicit base URL too
  // in case a form uses it. $.ajaxSetup can only run after jQuery
  // loads — see `finaliseDhis2Shim`.
  g.DHIS2_BASE_URL = `${window.location.origin}/`;

  // i18n — DHIS2 entry.js references window.dhis2.shim.i18n_translations
  // for every validation error string. Default to English (DER has no
  // translation layer yet; matches DHIS2's own loadCustomFormShim.js
  // default keys).
  dhis2.shim = dhis2.shim ?? {};
  (dhis2.shim as Record<string, unknown>).i18n_translations = {
    i18n_loading_file_info_failed: 'Loading file info failed',
    i18n_file_upload_failed: 'File upload failed',
    i18n_confirm_deletion: 'Confirm deletion',
    i18n_dataset_is_concluded: 'Dataset is concluded',
    i18n_dataset_is_closed: 'Dataset is closed',
    i18n_dataset_is_approved: 'Dataset is approved',
    i18n_dataset_is_locked: 'Dataset is locked',
    i18n_orgunit_is_closed: 'Org unit is closed',
    i18n_select_option: 'Choose an option',
    i18n_show_all_items: 'Show all items',
    i18n_value_of_data_element_greater:
      'The value of the following data element is less than the specified minimum value.',
    i18n_value_of_data_element_less:
      'The value of the following data element is greater than the specified maximum value.',
    i18n_value_too_long: 'Value is too long',
    i18n_value_must_number: 'Value must be a number',
    i18n_value_must_integer: 'Value must be an integer',
    i18n_value_must_positive_integer: 'Value must be a positive integer',
    i18n_value_must_negative_integer: 'Value must be a negative integer',
    i18n_value_must_zero_or_positive_integer: 'Value must be zero or a positive integer',
    i18n_value_must_coordinate: 'Value must be a coordinate (longitude, latitude)',
    i18n_value_must_unit_interval: 'Value must be a unit interval (between 0 and 1)',
    i18n_value_must_percentage: 'Value must be a percentage (between 0 and 100)',
    i18n_value_must_valid_url: 'Value must be a valid url',
  };
}

/**
 * Finalises the parts of the DHIS2 shim that require the vendor
 * stack to be loaded already:
 *   - `$.ajaxSetup` to add `withCredentials` so the DER_SESSION
 *     cookie rides every jQuery AJAX call a form emits.
 *   - `dhis2.period.format` + `calendar` + `generator` + `picker`
 *     because custom forms with datePicker inputs use these at
 *     render time.
 */
function finaliseDhis2Shim(): void {
  const g = globalThis as unknown as {
    $?: {
      ajaxSetup?: (o: object) => void;
      calendars?: { instance: (name: string) => unknown };
    };
    dhis2?: Record<string, Record<string, unknown>>;
  };

  if (g.$ && typeof g.$.ajaxSetup === 'function') {
    g.$.ajaxSetup({
      beforeSend: (
        xhr: unknown,
        options: { xhrFields?: Record<string, unknown> },
      ): void => {
        options.xhrFields = { ...(options.xhrFields ?? {}), withCredentials: true };
      },
    });
  }

  if (g.dhis2?.period && g.$?.calendars?.instance) {
    const period = g.dhis2.period as Record<string, unknown> & {
      PeriodGenerator?: new (calendar: unknown, format: string) => unknown;
      DatePicker?: new (calendar: unknown, format: string) => unknown;
    };
    // DHIS2 struts baked `$dateFormat.js` as the default format;
    // 'yyyy-MM-dd' is the modern equivalent the calendar plugin
    // understands and matches ISO-8601 output DER accepts.
    period.format = 'yyyy-mm-dd';
    period.calendar = g.$.calendars.instance('gregorian');
    if (period.PeriodGenerator) {
      period.generator = new period.PeriodGenerator(period.calendar, period.format);
    }
    if (period.DatePicker) {
      period.picker = new period.DatePicker(period.calendar, period.format);
    }
  }
}

/**
 * Mirror the current AOC selections into the DOM + globals so a
 * live custom form sees consistent state when the operator
 * changes a category:
 *   - update / create hidden `#category-<catId>` inputs under the
 *     form root (form.js's AOC resolver reads these).
 *   - rewrite `window.dhis2.de.currentCategorySelections`.
 */
function syncAocToDom(
  root: HTMLElement | null, selections: Record<string, string>,
): void {
  if (!root) return;
  for (const [catId, optId] of Object.entries(selections)) {
    let input = root.querySelector<HTMLInputElement>(
      `input[data-der-category="${catId}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.id = `category-${catId}`;
      input.setAttribute('data-der-category', catId);
      root.appendChild(input);
    }
    input.value = optId;
  }
  const g = globalThis as unknown as { dhis2?: Record<string,
    Record<string, unknown>> };
  if (g.dhis2?.de) {
    g.dhis2.de.currentCategorySelections = { ...selections };
  }
}

/**
 * Attach a blur handler to every data-value input in the form so
 * operator edits post to DER immediately. Independent of the DHIS2
 * `entry.js` save path — belt-and-suspenders so DER captures the
 * data even if a specific legacy script fails to wire.
 *
 * Save flow:
 *   1. Blur fires on an `<input name="<de>-<coc>-val">`.
 *   2. If the value hasn't changed since last save, no-op.
 *   3. POST a single-value dataValueSets envelope; set a border
 *      colour per state (amber = saving, green = saved, red = fail).
 *   4. On success, remember the new "last saved" value so repeat
 *      blurs on an unchanged field don't hit the network.
 */
function attachSaveOnBlur(
  container: HTMLElement,
  getDataSet: () => string,
  getPeriod: () => string,
  getOrgUnit: () => string,
  getAoc: () => Record<string, string>,
  api: { submitAggregate: (body: unknown) => Promise<unknown> },
  onSaveSuccess?: (status: 'saved' | 'queued') => void,
): void {
  const parseName = (name: string): { de: string; coc: string } | null => {
    const m = /^(.+)-(.+)-val$/.exec(name);
    return m ? { de: m[1]!, coc: m[2]!  } : null;
  };
  const lastSaved = new WeakMap<HTMLInputElement, string>();
  const inputs = container.querySelectorAll<HTMLInputElement>(
    'input[name$="-val"]');
  // Seed the baseline so the first unchanged blur doesn't save.
  for (const i of Array.from(inputs)) lastSaved.set(i, i.value);

  const handler = async (ev: Event): Promise<void> => {
    const t = ev.target as HTMLInputElement;
    if (!t || t.tagName !== 'INPUT') return;
    const name = t.getAttribute('name') ?? '';
    const parsed = parseName(name);
    if (!parsed) return;
    const dataSet = getDataSet(); const period = getPeriod();
    const orgUnit = getOrgUnit();
    if (!dataSet || !period || !orgUnit) return;
    const v = t.value;
    if (lastSaved.get(t) === v) return;
    // Refuse to ship values the DE's valueType rejects — these would
    // just loop through Central as CENTRAL_REJECTED and strand the
    // operator with a "mystery sync failure". attachLiveValidation
    // already paints the red outline; here we leave the previous
    // last-saved value intact (no POST) so the operator can correct
    // the typo without Central ever seeing the garbage.
    const vt = t.getAttribute('data-valuetype') ?? 'TEXT';
    if (v !== '' && validateByType(v, vt)) {
      paintState(t, 'error');
      return;
    }
    paintState(t, 'saving');
    try {
      const r = await api.submitAggregate({
        dataSet, period, orgUnit,
        attributeOptionComboSelections: getAoc(),
        dataValues: [{
          dataElement: parsed.de,
          categoryOptionCombo: parsed.coc,
          value: v,
        }],
      }) as { status?: string };
      lastSaved.set(t, v);
      // submitAggregate transparently enqueues when offline / edge
      // unreachable and returns `status: 'OFFLINE_QUEUED'` — paint
      // amber so the operator sees that their value is safe locally
      // and will drain when the network returns, distinct from a
      // live "saved" write.
      const s = r?.status === 'OFFLINE_QUEUED' ? 'queued' : 'saved';
      paintState(t, s);
      // Clear the dirty flag — the value is safe on the mirror
      // (or in the offline queue, which drains deterministically).
      t.removeAttribute('data-dirty');
      onSaveSuccess?.(s);
    } catch {
      paintState(t, 'error');
    }
  };
  // Use capture so we don't fight with jQuery's blur handlers.
  container.addEventListener('blur', (ev) => { void handler(ev); }, true);
  // Mark cells dirty as the operator types so the beforeunload
  // guard can warn when values have changed since the last save.
  // Save success clears the flag above.
  container.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (!/-val$/.test(t.getAttribute('name') ?? '')) return;
    if (t.value !== lastSaved.get(t)) {
      t.setAttribute('data-dirty', '1');
    } else {
      t.removeAttribute('data-dirty');
    }
  }, true);
}

/**
 * DHIS2-Data-Entry-style keyboard navigation:
 *   • Enter — focus the data-value input directly below (same
 *     categoryOptionCombo column, next data-element row).
 *   • Shift+Enter — the input directly above.
 *
 * Tab keeps native behaviour (moves to the next focusable element
 * in document order, which is the next cell to the right for a
 * row-ordered table). Only runs on `<input name="<de>-<coc>-val">`
 * targets so Prev/Next buttons + OU chip inputs stay untouched.
 */
function attachKeyboardNav(container: HTMLElement): void {
  const vertical = (t: HTMLInputElement, dir: -1 | 1): void => {
    const name = t.getAttribute('name') ?? '';
    const m = /^(.+)-(.+)-val$/.exec(name);
    if (!m) return;
    const coc = m[2];
    const column = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        `input[name$="-${coc}-val"]`));
    const idx = column.indexOf(t);
    if (idx === -1) return;
    const target = column[idx + dir];
    if (target) { target.focus(); target.select(); }
  };
  const horizontal = (t: HTMLInputElement, dir: -1 | 1): void => {
    // Walk to the sibling input in the same DOM row (same <tr>).
    // Enables spreadsheet-style left/right traversal across COC
    // columns for the same data element.
    const row = t.closest('tr');
    if (!row) return;
    const inputs = Array.from(
      row.querySelectorAll<HTMLInputElement>('input[name$="-val"]'));
    const idx = inputs.indexOf(t);
    if (idx === -1) return;
    const target = inputs[idx + dir];
    if (target) { target.focus(); target.select(); }
  };
  container.addEventListener('keydown', (ev) => {
    const e = ev as KeyboardEvent;
    const t = e.target as HTMLElement | null;
    if (!(t instanceof HTMLInputElement)) return;
    if (!/-val$/.test(t.getAttribute('name') ?? '')) return;
    // Modifier keys handled elsewhere (paste, select-all, etc.) —
    // let the browser own them.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      vertical(t, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      vertical(t, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Only hop to the neighbouring cell when the caret is at the
      // start/end of the current value — otherwise the operator is
      // inline-editing the number and expects native caret motion.
      const atStart = t.selectionStart === 0 && t.selectionEnd === 0;
      const atEnd = t.selectionStart === t.value.length
                 && t.selectionEnd === t.value.length;
      if (e.key === 'ArrowLeft' && atStart) {
        e.preventDefault();
        horizontal(t, -1);
      } else if (e.key === 'ArrowRight' && atEnd) {
        e.preventDefault();
        horizontal(t, +1);
      }
    }
  });
}

/**
 * Walk every `<de>-<coc>-val` input, validate the entered value
 * against the data-element's `valueType` (from
 * window.dhis2.de.dataElements), and highlight invalid cells.
 *
 * Checks covered client-side:
 *   • NUMBER / UNIT_INTERVAL / PERCENTAGE → finite numeric, in
 *     range per DHIS2's conventions.
 *   • INTEGER / INTEGER_* (POSITIVE / NEGATIVE / ZERO_OR_POSITIVE)
 *     → integer with sign constraints.
 *   • BOOLEAN / TRUE_ONLY → true/false/1/0 literal or empty.
 *   • URL → `new URL()` round-trip.
 *   • Blank → fine (DHIS2 treats as "no value captured"; only
 *     compulsory operands require a value — not covered here as
 *     DER's mirror doesn't surface the full operand list on the
 *     dataset fields mask yet).
 *
 * Invalid cells get a red 2 px outline; the summary status strip
 * reports the count.
 */
/**
 * Left-rail section navigator — scrapes `<h3 class="formSection">`
 * headers out of the rendered #contentDiv and renders them as a
 * clickable list. Click → smooth-scroll the heading into view.
 * An IntersectionObserver keeps the active link in sync as the
 * operator scrolls the form.
 *
 * Hidden on narrow viewports (< 1024 px) and when a form has
 * fewer than two sections — single-section forms don't benefit
 * from a navigator, and mobile layouts use the whole width for
 * the grid.
 */
/**
 * After applyFormAssets injects the form HTML, walk #contentDiv
 * and gather contiguous sibling runs that start with a heading
 * (h2/h3/h4) into wrapper `<div class="der-de-section-slot"
 * data-section-id="…">` elements. Both SECTION-renderer forms
 * (which emit `<h3 class="formSection">`) and CUSTOM author
 * forms (TBLP uses `<h2 class="tblep-h2">`) end up with the same
 * slot structure, so SectionNavigator can hide-all-but-active
 * independently of who authored the HTML.
 *
 * Content before the first heading (intros, hidden inputs,
 * styles) lands in an "intro" slot that's always visible.
 */
function groupIntoSections(root: HTMLElement): Array<{
  id: string; label: string; slot: HTMLElement;
}> {
  const headings = Array.from(root.querySelectorAll('h2, h3, h4'))
    .filter((h) => (h.textContent ?? '').trim().length > 0);
  if (headings.length < 2) return [];

  // For each heading, find the "most specific ancestor that owns
  // exactly this heading" — i.e. the lowest ancestor whose
  // subtree contains no OTHER heading from the list. That
  // ancestor becomes the section's slot. Works for every
  // DHIS2 shape we have in the wild:
  //   • SECTION renderer: h3.formSection + following sibling
  //     table share a shallow parent (#contentDiv) — the
  //     "exactly this heading" walk stops at the heading
  //     itself (parent contains all), so we fall back to a
  //     synthesised sibling-run wrapper.
  //   • TBLP CUSTOM: each `<div class="tblep-panel">` contains
  //     exactly one h2 — the walk resolves the panel as the
  //     slot immediately.
  const headingSet = new Set(headings);
  const slots: Array<{ id: string; label: string; slot: HTMLElement }> = [];

  const containsOtherHeading = (el: HTMLElement, self: Element): boolean => {
    for (const h of headingSet) {
      if (h === self) continue;
      if (el.contains(h)) return true;
    }
    return false;
  };

  headings.forEach((h, i) => {
    const id = h.id || `der-de-section-${i}`;
    h.id = id;
    let slot: HTMLElement | null = null;
    // Walk up until the parent would contain another heading.
    let p: HTMLElement | null = h.parentElement;
    let candidate: HTMLElement | null = null;
    while (p && p !== root) {
      if (containsOtherHeading(p, h)) break;
      candidate = p;
      p = p.parentElement;
    }
    if (candidate
      // We only promote an ancestor to a slot if it's a real
      // container (has more than just the heading). A naked
      // wrapper around the heading alone adds no value.
      && candidate.children.length > 1
      // Don't promote the shared root container (#contentDiv or
      // equivalent) — its direct children are the headings + their
      // trailing content for the sibling-run fallback to wrap.
      && candidate !== root) {
      slot = candidate;
      slot.classList.add('der-de-section-slot');
      slot.dataset.sectionId = id;
    } else {
      // Fallback — build a wrapper around the heading + its
      // following siblings up to the next heading (classic
      // SECTION-renderer path).
      slot = document.createElement('div');
      slot.className = 'der-de-section-slot';
      slot.dataset.sectionId = id;
      const next = headings[i + 1] ?? null;
      const nodes: Node[] = [];
      let cur: Node | null = h;
      while (cur && cur !== next) {
        const n: Node | null = cur.nextSibling;
        nodes.push(cur);
        cur = n;
      }
      h.parentNode?.insertBefore(slot, h);
      for (const n of nodes) slot.appendChild(n);
    }
    slots.push({ id, label: (h.textContent ?? '').trim(), slot });
  });
  return slots;
}

function SectionNavigator(
  { targetRef, formVersion }:
  { targetRef: RefObject<HTMLDivElement | null>;
    formVersion: number },
): JSX.Element | null {
  const [entries, setEntries] = useState<Array<{
    id: string; label: string; slot: HTMLElement;
  }>>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [progress, setProgress] = useState<Record<string, {
    filled: number; total: number }>>({});

  // Rescan every time the form is re-rendered (dataset / period
  // switch) — the previous slots are torn out and new ones take
  // their place.
  useEffect(() => {
    const root = targetRef.current;
    if (!root) return;
    const next = groupIntoSections(root);
    setEntries(next);
    setActiveId(next[0]?.id ?? '');
  }, [targetRef, formVersion]);

  // Alt+1..9 jumps to the Nth section. Overrides even when focus
  // is on a cell input — operators are nearly always typing, so a
  // "skip when in input" guard would make the shortcut useless.
  // ev.code (Digit1 etc.) instead of ev.key because Alt+1 on macOS
  // produces "¡" as ev.key; code stays Digit1 regardless of layout.
  useEffect(() => {
    if (entries.length === 0) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (!ev.altKey || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      const m = /^Digit([1-9])$/.exec(ev.code);
      if (!m) return;
      const n = Number(m[1]);
      const target = entries[n - 1];
      if (!target) return;
      ev.preventDefault();
      setActiveId(target.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entries]);

  // Live completion ratio per section — walks each slot's inputs
  // on every input event (hidden slots still count) and tallies
  // filled vs total.
  useEffect(() => {
    if (entries.length === 0) return;
    const recount = (): void => {
      const next: Record<string, { filled: number; total: number }> = {};
      for (const e of entries) {
        const inputs = Array.from(
          e.slot.querySelectorAll<HTMLInputElement>('input[name$="-val"]'));
        const filled = inputs.filter((i) => i.value.trim() !== '').length;
        next[e.id] = { filled, total: inputs.length };
      }
      setProgress(next);
    };
    recount();
    const root = targetRef.current;
    if (!root) return;
    const onInput = (ev: Event): void => {
      const t = ev.target as HTMLElement | null;
      if (t && t.tagName === 'INPUT'
        && /-val$/.test(t.getAttribute('name') ?? '')) {
        recount();
      }
    };
    root.addEventListener('input', onInput, true);
    return () => { root.removeEventListener('input', onInput, true); };
  }, [targetRef, entries]);

  // Show the active slot, hide the rest. "Intro" nodes (any
  // content before the first heading) stay visible.
  useEffect(() => {
    const root = targetRef.current;
    if (!root || entries.length === 0) return;
    for (const e of entries) {
      e.slot.style.display = e.id === activeId ? '' : 'none';
    }
    // Scroll the newly revealed slot to the top of the scroll box
    // so the operator doesn't start mid-section.
    const act = entries.find((e) => e.id === activeId);
    if (act) act.slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [targetRef, entries, activeId]);

  if (entries.length < 2) return null;

  return (
    <nav className="der-de-section-nav"
         aria-label="Form sections"
         data-test="de-section-nav">
      <div className="der-de-section-nav__title">Sections</div>
      <ul className="der-de-section-nav__list">
        {entries.map((e) => {
          const pr = progress[e.id];
          const tone = !pr || pr.total === 0 ? 'muted'
            : pr.filled === 0 ? 'muted'
            : pr.filled === pr.total ? 'done'
            : 'partial';
          return (
            <li key={e.id}>
              <button type="button"
                      className={'der-de-section-nav__item'
                        + (activeId === e.id
                          ? ' der-de-section-nav__item--active' : '')}
                      data-test="de-section-nav-item"
                      onClick={() => setActiveId(e.id)}>
                <span className="der-de-section-nav__label">{e.label}</span>
                {pr && pr.total > 0 && (
                  <span className={`der-de-section-nav__ratio `
                      + `der-de-section-nav__ratio--${tone}`}
                        data-test="de-section-nav-ratio"
                        title={`${pr.filled} of ${pr.total} cells filled`}>
                    {tone === 'done' ? '✓'
                      : `${pr.filled}/${pr.total}`}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Live summary pill for the current form's save state. Scans the
 * rendered inputs every 800 ms, buckets them by paint-state ring
 * colour (amber queued / amber saving / green saved / red error),
 * and renders a concise "N queued, M saved" line. Pinned into the
 * sticky bottom action bar so the operator sees per-cell outcomes
 * without squinting at individual outlines on a long section
 * form.
 */
function SaveStatePill(
  { root, formVersion }:
  { root: RefObject<HTMLDivElement | null>; formVersion: number },
): JSX.Element {
  const [tally, setTally] = useState({
    total: 0, filled: 0, saving: 0, saved: 0, queued: 0, error: 0,
  });

  useEffect(() => {
    const scan = (): void => {
      const el = root.current;
      if (!el) return;
      const inputs = Array.from(
        el.querySelectorAll<HTMLInputElement>('input[name$="-val"]'));
      let filled = 0; let saving = 0; let saved = 0;
      let queued = 0; let error = 0;
      for (const i of inputs) {
        if (i.value.trim() !== '') filled++;
        const o = i.style.outline || '';
        if (o.includes('rgb(185, 134, 10)') || o.includes('#b9860a')) saving++;
        else if (o.includes('rgb(206, 123, 0)') || o.includes('#ce7b00')) queued++;
        else if (o.includes('rgb(26, 135, 84)') || o.includes('#1a8754')
                 || o.includes('rgb(183, 220, 199)') || o.includes('#b7dcc7')) saved++;
        else if (o.includes('rgb(169, 50, 50)') || o.includes('#a93232')) error++;
      }
      setTally({ total: inputs.length, filled, saving, saved, queued, error });
    };
    scan();
    const id = window.setInterval(scan, 800);
    return () => window.clearInterval(id);
  }, [root, formVersion]);

  // Nothing to render until the form has inputs.
  if (tally.total === 0) {
    return (
      <span className="der-de-savepill der-de-savepill--muted"
            data-test="de-save-state">
        No cells yet
      </span>
    );
  }

  const parts: string[] = [];
  parts.push(`${tally.filled} of ${tally.total} filled`);
  if (tally.saving > 0) parts.push(`${tally.saving} saving`);
  if (tally.queued > 0) parts.push(`${tally.queued} queued`);
  if (tally.error > 0) parts.push(`${tally.error} error`);

  const tone = tally.error > 0 ? 'error'
    : tally.queued > 0 ? 'queued'
    : tally.saving > 0 ? 'saving'
    : tally.filled > 0 ? 'saved'
    : 'muted';

  return (
    <span className={`der-de-savepill der-de-savepill--${tone}`}
          data-test="de-save-state">
      {parts.join(' · ')}
    </span>
  );
}

/**
 * Live strip pinned to the top of the form card. Replaces the
 * right-rail cell-details drawer per operator feedback.
 *
 * Left half — active section name, tracked by watching
 * `[data-section-id]` slot display states.
 * Right half — the currently-focused cell: DE · COC · Value ·
 * Storage status. Updates on every focusin / input in the
 * form root.
 *
 * Empty state (no cell focused yet) shows a quiet prompt.
 */
function CellLiveStrip(
  { details, formSync, onClear }:
  { root: RefObject<HTMLDivElement | null>;
    details: CellDetails | null;
    formVersion: number;
    formSync: FormSyncState;
    onClear: (inputName: string) => void },
): JSX.Element {
  const stateLabel: Record<CellDetails['saveState'], string> = {
    empty: 'No value yet',
    saving: 'Saving…',
    saved: 'Saved on:',
    queued: 'Queued for sync',
    error: 'Rejected',
  };
  const stateTone: Record<CellDetails['saveState'], string> = {
    empty: 'muted', saving: 'saving', saved: 'saved',
    queued: 'queued', error: 'error',
  };
  return (
    <div className="der-de-live-strip" data-test="de-live-strip">
      <div className="der-de-live-strip__cell" data-test="de-live-cell">
        {details ? (
          <>
            <span className="der-de-live-strip__de">{details.deName}</span>
            <span className="der-de-live-strip__sep">·</span>
            <span className="der-de-live-strip__coc">{details.cocName}</span>
            {details.value && (
              <>
                <span className="der-de-live-strip__sep">·</span>
                <span className="der-de-live-strip__value">
                  {details.value}
                </span>
                <button type="button"
                        className="der-de-live-strip__clear"
                        data-test="de-live-clear"
                        aria-label="Clear value"
                        title="Clear this cell"
                        onMouseDown={(e) => {
                          // Prevent focus from leaving the input before
                          // our onClick fires — keeps the cell focused so
                          // the operator can immediately re-type.
                          e.preventDefault();
                        }}
                        onClick={() => onClear(details.inputName)}>×</button>
                <span className="der-de-live-strip__sep">·</span>
                <span className={`der-de-live-strip__state `
                  + `der-de-live-strip__state--${stateTone[details.saveState]}`}>
                  {stateLabel[details.saveState]}
                </span>
                {(details.lastUpdated || details.lastUpdatedBy) && (
                  <>
                    <span className="der-de-live-strip__sep">·</span>
                    <span className="der-de-live-strip__audit"
                          data-test="de-live-audit"
                          title={details.lastUpdated
                            ? new Date(details.lastUpdated).toLocaleString()
                            : undefined}>
                      {details.lastUpdated
                        ? fmtRelativeTime(details.lastUpdated)
                        : 'earlier'}
                      {details.lastUpdatedBy && (
                        <> by <strong>{details.lastUpdatedBy}</strong></>
                      )}
                    </span>
                  </>
                )}
              </>
            )}
            <SyncLogos formSync={formSync} cellState={details.saveState} />
            {details.compulsory && (
              <span className="der-de-live-strip__required"
                    title="Compulsory — a value is required.">Required</span>
            )}
          </>
        ) : (
          <span className="der-de-live-strip__hint">
            Click a cell to see its data element, category option combo + value.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Two tiny status logos on the cell-details strip. Both pins reflect
 * the FOCUSED cell's status — not the form's — so a cell with no
 * value shows gray even when other cells in the same form have been
 * synced:
 *
 *   • DER  — gray when the cell is empty, amber while saving, green
 *            once the DER mirror acknowledged the write (saved or
 *            queued), red if the local save rejected.
 *   • DHIS2 — gray until the cell has been saved locally. Once a
 *            save lands, follows the form envelope's central state
 *            (the drain worker coalesces per form so the envelope
 *            state is shared by every cell).
 */
function SyncLogos(
  { formSync, cellState }:
  { formSync: FormSyncState; cellState: CellDetails['saveState'] },
): JSX.Element {
  const cellSaved = cellState === 'saved' || cellState === 'queued';
  const derTone: 'lit' | 'pending' | 'error' | 'muted' =
      cellState === 'saved' || cellState === 'queued' ? 'lit'
    : cellState === 'saving' ? 'pending'
    : cellState === 'error'  ? 'error'
    : 'muted';
  const central = formSync.central;
  const centralTone: 'lit' | 'pending' | 'error' | 'muted' =
      !cellSaved ? 'muted'
    : central === 'CENTRAL_ACCEPTED' ? 'lit'
    : (central === 'PENDING' || central === 'IN_FLIGHT'
      || central === 'RETRYABLE' || central === 'UNKNOWN_OUTCOME') ? 'pending'
    : (central === 'CENTRAL_REJECTED' || central === 'CONFLICT_REVIEW'
      || central === 'QUARANTINED' || central === 'REQUIRES_APPROVAL') ? 'error'
    : 'muted';
  const derTitle =
      derTone === 'lit'     ? 'Saved on edge (DER)'
    : derTone === 'pending' ? 'Saving on edge…'
    : derTone === 'error'   ? 'Rejected by edge'
    : 'No value entered yet';
  const centralTitle =
      centralTone === 'lit'     ? 'Synced to Central DHIS2'
    : centralTone === 'pending' ? `Sync in progress (${central})`
    : centralTone === 'error'   ? `Central reported ${central}`
    : cellSaved                 ? 'Awaiting Central sync'
    : 'No value entered yet';
  return (
    <span className="der-de-sync-logos" data-test="de-sync-logos"
          aria-label="Save + sync status">
      <span className={'der-de-sync-logos__pin der-de-sync-logos__pin--der '
            + 'is-' + derTone}
            title={derTitle} data-test="de-sync-der"
            data-state={derTone}>
        <DerBrandMark />
        <span className={'der-de-sync-logos__dot is-' + derTone}
              aria-hidden="true" />
      </span>
      <span className={'der-de-sync-logos__pin der-de-sync-logos__pin--central '
            + 'is-' + centralTone}
            title={centralTitle} data-test="de-sync-central"
            data-state={centralTone}>
        <Dhis2BrandMark />
        <span className={'der-de-sync-logos__dot is-' + centralTone}
              aria-hidden="true" />
      </span>
    </span>
  );
}

/**
 * DER brand mark (12-path "nodes + arms" glyph).
 * Source: docs/media/singlecolors/DER_icon_singlecolor_navy.svg.
 * `fill="currentColor"` so the parent pin recolours it via CSS
 * (orange while sync is in progress, green when both edges confirm).
 */
function DerBrandMark(): JSX.Element {
  return (
    <svg viewBox="0 0 1254 1254" width="14" height="14"
         aria-hidden="true" className="der-de-sync-logos__svg">
      <g fill="currentColor" fillRule="evenodd">
        <path d="M636 288.49h-20l-17-3.15-22-9-14.45-9.34-11.84-11-14.05-19-10-23-4.15-23V177l4.15-23 9-22 11.34-16.45 16.55-15.55 14.45-9.34 20-8 15-3.15h27l14 3.15 20 8 17.45 11.34 15.55 15.55 10.34 15.45 8 19 4.15 19v25l-5.15 22-6 14-11.34 17.45-17.55 17.55-16.45 10.34-17 7Z" />
        <path d="M178 456.18l2.66-16.18 4-13 11-25 15.34-22.45 17.55-17.55 15.45-11.34 207-124 53.02-30.66 5.64 25 6 15 7.67 12-.33 1.28L265 402.66l-12 11.89-7.34 9.45-7 13-7.66 22.02-8-2.36-16-2.15h-12l-16 2.6Z" />
        <path d="M1074.26 457l-27.26-2.49h-12l-14 3.46-1.34-1.12-5.32-18-7-14-7.34-10.45-13-12.89-157-95-99-58.38-.34-2.28 7.68-14 6-16 3.38-21 2.28-.34 105 61 157 96 9.45 7.34 21.55 21.55 15.34 23.45 9 22Z" />
        <path d="M636 686.49h-19l-11-2.15-18-8-91-49.68-60-31.32-7-4.68-60-31.32-7.34-6.34-5-8-1.15-4 1.15-14 4.34-7.45 8-6.89 225-119.38.51-28.28.98-3-.82-11 .82-2 .02-50 1.49-1.49 25 3.98 17-1 14-2.98 2.28.49.23 93 1.05 2 227.44 120.66 8.34 8.34 4.15 13-1.15 8-4 8-10.34 9.34-224 120-11 4Z" />
        <path d="M209 667.49h-17l-22-4.15-22-10-17.44-13.34-14.9-18-6-11-6-15-4.15-22 1.15-22 6-22 8-16 9.34-12.45 15.55-14.55 13.45-8.34 17-7 21-4.15h19l23 5.15 14 6 18.45 12.34 15.55 16.55 8.34 13.45 7 17 4.15 24-1.15 20-6 22-5 11-11.34 16.45-12.55 12.55-14.45 10.34-12 6-12 4Z" />
        <path d="M1062 667.49h-23l-19-4.15-18-8-17.45-12.34-15.89-18-10-18-6-19-2.15-17v-9l2.15-15 5-17 7-14 10.34-14.45 10.55-10.55 13.45-9.34 19-9 25-5.15h17l17 3.15 14 5 10 5 13.45 9.34 15.55 15.55 7.34 10.45 8 17 5.15 22v24l-2.15 12-7 20-9.34 15.45-12 14.05-17 12.84-16 8-17 5Z" />
        <path d="M897.49 677l-2.15 9-4 8-9.34 9.34-222 118-16 6-20 2.15-10-1.15-19-6L372 703.34l-9.34-9.34-4-8-2-8 .85-50 5.15-14 7.34-9.5 4-3.79 7-4.05 8-3 4 0 45 25.68 154 82 20 6 22 1.15 16-3.15 15-6 197-106.47 13 4.78 8.45 6.34 6.89 8 4 8 3.15 14Z" />
        <path d="M357 650.26l-11-4.92-45.11-25.34 3.45-6 7-20 3.66-24.27 36 18.93 22.11 13.34-8.45 9-5 9-2.15 8Z" />
        <path d="M898 650.02l-.51-16.02-3.15-14-4-8-9.45-10 4.11-3.34 11-5.32 21-12.68 20-9.93 3.66 25.27 9.46 24-5.12 4.34Z" />
        <path d="M512 1082.28l-2 .06L234 916.34l-14.45-10.34L201 886.45l-7.34-10.45-8-15-5-13-5.15-24-.51-146.28L194 680.49h13l20-3.51.51 119 .98 3-.98 13 4.15 22 7 14 6.34 9.45 13.55 12.55 14.45 9.34L532 1034.72l-.66 3.28-6.68 10-8 17Z" />
        <path d="M739 1084.02l-5.66-19-5-12-9.68-15 .9-3L979 879.34l15.45-10.34 13.55-13.55 10.34-17.45 3-8 2.15-11 .23-141 3.28-.49 15 2.98 17 0 17-2.77.5 139.28-1.01 10-3.15 16-7 19-8 15-8.34 11.45-11.55 12.55L1016 917.34Z" />
        <path d="M897.49 817l-2.15 9-4 8-3.84 5L877 848.34l-186 97-38 18.38-1 32.56-14-1.77h-23l-14 1.95-1.02-.45.51-14-.98-3 .98-12-2.49-3.34-13-4.32L372 847.5l-11.34-13.5-4-11-1.16-8L356.51 756l4.15-11 3.89-5L375 732.66l10-2 64 34.68 147 76 19 5.15h23l19-5.15 213-111.46 9 2.78 5.45 3.34 7.89 8 4 9 1.15 5Z" />
        <path d="M634 1206.49h-19l-18-3.15-18-7-15-9-17-15.89-6.34-8.45-10-18-5-15-3.15-21 2.15-23 6-20 7-14 13.84-18 14.5-12.34 16-9 22-7 18-2.15 21 2 13 3.15 18 8 15.45 10.34 14.55 14.55 11.34 17.45 7 18 3.15 17v22l-3.15 16-9 22-10.34 15.45-13.55 13.55-18.45 12.34-20 8Z" />
      </g>
    </svg>
  );
}

/**
 * DHIS2 brand mark — the blue hexagon logotype only (the "dhis2"
 * text is cropped off via viewBox). Source: docs/media/dhislogo.svg.
 * `fill="currentColor"` so the pin's colour drives the mark's tint.
 */
function Dhis2BrandMark(): JSX.Element {
  return (
    <svg viewBox="0 0 200 182" width="14" height="14"
         aria-hidden="true" className="der-de-sync-logos__svg">
      <g fill="currentColor">
        <path d="M191.91,60,109.17,6.34a19.75,19.75,0,0,0-20.33,0L8.49,58.43a12,12,0,0,0-.25,20.63L88.78,134a19.39,19.39,0,0,0,20.38.25l82.75-53.65a11.87,11.87,0,0,0,0-20.59Zm-91,61.45a4.29,4.29,0,0,1-3.49-.05l-77-52.49L97.13,19.13a4.76,4.76,0,0,1,3.74,0l78.91,51.15Z" />
        <path d="M88.84,47.82,45.28,76.06,58.9,85.39,97.13,60.61a4.76,4.76,0,0,1,3.74,0l39.37,25.52,14-9.06L109.17,47.82A19.78,19.78,0,0,0,88.84,47.82Z" />
        <path d="M191.91,101.46l-8.62-5.59-14,9.06,10.52,6.83-78.91,51.15a4.37,4.37,0,0,1-3.49,0l-77-52.5,10-6.47L16.74,94.57,8.49,99.91a12,12,0,0,0-.25,20.63l80.54,54.92a19.36,19.36,0,0,0,20.38.24l82.74-53.65a11.87,11.87,0,0,0,0-20.59Z" />
      </g>
    </svg>
  );
}

/**
 * Right-rail drawer that lists every cell flagged by the most
 * recent `Validate` pass (plan §7.2). Click an issue → scroll the
 * cell into view, focus it and select the text so the operator
 * can type the correction.
 *
 * Esc closes the drawer; the "N issues" chip in the action bar
 * re-opens it. Doesn't trap focus — the form stays interactive.
 */
function ValidationIssuesModal(
  { open, issues, totalCells, onClose, onPick }:
  { open: boolean;
    issues: ValidationIssue[];
    totalCells: number;
    onClose: () => void;
    onPick: (i: ValidationIssue) => void },
): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const clean = issues.length === 0;
  return (
    <div className="der-de-validation-backdrop"
         role="dialog"
         aria-modal="true"
         aria-label="Validation result"
         data-test="de-validation-modal"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`der-de-validation `
          + (clean ? 'der-de-validation--ok' : 'der-de-validation--err')}>
        <header className="der-de-validation__head">
          <div className="der-de-validation__title">
            <span className="der-de-validation__badge" aria-hidden="true">
              {clean ? '✓' : '!'}
            </span>
            <h3 className="der-de-validation__heading">
              {clean
                ? `Validation passed — all ${totalCells} cells OK.`
                : `Validation found ${issues.length} issue`
                  + `${issues.length === 1 ? '' : 's'} across ${totalCells} cells.`}
            </h3>
          </div>
          <button type="button"
                  className="der-de-validation__close"
                  aria-label="Close validation modal"
                  data-test="de-validation-close"
                  onClick={onClose}>×</button>
        </header>
        <div className="der-de-validation__body">
          {clean ? (
            <p className="der-de-validation__ok-prose">
              Every value on this form matches its data-element
              valueType. Nothing is blocking a save; proceed to
              <strong> Mark complete</strong> when you're ready.
            </p>
          ) : (
            <table className="der-de-validation__table"
                   aria-label="Validation issues list">
              <thead>
                <tr>
                  <th scope="col">Data element</th>
                  <th scope="col">Category option combo</th>
                  <th scope="col">Entered value</th>
                  <th scope="col">Problem</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={`${i.deId}-${i.cocId}`} data-test="de-issues-row">
                    <td>{i.deName}</td>
                    <td className="der-de-validation__coc">{i.cocName}</td>
                    <td>
                      <code className="der-de-validation__value">
                        {i.value || '—'}
                      </code>
                    </td>
                    <td className="der-de-validation__why">{i.problem}</td>
                    <td className="der-de-validation__jump">
                      <button type="button"
                              className="der-de-validation__jump-btn"
                              data-test="de-issues-item"
                              onClick={() => onPick(i)}>
                        Jump to cell →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Centered modal listing keyboard shortcuts the data-entry app
 * supports. Dismissable via Esc, × button, or backdrop click.
 * Opened from the actionbar "⌨ Shortcuts" chip or by pressing
 * `?` anywhere on the page (except inside an input).
 */
function ShortcutsPopover(
  { open, onClose }: { open: boolean; onClose: () => void },
): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const rows: Array<[string, string]> = [
    ['Enter / ↓', 'Next row (same COC column)'],
    ['Shift + Enter / ↑', 'Previous row'],
    ['← / →', 'Previous / next COC column (same row)'],
    ['Tab / Shift + Tab', 'Next / previous cell (DOM order)'],
    ['Alt + 1..9', 'Jump to section N'],
    ['Alt + S', 'Save all unsaved cells'],
    ['Alt + V', 'Run validation'],
    ['Alt + C', 'Toggle Complete marker'],
    ['Paste multi-line', 'Distributes down the COC column'],
    ['Esc', 'Close an open drawer'],
    ['?', 'Show / hide this cheatsheet'],
  ];
  return (
    <div className="der-de-shortcuts-backdrop"
         role="dialog"
         aria-modal="true"
         aria-label="Keyboard shortcuts"
         data-test="de-shortcuts-popover"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="der-de-shortcuts">
        <header className="der-de-shortcuts__head">
          <h3 className="der-de-shortcuts__title">Keyboard shortcuts</h3>
          <button type="button"
                  className="der-de-shortcuts__close"
                  aria-label="Close keyboard shortcuts"
                  onClick={onClose}>×</button>
        </header>
        <dl className="der-de-shortcuts__list">
          {rows.map(([k, v]) => (
            <div key={k} className="der-de-shortcuts__row">
              <dt><kbd>{k}</kbd></dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * Dataset summary popover — info icon on the toolbar opens this.
 * Grounds the operator by showing the dataset's name + description
 * and the structural counts (sections, DEs, compulsory cells,
 * validation rules, indicators) so a new operator can see at a
 * glance what they're looking at before they start typing.
 */
function InfoPopover(
  { open, onClose, formInfo, summary }:
  { open: boolean;
    onClose: () => void;
    formInfo: {
      displayName?: string; periodType?: string;
      openFuturePeriods?: number; formType?: string;
    } | null;
    summary: {
      description?: string;
      sectionCount: number;
      dataElementCount: number;
      compulsoryCount: number;
      validationRuleCount: number;
      indicatorCount: number;
    } | null },
): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open || !formInfo || !summary) return null;
  const openFuture = formInfo.openFuturePeriods ?? 0;
  const rows: Array<[string, React.ReactNode]> = [
    ['Period type', formInfo.periodType ?? '—'],
    ['Form type', formInfo.formType ?? '—'],
    ['Open future periods', String(openFuture)
      + (openFuture === 0 ? ' (current period closed)' : '')],
    ['Sections', String(summary.sectionCount)],
    ['Data elements', String(summary.dataElementCount)],
    ['Compulsory cells', String(summary.compulsoryCount)],
    ['Indicators', String(summary.indicatorCount)],
    ['Validation rules', String(summary.validationRuleCount)],
  ];
  return (
    <div className="der-de-shortcuts-backdrop der-de-info-backdrop"
         role="dialog"
         aria-modal="true"
         aria-label="Dataset info"
         data-test="de-info-popover"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="der-de-info-modal">
        <header className="der-de-info-modal__head">
          <div className="der-de-info-modal__title-wrap">
            <span className="der-de-info-modal__eyebrow">Dataset</span>
            <h2 className="der-de-info-modal__title"
                data-test="de-info-title">
              {formInfo.displayName ?? 'Dataset info'}
            </h2>
          </div>
          <button type="button"
                  className="der-de-info-modal__close"
                  aria-label="Close dataset info"
                  data-test="de-info-close"
                  onClick={onClose}>×</button>
        </header>
        <div className="der-de-info-modal__body">
          {summary.description && (
            <p className="der-de-info-modal__desc"
               data-test="de-info-desc">{summary.description}</p>
          )}
          <dl className="der-de-info-modal__stats">
            {rows.map(([k, v]) => (
              <div key={k} className="der-de-info-modal__stat">
                <dt>{k}</dt>
                <dd data-test={`de-info-${k.toLowerCase().replace(/\s+/g, '-')}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <footer className="der-de-info-modal__foot">
          <button type="button"
                  className="der-de-info-modal__done"
                  data-test="de-info-done"
                  onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Form-level sync state surfaced on the cell-details strip.
 *
 * `localSaved` flips true once any cell in the active form has been
 * written to the DER mirror via POST /api/dataValueSets. `central`
 * reflects the latest state of the per-form outbox envelope that the
 * drain worker owns — CENTRAL_ACCEPTED means every cell in this form
 * is also safe in Central DHIS2.
 */
export interface FormSyncState {
  readonly localSaved: boolean;
  readonly central:
    | 'PENDING' | 'IN_FLIGHT' | 'RETRYABLE' | 'UNKNOWN_OUTCOME'
    | 'CENTRAL_ACCEPTED' | 'CENTRAL_REJECTED'
    | 'CONFLICT_REVIEW' | 'QUARANTINED' | 'REQUIRES_APPROVAL' | null;
  readonly updatedAt?: string;
}

export interface CellDetails {
  readonly deId: string;
  readonly cocId: string;
  readonly deName: string;
  readonly deFormName?: string;
  readonly valueType: string;
  readonly optionSetId?: string;
  readonly cocName: string;
  readonly categoryBreakdown: Array<{ category: string; option: string }>;
  readonly value: string;
  readonly saveState: 'empty' | 'saving' | 'saved' | 'queued' | 'error';
  readonly inputName: string;
  readonly compulsory: boolean;
  /** ISO timestamp of the most recent server-side write for this cell,
   *  stamped onto the input as `data-updated` by the prefill pass. */
  readonly lastUpdated?: string;
  /** Username of the operator who made that write. */
  readonly lastUpdatedBy?: string;
}

/**
 * Right-rail details drawer that mirrors DHIS2's own "Element
 * details" pane — surfaces the metadata the operator typically
 * needs while entering a value (DE name, id, valueType, category
 * breakdown) and the per-cell save state, driven by the
 * currently-focused input.
 */
function CellDetailsDrawer(
  { open, details, onClose }:
  { open: boolean; details: CellDetails | null;
    onClose: () => void },
): JSX.Element | null {
  if (!open) return null;
  if (!details) {
    return (
      <aside className="der-de-details-drawer"
             data-test="de-details-drawer"
             role="complementary"
             aria-label="Cell details">
        <header className="der-de-details-drawer__head">
          <h4 className="der-de-details-drawer__title">Cell details</h4>
          <button type="button"
                  className="der-de-details-drawer__close"
                  aria-label="Close details panel"
                  onClick={onClose}>×</button>
        </header>
        <p className="der-de-details-drawer__empty">
          Click a value cell to inspect its data element,
          category breakdown and save state.
        </p>
      </aside>
    );
  }
  const stateLabel: Record<CellDetails['saveState'], string> = {
    empty: 'No value yet',
    saving: 'Saving…',
    saved: 'Saved on:',
    queued: 'Queued for sync',
    error: 'Rejected — fix and retry',
  };
  const stateTone: Record<CellDetails['saveState'], string> = {
    empty: 'muted', saving: 'saving', saved: 'saved',
    queued: 'queued', error: 'error',
  };
  return (
    <aside className="der-de-details-drawer"
           data-test="de-details-drawer"
           role="complementary"
           aria-label="Cell details">
      <header className="der-de-details-drawer__head">
        <h4 className="der-de-details-drawer__title">Cell details</h4>
        <button type="button"
                className="der-de-details-drawer__close"
                aria-label="Close details panel"
                onClick={onClose}>×</button>
      </header>
      <div className="der-de-details-drawer__body">
        <div className="der-de-details-drawer__de">
          {details.deName}
          {details.compulsory && (
            <span className="der-de-details-drawer__compulsory"
                  title="Compulsory — a value is required before this dataset can be marked complete.">
              Compulsory
            </span>
          )}
        </div>
        <span className={`der-de-details-drawer__state `
          + `der-de-details-drawer__state--${stateTone[details.saveState]}`}>
          {stateLabel[details.saveState]}
        </span>
        <dl className="der-de-details-drawer__meta">
          <dt>Value type</dt><dd>{details.valueType}</dd>
          {details.deFormName && details.deFormName !== details.deName && (
            <><dt>Form name</dt><dd>{details.deFormName}</dd></>
          )}
          <dt>Data element</dt>
          <dd><code>{details.deId}</code></dd>
          <dt>Category combo</dt><dd>{details.cocName}</dd>
          {details.categoryBreakdown.length > 0 && (
            <><dt>Breakdown</dt>
              <dd>
                <ul className="der-de-details-drawer__breakdown">
                  {details.categoryBreakdown.map((b, i) => (
                    <li key={i}>
                      <span className="der-de-details-drawer__cat">{b.category}</span>
                      <span className="der-de-details-drawer__opt">{b.option}</span>
                    </li>
                  ))}
                </ul>
              </dd></>
          )}
          <dt>COC id</dt>
          <dd><code>{details.cocId}</code></dd>
          <dt>Current value</dt>
          <dd>{details.value || <span className="der-de-details-drawer__empty-val">—</span>}</dd>
        </dl>
      </div>
    </aside>
  );
}

/**
 * Column paste (FR-06). Operators routinely copy a column of
 * values from a spreadsheet and want it to drop into DER in one
 * action. On paste into any `<input name="<de>-<coc>-val">`:
 *
 *   • If the clipboard text contains newlines → split on
 *     \r?\n, trim trailing empties, and distribute values
 *     DOWN the same COC column starting at the focused cell.
 *   • Each target fires `blur` so attachSaveOnBlur captures +
 *     saves the value (or enqueues when offline).
 *   • The status strip reports "Pasted N values into COC …".
 *   • Fewer clipboard values than cells → the remainder stay
 *     untouched. More values than cells → the overflow is
 *     silently dropped (we don't want to walk off the end of
 *     the section).
 *
 * Single-line pastes fall through to the browser's native
 * behaviour (just updates this one cell).
 */
function attachColumnPaste(
  container: HTMLElement,
  setStatus: (s: { kind: 'ok' | 'error'; message: string }) => void,
): void {
  container.addEventListener('paste', (ev) => {
    const target = ev.target as HTMLInputElement | null;
    if (!target || target.tagName !== 'INPUT') return;
    const name = target.getAttribute('name') ?? '';
    const m = /^(.+)-(.+)-val$/.exec(name);
    if (!m) return;
    const text = ev.clipboardData?.getData('text/plain') ?? '';
    const hasNl = /\r?\n/.test(text);
    const hasTab = /\t/.test(text);
    if (!hasNl && !hasTab) return; // single-cell → native.
    // Parse into a 2-D grid. Excel's convention: \n between rows,
    // \t between cells within a row. Trim trailing blank rows.
    const grid = text.split(/\r?\n/)
      .filter((_v, i, arr) => !(i === arr.length - 1 && _v === ''))
      .map((row) => row.split('\t').map((c) => c.trim()));
    if (grid.length === 0) return;
    ev.preventDefault();
    const slot = (target.closest('[data-section-id]') as HTMLElement | null)
      ?? container;
    // Build the grid of inputs within the visible slot. Rows are
    // DE × COC cells laid out as they appear; we walk the `<tr>`s
    // in document order so we land on the same visual rectangle
    // the operator sees.
    const rows = Array.from(slot.querySelectorAll<HTMLTableRowElement>(
      'tbody tr'));
    const cellRows: HTMLInputElement[][] = rows.map((r) =>
      Array.from(r.querySelectorAll<HTMLInputElement>('input[name$="-val"]')));
    // Locate the anchor cell's (row, col) in the slot.
    let startRow = -1; let startCol = -1;
    for (let r = 0; r < cellRows.length; r++) {
      const c = cellRows[r]!.indexOf(target);
      if (c !== -1) { startRow = r; startCol = c; break; }
    }
    if (startRow === -1) return;
    let filled = 0; let overflow = 0;
    for (let i = 0; i < grid.length; i++) {
      const rowVals = grid[i]!;
      const targetRow = cellRows[startRow + i];
      if (!targetRow) { overflow += rowVals.length; continue; }
      for (let j = 0; j < rowVals.length; j++) {
        const cell = targetRow[startCol + j];
        if (!cell) { overflow++; continue; }
        cell.value = rowVals[j] ?? '';
        cell.dispatchEvent(new Event('input', { bubbles: true }));
        cell.dispatchEvent(new Event('blur', { bubbles: true }));
        filled++;
      }
    }
    const shape = grid.length === 1
      ? `${grid[0]!.length}-cell row`
      : grid[0]?.length === 1
        ? `${grid.length}-cell column`
        : `${grid.length}×${grid[0]?.length ?? 0} block`;
    setStatus({ kind: 'ok',
      message: `Pasted ${filled} value${filled === 1 ? '' : 's'} `
        + `(${shape}${overflow > 0 ? `, ${overflow} overflow` : ''}).` });
  }, true);
}

/**
 * TBLP and legacy DHIS2 custom forms often ship an explicit
 * "Total across all breakdown cells: [input name=total
 * dataelementid=…]" trailer under each matrix table. Drop the
 * noisy trailer + show the running sum inline in the matrix
 * title as " (Total: N)" that updates live.
 *
 * Strategy per total-input:
 *   1. Find the preceding sibling heading (h1..h4, label-div,
 *      caption etc.) and remember it as the title node.
 *   2. Remove the author's trailer container entirely.
 *   3. Append a span.der-de-matrix-total to the title.
 *   4. Register a `recompute` that sums every
 *      input[name$="-val"][dataelementid=<id>] currently in the
 *      form, writing the result into the span.
 *
 * A single input listener on #contentDiv in capture phase fires
 * every registered recompute.
 */
function attachMatrixTotals(container: HTMLElement): void {
  const totals = Array.from(container.querySelectorAll<HTMLInputElement>(
    'input[name="total"][dataelementid]'));
  if (totals.length === 0) return;
  const recomputers: Array<() => void> = [];
  for (const total of totals) {
    const deId = total.getAttribute('dataelementid') ?? '';
    if (!deId) continue;
    // The trailer wrapper is the closest DIV ancestor that
    // contains this input and no other table. Fall back to the
    // input's own parent.
    const trailer = total.closest('div');
    // Walk previous siblings of the trailer's container looking
    // for a heading or label-div. If none found, fall back to the
    // nearest h3.formSection two levels up.
    const findTitle = (): HTMLElement | null => {
      let node: HTMLElement | null = trailer ?? total.parentElement;
      if (!node) return null;
      let cur: Element | null = node.previousElementSibling;
      while (cur) {
        if (/^(H1|H2|H3|H4)$/.test(cur.tagName)) return cur as HTMLElement;
        // Author template convention: a plain <div> + specific
        // style makes a title above the matrix (TBLP uses this
        // for "New TB episodes by age and sex").
        if (cur.tagName === 'DIV'
          && !cur.querySelector('table, input')
          && (cur.textContent ?? '').trim().length > 0) {
          return cur as HTMLElement;
        }
        cur = cur.previousElementSibling;
      }
      // Fallback: nearest h3.formSection ancestor.
      const anc = node.closest('[data-section-id]');
      if (anc) {
        const h = anc.querySelector<HTMLElement>('h2, h3, h4');
        if (h) return h;
      }
      return null;
    };
    const title = findTitle();
    if (!title) continue;
    // Drop the trailer (`Total across all breakdown cells: [input]`).
    trailer?.remove();
    // Inject a running-total badge into the title.
    const badge = document.createElement('span');
    badge.className = 'der-de-matrix-total';
    badge.setAttribute('data-de', deId);
    title.appendChild(badge);
    const recompute = (): void => {
      let sum = 0; let any = false;
      // Author inputs expose the DE in the `dataelementid` attr
      // AND in the normalised `name` prefix ("<de>-<coc>-val").
      // Match either for maximum compatibility.
      const matches = Array.from(container.querySelectorAll<HTMLInputElement>(
        `input[dataelementid="${deId}"][name$="-val"],`
        + `input[name^="${deId}-"][name$="-val"]`));
      const seen = new Set<HTMLInputElement>();
      for (const i of matches) {
        if (seen.has(i)) continue;
        seen.add(i);
        const v = parseFloat(i.value);
        if (Number.isFinite(v)) { sum += v; any = true; }
      }
      if (any) {
        const rounded = Number.isInteger(sum) ? sum : Number(sum.toFixed(2));
        badge.textContent = ` (Total: ${rounded})`;
      } else {
        badge.textContent = '';
      }
    };
    recomputers.push(recompute);
    recompute();
  }
  if (recomputers.length === 0) return;
  container.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (!/-val$/.test(t.getAttribute('name') ?? '')) return;
    for (const fn of recomputers) fn();
  }, true);
}

/**
 * Live per-row total column on matrix sections (renderSectionForm
 * appends a trailing `td.der-de-row-total-cell[data-de-row-total]`
 * on every DE row when the section has ≥ 2 COCs). Sums every
 * numeric value in the row and writes it into the trailing cell;
 * refreshes on every input event. Empty rows read "—" so the
 * operator can tell at a glance which rows have nothing captured.
 */
function attachRowTotals(container: HTMLElement): void {
  const cells = Array.from(container.querySelectorAll<HTMLElement>(
    'td.der-de-row-total-cell[data-de-row-total]'));
  if (cells.length === 0) return;
  const recompute = (cell: HTMLElement): void => {
    const row = cell.closest('tr');
    if (!row) return;
    let sum = 0;
    let any = false;
    for (const input of Array.from(
        row.querySelectorAll<HTMLInputElement>('input[name$="-val"]'))) {
      const raw = input.value.trim();
      if (raw === '') continue;
      const v = Number(raw);
      if (Number.isFinite(v)) { sum += v; any = true; }
    }
    if (!any) {
      cell.textContent = '—';
      return;
    }
    cell.textContent = Number.isInteger(sum)
      ? String(sum) : sum.toFixed(2);
  };
  for (const cell of cells) recompute(cell);
  container.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (!/-val$/.test(t.getAttribute('name') ?? '')) return;
    const row = t.closest('tr');
    const cell = row?.querySelector<HTMLElement>(
      'td.der-de-row-total-cell[data-de-row-total]');
    if (cell) recompute(cell);
  }, true);
}

/**
 * Flag every value input whose (dataElement, categoryOptionCombo)
 * identity appears in meta.compulsoryDataElementOperands. DHIS2's
 * dimensionItem is "deId.cocId". The input gains
 * `data-compulsory="1"` which the CSS turns into an amber left
 * border; runValidation treats empty compulsory cells as issues
 * and toggleCompletion refuses when any remain empty.
 */
/**
 * Live indicator engine. Every indicator carries a numerator +
 * denominator expression made of `#{deId.cocId}` references (plus
 * `#{deId}` for "sum over all COCs"). On every input event we
 * substitute references with current cell values, evaluate the
 * two arithmetic expressions, and write `(num / den) * factor`
 * into the readonly `<input indicatorid=…>` cell.
 *
 * Error-safe:
 *   • division by zero → blank cell (not NaN or Infinity).
 *   • any eval throw   → blank cell.
 *   • missing references default to 0, matching DHIS2's
 *     entry.js convention.
 *
 * Expressions trusted — they come from the DER mirror, which
 * reflects authored DHIS2 metadata, not user input. Still wrap
 * eval in a try/catch so a malformed indicator doesn't nuke the
 * whole form.
 */
function attachIndicatorEngine(container: HTMLElement,
  meta: DataSetBundle): void {
  const indicators = meta.indicators ?? [];
  if (indicators.length === 0) return;
  // Pre-compile each formula into a function that takes a value
  // lookup fn and returns the computed result (or null).
  const compiled = indicators
    .filter((i) => i.numerator && i.denominator)
    .map((i) => ({
      id: i.id,
      factor: i.indicatorType?.factor ?? 1,
      numExpr: i.numerator as string,
      denExpr: i.denominator as string,
    }));
  if (compiled.length === 0) return;
  const indicatorInputs = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[indicatorid]'));
  const inputByName = new Map<string, HTMLInputElement>();
  for (const i of Array.from(container.querySelectorAll<HTMLInputElement>(
      'input[name$="-val"]'))) {
    inputByName.set(i.getAttribute('name') ?? '', i);
  }
  const sumByDe = (deId: string): number => {
    let sum = 0;
    for (const [name, el] of inputByName) {
      if (!name.startsWith(`${deId}-`)) continue;
      const v = parseFloat(el.value);
      if (Number.isFinite(v)) sum += v;
    }
    return sum;
  };
  const substitute = (expr: string): string =>
    expr.replace(/#\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g,
      (_m, de: string, coc?: string) => {
        if (coc) {
          const el = inputByName.get(`${de}-${coc}-val`);
          const v = parseFloat(el?.value ?? '');
          return Number.isFinite(v) ? String(v) : '0';
        }
        return String(sumByDe(de));
      });
  const safeEval = (raw: string): number => {
    // Allow only digits, operators, parentheses, dots, spaces.
    // Any other character → bail (prevents injected expressions
    // leaking through the substitution stage).
    if (!/^[\s\d+\-*/().eE]+$/.test(raw)) return NaN;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      return Function(`"use strict";return (${raw})`)() as number;
    } catch { return NaN; }
  };
  const recompute = (): void => {
    for (const ind of compiled) {
      const num = safeEval(substitute(ind.numExpr));
      const den = safeEval(substitute(ind.denExpr));
      const target = indicatorInputs.find((el) =>
        el.getAttribute('indicatorid') === ind.id);
      if (!target) continue;
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
        target.value = '';
        continue;
      }
      const r = (num / den) * ind.factor;
      // Round to 2 decimals unless integer — DHIS2 convention
      // matches reporting expectations.
      target.value = Number.isInteger(r) ? String(r) : r.toFixed(2);
    }
  };
  container.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement | null;
    if (t && t.tagName === 'INPUT' && t.hasAttribute('name')
      && /-val$/.test(t.getAttribute('name') ?? '')) {
      recompute();
    }
  }, true);
  // Initial pass — prefill may already have populated values.
  recompute();
}

/**
 * Walk every value input + set `aria-label` to
 * "<DE name>, <COC name>" so screen readers announce the full
 * cell identity on focus. Also sets `aria-required="true"` on
 * compulsory cells (markCompulsoryCells has already set the
 * `data-compulsory` attribute).
 */
function annotateAriaLabels(container: HTMLElement,
  meta: DataSetBundle): void {
  const des: Record<string, { name?: string; formName?: string;
    categoryCombo?: { categoryOptionCombos?: Array<{
      id: string; name?: string; displayName?: string }> } }> = {};
  for (const dse of meta.dataSetElements ?? []) {
    if (dse.dataElement) des[dse.dataElement.id] = dse.dataElement;
  }
  for (const input of Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name$="-val"]'))) {
    const m = /^(.+)-(.+)-val$/.exec(input.getAttribute('name') ?? '');
    if (!m) continue;
    const de = des[m[1]!];
    const deLabel = de?.formName ?? de?.name ?? m[1];
    const coc = de?.categoryCombo?.categoryOptionCombos?.find((c) => c.id === m[2]);
    const cocLabel = coc?.name ?? coc?.displayName ?? m[2];
    if (!input.hasAttribute('aria-label')) {
      input.setAttribute('aria-label',
        cocLabel === m[2] ? `${deLabel}` : `${deLabel}, ${cocLabel}`);
    }
    if (input.getAttribute('data-compulsory') === '1') {
      input.setAttribute('aria-required', 'true');
    }
  }
}

/**
 * Stamp each cell input with `data-valuetype` + a value-type-matched
 * `inputmode` / `pattern`. Operators get the right native keyboard on
 * tablets (numeric keypad for integers, decimal pad for NUMBER,
 * yes/no toggle hints for BOOLEAN) and the browser flags
 * `pattern`-violating values with its own :invalid state — which
 * attachLiveValidation layers a DER tooltip + red outline on top of.
 */
function annotateValueTypes(container: HTMLElement, meta: DataSetBundle): void {
  const byId: Record<string, { valueType?: string; optionSet?: { id: string } }> = {};
  for (const dse of meta.dataSetElements ?? []) {
    if (dse.dataElement) byId[dse.dataElement.id] = dse.dataElement;
  }
  for (const input of Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name$="-val"]'))) {
    const m = /^(.+)-(.+)-val$/.exec(input.getAttribute('name') ?? '');
    if (!m) continue;
    const vt = byId[m[1]!]?.valueType ?? 'TEXT';
    input.setAttribute('data-valuetype', vt);
    switch (vt) {
      case 'INTEGER':
      case 'INTEGER_POSITIVE':
      case 'INTEGER_NEGATIVE':
      case 'INTEGER_ZERO_OR_POSITIVE':
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '-?\\d*');
        break;
      case 'NUMBER':
      case 'UNIT_INTERVAL':
      case 'PERCENTAGE':
        input.setAttribute('inputmode', 'decimal');
        input.setAttribute('pattern', '-?\\d*(\\.\\d+)?');
        break;
      case 'EMAIL':
        input.setAttribute('inputmode', 'email');
        input.setAttribute('type', 'email');
        break;
      case 'PHONE_NUMBER':
        input.setAttribute('inputmode', 'tel');
        input.setAttribute('type', 'tel');
        break;
      case 'URL':
        input.setAttribute('inputmode', 'url');
        input.setAttribute('type', 'url');
        break;
      case 'DATE':
        input.setAttribute('type', 'date');
        break;
      case 'TIME':
        input.setAttribute('type', 'time');
        break;
      case 'DATETIME':
        input.setAttribute('type', 'datetime-local');
        break;
      default: break;
    }
  }
}

/**
 * Validate every cell against its data element's valueType on each
 * input event — flag non-conforming cells with `data-de-invalid="1"`
 * + a human `title`. Paired with the save-on-blur guard below so
 * invalid values never reach the DER mirror.
 */
function attachLiveValidation(container: HTMLElement): void {
  const run = (input: HTMLInputElement): void => {
    const v = input.value;
    if (v === '') {
      input.removeAttribute('data-de-invalid');
      input.removeAttribute('title');
      return;
    }
    const vt = input.getAttribute('data-valuetype') ?? 'TEXT';
    const err = validateByType(v, vt);
    if (err) {
      input.setAttribute('data-de-invalid', '1');
      input.setAttribute('title', err);
    } else {
      input.removeAttribute('data-de-invalid');
      input.removeAttribute('title');
    }
  };
  container.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement | null;
    if (!t || t.tagName !== 'INPUT') return;
    if (!/-val$/.test(t.getAttribute('name') ?? '')) return;
    run(t);
  }, true);
  // Initial pass — prefilled values deserve the same scrutiny so the
  // operator sees any existing bad data on first open.
  for (const input of Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name$="-val"]'))) {
    run(input);
  }
}

function markCompulsoryCells(container: HTMLElement,
  meta: DataSetBundle): void {
  const ops = meta.compulsoryDataElementOperands ?? [];
  const req = new Set<string>();
  for (const op of ops) {
    const dim = op.dimensionItem;
    if (!dim) continue;
    const parts = dim.split('.');
    if (parts.length === 2) req.add(`${parts[0]}:${parts[1]}`);
  }
  if (req.size === 0) return;
  for (const input of Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name$="-val"]'))) {
    const m = /^(.+)-(.+)-val$/.exec(input.getAttribute('name') ?? '');
    if (!m) continue;
    if (req.has(`${m[1]}:${m[2]}`)) {
      input.setAttribute('data-compulsory', '1');
    }
  }
}

function attachDetailsSpy(
  container: HTMLElement,
  meta: DataSetBundle,
  setDetails: (d: CellDetails | null) => void,
): void {
  // Build closure-local lookups so vendor scripts can't wipe them
  // by reassigning dhis2.de later on.
  const des: Record<string, DataSetBundle['dataSetElements'] extends
    Array<infer U> | undefined ? U extends { dataElement?: infer D } ? D : never : never> =
    {} as Record<string, never>;
  for (const dse of meta.dataSetElements ?? []) {
    if (dse.dataElement) {
      (des as Record<string, unknown>)[dse.dataElement.id] = dse.dataElement;
    }
  }
  const compute = (input: HTMLInputElement): CellDetails | null => {
    const name = input.getAttribute('name') ?? input.id ?? '';
    const m = /^(.+)-(.+)-val$/.exec(name);
    if (!m) return null;
    const deId = m[1]!; const cocId = m[2]!;
    const de = (des as Record<string, {
      name?: string; formName?: string; valueType?: string;
      optionSet?: { id?: string };
      categoryCombo?: {
        name?: string; displayName?: string;
        categories?: Array<{ name?: string; displayName?: string;
          categoryOptions?: Array<{ id: string; name?: string;
            displayName?: string }> }>;
        categoryOptionCombos?: Array<{ id: string;
          name?: string; displayName?: string }>;
      };
    }>)[deId];
    const cc = de?.categoryCombo;
    const coc = cc?.categoryOptionCombos?.find((c) => c.id === cocId);
    // Best-effort breakdown: split the COC name on DHIS2's
    // standard ", " separator; align with the categories' option
    // list by presence, not by index (COC order depends on
    // DHIS2's cross-product convention).
    const breakdown: Array<{ category: string; option: string }> = [];
    const cocLabel = coc?.name ?? coc?.displayName ?? cocId;
    const parts = cocLabel.split(/,\s*/).filter(Boolean);
    const cats = cc?.categories ?? [];
    parts.forEach((part, i) => {
      breakdown.push({
        category: cats[i]?.name ?? cats[i]?.displayName ?? '',
        option: part,
      });
    });
    const outline = input.style.outline || '';
    const state: CellDetails['saveState'] =
      outline.includes('rgb(185, 134, 10)') || outline.includes('#b9860a') ? 'saving'
      : outline.includes('rgb(206, 123, 0)') || outline.includes('#ce7b00') ? 'queued'
      : outline.includes('rgb(26, 135, 84)') || outline.includes('#1a8754')
        || outline.includes('rgb(183, 220, 199)') || outline.includes('#b7dcc7') ? 'saved'
      : outline.includes('rgb(169, 50, 50)') || outline.includes('#a93232') ? 'error'
      : input.value.trim() === '' ? 'empty' : 'saved';
    return {
      deId, cocId,
      deName: de?.name ?? deId,
      deFormName: de?.formName,
      valueType: de?.valueType ?? 'TEXT',
      optionSetId: de?.optionSet?.id,
      cocName: cocLabel,
      categoryBreakdown: breakdown,
      value: input.value,
      saveState: state,
      inputName: name,
      compulsory: input.getAttribute('data-compulsory') === '1',
      lastUpdated: input.getAttribute('data-updated') ?? undefined,
      lastUpdatedBy: input.getAttribute('data-updated-by') ?? undefined,
    };
  };
  container.addEventListener('focusin', (ev) => {
    const t = ev.target as HTMLElement;
    if (t && t.tagName === 'INPUT') {
      const d = compute(t as HTMLInputElement);
      if (d) setDetails(d);
    }
  }, true);
  // Keep details in sync as the operator types + blurs.
  container.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t && t.tagName === 'INPUT') {
      const d = compute(t as HTMLInputElement);
      if (d) setDetails(d);
    }
  }, true);
}

export interface ValidationIssue {
  readonly deId: string;
  readonly cocId: string;
  readonly deName: string;
  readonly cocName: string;
  readonly valueType: string;
  readonly value: string;
  readonly problem: string;
  readonly inputName: string;
}

function runValidation(
  root: HTMLElement | null,
  setStatus: (s: {
    kind: 'ok' | 'error' | 'idle'; message?: string;
  }) => void,
  setIssues: (xs: ValidationIssue[], totalCells: number) => void,
): void {
  if (!root) return;
  const g = globalThis as unknown as {
    dhis2?: { de?: {
      dataElements?: Record<string, { valueType?: string; name?: string }>;
      categoryOptionCombos?: Record<string, { name?: string }>;
    } };
  };
  const dataElements = g.dhis2?.de?.dataElements ?? {};
  const cocs = g.dhis2?.de?.categoryOptionCombos ?? {};
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>(
    'input[name$="-val"]'));
  const issues: ValidationIssue[] = [];
  for (const input of inputs) {
    input.style.outline = '';
    const m = /^(.+)-(.+)-val$/.exec(input.getAttribute('name') ?? '');
    if (!m) continue;
    const deId = m[1]!;
    const cocId = m[2]!;
    const de = dataElements[deId];
    const valueType = de?.valueType ?? 'TEXT';
    const v = input.value.trim();
    if (v === '') {
      // Empty cells only count as issues when they are flagged
      // compulsory on the dataset. §FR-09.
      if (input.getAttribute('data-compulsory') === '1') {
        input.style.outline = '2px solid #c0392b';
        issues.push({
          deId, cocId, valueType, value: '',
          problem: 'compulsory value missing',
          deName: de?.name ?? deId,
          cocName: cocs[cocId]?.name ?? cocId,
          inputName: input.name,
        });
      }
      continue;
    }
    const problem = validateByType(v, valueType);
    if (problem) {
      input.style.outline = '2px solid #c0392b';
      issues.push({
        deId, cocId, valueType, value: v, problem,
        deName: de?.name ?? deId,
        cocName: cocs[cocId]?.name ?? cocId,
        inputName: input.name,
      });
    }
  }
  setIssues(issues, inputs.length);
  // The modal surfaces the result now; drop the status strip
  // chatter so the operator sees a single, authoritative panel.
  setStatus({ kind: 'idle' });
}

function validateByType(value: string, valueType: string): string | null {
  const n = Number(value);
  const isInt = Number.isInteger(n);
  switch (valueType) {
    case 'NUMBER':
    case 'INTEGER':
    case 'INTEGER_POSITIVE':
    case 'INTEGER_NEGATIVE':
    case 'INTEGER_ZERO_OR_POSITIVE':
    case 'UNIT_INTERVAL':
    case 'PERCENTAGE':
      if (!Number.isFinite(n)) return 'must be a number';
      break;
  }
  switch (valueType) {
    case 'INTEGER':
      if (!isInt) return 'must be an integer';
      break;
    case 'INTEGER_POSITIVE':
      if (!isInt || n <= 0) return 'must be a positive integer';
      break;
    case 'INTEGER_NEGATIVE':
      if (!isInt || n >= 0) return 'must be a negative integer';
      break;
    case 'INTEGER_ZERO_OR_POSITIVE':
      if (!isInt || n < 0) return 'must be zero or positive';
      break;
    case 'UNIT_INTERVAL':
      if (n < 0 || n > 1) return 'must be between 0 and 1';
      break;
    case 'PERCENTAGE':
      if (n < 0 || n > 100) return 'must be between 0 and 100';
      break;
    case 'BOOLEAN':
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase())) {
        return 'must be a yes/no value';
      }
      break;
    case 'TRUE_ONLY':
      if (!['true', '1', 'yes'].includes(value.toLowerCase())) {
        return 'must be yes';
      }
      break;
    case 'URL':
      try { new URL(value); }
      catch { return 'must be a valid URL'; }
      break;
    default:
      // TEXT, LONG_TEXT, LETTER, PHONE_NUMBER, EMAIL, DATE, TIME,
      // DATETIME, COORDINATE, FILE_RESOURCE — skip; DHIS2's own
      // entry.js validation catches these via jquery.validate.
      break;
  }
  return null;
}

function paintState(
  input: HTMLInputElement,
  state: 'saving' | 'saved' | 'queued' | 'error',
): void {
  const colour = state === 'saving' ? '#b9860a'
    : state === 'saved' ? '#1a8754'
    : state === 'queued' ? '#ce7b00'
    : '#a93232';
  input.style.outline = `2px solid ${colour}`;
  input.style.transition = 'outline 150ms';
  // `queued` — amber ring + a tooltip the operator can hover to
  // learn the value is pending drain. Doesn't fade; the operator
  // should keep seeing which cells are pending until a drain
  // succeeds and the next blur paints them green.
  if (state === 'queued') {
    input.setAttribute('title', 'Queued — will sync when the edge is reachable again.');
  } else {
    input.removeAttribute('title');
  }
  if (state === 'saved') {
    window.setTimeout(() => {
      // Fade the ring so saved cells don't stay loudly highlighted.
      if (input.style.outline.includes('#1a8754')) {
        input.style.outline = '1px solid #b7dcc7';
      }
    }, 1200);
  }
}

/**
 * Fetch existing dataValues for (dataSet, period, orgUnit) and
 * populate every `<input name="<de>-<coc>-val">` that already has
 * a captured value. Mirrors the pattern DHIS2's own Data Entry
 * uses when loading a form the operator has visited before.
 *
 * The /api/dataValueSets read uses the DER aggregate readback
 * endpoint which filters by orgUnit + period server-side. Fails
 * silently — a missing or empty response leaves the form blank.
 */
async function prefillExistingValues(
  container: HTMLElement,
  dataSet: string,
  period: string,
  orgUnit: string,
  api: { readAggregateValues: (ou: string, pe: string, limit?: number) =>
    Promise<{ dataValues: Array<{ dataElement?: string;
      categoryOptionCombo?: string; value?: string;
      lastUpdated?: string; storedByUsername?: string }> }> },
): Promise<void> {
  if (!dataSet || !period || !orgUnit) return;
  let rows: Array<{ dataElement?: string; categoryOptionCombo?: string;
    value?: string; lastUpdated?: string; storedByUsername?: string }>;
  try {
    const r = await api.readAggregateValues(orgUnit, period, 2000);
    rows = r.dataValues ?? [];
  } catch { return; }
  for (const row of rows) {
    const de = row.dataElement;
    const coc = row.categoryOptionCombo;
    const value = row.value;
    if (!de || !coc || value == null) continue;
    const input = container.querySelector<HTMLInputElement>(
      `input[name="${de}-${coc}-val"]`);
    if (!input) continue;
    input.value = value;
    // Stamp the audit trail from the readback so attachDetailsSpy
    // can surface "Saved {ago} by {user}" on the cell-details
    // strip + the browser native title tooltip picks up the same
    // text on hover.
    if (row.lastUpdated) {
      input.setAttribute('data-updated', row.lastUpdated);
    }
    if (row.storedByUsername) {
      input.setAttribute('data-updated-by', row.storedByUsername);
    }
    // Title stays unset here — attachLiveValidation owns the
    // title attribute (sets it to the validation reason on failing
    // keystrokes, clears it on valid ones). The audit trail lives
    // on the cell-details strip instead.
  }
}

/**
 * Short relative-time label for the audit tooltip. Falls back to the
 * raw ISO string when the input is malformed so the operator still
 * gets context rather than an empty tooltip.
 */
function fmtRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 0) return new Date(t).toLocaleString();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(t).toLocaleDateString();
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.setAttribute('data-der-custom-form', src);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadStyle(href: string): void {
  if (document.querySelector(`link[data-der-custom-form="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  l.setAttribute('data-der-custom-form', href);
  document.head.appendChild(l);
}

/**
 * Rewrite a form-relative asset path (`../javascripts/jQuery/...`,
 * `./custom.css`, `../../../dhis-web-commons/...`) to our server's
 * `/legacy-custom-forms/...` tree. Absolute URLs are left alone so a
 * form that explicitly points at the central DHIS2 origin still
 * works for fleet operators who allow that traffic.
 */
function rewriteLegacyPath(raw: string): string {
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/legacy-custom-forms/')) return raw;
  if (raw.startsWith('/')) return raw;
  // DHIS2 custom forms live under `dhis-web-dataentry/...` in DHIS2;
  // their relative paths dot-up into the shared vendor tree
  // (`../javascripts/…`, `../css/…`). Our server mirrors that tree
  // at `/legacy-custom-forms/`, so we just strip the leading `../`
  // chain and prepend our root.
  const trimmed = raw.replace(/^(?:\.{1,2}\/)+/, '');
  return `/legacy-custom-forms/${trimmed}`;
}

/**
 * Processes the DHIS2 form's htmlCode exactly the way DHIS2 does:
 *   1. Extract every `<link rel="stylesheet">` → append to head.
 *   2. Extract every `<style>` → append to head.
 *   3. Extract every `<script>` (src or inline) → load + execute
 *      sequentially so later scripts see earlier side effects.
 *   4. Everything else → inject into #contentDiv as real DOM nodes
 *      (not `innerHTML`, so attributes + inputs survive).
 */
async function applyFormAssets(
  container: HTMLElement,
  htmlCode: string,
  opts: { stripStyles?: boolean } = {},
): Promise<void> {
  const stripStyles = opts.stripStyles ?? true;
  // Switch the container class so stylesheet rules
  // (.der-de-custom-form vs .der-de-custom-form--author) pick
  // the right level of chrome suppression. Author mode leaves
  // the DHIS2 custom-form HTML + CSS untouched; DER mode strips
  // decorations + inline styles.
  container.classList.toggle('der-de-custom-form--author', !stripStyles);
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${htmlCode}</body></html>`,
    'text/html');

  // Styles — order-preserving copy to head.
  for (const node of Array.from(
      doc.querySelectorAll('link[rel="stylesheet"],style'))) {
    if (node.tagName === 'LINK') {
      const href = node.getAttribute('href') ?? '';
      if (href) loadStyle(rewriteLegacyPath(href));
    } else {
      const s = document.createElement('style');
      s.textContent = node.textContent ?? '';
      s.setAttribute('data-der-custom-form', 'inline');
      document.head.appendChild(s);
    }
    node.remove();
  }

  // Collect scripts in order, strip them from the body so they
  // don't get injected as inert text.
  const scriptEntries: Array<{ src?: string; code?: string }> = [];
  for (const node of Array.from(doc.querySelectorAll('script'))) {
    const src = node.getAttribute('src');
    if (src) scriptEntries.push({ src: rewriteLegacyPath(src) });
    else scriptEntries.push({ code: node.textContent ?? '' });
    node.remove();
  }

  // Author-written custom forms (TBLP, legacy DHIS2 bundles)
  // routinely ship inline `style="background:…;border-radius:
  // 22px;padding:20px"` attributes that fight DER's compact-grid
  // design system. Strip every inline style before we adopt the
  // nodes — the author's structural choices (tables, labels,
  // sections) remain but visual chrome inherits DER's design
  // tokens. Plan §6.2 Phase A sanitisation.
  //
  // DOMParser's doc uses a different document than the main page;
  // a cross-document `instanceof HTMLElement` check fails under
  // some runtimes, so strip unconditionally via removeAttribute —
  // every Element has it, idempotent for non-styled nodes.
  for (const node of Array.from(doc.body.querySelectorAll('*'))) {
    if (stripStyles) node.removeAttribute('style');
    // DHIS2 custom-form authors sometimes bind inputs with
    // name="entryfield" or name="total" + id="<de>-<coc>-val".
    // Normalise `name` to the id so the save-on-blur regex
    // `^(.+)-(.+)-val$` picks the input up like a SECTION cell.
    if (node.tagName === 'INPUT') {
      const id = node.getAttribute('id') ?? '';
      if (id.endsWith('-val') && node.getAttribute('name') !== id) {
        node.setAttribute('name', id);
      }
    }
    // Harmonise the row-label column header in DER mode only.
    // Author mode keeps the author's copy ("Reporting item" /
    // "Reported count") intact.
    if (stripStyles && node.tagName === 'TH') {
      const text = (node.textContent ?? '').trim();
      if (text === 'Reporting item' || text === 'Reported count') {
        node.textContent = text === 'Reporting item'
          ? 'Data elements' : 'Value';
      }
    }
  }
  // Append the remaining DOM. `adoptNode` lets us move real nodes
  // across documents so attributes + listeners stay intact. Children
  // of <body> cover 99% of DHIS2 form HTML (templates sometimes
  // wrap in a <html> → <body> pair; the DOMParser handles that).
  for (const child of Array.from(doc.body.childNodes)) {
    container.appendChild(document.adoptNode(child));
  }

  // Execute scripts sequentially — src ones via an element with
  // onload; inline via appendChild which executes immediately.
  for (const entry of scriptEntries) {
    if (entry.src) {
      if (!document.querySelector(
          `script[data-der-custom-form="${entry.src}"]`)) {
        await loadScript(entry.src);
      }
    } else if (entry.code) {
      const s = document.createElement('script');
      s.textContent = entry.code;
      s.setAttribute('data-der-custom-form', 'inline');
      document.head.appendChild(s);
      s.remove();
    }
  }
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const inputStyle = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '6px 8px', border: '1px solid #d7dde5',
  borderRadius: 0, fontSize: 13, fontFamily: 'inherit',
};
const primaryBtn = {
  padding: '6px 16px', border: '1px solid #0a5497',
  background: '#147CD7', color: '#fff',
  borderRadius: 0, fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const secondaryBtn = {
  padding: '6px 16px', border: '1px solid #c0c7cf',
  background: '#fff', color: '#2c3e4c',
  borderRadius: 0, fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const okStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#e8f4ee', color: '#136436',
  border: '1px solid #b7dcc7', borderRadius: 0,
};
const errorStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#fbeaea', color: '#8a2525',
  border: '1px solid #e0bcbc', borderRadius: 0,
};
/**
 * Render a dropdown-style period picker for the dataset's
 * periodType. Operators prefer picking from a short list of
 * actual DHIS2 period ids over a calendar widget.
 *
 * Returns the DHIS2 period id as the <select> value (so the
 * form state stays in native DHIS2 shape and the submit path +
 * hidden #selectedPeriodId are unchanged).
 */
function renderPeriodPicker(
  periodType: string | undefined,
  period: string,
  setPeriod: (v: string) => void,
  completedPeriods: Set<string> = new Set(),
  touchedPeriods: Set<string> = new Set(),
  openFuturePeriods: number = 0,
): JSX.Element {
  // ✓ wins over ● — if a period is complete it's also touched.
  const markLabel = (id: string, label: string): string => {
    if (completedPeriods.has(id)) return `✓  ${label}`;
    if (touchedPeriods.has(id))   return `●  ${label}`;
    return label;
  };
  const common = { ...inputStyle } as React.CSSProperties;
  const baseOptions = buildPeriodOptions(periodType, openFuturePeriods);
  if (baseOptions.length === 0) {
    // Unknown periodType — fall back to free text (DHIS2 period id).
    return (
      <input value={period}
        onChange={(e) => setPeriod(e.target.value)}
        placeholder={periodType
          ? `DHIS2 ${periodType} period id` : 'e.g. 202611'}
        style={common} />
    );
  }
  // Grow the options list so prev/next can navigate outside the
  // default window. baseOptions are sorted newest-first; if the
  // current selection sits beyond either end, prepend/append.
  const options = [...baseOptions];
  if (period && !options.some((o) => o.id === period)) {
    const label = formatPeriodLabel(periodType, period) ?? period;
    options.unshift({ id: period, label });
  }
  // `current` reports the DHIS2 period id for "right now" so Next
  // can disable itself before stepping into the future.
  const currentPeriodId = baseOptions[0]?.id ?? null;

  const idx = options.findIndex((o) => o.id === period);
  const canPrev = idx === -1 || idx < options.length - 1
                  || !!periodType;  // always generate older
  const canNext = period !== ''
                  && (idx > 0 || period !== currentPeriodId);

  const goPrev = (): void => {
    if (!periodType) return;
    const prev = idx >= 0 && idx < options.length - 1
      ? options[idx + 1]?.id ?? ''
      : stepPeriod(periodType, period || currentPeriodId || '', -1);
    if (prev) setPeriod(prev);
  };
  const goNext = (): void => {
    if (!periodType || !period) return;
    // Don't let Next cross into the future past the current period.
    if (period === currentPeriodId) return;
    const next = idx > 0
      ? options[idx - 1]?.id ?? ''
      : stepPeriod(periodType, period, +1);
    if (next) setPeriod(next);
  };

  return (
    <span className="der-de-period-nav">
      <button type="button" aria-label="Previous period"
              onClick={goPrev} disabled={!canPrev}
              className="der-de-period-btn">◀</button>
      <select value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={common}>
        <option value="">Select a period…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{markLabel(o.id, o.label)}</option>
        ))}
      </select>
      <button type="button" aria-label="Next period"
              onClick={goNext} disabled={!canNext}
              className="der-de-period-btn">▶</button>
    </span>
  );
}

/**
 * Compute the period id one step before or after a given id for
 * the periodType — lets the Prev/Next buttons navigate beyond
 * the initial dropdown window.
 */
function stepPeriod(
  periodType: string, currentId: string, delta: -1 | 1,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (periodType) {
    case 'Daily': {
      if (!/^\d{8}$/.test(currentId)) return '';
      const y = Number(currentId.slice(0, 4));
      const m = Number(currentId.slice(4, 6)) - 1;
      const d = Number(currentId.slice(6, 8));
      const next = new Date(y, m, d + delta);
      return `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    }
    case 'Weekly': {
      const m = /^(\d{4})W(\d{1,2})$/.exec(currentId);
      if (!m) return '';
      let wy = Number(m[1]);
      let wk = Number(m[2]) + delta;
      if (wk < 1) { wy -= 1; wk = isoWeeksInYear(wy); }
      else if (wk > isoWeeksInYear(wy)) { wy += 1; wk = 1; }
      return `${wy}W${wk}`;
    }
    case 'Monthly': {
      if (!/^\d{6}$/.test(currentId)) return '';
      const y = Number(currentId.slice(0, 4));
      const m = Number(currentId.slice(4, 6)) - 1;
      const total = y * 12 + m + delta;
      return `${Math.floor(total / 12)}${pad((total % 12 + 12) % 12 + 1)}`;
    }
    case 'BiMonthly': {
      const m = /^(\d{4})(\d{2})B$/.exec(currentId);
      if (!m) return '';
      let by = Number(m[1]); let bm = Number(m[2]) + delta;
      if (bm < 1) { by -= 1; bm = 6; }
      else if (bm > 6) { by += 1; bm = 1; }
      return `${by}${pad(bm)}B`;
    }
    case 'Quarterly': {
      const m = /^(\d{4})Q(\d)$/.exec(currentId);
      if (!m) return '';
      let qy = Number(m[1]); let q = Number(m[2]) + delta;
      if (q < 1) { qy -= 1; q = 4; }
      else if (q > 4) { qy += 1; q = 1; }
      return `${qy}Q${q}`;
    }
    case 'SixMonthly': {
      const m = /^(\d{4})S(\d)$/.exec(currentId);
      if (!m) return '';
      let sy = Number(m[1]); let s = Number(m[2]) + delta;
      if (s < 1) { sy -= 1; s = 2; }
      else if (s > 2) { sy += 1; s = 1; }
      return `${sy}S${s}`;
    }
    case 'Yearly':
    case 'FinancialApril':
    case 'FinancialJuly':
    case 'FinancialOct': {
      if (!/^\d{4}$/.test(currentId)) return '';
      return String(Number(currentId) + delta);
    }
    default:
      return '';
  }
}

/** Human-friendly label for a period id outside the default window. */
function formatPeriodLabel(periodType: string | undefined, id: string): string | null {
  const MONTH_NAMES = ['January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  switch (periodType) {
    case 'Daily': {
      if (!/^\d{8}$/.test(id)) return null;
      return `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
    }
    case 'Weekly': {
      const m = /^(\d{4})W(\d{1,2})$/.exec(id);
      return m ? `${m[1]} W${String(m[2]).padStart(2, '0')}` : null;
    }
    case 'Monthly': {
      if (!/^\d{6}$/.test(id)) return null;
      const mi = Number(id.slice(4, 6)) - 1;
      return `${MONTH_NAMES[mi] ?? ''} ${id.slice(0, 4)}`;
    }
    case 'BiMonthly': {
      const m = /^(\d{4})(\d{2})B$/.exec(id);
      if (!m) return null;
      const a = (Number(m[2]) - 1) * 2;
      return `${MONTH_NAMES[a]}–${MONTH_NAMES[a + 1]} ${m[1]}`;
    }
    case 'Quarterly': return id.replace(/^(\d{4})Q(\d)$/, '$1 Q$2');
    case 'SixMonthly': {
      const m = /^(\d{4})S(\d)$/.exec(id);
      if (!m) return null;
      return `${m[1]} ${m[2] === '1' ? 'Jan–Jun' : 'Jul–Dec'}`;
    }
    case 'Yearly':
    case 'FinancialApril':
    case 'FinancialJuly':
    case 'FinancialOct':
      return /^\d{4}$/.test(id) ? id : null;
    default: return null;
  }
}

/**
 * Build the periods offered in the picker for a given periodType.
 *   Daily      → last 30 days
 *   Weekly     → last 12 ISO weeks
 *   Monthly    → last 24 months
 *   BiMonthly  → last 12 bi-months (Jan-Feb … Nov-Dec, labelled)
 *   Quarterly  → last 8 quarters
 *   SixMonthly → last 6 half-years
 *   Yearly / FinancialOct / FinancialJuly / FinancialApril → last 10 years
 * Falls back to [] (free text) for unknown period types.
 */
function buildPeriodOptions(
  periodType?: string,
  openFuturePeriods: number = 0,
): Array<{ id: string; label: string }> {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const pad = (n: number) => String(n).padStart(2, '0');
  const MONTH_NAMES = ['January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  // DHIS2 opens the current + next (openFuturePeriods - 1) periods;
  // when openFuturePeriods = 0 (the default) the current period is
  // closed too, so entry starts at the last-completed period. We
  // shift each generator's starting index by (1 - openFuturePeriods)
  // — positive values skip past the current period, 1 keeps it, 2+
  // walks further into the future.
  const skip = Math.max(0, 1 - Math.max(0, openFuturePeriods));
  switch (periodType) {
    case 'Daily': {
      const out: Array<{ id: string; label: string }> = [];
      for (let i = skip; i < 30 + skip; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const id = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        const label = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        out.push({ id, label });
      }
      return out;
    }
    case 'Weekly': {
      const out: Array<{ id: string; label: string }> = [];
      const w = isoWeek(today);
      let wy = w.year; let wk = w.week;
      for (let s = 0; s < skip; s++) {
        wk -= 1;
        if (wk < 1) { wy -= 1; wk = isoWeeksInYear(wy); }
      }
      for (let i = 0; i < 12; i++) {
        out.push({ id: `${wy}W${wk}`, label: `${wy} W${pad(wk)}` });
        wk -= 1;
        if (wk < 1) { wy -= 1; wk = isoWeeksInYear(wy); }
      }
      return out;
    }
    case 'Monthly': {
      const out: Array<{ id: string; label: string }> = [];
      for (let i = skip; i < 24 + skip; i++) {
        const my = y; const mm = m;
        const total = my * 12 + mm - i;
        const yy = Math.floor(total / 12);
        const mi = ((total % 12) + 12) % 12;
        out.push({
          id: `${yy}${pad(mi + 1)}`,
          label: `${MONTH_NAMES[mi]} ${yy}`,
        });
      }
      return out;
    }
    case 'BiMonthly': {
      const out: Array<{ id: string; label: string }> = [];
      // Bi-month id = YYYY0{1..6}B; 1 = Jan-Feb, 2 = Mar-Apr, …
      const curBm = Math.floor(m / 2) + 1;
      let by = y; let bm = curBm;
      for (let s = 0; s < skip; s++) {
        bm -= 1;
        if (bm < 1) { by -= 1; bm = 6; }
      }
      for (let i = 0; i < 12; i++) {
        const a = (bm - 1) * 2;
        out.push({
          id: `${by}${pad(bm)}B`,
          label: `${MONTH_NAMES[a]}–${MONTH_NAMES[a + 1]} ${by}`,
        });
        bm -= 1;
        if (bm < 1) { by -= 1; bm = 6; }
      }
      return out;
    }
    case 'Quarterly': {
      const out: Array<{ id: string; label: string }> = [];
      const curQ = Math.floor(m / 3) + 1;
      let qy = y; let q = curQ;
      for (let s = 0; s < skip; s++) {
        q -= 1;
        if (q < 1) { qy -= 1; q = 4; }
      }
      for (let i = 0; i < 8; i++) {
        out.push({ id: `${qy}Q${q}`, label: `${qy} Q${q}` });
        q -= 1;
        if (q < 1) { qy -= 1; q = 4; }
      }
      return out;
    }
    case 'SixMonthly': {
      const out: Array<{ id: string; label: string }> = [];
      const curS = m < 6 ? 1 : 2;
      let sy = y; let s = curS;
      for (let i = 0; i < skip; i++) {
        s -= 1;
        if (s < 1) { sy -= 1; s = 2; }
      }
      for (let i = 0; i < 6; i++) {
        out.push({ id: `${sy}S${s}`, label: `${sy} ${s === 1 ? 'Jan–Jun' : 'Jul–Dec'}` });
        s -= 1;
        if (s < 1) { sy -= 1; s = 2; }
      }
      return out;
    }
    case 'Yearly':
    case 'FinancialApril':
    case 'FinancialJuly':
    case 'FinancialOct': {
      const out: Array<{ id: string; label: string }> = [];
      for (let i = skip; i < 10 + skip; i++) {
        const yy = y - i;
        out.push({ id: String(yy), label: String(yy) });
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * ISO-8601 week number of a calendar date — operates in the
 * operator's LOCAL calendar so DHIS2 period IDs match what they
 * see on the wall clock. DHIS2 period IDs are calendar values
 * (e.g. "2026W45" = ISO week 45 of 2026 everywhere), not
 * timezone-bound; using local avoids off-by-one around midnight
 * for operators in UTC-7/UTC+12 edges.
 *
 * Algorithm per ISO-8601: shift to the Thursday of the same
 * week, then week number is weeks-from-Jan-1 of that Thursday's
 * year. Day-arithmetic uses a `setDate()` adjustment which is
 * safe against DST in every modern JS runtime.
 */
function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = t.getDay() === 0 ? 7 : t.getDay();
  t.setDate(t.getDate() + 4 - dayNum);
  const yearStart = new Date(t.getFullYear(), 0, 1);
  const msPerDay = 86400000;
  const daysSinceYearStart = Math.round(
    (t.getTime() - yearStart.getTime()) / msPerDay);
  return { year: t.getFullYear(), week: Math.ceil((daysSinceYearStart + 1) / 7) };
}

function isoWeeksInYear(y: number): number {
  // Dec 28 is always in the last ISO week of its year; probe it.
  return isoWeek(new Date(y, 11, 28)).week;
}

/* Scoped styles for the aggregate data-entry app. Flat/soft per
 * the project rule — 1 px borders, no shadows, minimal radius.
 * Fonts resolve to Roboto via the shell's token stack. */
const APP_STYLES = `
/* Flat-UI reset — the data-entry app renders inside the AppHost
 * wrapper and matches the admin-ui's zero-radius / solid-ink
 * table language. Any radius we still want on an individual
 * element must re-declare it explicitly after this rule. */
.der-apphost .der-de-toolbar *,
.der-apphost .der-de-actionbar *,
.der-apphost .der-de-form-card *,
.der-apphost .der-de-section-nav *,
.der-apphost .der-de-details-drawer,
.der-apphost .der-de-details-drawer * {
  border-radius: 0 !important;
}

/* Section tables — adopt the admin-ui ea-table look: collapsed
 * borders, uppercase 13 px sticky thead with a 2 px underline,
 * no cell borders, subtle hover tint. */
.der-apphost .der-de-form-card .sectionTable {
  border-collapse: collapse;
  width: 100%;
  table-layout: auto;
  font-size: 14px;
  margin: 0;
}
.der-apphost .der-de-form-card .sectionTable th,
.der-apphost .der-de-form-card .sectionTable td {
  padding: 6px 8px;
  border: 0 !important;
  text-align: left;
  vertical-align: middle;
  background: transparent !important;
}
.der-apphost .der-de-form-card .sectionTable thead th {
  background: transparent !important;
  color: var(--der-ink-700, #2a3447);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 6px 8px !important;
  border-bottom: 2px solid var(--der-brand-300, #c0c8ea) !important;
  text-align: left;
}
.der-apphost .der-de-form-card .sectionTable thead th.dataElementCell {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
}
.der-apphost .der-de-form-card .sectionTable tr.indicatorRow td {
  background: #f0f3fb !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
.der-apphost .der-de-form-card .sectionTable th.der-de-row-total-cell,
.der-apphost .der-de-form-card .sectionTable td.der-de-row-total-cell {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
  background: #f6f8fd !important;
  border-left: 1px solid var(--der-brand-100, #c7dff6) !important;
  padding: 3px 10px !important;
  min-width: 48px;
}
.der-apphost .der-de-form-card .sectionTable th.der-de-row-total-cell {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
  background: transparent !important;
}
/* Matrix title total badge — "(Total: 19)" appended to the
 * title of each disaggregated matrix. Updates live from input
 * events on inputs sharing the same dataelementid. */
.der-de-matrix-total {
  margin-left: 6px;
  font-weight: 400;
  color: var(--der-ink-500, #5b6478);
  font-size: 0.92em;
}

/* Inline live strip — mounted on the right of the picks row
 * (Dataset · AOC · Period). No row of its own; shares the
 * baseline of the selects. */
.der-de-toolbar__cell-info {
  margin-left: auto;
  align-self: flex-end;
  padding-bottom: 4px;
  max-width: 560px;
  overflow: hidden;
}
.der-de-live-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--der-ink-700, #2a3447);
}
.der-de-live-strip__cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--der-ink-700, #2a3447);
  font-size: 12px;
}
.der-de-live-strip__de {
  color: var(--der-ink-900, #101a32);
  font-weight: 500;
}
.der-de-live-strip__coc {
  color: var(--der-ink-500, #5b6478);
}
.der-de-live-strip__value {
  color: var(--der-ink-900, #101a32);
  font-family: ui-monospace, monospace;
}
.der-de-live-strip__empty {
  color: var(--der-ink-300, #9097a8);
  font-style: normal;
}
.der-de-live-strip__sep {
  color: var(--der-ink-300, #9097a8);
}
.der-de-live-strip__state--muted  { color: #5b6478; }
.der-de-live-strip__state--saved  { color: #1b8243; }
.der-de-live-strip__state--saving { color: #9b5a00; }
.der-de-live-strip__state--queued { color: #9b5a00; }
.der-de-live-strip__state--error  { color: #c0392b; }
.der-de-live-strip__required {
  color: #9b5a00;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.der-de-live-strip__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--der-ink-500, #5b6478);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: background 120ms, color 120ms;
}
.der-de-live-strip__clear:hover,
.der-de-live-strip__clear:focus-visible {
  background: #fbe9e7;
  color: #a3322c;
  outline: 0;
}
.der-de-live-strip__audit {
  color: var(--der-ink-500, #5b6478);
  font-size: 12px;
}
.der-de-live-strip__audit strong {
  color: var(--der-ink-700, #2a3447);
  font-weight: 500;
}
.der-de-sync-logos {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}
.der-de-sync-logos__pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  background: transparent;
  border: 0;
  line-height: 1;
}
.der-de-sync-logos__pin svg { flex-shrink: 0; }
/* Each brand mark keeps its native dark hue — status is communicated
 * by the small square dot next to it, not by recolouring the logo. */
.der-de-sync-logos__pin--der    { color: #0B3558; }
.der-de-sync-logos__pin--central { color: #0080d4; }
/* Square status dot, 8 px. Green = saved/synced, orange = pending,
 * red = error, gray = empty. */
.der-de-sync-logos__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  background: #c6ccd7;
}
.der-de-sync-logos__dot.is-muted   { background: #c6ccd7; }
.der-de-sync-logos__dot.is-lit     { background: #1b8243; }
.der-de-sync-logos__dot.is-pending { background: #c6680a; }
.der-de-sync-logos__dot.is-error   { background: #a3322c; }
.der-de-sync-logos__svg {
  display: block;
  flex-shrink: 0;
}
.der-de-live-strip__hint {
  color: var(--der-ink-500, #5b6478);
  font-style: italic;
}
.der-apphost .der-de-form-card .sectionTable .dataElementCell {
  background: transparent !important;
  color: var(--der-ink-900, #101a32);
  font-weight: 400;
  min-width: 220px;
  padding: 4px 8px !important;
}
.der-apphost .der-de-form-card .sectionTable tbody tr {
  border: 0 !important;
  min-height: 32px;
}
.der-apphost .der-de-form-card .sectionTable tbody tr:hover td,
.der-apphost .der-de-form-card .sectionTable tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
}
.der-apphost .der-de-form-card .sectionTable tbody td {
  padding: 3px 8px !important;
  color: var(--der-ink-900, #101a32) !important;
  line-height: 1.4;
  font-size: 14px;
}
/* Blocked / not-applicable cells — DHIS2 greyedFields. Soft
 * indigo-tinted wash + slash pattern so they read as "cannot
 * be edited" without yelling for attention. */
.der-apphost .der-de-form-card .sectionTable td.greyed {
  background: repeating-linear-gradient(
    45deg,
    #eef0f9,
    #eef0f9 6px,
    #dde3f1 6px,
    #dde3f1 7px
  ) !important;
  color: #8893b1 !important;
  text-align: center;
}
/* Indicator rows — computed values, not editable. Soft tint
 * aligned with the thead so they read as "same family as the
 * header row". */
/* Total / readonly cells (e.g. TBLP's "Total across all breakdown"
 * input). */
.der-apphost .der-de-custom-form input[readonly],
.der-apphost .der-de-form-card input[readonly] {
  background: #f0f3fb !important;
  color: var(--der-ink-500, #5b6478) !important;
  cursor: default;
}
.der-apphost .der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid #aaa !important;
  background: #fff !important;
  padding: 4px 6px;
  font-size: 14px;
  color: var(--der-ink-900, #101a32);
}
.der-apphost .der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
}

/* Solid-ink pills — no pastel tint, just coloured text on
 * transparent background with a thin bottom underline. */
.der-apphost .der-de-toolbar__status,
.der-apphost .der-de-savepill,
.der-apphost .der-de-section-nav__ratio,
.der-apphost .der-de-completion-pill,
.der-apphost .der-de-issues-chip {
  background: transparent !important;
  padding: 0 4px !important;
  border: 0 !important;
}
.der-apphost .der-de-toolbar__status--on    { color: #1b8243 !important; }
.der-apphost .der-de-toolbar__status--off   { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--saved        { color: #1b8243 !important; }
.der-apphost .der-de-savepill--saving       { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--queued       { color: #9b5a00 !important; }
.der-apphost .der-de-savepill--error        { color: #c0392b !important; }
.der-apphost .der-de-section-nav__ratio--muted   { color: #5b6478 !important; }
.der-apphost .der-de-section-nav__ratio--partial { color: #9b5a00 !important; }
.der-apphost .der-de-section-nav__ratio--done    { color: #1b8243 !important; }

/* Single sticky toolbar — replaces the old title + chip strip.
 * SOLID background so scrolling long forms doesn't show the
 * grid through the header. */
.der-de-toolbar {
  position: sticky;
  top: 52px;
  z-index: 5;
  margin: 0 -20px 12px;
  padding: 10px 20px 10px;
  background: #ffffff;
  border-bottom: 1px solid #e5e9ef;
  box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
}
.der-de-toolbar__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.der-de-toolbar__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #e6f1fb;
  flex: 0 0 auto;
}
.der-de-saveall-btn {
  padding: 6px 14px;
  border: 1px solid var(--der-brand-600, #0f68b7);
  background: var(--der-brand-500, #147CD7);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: background 120ms;
}
.der-de-saveall-btn:hover,
.der-de-saveall-btn:focus-visible {
  background: var(--der-brand-600, #0f68b7);
  outline: 0;
}
.der-de-toolbar__info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: var(--der-brand-500, #147CD7);
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
  transition: color 120ms, background 120ms;
  border-radius: 4px;
}
.der-de-toolbar__info-btn:hover,
.der-de-toolbar__info-btn:focus-visible {
  color: var(--der-brand-700, #0a5497);
  background: #e6f1fb;
  outline: 0;
}
.der-de-info-modal {
  background: #fff;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(16, 26, 50, 0.28);
  border-radius: 12px;
  overflow: hidden;
}
.der-de-info-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e9ef;
  background: linear-gradient(180deg, #f6f9ff 0%, #fff 100%);
}
.der-de-info-modal__title-wrap {
  flex: 1 1 auto;
  min-width: 0;
}
.der-de-info-modal__eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--der-brand-500, #147CD7);
  margin-bottom: 4px;
}
.der-de-info-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  line-height: 1.3;
}
.der-de-info-modal__close {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--der-ink-500, #5b6478);
  font-size: 26px;
  line-height: 1;
  padding: 0 6px;
  border-radius: 4px;
  transition: color 120ms, background 120ms;
}
.der-de-info-modal__close:hover,
.der-de-info-modal__close:focus-visible {
  color: var(--der-ink-900, #101a32);
  background: #e5e9ef;
  outline: 0;
}
.der-de-info-modal__body {
  padding: 20px 24px 8px;
  overflow-y: auto;
}
.der-de-info-modal__desc {
  margin: 0 0 20px;
  color: var(--der-ink-700, #2a3447);
  font-size: 14px;
  line-height: 1.6;
}
.der-de-info-modal__stats {
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.der-de-info-modal__stat {
  background: #f6f8fd;
  border: 1px solid #e0e6f3;
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0;
}
.der-de-info-modal__stat dt {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--der-ink-500, #5b6478);
  margin-bottom: 4px;
}
.der-de-info-modal__stat dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.der-de-info-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px 16px;
  border-top: 1px solid #e5e9ef;
  background: #fff;
}
.der-de-info-modal__done {
  background: var(--der-brand-500, #147CD7);
  color: #fff;
  border: 1px solid var(--der-brand-600, #0f68b7);
  border-radius: 6px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms;
}
.der-de-info-modal__done:hover,
.der-de-info-modal__done:focus-visible {
  background: var(--der-brand-600, #0f68b7);
  outline: 0;
}
.der-de-toolbar__title {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  color: #101a32;
  letter-spacing: -0.01em;
}
.der-de-toolbar__status {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0;
  background: transparent;
}
.der-de-toolbar__status::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  vertical-align: 1px;
  background: currentColor;
}
.der-de-toolbar__status--on  { color: #1b8243; }
.der-de-toolbar__status--off { color: #9b5a00; }
.der-de-toolbar__ou-wrap {
  margin-left: auto;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  max-width: 360px;
}
.der-de-toolbar__ou-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9097a8;
}
.der-de-toolbar__ou {
  color: #101a32;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.der-de-toolbar__picks {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.der-de-toolbar__field {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
}
.der-de-toolbar__field--period {
  min-width: 260px;
}
.der-de-toolbar__field--filter {
  min-width: 240px;
  max-width: 320px;
}
.der-de-toolbar__filter {
  display: inline-flex;
  width: 100%;
  position: relative;
}
.der-de-toolbar__filter-input {
  width: 100%;
  padding: 5px 24px 5px 10px;
  border: 1px solid #d8dee8;
  background: #fff;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
  transition: border-color 150ms;
}
.der-de-toolbar__filter-input:hover { border-color: #9aa3b8; }
.der-de-toolbar__filter-input:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
.der-de-toolbar__filter-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  cursor: pointer;
  color: #6e7a8a;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}
.der-de-toolbar__field-label {
  font-size: 11px;
  color: #6e7a8a;
  letter-spacing: 0.04em;
}
.der-de-toolbar__select,
.der-apphost .der-de-period-nav select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 5px 24px 5px 10px;
  border: 1px solid #d8dee8;
  border-radius: 0;
  background: #fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='%235b6478' stroke-width='1.5'><path d='M1 1l4 4 4-4'/></svg>")
    no-repeat right 8px center;
  background-size: 10px 6px;
  box-shadow: none;
  font-size: 13px;
  color: #101a32;
  font-family: inherit;
  transition: border-color 150ms;
}
.der-de-toolbar__select:hover,
.der-apphost .der-de-period-nav select:hover {
  border-color: #9aa3b8;
}
.der-de-toolbar__select:focus,
.der-apphost .der-de-period-nav select:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Back-compat kill switch for legacy .der-de-chip classes. */
.der-de-chip, .der-de-chip-signed,
.der-de-chip-label, .der-de-chip-value {
  display: none !important;
}
.der-de-select,
.der-de-period-wrap > * {
  font-size: 13px;
  font-family: inherit;
}
.der-de-select:focus,
.der-de-period-wrap > *:focus {
  outline: none;
  border-color: var(--der-brand-500, #147CD7);
}
/* Compound prev-[select]-next. No wrapping border; each child
 * carries its own 1 px outline so the three items read as one
 * unit without a second enclosing frame. */
.der-de-period-nav {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  width: 100%;
}
.der-de-period-nav select {
  flex: 1 1 auto;
  padding: 4px 8px;
  border: 1px solid #d8dee8;
  background: #fff;
  color: #101a32;
  border-radius: 4px;
}
.der-de-period-btn {
  background: transparent;
  border: 0;
  color: #147CD7;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  color: #0a5497;
  background: #e6f1fb;
}
.der-de-period-btn:disabled {
  color: #c0c7d2;
  cursor: not-allowed;
}
.der-de-placeholder {
  padding: 32px 16px;
  text-align: center;
  color: #6e7a8a;
  font-size: 14px;
  background: #fff;
  border: 1px dashed #d7dde5;
  border-radius: 3px;
}
/* Layout envelope — the AppHost's ScreenCard body is a flex
 * column whose height fills the viewport below the shell topbar
 * + sticky toolbar. The form card grows to fill the remaining
 * space (flex: 1) so a short form still pushes the actionbar to
 * the screen bottom; a long form grows the column naturally and
 * the actionbar follows the content (not the viewport). */
.der-apphost .der-screen-card__body {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--der-topbar-h, 52px));
}
.der-de-form-card {
  padding: 0;
  background: transparent;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  line-height: 1.45;
}
.der-de-form-card h2,
.der-de-form-card h3,
.der-de-form-card h4,
.der-de-custom-form h3,
.der-de-custom-form .formSection,
.der-de-custom-form h3.formSection {
  font-size: 16px;
  font-weight: 600;
  color: var(--der-ink-900, #101a32);
  letter-spacing: 0;
}
.der-de-custom-form p,
.der-de-custom-form label,
.der-de-custom-form td,
.der-de-custom-form th,
.der-de-form-card p,
.der-de-form-card label {
  font-size: 14px;
}
.der-de-form-split {
  flex: 1 1 auto;
}
.der-de-actionbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px -20px 0;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e5e9ef;
}
.der-de-savepill {
  margin-right: auto;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.der-de-savepill--muted  { background: #eef0f3; color: #6e7a8a; }
.der-de-savepill--saved  { background: #e8f4ee; color: #136436; }
.der-de-savepill--saving { background: #fbf4e0; color: #8a6b00; }
.der-de-savepill--queued { background: #fbeedd; color: #874a00; }
.der-de-savepill--error  { background: #fbeaea; color: #8a2525; }
.der-de-form-split {
  display: block;
}
.der-de-section-nav { display: none; }
@media (min-width: 1024px) {
  .der-de-form-split {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 15px;
    align-items: start;
  }
  .der-de-section-nav {
    display: block;
    position: sticky;
    top: 140px;
    align-self: start;
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    padding: 10px 6px;
    background: #f7f8fc;
    border-radius: 10px;
  }
}
.der-de-section-nav__title {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
  margin: 0 8px 8px;
}
.der-de-section-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.der-de-section-nav__item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  padding: 8px 10px;
  margin: 0;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 4px 4px 0;
  color: #404b5a;
  font-size: 13px;
  line-height: 1.35;
  cursor: pointer;
}
.der-de-section-nav__label {
  flex: 1 1 auto;
}
.der-de-section-nav__ratio {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.der-de-section-nav__ratio--muted   { background: #eef0f5; color: #6e7a8a; }
.der-de-section-nav__ratio--partial { background: #fef0d8; color: #9b5a00; }
.der-de-section-nav__ratio--done    { background: #e3f7eb; color: #1b8243; }
.der-de-section-nav__item:hover {
  background: #eef0f3;
}
.der-de-section-nav__item--active {
  background: #eef4fa;
  border-left-color: #147CD7;
  color: #0a5497;
  font-weight: 500;
}
/* One section at a time. Each slot stretches to fill the form
 * column so the operator sees exactly the section they picked
 * — no accidental scroll into neighbours. */
.der-de-section-slot {
  margin: 0 0 12px;
}
/* Custom form visual integration. The inline-style strip in
 * applyFormAssets neutralises TBLP/legacy template colours +
 * rounded chrome; these rules give the author's table structure
 * DER's compact grid design back. */
.der-de-custom-form h1,
.der-de-custom-form h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: #0a5497;
  border-bottom: 1px solid #e5e9ef;
  padding-bottom: 6px;
}
.der-de-custom-form .tblep-root,
.der-de-custom-form .tblep-head,
.der-de-custom-form .tblep-panel {
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  margin: 0 0 16px !important;
}
/* Author-authored decorations shipped inside CUSTOM
 * dataEntryForm.htmlCode (TBLP + legacy DHIS2 custom forms).
 * These duplicate signal the DER data-entry chrome already
 * surfaces — dataset title (toolbar), section nav numbering,
 * section headers — and introduce visual styles that fight the
 * shared DER UI. Hide everything but the semantic structure
 * (sections + tables + inputs) so operators see one consistent
 * language regardless of who authored the form. */
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-kicker,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-num,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-h1,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-lead,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-note,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-muted,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-head,
.der-de-custom-form:not(.der-de-custom-form--author) .tblep-foot {
  display: none !important;
}
/* Author mode — let the DHIS2 custom-form HTML render natively.
 * Only the .tblep-table border suppression in DER mode is
 * undone; author tables retain their own 1 px row borders +
 * background accents. */
.der-de-custom-form--author .tblep-root,
.der-de-custom-form--author .tblep-head,
.der-de-custom-form--author .tblep-panel,
.der-de-custom-form--author .tblep-table th,
.der-de-custom-form--author .tblep-table td,
.der-de-custom-form--author table th,
.der-de-custom-form--author table td {
  padding: revert !important;
  border: revert !important;
  background: revert !important;
  color: revert !important;
  margin: revert !important;
  border-radius: revert !important;
}
.der-de-custom-form--author input[name$="-val"],
.der-de-custom-form--author input[name="entryfield"],
.der-de-custom-form--author input[name="total"] {
  border: revert !important;
  border-radius: revert !important;
  padding: revert !important;
  background: revert !important;
  font-size: revert !important;
  color: revert !important;
}
.der-de-custom-form .tblep-table,
.der-de-custom-form table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 14px;
}
.der-de-custom-form .tblep-table th,
.der-de-custom-form .tblep-table td,
.der-de-custom-form table th,
.der-de-custom-form table td {
  padding: 4px 8px !important;
  border: 0 !important;
  text-align: left !important;
  vertical-align: middle;
  background: transparent !important;
  font-size: 14px;
}
.der-de-custom-form .tblep-table thead th,
.der-de-custom-form table thead th {
  border-bottom: 2px solid var(--der-brand-300, #c0c8ea) !important;
  color: var(--der-ink-700, #2a3447) !important;
  font-weight: 500;
  font-size: 14px;
}
.der-de-custom-form .tblep-table tbody tr {
  border: 0 !important;
}
.der-de-custom-form .tblep-table tbody tr:hover td,
.der-de-custom-form .tblep-table tbody tr:focus-within td {
  background: rgba(13, 46, 92, 0.045) !important;
}
.der-de-custom-form .tblep-table th,
.der-de-custom-form table th {
  background: transparent !important;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
}
.der-de-custom-form .tblep-table input[type="text"],
.der-de-custom-form table input[type="text"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  width: 100% !important;
  padding: 2px 4px !important;
  border: 1px solid #aaa !important;
  background: #fff !important;
  font-size: 14px !important;
  color: #212934 !important;
  font-family: inherit;
}
.der-de-custom-form input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
  background: #fff !important;
}
.der-de-completion-pill {
  margin-right: auto;
  padding: 4px 10px;
  border-radius: 12px;
  background: #eef0f3;
  color: #404b5a;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.der-de-form-card .sectionTable {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0 20px;
  font-size: 14px;
}
.der-de-form-card .sectionTable th,
.der-de-form-card .sectionTable td {
  border: 1px solid #e5e9ef;
  padding: var(--der-de-cell-pad, 6px 8px);
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable thead th {
  background: transparent;
  font-weight: 500;
  color: var(--der-ink-700, #2a3447);
  text-align: center;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: transparent;
  min-width: var(--der-de-de-col, 200px);
  text-align: left;
}
/* Each table lives inside a container that normally fits the
   viewport (categories nest with colspan rather than forcing a
   wide flat matrix). Only scroll horizontally as a last resort
   when the operator chose Comfortable density on a very wide
   combo (Age × Sex × Status + 50+ DEs). */
.der-de-form-card .der-de-table-scroll {
  overflow-x: auto;
  margin: 6px 0 16px;
  background: transparent;
}
.der-de-form-card .der-de-table-scroll .sectionTable {
  margin: 0;
  width: 100%;
  border-collapse: collapse;
}
.der-de-form-card .sectionTable .indicatorRow td {
  background: #f0f3fb;
  font-weight: 500;
}
.der-de-form-card .sectionTable .greyed {
  background: #eef0f9;
  color: #8893b1;
  text-align: center;
}
.der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 1px solid #aaa;
  background: #fff;
  padding: 2px 4px;
  font-size: 14px;
  color: #212934;
  font-family: inherit;
  border-radius: 4px;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 0;
  border-color: #147CD7;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Compulsory cells — DHIS2 marks these with an amber left
 * rule so operators can tell at a glance which fields block
 * "Mark complete". Applies to both SECTION-renderer inputs and
 * CUSTOM author inputs (we tag them the same way). */
.der-de-form-card .sectionTable input[type="text"][data-compulsory="1"],
.der-de-custom-form input[data-compulsory="1"] {
  border-left: 3px solid #9b5a00 !important;
}
.der-de-form-card .sectionTable input[type="text"][data-compulsory="1"]:placeholder-shown,
.der-de-custom-form input[data-compulsory="1"]:placeholder-shown {
  background: #fef0d8 !important;
}
/* Row-level focus tint — SECTION renderer tables + CUSTOM
 * author tables both get a subtle indigo wash when the row
 * contains focus or is being hovered, so the operator always
 * knows which row they are typing into. */
.der-de-form-card .sectionTable tbody tr:hover,
.der-de-form-card .sectionTable tbody tr:focus-within,
.der-de-custom-form table tbody tr:hover,
.der-de-custom-form table tbody tr:focus-within {
  background: #eef4fa;
}
.der-de-form-card .sectionTable tbody tr:focus-within
  .dataElementCell,
.der-de-custom-form table tbody tr:focus-within td:first-child {
  color: #083f72;
  font-weight: 500;
}
/* Custom-form author inputs inherit the same visual language as
 * SECTION-renderer inputs: 1 px border, 4 px radius, indigo
 * focus ring. */
.der-de-custom-form input[name$="-val"],
.der-de-custom-form input[name="entryfield"],
.der-de-custom-form input[name="total"] {
  border: 1px solid #aaa !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  background: #fff !important;
}
.der-de-custom-form input[name$="-val"]:focus,
.der-de-custom-form input[name="entryfield"]:focus,
.der-de-custom-form input[name="total"]:focus {
  outline: 0;
  border-color: #147CD7 !important;
  box-shadow: inset 0 0 0 2px #147CD7;
}
/* Realtime value-type validation — attachLiveValidation stamps
 * data-de-invalid="1" + title=<reason> on inputs that don't
 * match their data element's valueType. */
.der-de-custom-form input[data-de-invalid="1"],
.der-apphost .der-de-form-card input[data-de-invalid="1"] {
  border-color: #c0392b !important;
  background: #fbeaea !important;
  box-shadow: inset 0 0 0 1px #c0392b;
}
.der-de-custom-form input[data-de-invalid="1"]:focus,
.der-apphost .der-de-form-card input[data-de-invalid="1"]:focus,
.der-apphost .der-de-form-card .sectionTable input[type="text"][data-de-invalid="1"]:focus {
  border-color: #c0392b !important;
  box-shadow: inset 0 0 0 2px #c0392b !important;
}
.der-de-form-card h3.formSection {
  margin: 0 0 8px;
  padding: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--der-ink-900, #101a32);
  border: 0;
  letter-spacing: -0.01em;
}
/* Compact density — the default. Dense enough to show large
   multi-dimensional disaggregations without a horizontal
   scroll in most cases. */
.der-de-form-card.der-de-density-compact {
  --der-de-cell-pad: 3px 6px;
  --der-de-de-col: 180px;
  --der-de-de-col-max: 260px;
}
.der-de-form-card.der-de-density-compact .sectionTable {
  font-size: 12px;
}
.der-de-form-card.der-de-density-compact .sectionTable input[type="text"] {
  font-size: 12px;
  padding: 1px 3px;
}
.der-de-form-card.der-de-density-compact h3.formSection {
  font-size: 15px;
}
/* Comfortable density — roomier spacing for operators on
   tablets or anyone who wants a bigger tap target. */
.der-de-form-card.der-de-density-comfortable {
  --der-de-cell-pad: 8px 10px;
  --der-de-de-col: 240px;
  --der-de-de-col-max: 360px;
}
.der-de-form-card.der-de-density-comfortable .sectionTable {
  font-size: 14px;
}
.der-de-form-card.der-de-density-comfortable .sectionTable input[type="text"] {
  font-size: 14px;
  padding: 4px 6px;
}
.der-de-form-card.der-de-density-comfortable h3.formSection {
  font-size: 17px;
}
.der-de-density-btn {
  padding: 4px 10px;
  border: 1px solid #c0c7cf;
  border-radius: 10px;
  background: #fff;
  color: #404b5a;
  font-size: 12px;
  cursor: pointer;
}
.der-de-density-btn:hover {
  background: #f3f5f7;
}
.der-de-issues-chip {
  padding: 4px 10px;
  border: 1px solid #e0bcbc;
  border-radius: 10px;
  background: #fbeaea;
  color: #8a2525;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
/* Validation modal — large centered dialog. Replaces the
 * right-rail drawer: easier to read many issues at once +
 * surfaces a clean success state. */
.der-de-validation-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Must sit above .der-topbar (z-index: 100) so click-outside
   * registers on the backdrop near the top of the viewport and
   * the operator doesn't accidentally hit the topbar instead. */
  z-index: 200;
}
.der-de-validation {
  background: #fff;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(16, 26, 50, 0.24);
}
.der-de-validation__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-validation__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.der-de-validation__heading {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #101a32;
}
.der-de-validation__badge {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}
.der-de-validation--ok .der-de-validation__badge {
  background: #1b8243;
}
.der-de-validation--err .der-de-validation__badge {
  background: #c0392b;
}
.der-de-validation__close {
  background: transparent; border: 0; cursor: pointer;
  color: #5b6478; font-size: 22px; line-height: 1;
}
.der-de-validation__body {
  padding: 16px 20px 20px;
  overflow-y: auto;
}
.der-de-validation__ok-prose {
  margin: 0;
  color: #404b5a;
  font-size: 13px;
  line-height: 1.5;
}
.der-de-validation__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.der-de-validation__table th,
.der-de-validation__table td {
  padding: 8px 10px;
  text-align: left;
  color: #101a32;
  border-bottom: 1px solid #eef0f3;
}
.der-de-validation__table thead th {
  font-size: 12px;
  font-weight: 500;
  color: #5b6478;
  border-bottom: 2px solid #d8dee8;
}
.der-de-validation__coc { color: #5b6478; }
.der-de-validation__value {
  display: inline-block;
  padding: 1px 6px;
  background: #fbeaea;
  color: #8a2525;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}
.der-de-validation__why { color: #8a2525; }
.der-de-validation__jump-btn {
  background: transparent;
  border: 0;
  color: #147CD7;
  font-size: 12px;
  cursor: pointer;
}
.der-de-validation__jump-btn:hover { color: #0a5497; }

.der-de-shortcuts-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 26, 50, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Above .der-topbar (z-index: 100) so click-outside anywhere
   * on the backdrop closes the popover — the previous 20 meant
   * the shell topbar intercepted clicks near the top. */
  z-index: 200;
}
.der-de-shortcuts {
  background: #fff;
  border-radius: 12px;
  padding: 0;
  width: min(440px, calc(100vw - 32px));
  box-shadow: 0 16px 48px rgba(16, 26, 50, 0.24);
  overflow: hidden;
}
.der-de-shortcuts__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #f7f8fc;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-shortcuts__title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #083f72;
}
.der-de-shortcuts__close {
  background: transparent; border: 0; cursor: pointer;
  font-size: 22px; line-height: 1; color: #6e7a8a;
}
.der-de-shortcuts__list {
  margin: 0;
  padding: 10px 18px 16px;
}
.der-de-shortcuts__row {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f5f7;
}
.der-de-shortcuts__row:last-child { border-bottom: 0; }
.der-de-shortcuts__row dt { margin: 0; }
.der-de-shortcuts__row dd { margin: 0; color: #404b5a; font-size: 13px; }
.der-de-shortcuts kbd {
  display: inline-block;
  padding: 2px 8px;
  background: #eef0f5;
  border: 1px solid #d8dee8;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #101a32;
  box-shadow: 0 1px 0 rgba(16, 26, 50, 0.1);
}
.der-de-details-drawer {
  position: fixed;
  top: 112px;
  right: 16px;
  width: 320px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e5e9ef;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(16, 26, 50, 0.08);
  z-index: 8;
}
.der-de-details-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f7f8fc;
  border-bottom: 1px solid #e5e9ef;
}
.der-de-details-drawer__title {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
}
.der-de-details-drawer__close {
  padding: 0 6px;
  background: transparent; border: 0; cursor: pointer;
  color: #6e7a8a; font-size: 20px; line-height: 1;
}
.der-de-details-drawer__body {
  padding: 12px 14px;
  overflow-y: auto;
}
.der-de-details-drawer__empty {
  padding: 16px 14px;
  margin: 0;
  color: #6e7a8a;
  font-size: 13px;
}
.der-de-details-drawer__de {
  font-size: 14px;
  font-weight: 500;
  color: #083f72;
  margin-bottom: 6px;
}
.der-de-details-drawer__compulsory {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 10px;
  background: #fef0d8;
  color: #9b5a00;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  vertical-align: middle;
}
.der-de-details-drawer__state {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  margin-bottom: 12px;
}
.der-de-details-drawer__state--muted  { background: #eef0f5; color: #475061; }
.der-de-details-drawer__state--saved  { background: #e3f7eb; color: #1b8243; }
.der-de-details-drawer__state--saving { background: #fef0d8; color: #9b5a00; }
.der-de-details-drawer__state--queued { background: #fef0d8; color: #9b5a00; }
.der-de-details-drawer__state--error  { background: #fee2e2; color: #c0392b; }
.der-de-details-drawer__meta {
  display: grid;
  grid-template-columns: 90px 1fr;
  row-gap: 6px;
  column-gap: 10px;
  margin: 0;
  font-size: 12px;
}
.der-de-details-drawer__meta dt {
  color: #6e7a8a;
  font-weight: 400;
}
.der-de-details-drawer__meta dd {
  margin: 0;
  color: #101a32;
  overflow-wrap: anywhere;
}
.der-de-details-drawer__meta dd code {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #475061;
}
.der-de-details-drawer__empty-val {
  color: #9097a8;
}
.der-de-details-drawer__breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
}
.der-de-details-drawer__breakdown li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
  font-size: 12px;
}
.der-de-details-drawer__cat {
  color: #6e7a8a;
}
.der-de-details-drawer__opt {
  color: #101a32;
  font-weight: 500;
}
.der-de-issues-drawer {
  position: fixed;
  top: 112px;
  right: 16px;
  width: 360px;
  max-height: calc(100vh - 160px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e0bcbc;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(28, 46, 70, 0.12);
  z-index: 10;
}
.der-de-issues-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fbeaea;
  border-bottom: 1px solid #e0bcbc;
}
.der-de-issues-drawer__title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #8a2525;
}
.der-de-issues-drawer__close {
  padding: 0 6px;
  background: transparent;
  border: 0;
  color: #8a2525;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.der-de-issues-drawer__list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.der-de-issues-drawer__item {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  border: 0;
  border-bottom: 1px solid #eef0f3;
  background: transparent;
  color: #212934;
  cursor: pointer;
}
.der-de-issues-drawer__item:hover {
  background: #fdf5f5;
}
.der-de-issues-drawer__de {
  font-size: 13px;
  font-weight: 500;
}
.der-de-issues-drawer__coc {
  font-size: 11px;
  color: #6e7a8a;
}
.der-de-issues-drawer__why {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #8a2525;
}
.der-de-issues-drawer__value {
  padding: 1px 6px;
  border-radius: 3px;
  background: #fbeaea;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #8a2525;
}
`;

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: active ? '#147CD7' : 'transparent',
    color: active ? '#fff' : '#147CD7',
    border: '1px solid #147CD7',
    borderRadius: 0, fontSize: 13, cursor: 'pointer',
  };
}
