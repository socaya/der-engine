import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel } from './shared';

type Layout = edgeApi.SignInLayoutKind | '';

/**
 * EA Login appearance — admin configures the DER device-client
 * sign-in page (title, intro, button label, background image and
 * layout).
 *
 * Writes go to `/edge-api/v1/admin/signin-settings` + `…/background`.
 * Public reads at `/edge-api/v1/public/signin-settings` are what
 * each device fetches on mount. Device operators can still override
 * any field per-device via `localStorage.*`.
 */
export function LoginAppearance(): JSX.Element {
  const [loaded, setLoaded] = useState<edgeApi.SignInSettings | null>(null);
  const [layout, setLayout] = useState<Layout>('');
  const [appTitle, setAppTitle] = useState('');
  const [appIntro, setAppIntro] = useState('');
  const [submitLabel, setSubmitLabel] = useState('');
  const [footerHtml, setFooterHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload(): Promise<void> {
    try {
      const s = await edgeApi.readSignInSettings();
      setLoaded(s);
      setLayout((s.layout ?? '') as Layout);
      setAppTitle(s.appTitle ?? '');
      setAppIntro(s.appIntro ?? '');
      setSubmitLabel(s.submitLabel ?? '');
      setFooterHtml(s.footerHtml ?? '');
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }
  useEffect(() => { void reload(); }, []);

  function refreshPreview(): void {
    setPreviewKey((k) => k + 1);
  }

  async function onSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await edgeApi.updateSignInSettings({
        layout: (layout === '' ? null : layout),
        appTitle: appTitle.trim() === '' ? null : appTitle,
        appIntro: appIntro.trim() === '' ? null : appIntro,
        submitLabel: submitLabel.trim() === '' ? null : submitLabel,
        footerHtml: footerHtml.trim() === '' ? null : footerHtml,
      });
      setMsg({ kind: 'ok', text: 'Login page saved. Device clients will pick it up on next sign-in page load.' });
      await reload();
      refreshPreview();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      await edgeApi.uploadSignInBackground(file);
      setMsg({ kind: 'ok', text: `Uploaded ${file.name} as the sign-in background.` });
      await reload();
      refreshPreview();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onClearBackground(): Promise<void> {
    setMsg(null);
    try {
      await edgeApi.clearSignInBackground();
      setMsg({ kind: 'ok', text: 'Background cleared — device clients fall back to the bundled default.' });
      await reload();
      refreshPreview();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  return (
    <div
      data-test="ea-login-appearance"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 560px) 1fr', gap: 24 }}
    >
      <div>
        <Panel title="Login page appearance">
          <p className="ea-text-muted" style={{ marginTop: 0 }}>
            Applies to every device client on next sign-in page load.
            Device operators can still override per-device.
          </p>
          {msg && (
            <div
              className={msg.kind === 'err' ? 'ea-notice ea-notice--error' : 'ea-notice ea-notice--ok'}
              role="status"
              data-test="login-appearance-msg"
              style={{ padding: '8px 12px', marginBottom: 12,
                       border: '1px solid',
                       borderColor: msg.kind === 'err' ? '#a93232' : '#1a8754',
                       background: msg.kind === 'err' ? '#fdecec' : '#ecf7ef',
                       color: msg.kind === 'err' ? '#6b1f1f' : '#0f4e2d' }}
            >
              {msg.text}
            </div>
          )}
          <form onSubmit={onSave}>
            <label className="ea-label" htmlFor="la-layout">Layout</label>
            <select
              id="la-layout"
              className="ea-input"
              value={layout}
              onChange={(e) => setLayout(e.target.value as Layout)}
              data-test="layout-select"
              style={{ marginBottom: 12, width: '100%' }}
            >
              <option value="">Use client default (sidebar)</option>
              <option value="sidebar">Sidebar — DHIS2-style (recommended)</option>
              <option value="standard">Standard — heading + centered card</option>
              <option value="hero">Hero — full-bleed image + card</option>
              <option value="marketing">Marketing — split image + floating card</option>
            </select>

            <label className="ea-label" htmlFor="la-title">Application title</label>
            <input
              id="la-title"
              className="ea-input"
              value={appTitle}
              onChange={(e) => setAppTitle(e.target.value)}
              data-test="app-title"
              style={{ marginBottom: 12, width: '100%' }}
            />

            <label className="ea-label" htmlFor="la-intro">Application intro</label>
            <textarea
              id="la-intro"
              className="ea-input"
              value={appIntro}
              onChange={(e) => setAppIntro(e.target.value)}
              rows={3}
              data-test="app-intro"
              style={{ marginBottom: 12, width: '100%' }}
            />

            <label className="ea-label" htmlFor="la-submit">Sign-in button label</label>
            <input
              id="la-submit"
              className="ea-input"
              value={submitLabel}
              onChange={(e) => setSubmitLabel(e.target.value)}
              data-test="submit-label"
              style={{ marginBottom: 12, width: '100%' }}
              placeholder="Sign in"
            />

            <label className="ea-label" htmlFor="la-footer">Footer (HTML allowed)</label>
            <textarea
              id="la-footer"
              className="ea-input"
              value={footerHtml}
              onChange={(e) => setFooterHtml(e.target.value)}
              rows={3}
              data-test="footer-html"
              style={{ marginBottom: 16, width: '100%' }}
            />

            <button
              type="submit"
              className="ea-btn ea-btn--primary"
              disabled={saving}
              data-test="save-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </Panel>

        <Panel title="Background image">
          <p className="ea-text-muted" style={{ marginTop: 0 }}>
            PNG, JPG, SVG or WebP. Max 2 MB.
          </p>
          <div style={{ marginBottom: 12 }}>
            {loaded?.hasBackground && loaded.backgroundUrl ? (
              <img
                src={`${loaded.backgroundUrl}?v=${loaded.backgroundEtag ?? ''}`}
                alt="Current background"
                style={{ maxWidth: '100%', height: 140, objectFit: 'cover',
                         border: '1px solid #d7dde5' }}
                data-test="current-bg"
              />
            ) : (
              <p className="ea-text-muted" style={{ margin: 0 }}>
                No custom background set — device clients show the bundled default.
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={onUpload}
            disabled={uploading}
            data-test="bg-file"
          />
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ea-btn ea-btn--danger"
              disabled={!loaded?.hasBackground}
              onClick={onClearBackground}
              data-test="clear-bg-btn"
            >
              Remove background
            </button>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title="Preview">
          <p className="ea-text-muted" style={{ marginTop: 0 }}>
            Live view of the sign-in screen with the saved settings.
          </p>
          <iframe
            key={previewKey}
            title="Sign-in preview"
            src="/sign-in"
            data-test="login-preview"
            style={{ width: '100%', height: 640, border: '1px solid #d7dde5' }}
          />
        </Panel>
      </div>
    </div>
  );
}
