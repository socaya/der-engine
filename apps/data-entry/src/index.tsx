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
  // Bump after every successful form render so SectionNavigator
  // re-scrapes the headers of the freshly-injected #contentDiv.
  const [formRenderVersion, setFormRenderVersion] = useState(0);

  // Hydrate the dataset picker once on mount — operators choose
  // from what's mirrored on this edge, not type raw UIDs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listDataSets();
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
  }, []);

  // Whenever the dataset UID changes, peek at the dataset's form
  // metadata so the UI can offer "Switch to custom form" when the
  // dataset actually has one.
  useEffect(() => {
    if (dataSet.trim() === '') { setFormInfo(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const meta = await api.getDataSetMeta(dataSet.trim()) as {
          displayName?: string; name?: string;
          formType?: string; periodType?: string;
          dataEntryForm?: { id: string } | null;
        };
        if (cancelled) return;
        // The "Custom form" tab lights up for both CUSTOM
        // (operator-authored htmlCode) and SECTION (DER renders
        // the DHIS2 section table from metadata) formTypes. Either
        // path feeds through the same vendor + shim pipeline so
        // entry.js's autosave + validation + indicators wire up
        // identically.
        const hasCustomForm = (!!meta.dataEntryForm && meta.formType === 'CUSTOM')
          || meta.formType === 'SECTION';
        setFormInfo({
          hasCustomForm,
          formId: meta.dataEntryForm?.id,
          displayName: meta.displayName ?? meta.name,
          formType: meta.formType,
          periodType: meta.periodType,
        });
        // Pick the right rendering mode automatically: datasets
        // with CUSTOM/SECTION always route through the vendor-stack
        // path; everything else (DEFAULT) falls back to the
        // structured single-cell form.
        setMode(hasCustomForm ? 'custom' : 'structured');
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
        await applyFormAssets(content, formHtml);
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
          api);
        attachKeyboardNav(content);
        setFormRenderVersion((v) => v + 1);
        setStatus({ kind: 'ok',
          message: 'Custom form loaded. Autosave + validation run as in DHIS2.' });
      } catch (e) {
        setStatus({ kind: 'error',
          message: `custom form failed to render: ${(e as Error).message}` });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, formInfo, dataSet, period, ou.orgUnitUid]);

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

  async function toggleCompletion(): Promise<void> {
    if (!formReady || completionBusy) return;
    const next = !(completion?.completed);
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
      setStatus({ kind: 'ok',
        message: rec.completed
          ? 'Dataset marked complete.'
          : 'Dataset reopened.' });
    } catch (err) {
      setStatus({ kind: 'error',
        message: `Completion failed: ${(err as Error).message}` });
    } finally { setCompletionBusy(false); }
  }

  return (
    <ScreenCard
      title="Aggregate data entry"
      actions={
        <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
          {online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`}
        </StatusPill>
      }
    >
      <style>{APP_STYLES}</style>

      {/* Context strip — three "chips" in DHIS2-Capture style. */}
      <div className="der-de-context">
        <div className="der-de-chip">
          <span className="der-de-chip-label">Organisation unit</span>
          <span className="der-de-chip-value"
                title={ou.orgUnitPath || ou.orgUnitUid || ''}>
            {ou.orgUnitDisplayName || ou.orgUnitUid || '—'}
          </span>
        </div>
        <div className="der-de-chip">
          <span className="der-de-chip-label">Data set</span>
          <select className="der-de-select"
                  value={dataSet}
                  onChange={(e) => { setDataSet(e.target.value); setPeriod(''); }}
                  data-test="der-de-dataset-picker">
            <option value="">Select a data set…</option>
            {datasetList.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="der-de-chip">
          <span className="der-de-chip-label">
            Period {formInfo?.periodType ? `· ${formInfo.periodType}` : ''}
          </span>
          <span className="der-de-period-wrap">
            {renderPeriodPicker(formInfo?.periodType, period, setPeriod)}
          </span>
        </div>
        <div className="der-de-chip der-de-chip-signed">
          <span className="der-de-chip-label">Signed in</span>
          <span className="der-de-chip-value">{auth.displayName}</span>
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
        <div className="der-de-form-card">
          {aocCategories.length > 0 && (
            <div style={{ display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(aocCategories.length, 3)}, 1fr)`,
              gap: 12, marginBottom: 12 }}>
              {aocCategories.map((c) => (
                <label key={c.id}>{c.name}
                  <select
                    value={aocSelections[c.id] ?? ''}
                    onChange={(e) => {
                      const next = { ...aocSelections, [c.id]: e.target.value };
                      setAocSelections(next);
                      aocSelectionsRef.current = next;
                      syncAocToDom(customRoot.current, next);
                    }}
                    style={inputStyle}
                  >
                    {c.options.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
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
          <button type="button"
                  onClick={() => runValidation(customRoot.current, setStatus)}
                  style={secondaryBtn}
                  data-test="de-validate-btn">
            Validate
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
  periodType?: string;
  formType?: string;
  version?: number;
  categoryCombo?: {
    id: string; name?: string;
    categories?: Array<{ id: string; name?: string;
      categoryOptions?: Array<{ id: string; name?: string }> }>;
    categoryOptionCombos?: Array<{ id: string; name?: string }>;
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
  categories?: Array<{ id: string }>;
  categoryOptionCombos?: Array<{ id: string; name?: string }>;
}

interface CocRegistryEntry {
  id: string;
  name?: string;
  displayName?: string;
  categoryCombo?: { id: string };
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
        id: c.id, name: c.name ?? c.displayName })),
      // Leave `categories` unexpanded — `/api/categories` isn't on
      // DER's mirror, so renderSectionForm's nested-header branch
      // stays a no-op and we fall back to the flat COC-name header
      // row. Still legible; a future slice can expand categories
      // once the mirror picks them up.
      categories: (reg.categories ?? []).map((c) => ({ id: c.id })),
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
      parts.push(`<table class="sectionTable" cellspacing="0">`);
      // Nested column headers: one <tr> per category, each cell
      // spans the width of its options' slice across COCs. For a
      // categoryCombo of (Sex × Age) with 2 × 3 options the first
      // row has 2 cells (Sex) each spanning 3 COCs; second row has
      // 6 cells (Age) each spanning 1. If we can't derive the
      // nesting (missing metadata), fall back to a single flat row.
      const nestedHeaders = buildNestedHeaders(cats, cocs);
      parts.push('<thead>');
      if (nestedHeaders.length > 0) {
        for (let i = 0; i < nestedHeaders.length; i++) {
          parts.push('<tr>');
          if (i === 0) {
            parts.push(`<th class="dataElementCell" rowspan="${nestedHeaders.length}">`
              + esc(group.cc.name ?? 'Data element') + '</th>');
          }
          for (const h of nestedHeaders[i] ?? []) {
            parts.push(`<th colspan="${h.span}">${esc(h.label)}</th>`);
          }
          parts.push('</tr>');
        }
      } else {
        parts.push('<tr>');
        parts.push(`<th class="dataElementCell">${esc(group.cc.name ?? 'Data element')}</th>`);
        for (const c of cocs) parts.push(`<th>${esc(c.name ?? '')}</th>`);
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
        parts.push('</tr>');
      }
      // Indicator rows — one per indicator in the section. Input
      // name="indicator" + indicatorid attribute is what
      // entry.js's updateIndicators() queries. Span across COCs
      // via colspan so the row looks aligned with data rows.
      for (const iref of section.indicators ?? []) {
        const ind = indicatorsById[iref.id];
        if (!ind) continue;
        parts.push('<tr class="indicatorRow">');
        parts.push(`<td class="dataElementCell">${esc(ind.name ?? ind.id)}</td>`);
        parts.push(`<td colspan="${cocs.length}">`
          + `<input type="text" name="indicator" indicatorid="${esc(ind.id)}"`
          + ' readonly></td>');
        parts.push('</tr>');
      }
      parts.push('</tbody></table>');
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
  _cocs: Array<{ id: string; name?: string }>,
): Array<Array<{ label: string; span: number }>> {
  if (cats.length === 0) return [];
  // Each category's options drive its row's span pattern. The
  // span for a category at depth `d` is the product of the option
  // counts of categories deeper than d (so the first row is the
  // widest-spanning).
  const counts = cats.map((c) => (c.categoryOptions?.length ?? 0));
  if (counts.some((n) => n === 0)) return [];
  const rows: Array<Array<{ label: string; span: number }>> = [];
  for (let d = 0; d < cats.length; d++) {
    const cells: Array<{ label: string; span: number }> = [];
    let span = 1;
    for (let e = d + 1; e < cats.length; e++) span *= counts[e] ?? 1;
    let repeat = 1;
    for (let e = 0; e < d; e++) repeat *= counts[e] ?? 1;
    for (let r = 0; r < repeat; r++) {
      for (const opt of cats[d]?.categoryOptions ?? []) {
        cells.push({ label: opt.name ?? opt.id, span });
      }
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
      paintState(t, r?.status === 'OFFLINE_QUEUED' ? 'queued' : 'saved');
    } catch {
      paintState(t, 'error');
    }
  };
  // Use capture so we don't fight with jQuery's blur handlers.
  container.addEventListener('blur', (ev) => { void handler(ev); }, true);
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
  container.addEventListener('keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLElement | null;
    if (!(t instanceof HTMLInputElement)) return;
    const name = t.getAttribute('name') ?? '';
    const m = /^(.+)-(.+)-val$/.exec(name);
    if (!m) return;
    e.preventDefault();
    const coc = m[2];
    // All inputs in the same COC column, in DOM order.
    const column = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        `input[name$="-${coc}-val"]`));
    const idx = column.indexOf(t);
    if (idx === -1) return;
    const target = column[idx + (e.shiftKey ? -1 : 1)];
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
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
function SectionNavigator(
  { targetRef, formVersion }:
  { targetRef: RefObject<HTMLDivElement | null>;
    formVersion: number },
): JSX.Element | null {
  const [entries, setEntries] = useState<Array<{
    id: string; label: string; el: HTMLHeadingElement;
  }>>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Rescan every time the form is re-rendered (dataset / period
  // switch) — the previous <h3>s are torn out and new ones take
  // their place.
  useEffect(() => {
    const root = targetRef.current;
    if (!root) return;
    const hs = Array.from(
      root.querySelectorAll<HTMLHeadingElement>('h3.formSection'));
    const next = hs.map((h, i) => {
      const id = h.id || `der-de-section-${i}`;
      h.id = id;
      return { id, label: (h.textContent ?? '').trim(), el: h };
    }).filter((e) => e.label);
    setEntries(next);
    setActiveId(next[0]?.id ?? '');
  }, [targetRef, formVersion]);

  // Scroll-spy via IntersectionObserver. The topmost section that
  // is at least 40 % visible wins. Fallbacks to the first section
  // if nothing qualifies (e.g. between sections).
  useEffect(() => {
    if (entries.length === 0) return;
    const io = new IntersectionObserver((xs) => {
      // Pick the entry with the largest intersection ratio among
      // those currently crossing the threshold.
      let best: { id: string; ratio: number } | null = null;
      for (const x of xs) {
        if (!x.isIntersecting) continue;
        const id = (x.target as HTMLElement).id;
        if (!id) continue;
        if (!best || x.intersectionRatio > best.ratio) {
          best = { id, ratio: x.intersectionRatio };
        }
      }
      if (best) setActiveId(best.id);
    }, { threshold: [0, 0.2, 0.4, 0.6], rootMargin: '-80px 0px -60% 0px' });
    for (const e of entries) io.observe(e.el);
    return () => io.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <nav className="der-de-section-nav"
         aria-label="Form sections"
         data-test="de-section-nav">
      <div className="der-de-section-nav__title">Sections</div>
      <ul className="der-de-section-nav__list">
        {entries.map((e) => (
          <li key={e.id}>
            <button type="button"
                    className={'der-de-section-nav__item'
                      + (activeId === e.id
                        ? ' der-de-section-nav__item--active' : '')}
                    data-test="de-section-nav-item"
                    onClick={() => {
                      e.el.scrollIntoView({
                        behavior: 'smooth', block: 'start' });
                      setActiveId(e.id);
                    }}>
              {e.label}
            </button>
          </li>
        ))}
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

function runValidation(
  root: HTMLElement | null,
  setStatus: (s: {
    kind: 'ok' | 'error'; message: string;
  }) => void,
): void {
  if (!root) return;
  const g = globalThis as unknown as {
    dhis2?: { de?: { dataElements?: Record<string,
      { valueType?: string }> } };
  };
  const dataElements = g.dhis2?.de?.dataElements ?? {};
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>(
    'input[name$="-val"]'));
  const problems: string[] = [];
  for (const input of inputs) {
    input.style.outline = '';
    const v = input.value.trim();
    if (v === '') continue;
    const m = /^(.+)-(.+)-val$/.exec(input.getAttribute('name') ?? '');
    if (!m) continue;
    const deId = m[1]!;
    const de = dataElements[deId];
    const valueType = de?.valueType ?? 'TEXT';
    const problem = validateByType(v, valueType);
    if (problem) {
      input.style.outline = '2px solid #a93232';
      problems.push(`${de?.valueType ? '' : '(unknown DE) '}`
        + `${deId}: ${problem}`);
    }
  }
  if (problems.length === 0) {
    setStatus({ kind: 'ok', message: `Validation passed — all ${inputs.length} cells OK.` });
  } else {
    setStatus({ kind: 'error',
      message: `Validation found ${problems.length} issue${problems.length === 1 ? '' : 's'}. First: ${problems[0]}` });
  }
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
      categoryOptionCombo?: string; value?: string }> }> },
): Promise<void> {
  if (!dataSet || !period || !orgUnit) return;
  let rows: Array<{ dataElement?: string; categoryOptionCombo?: string; value?: string }>;
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
    if (input) input.value = value;
  }
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
async function applyFormAssets(container: HTMLElement, htmlCode: string): Promise<void> {
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
  borderRadius: 2, fontSize: 13, fontFamily: 'inherit',
};
const primaryBtn = {
  padding: '6px 16px', border: '1px solid #1f4d70',
  background: '#2c6693', color: '#fff',
  borderRadius: 2, fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const secondaryBtn = {
  padding: '6px 16px', border: '1px solid #c0c7cf',
  background: '#fff', color: '#2c3e4c',
  borderRadius: 2, fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const okStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#e8f4ee', color: '#136436',
  border: '1px solid #b7dcc7', borderRadius: 3,
};
const errorStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#fbeaea', color: '#8a2525',
  border: '1px solid #e0bcbc', borderRadius: 3,
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
): JSX.Element {
  const common = { ...inputStyle } as React.CSSProperties;
  const baseOptions = buildPeriodOptions(periodType);
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
          <option key={o.id} value={o.id}>{o.label}</option>
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
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
function buildPeriodOptions(periodType?: string): Array<{ id: string; label: string }> {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const pad = (n: number) => String(n).padStart(2, '0');
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  switch (periodType) {
    case 'Daily': {
      const out: Array<{ id: string; label: string }> = [];
      for (let i = 0; i < 30; i++) {
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
      for (let i = 0; i < 12; i++) {
        out.push({ id: `${wy}W${wk}`, label: `${wy} W${pad(wk)}` });
        wk -= 1;
        if (wk < 1) { wy -= 1; wk = isoWeeksInYear(wy); }
      }
      return out;
    }
    case 'Monthly': {
      const out: Array<{ id: string; label: string }> = [];
      for (let i = 0; i < 24; i++) {
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
      for (let i = 0; i < 10; i++) {
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
.der-de-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 12px 0 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(140%) blur(6px);
  border: 1px solid #eef0f3;
  border-radius: 8px;
  /* ADR-0037 §1.2 — sticky context strip so the operator always
   * sees which dataset/period/OU/AOC they are editing, even when
   * scrolling long section forms. 56 px matches the shell topbar
   * height so the two stack cleanly. */
  position: sticky;
  top: 56px;
  z-index: 5;
}
.der-de-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 3px;
}
.der-de-chip-signed {
  background: #f3f5f7;
}
.der-de-chip-label {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6e7a8a;
  font-weight: 500;
}
.der-de-chip-value {
  font-size: 13px;
  color: #212934;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.der-de-select,
.der-de-period-wrap > * {
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid #d7dde5;
  border-radius: 2px;
  background: #fff;
  color: #212934;
  width: 100%;
  font-family: inherit;
}
.der-de-select:focus,
.der-de-period-wrap > *:focus {
  outline: none;
  border-color: #2c6693;
}
.der-de-period-nav {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  width: 100%;
}
.der-de-period-nav select {
  flex: 1 1 auto;
}
.der-de-period-btn {
  background: #fff;
  border: 1px solid #d7dde5;
  color: #2c6693;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 2px;
  line-height: 1;
}
.der-de-period-btn:hover:not(:disabled) {
  background: #e4edf6;
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
.der-de-form-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #d7dde5;
  border-radius: 3px;
}
.der-de-actionbar {
  position: sticky;
  bottom: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: saturate(140%) blur(6px);
  border: 1px solid #eef0f3;
  border-radius: 8px;
  box-shadow: 0 -2px 6px rgba(28, 46, 70, 0.04);
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
    gap: 24px;
    align-items: start;
  }
  .der-de-section-nav {
    display: block;
    position: sticky;
    top: 80px;
    align-self: start;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding: 12px 8px;
    background: #fafbfc;
    border: 1px solid #eef0f3;
    border-radius: 6px;
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
  display: block;
  width: 100%;
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
.der-de-section-nav__item:hover {
  background: #eef0f3;
}
.der-de-section-nav__item--active {
  background: #eef4fa;
  border-left-color: #2c6693;
  color: #1f4d70;
  font-weight: 500;
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
  font-size: 13px;
}
.der-de-form-card .sectionTable th,
.der-de-form-card .sectionTable td {
  border: 1px solid #d7dde5;
  padding: 6px 8px;
  text-align: left;
  vertical-align: middle;
}
.der-de-form-card .sectionTable th {
  background: #f3f5f7;
  font-weight: 500;
  color: #404b5a;
}
.der-de-form-card .sectionTable .dataElementCell {
  background: #f8fafc;
  min-width: 220px;
}
.der-de-form-card .sectionTable .indicatorRow td {
  background: #fcf7e6;
  font-weight: 500;
}
.der-de-form-card .sectionTable .greyed {
  background: #eef0f3;
  color: #9aa3b0;
  text-align: center;
}
.der-de-form-card .sectionTable input[type="text"] {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 2px 4px;
  font-size: 13px;
  color: #212934;
  font-family: inherit;
}
.der-de-form-card .sectionTable input[type="text"]:focus {
  outline: 1px solid #2c6693;
  background: #fff;
}
.der-de-form-card h3.formSection {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
  color: #1f4d70;
  border-bottom: 1px solid #d7dde5;
  padding-bottom: 4px;
}
`;

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: active ? '#2c6693' : 'transparent',
    color: active ? '#fff' : '#2c6693',
    border: '1px solid #2c6693',
    borderRadius: 2, fontSize: 13, cursor: 'pointer',
  };
}
