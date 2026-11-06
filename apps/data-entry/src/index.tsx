import { useEffect, useRef, useState, type FormEvent } from 'react';
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

  const [mode, setMode] = useState<Mode>('structured');
  const [dataSet, setDataSet] = useState('');
  const [period, setPeriod] = useState('');
  const [dataElement, setDataElement] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [formInfo, setFormInfo] = useState<{
    hasCustomForm: boolean; formId?: string; displayName?: string;
    formType?: string;
  } | null>(null);
  const customRoot = useRef<HTMLDivElement | null>(null);

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
          formType?: string;
          dataEntryForm?: { id: string } | null;
        };
        if (cancelled) return;
        setFormInfo({
          hasCustomForm: !!meta.dataEntryForm && meta.formType === 'CUSTOM',
          formId: meta.dataEntryForm?.id,
          displayName: meta.displayName ?? meta.name,
          formType: meta.formType,
        });
      } catch { if (!cancelled) setFormInfo(null); }
    })();
    return () => { cancelled = true; };
  }, [dataSet, api]);

  // Mount the DHIS2 custom form when the user switches to custom
  // mode and the dataset has one. Loads vendor scripts in sequence,
  // seeds DHIS2 globals + hidden selectors, then injects htmlCode.
  useEffect(() => {
    if (mode !== 'custom' || !formInfo?.hasCustomForm || !formInfo.formId) return;
    const root = customRoot.current;
    if (!root) return;
    let cancelled = false;

    (async () => {
      setStatus({ kind: 'submitting' });
      try {
        const form = await api.getDataEntryFormHtml(formInfo.formId!) as {
          htmlCode?: string;
        };
        if (cancelled) return;
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
        // The form's content lands here — DHIS2's entry.js expects
        // #contentDiv as the root selector.
        const content = document.createElement('div');
        content.id = 'contentDiv';
        root.appendChild(content);
        // Global DHIS2 namespace — seed selections.
        const g = globalThis as unknown as { dhis2?: Record<string, unknown> };
        g.dhis2 = g.dhis2 ?? {};
        const dhis2 = g.dhis2 as Record<string, Record<string, unknown>>;
        dhis2.de = dhis2.de ?? {};
        dhis2.de.currentDataSetId = dataSet.trim();
        dhis2.de.currentOrganisationUnitId = ou.orgUnitUid ?? '';
        dhis2.de.currentPeriodId = period.trim();

        // Vendor CSS baseline (DHIS2's own stack) first so the form
        // renders styled on first paint.
        for (const href of VENDOR_STYLES) loadStyle(href);
        for (const src of VENDOR_SCRIPTS) {
          if (document.querySelector(`script[data-der-custom-form="${src}"]`)) continue;
          await loadScript(src);
        }
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
        await applyFormAssets(content, form.htmlCode ?? '');
        setStatus({ kind: 'ok',
          message: 'Custom form loaded. Autosave + validation run as in DHIS2.' });
      } catch (e) {
        setStatus({ kind: 'error',
          message: `custom form failed to render: ${(e as Error).message}` });
      }
    })();
    return () => { cancelled = true; };
  }, [mode, formInfo, dataSet, period, ou.orgUnitUid, api]);

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

  return (
    <ScreenCard
      title={formInfo?.displayName ?? 'Aggregate data entry'}
      actions={
        <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
          {online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`}
        </StatusPill>
      }
    >
      <p style={{ margin: 0, color: '#6e7a8a', fontSize: 13 }}>
        Signed in as <strong>{auth.displayName}</strong> • Bound OU
        <code style={{ marginInline: 6 }}>{ou.orgUnitPath}</code>
      </p>

      <div style={{ display: 'flex', gap: 2, margin: '12px 0 16px' }}>
        <button type="button" onClick={() => setMode('structured')}
                style={tabBtn(mode === 'structured')}>
          Structured
        </button>
        <button type="button" onClick={() => setMode('custom')}
                disabled={!formInfo?.hasCustomForm}
                title={formInfo?.hasCustomForm ? ''
                  : (formInfo?.formType
                      ? `Dataset formType is ${formInfo.formType}; custom form unavailable`
                      : 'Enter a dataset UID to detect the form')}
                style={tabBtn(mode === 'custom')}>
          Custom form {formInfo && !formInfo.hasCustomForm && <span>·&nbsp;unavailable</span>}
        </button>
      </div>

      {status.kind === 'ok' && (
        <div style={okStrip}>{status.message}</div>
      )}
      {status.kind === 'error' && (
        <div style={errorStrip}>{status.message}</div>
      )}

      {mode === 'structured' && (
        <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>Data set UID
            <input value={dataSet} onChange={(e) => setDataSet(e.target.value)}
                   placeholder="e.g. BfMAe6Itzgt" style={inputStyle} />
          </label>
          <label>Period (ISO)
            <input value={period} onChange={(e) => setPeriod(e.target.value)}
                   placeholder="e.g. 202611" style={inputStyle} />
          </label>
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

      {mode === 'custom' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 12, marginBottom: 12 }}>
            <label>Data set UID
              <input value={dataSet} onChange={(e) => setDataSet(e.target.value)}
                     placeholder="e.g. BfMAe6Itzgt" style={inputStyle} />
            </label>
            <label>Period
              <input value={period} onChange={(e) => setPeriod(e.target.value)}
                     placeholder="e.g. 202611" style={inputStyle} />
            </label>
          </div>
          <div ref={customRoot}
               data-test="der-de-custom-form"
               className="der-de-custom-form" />
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
function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: active ? '#2c6693' : 'transparent',
    color: active ? '#fff' : '#2c6693',
    border: '1px solid #2c6693',
    borderRadius: 2, fontSize: 13, cursor: 'pointer',
  };
}
