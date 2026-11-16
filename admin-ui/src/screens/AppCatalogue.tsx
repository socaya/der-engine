import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import * as edgeApi from '../api/edgeApi';
import * as manifestParser from './parseAppManifest';
import type { ParsedKind, ParsedManifest } from './parseAppManifest';
import { Panel, RowMenu } from './shared';

/**
 * EA App catalogue — admin installs, upgrades, enables/disables and
 * deletes the deep-link app bundles served to each device client.
 *
 * Reads at `GET /edge-api/v1/apps`. Mutating calls hit
 * `POST /edge-api/v1/admin/apps/...` and `DELETE /.../:appId`. The
 * server signs bundles on write — the admin-ui just posts raw bytes.
 */
export function AppCatalogue(): JSX.Element {
  const [apps, setApps] = useState<edgeApi.AppCatalogueEntry[]>([]);
  const [dhis2Apps, setDhis2Apps] = useState<edgeApi.InstalledDhis2App[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Optimistic enable/disable overlay. Cleared on reload (server state wins).
  const [disabledIds, setDisabledIds] = useState<ReadonlySet<string>>(new Set());

  // App Hub browser state. Opened on-demand to avoid calling App Hub
  // on every catalogue page load — some pilot sites are air-gapped.
  const [hubOpen, setHubOpen] = useState(false);
  const [hubApps, setHubApps] = useState<edgeApi.AppHubListing[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubInstallingKey, setHubInstallingKey] = useState<string | null>(null);

  // Install form state
  const [installOpen, setInstallOpen] = useState(false);
  const [installAppKey, setInstallAppKey] = useState('');
  const [installDisplayName, setInstallDisplayName] = useState('');
  const [installModule, setInstallModule] = useState('');
  const [installVersion, setInstallVersion] = useState('');
  const [installRequires, setInstallRequires] = useState('');
  const [installBusy, setInstallBusy] = useState(false);
  const installFileRef = useRef<HTMLInputElement>(null);
  // Classification of the currently-selected install file. Drives
  // which endpoint the submit posts to and which form fields to
  // show. `unknown` = no file yet (or an unrecognised layout) — the
  // form falls back to the signed-bundle contract so the admin can
  // hand-fill if they insist.
  const [installKind, setInstallKind] = useState<ParsedKind>('unknown');
  const [installPreview, setInstallPreview] = useState<ParsedManifest>({});

  // Upgrade dialog — scoped to one row at a time
  const [upgradeFor, setUpgradeFor] = useState<string | null>(null);
  const [upgradeVersion, setUpgradeVersion] = useState('');
  const [upgradeRequires, setUpgradeRequires] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const upgradeFileRef = useRef<HTMLInputElement>(null);

  async function reload(): Promise<void> {
    try {
      // Fetch both lists in parallel so a slow one doesn't delay
      // the other. Signed-bundle failures are fatal (something's
      // very wrong); DHIS2-list failures just log and show empty
      // because they're the newer surface.
      const [sig, dhis2] = await Promise.allSettled([
        edgeApi.listApps(),
        edgeApi.listDhis2Apps(),
      ]);
      if (sig.status === 'fulfilled') {
        setApps(sig.value.apps);
      } else {
        setMsg({ kind: 'err', text: (sig.reason as Error).message });
      }
      if (dhis2.status === 'fulfilled') {
        setDhis2Apps(dhis2.value);
      } else {
        setDhis2Apps([]);
      }
      setDisabledIds(new Set());
      setLoaded(true);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }
  useEffect(() => { void reload(); }, []);

  async function reloadHub(): Promise<void> {
    setHubLoading(true);
    setHubError(null);
    try {
      const r = await edgeApi.listAppHubApps();
      setHubApps(r);
    } catch (err) {
      setHubError((err as Error).message);
      setHubApps([]);
    } finally {
      setHubLoading(false);
    }
  }

  async function onInstallFromHub(row: edgeApi.AppHubListing): Promise<void> {
    setHubInstallingKey(row.appKey);
    setMsg(null);
    try {
      await edgeApi.installDhis2AppFromHub(row.downloadUrl);
      setMsg({ kind: 'ok',
               text: `Installed ${row.displayName} ${row.version} from App Hub.` });
      await reload();
      await reloadHub();
    } catch (err) {
      setMsg({ kind: 'err',
               text: `App Hub install failed: ${(err as Error).message}` });
    } finally {
      setHubInstallingKey(null);
    }
  }

  async function onDeleteDhis2(app: edgeApi.InstalledDhis2App): Promise<void> {
    if (!window.confirm(`Uninstall DHIS2 app "${app.displayName}"?`)) {
      return;
    }
    setMsg(null);
    try {
      await edgeApi.uninstallDhis2App(app.appId);
      setMsg({ kind: 'ok', text: `Uninstalled ${app.displayName}.` });
      await reload();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  function resetInstallForm(): void {
    setInstallAppKey('');
    setInstallDisplayName('');
    setInstallModule('');
    setInstallVersion('');
    setInstallRequires('');
    setInstallKind('unknown');
    setInstallPreview({});
    if (installFileRef.current) installFileRef.current.value = '';
  }

  /** On file-select, inspect the archive to decide which install
   *  flow this bundle maps to, then auto-fill the signed-bundle
   *  form fields when relevant. Never overwrites an admin-typed
   *  value — operator intent wins. */
  async function onInstallFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) {
      setInstallKind('unknown');
      setInstallPreview({});
      return;
    }
    const parsed = await manifestParser.parseAppManifest(file);
    setInstallKind(parsed.kind);
    setInstallPreview(parsed.fields);
    // DHIS2 flow: fields are informational only (the server reads
    // manifest.webapp itself); skip auto-fill of the signed-bundle
    // inputs since they won't be submitted.
    if (parsed.kind !== 'signed') return;
    const mf = parsed.fields;
    if (mf.appKey && installAppKey === '') setInstallAppKey(mf.appKey);
    if (mf.displayName && installDisplayName === '') setInstallDisplayName(mf.displayName);
    if (mf.module && installModule === '') setInstallModule(mf.module);
    if (mf.version && installVersion === '') setInstallVersion(mf.version);
    if (mf.requiresDerApi && installRequires === '') setInstallRequires(mf.requiresDerApi);
  }

  function resetUpgradeForm(): void {
    setUpgradeFor(null);
    setUpgradeVersion('');
    setUpgradeRequires('');
    if (upgradeFileRef.current) upgradeFileRef.current.value = '';
  }

  async function onInstall(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const file = installFileRef.current?.files?.[0];
    if (!file) {
      setMsg({ kind: 'err', text: 'Choose a bundle file to install.' });
      return;
    }
    setInstallBusy(true);
    setMsg(null);
    try {
      if (installKind === 'dhis2') {
        // ADR-0005 path — server parses manifest.webapp itself;
        // we post the raw file and let it serve at
        // `/dhis-web-<appKey>/**`.
        await edgeApi.installDhis2App(file);
        const name = installPreview.displayName
                  || installPreview.appKey
                  || file.name;
        setMsg({ kind: 'ok',
                 text: `Installed DHIS2 app "${name}". Served at /dhis-web-${
                         installPreview.appKey ?? '<key>'}/.` });
      } else {
        // ADR-0037 signed-bundle path.
        await edgeApi.installApp({
          file,
          appKey: installAppKey.trim(),
          displayName: installDisplayName.trim(),
          module: installModule.trim() === '' ? null : installModule.trim(),
          version: installVersion.trim(),
          requiresDerApi: installRequires.trim(),
        });
        setMsg({ kind: 'ok',
                 text: `Installed ${installDisplayName || installAppKey}.` });
      }
      resetInstallForm();
      setInstallOpen(false);
      await reload();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setInstallBusy(false);
    }
  }

  async function onUpgrade(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const file = upgradeFileRef.current?.files?.[0];
    const appId = upgradeFor;
    if (!appId || !file) {
      setMsg({ kind: 'err', text: 'Choose a bundle file to upgrade.' });
      return;
    }
    setUpgradeBusy(true);
    setMsg(null);
    try {
      await edgeApi.upgradeApp(appId, {
        file,
        version: upgradeVersion.trim(),
        requiresDerApi: upgradeRequires.trim(),
      });
      setMsg({ kind: 'ok', text: `Upgraded ${appId} to ${upgradeVersion}.` });
      resetUpgradeForm();
      await reload();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function onToggle(entry: edgeApi.AppCatalogueEntry): Promise<void> {
    const currentlyDisabled = disabledIds.has(entry.appId);
    // Optimistic flip
    const nextSet = new Set(disabledIds);
    if (currentlyDisabled) nextSet.delete(entry.appId);
    else nextSet.add(entry.appId);
    setDisabledIds(nextSet);
    setMsg(null);
    try {
      if (currentlyDisabled) await edgeApi.enableApp(entry.appId);
      else await edgeApi.disableApp(entry.appId);
      setMsg({ kind: 'ok',
        text: currentlyDisabled
          ? `Enabled ${entry.displayName}.`
          : `Disabled ${entry.displayName}.` });
      await reload();
    } catch (err) {
      // Roll the optimistic flip back
      setDisabledIds(disabledIds);
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function onDelete(entry: edgeApi.AppCatalogueEntry): Promise<void> {
    const ok = typeof window !== 'undefined' && window.confirm(
      `Delete ${entry.displayName}? Device clients will lose this app on next catalogue refresh.`);
    if (!ok) return;
    setMsg(null);
    try {
      await edgeApi.deleteApp(entry.appId);
      setMsg({ kind: 'ok', text: `Deleted ${entry.displayName}.` });
      await reload();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  function onPickUpgrade(entry: edgeApi.AppCatalogueEntry): void {
    setUpgradeFor(entry.appId);
    setUpgradeVersion('');
    setUpgradeRequires(entry.requiresDerApi);
    if (upgradeFileRef.current) upgradeFileRef.current.value = '';
  }

  return (
    <div data-test="ea-app-catalogue">
      <Panel
        title="App catalogue"
        action={
          <button
            type="button"
            className="ea-btn ea-btn--primary"
            onClick={() => { setInstallOpen((v) => !v); setMsg(null); }}
            data-test="install-open-btn"
          >
            {installOpen ? 'Close' : 'Install app'}
          </button>
        }
      >
        <p className="ea-text-muted" style={{ marginTop: 0 }}>
          Bundles signed by the edge on write. Device clients fetch the
          catalogue on launch and cache each bundle by SHA-256.
        </p>
        {msg && (
          <div
            className={msg.kind === 'err' ? 'ea-notice ea-notice--error' : 'ea-notice ea-notice--ok'}
            role="status"
            data-test="app-catalogue-msg"
            style={{ padding: '8px 12px', marginBottom: 12,
                     border: '1px solid',
                     borderColor: msg.kind === 'err' ? '#a93232' : '#1a8754',
                     background: msg.kind === 'err' ? '#fdecec' : '#ecf7ef',
                     color: msg.kind === 'err' ? '#6b1f1f' : '#0f4e2d' }}
          >
            {msg.text}
          </div>
        )}

        {installOpen && (
          <form
            onSubmit={onInstall}
            data-test="install-form"
            style={{ border: '1px solid #d7dde5', borderRadius: 6,
                     padding: 12, marginBottom: 16 }}
          >
            <div>
              <label className="ea-label" htmlFor="install-file">Bundle file</label>
              <input
                id="install-file"
                ref={installFileRef}
                type="file"
                accept=".zip,application/zip,.js,.mjs,application/javascript,text/javascript"
                data-test="install-file"
                onChange={(e) => void onInstallFileChange(e)}
                style={{ width: '100%' }}
              />
              <p className="ea-text-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Accepts DHIS2 custom apps (<code>.zip</code> with
                <code> manifest.webapp</code> at root, ADR-0005) and
                DER-native signed bundles (<code>.js</code>/<code>.mjs</code>
                or <code>.zip</code> with <code>bundle.js</code>, ADR-0037).
                The flow is picked from the archive contents.
              </p>
            </div>

            {installKind === 'dhis2' && (
              <div
                className="ea-notice ea-notice--ok"
                role="status"
                data-test="install-kind-dhis2"
                style={{ padding: '10px 12px', marginTop: 12,
                         border: '1px solid #1a8754',
                         background: '#ecf7ef', color: '#0f4e2d' }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  ✓ DHIS2 custom app detected
                </div>
                <div style={{ fontSize: 13 }}>
                  <code>manifest.webapp</code> at root. Posts to{' '}
                  <code>/edge-api/v1/apps/install</code>; will serve at{' '}
                  <code>
                    /dhis-web-{installPreview.appKey ?? '&lt;key&gt;'}/
                  </code>.
                </div>
                {(installPreview.appKey || installPreview.displayName
                    || installPreview.version) && (
                  <ul style={{ margin: '6px 0 0 18px', fontSize: 13 }}>
                    {installPreview.appKey && (
                      <li data-test="install-preview-appkey">
                        name: <code>{installPreview.appKey}</code>
                      </li>
                    )}
                    {installPreview.displayName && (
                      <li data-test="install-preview-displayname">
                        displayName: {installPreview.displayName}
                      </li>
                    )}
                    {installPreview.version && (
                      <li data-test="install-preview-version">
                        version: <code>{installPreview.version}</code>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {installKind !== 'dhis2' && (
              <div style={{ display: 'grid',
                            gridTemplateColumns: '1fr 1fr', gap: 12,
                            marginTop: 12 }}
                   data-test="install-signed-fields">
                <div>
                  <label className="ea-label" htmlFor="install-app-key">App key</label>
                  <input
                    id="install-app-key"
                    className="ea-input"
                    value={installAppKey}
                    onChange={(e) => setInstallAppKey(e.target.value)}
                    required
                    data-test="install-app-key"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="ea-label" htmlFor="install-display-name">Display name</label>
                  <input
                    id="install-display-name"
                    className="ea-input"
                    value={installDisplayName}
                    onChange={(e) => setInstallDisplayName(e.target.value)}
                    required
                    data-test="install-display-name"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="ea-label" htmlFor="install-module">Module (optional)</label>
                  <input
                    id="install-module"
                    className="ea-input"
                    value={installModule}
                    onChange={(e) => setInstallModule(e.target.value)}
                    data-test="install-module"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="ea-label" htmlFor="install-version">Version</label>
                  <input
                    id="install-version"
                    className="ea-input"
                    value={installVersion}
                    onChange={(e) => setInstallVersion(e.target.value)}
                    required
                    data-test="install-version"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="ea-label" htmlFor="install-requires">Requires DER API</label>
                  <input
                    id="install-requires"
                    className="ea-input"
                    value={installRequires}
                    onChange={(e) => setInstallRequires(e.target.value)}
                    required
                    data-test="install-requires"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button
                type="submit"
                className="ea-btn ea-btn--primary"
                disabled={installBusy}
                data-test="install-submit-btn"
              >
                {installBusy ? 'Installing...' : 'Install'}
              </button>
              <button
                type="button"
                className="ea-btn"
                onClick={() => { resetInstallForm(); setInstallOpen(false); }}
                style={{ marginLeft: 8 }}
                data-test="install-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loaded && apps.length === 0 && dhis2Apps.length === 0 ? (
          <p className="ea-text-muted" data-test="empty-state">
            No apps installed yet. Use Install app to add one,
            or Browse App Hub to pick from the public catalogue.
          </p>
        ) : apps.length === 0 ? null : (
          <table
            className="ea-table"
            data-test="apps-table"
            style={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>App</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Version</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Requires DER API</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>SHA-256</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const disabled = disabledIds.has(a.appId);
                return (
                  <tr key={a.appId} data-test={`app-row-${a.appId}`}>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{a.displayName}</div>
                      {a.module && (
                        <div className="ea-text-muted ea-text-xs">
                          {a.module}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px' }}
                        data-test={`type-${a.appId}`}>
                      <span style={{ fontSize: 12, padding: '2px 6px',
                                     borderRadius: 10,
                                     background: '#e6effb',
                                     color: '#1b4a7a' }}>
                        DER (signed)
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px' }}>{a.version}</td>
                    <td style={{ padding: '6px 8px' }}>{a.requiresDerApi}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <code title={a.bundleSha256} data-test={`sha-${a.appId}`}>
                        {a.bundleSha256.slice(0, 10)}
                      </code>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}
                        data-test={`row-actions-${a.appId}`}>
                      <RowMenu
                        items={[
                          { label: 'Upgrade',
                            onSelect: () => onPickUpgrade(a) },
                          { label: disabled ? 'Enable' : 'Disable',
                            onSelect: () => { void onToggle(a); } },
                          { label: 'Delete',
                            onSelect: () => { void onDelete(a); },
                            danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ADR-0005 DHIS2 custom apps — separate storage from the
            signed-bundle catalogue above; the merge is cosmetic for
            the operator. */}
        {dhis2Apps.length > 0 && (
          <div style={{ marginTop: 20 }}
               data-test="dhis2-apps-section">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              DHIS2 custom apps (ADR-0005)
            </div>
            <p className="ea-text-muted" style={{ marginTop: 0, fontSize: 13 }}>
              Served at <code>/dhis-web-&lt;appKey&gt;/</code>.
              Listed by <code>/api/apps</code> for DHIS2 discovery.
            </p>
            <table
              className="ea-table"
              data-test="dhis2-apps-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>App</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Version</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Deep-link</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dhis2Apps.map((a) => (
                  <tr key={a.appId} data-test={`dhis2-app-row-${a.appKey}`}>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{a.displayName}</div>
                      <div className="ea-text-muted ea-text-xs">
                        {a.appKey}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px' }}
                        data-test={`dhis2-type-${a.appKey}`}>
                      <span style={{ fontSize: 12, padding: '2px 6px',
                                     borderRadius: 10,
                                     background: '#e6f4ea',
                                     color: '#276a3f' }}>
                        DHIS2
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px' }}>{a.version}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <a href={`/dhis-web-${a.appKey}/`}
                         target="_blank" rel="noopener noreferrer"
                         data-test={`dhis2-open-${a.appKey}`}>
                        Open ↗
                      </a>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}
                        data-test={`dhis2-row-actions-${a.appKey}`}>
                      <RowMenu
                        items={[
                          { label: 'Open',
                            onSelect: () => {
                              window.open(`/dhis-web-${a.appKey}/`,
                                '_blank', 'noopener,noreferrer');
                            } },
                          { label: 'Uninstall',
                            onSelect: () => { void onDeleteDhis2(a); },
                            danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DHIS2 App Hub browser — opt-in because we don't want to
            call the public hub on every catalogue page load (pilot
            sites may be air-gapped). */}
        <div style={{ marginTop: 20 }} data-test="apphub-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>DHIS2 App Hub</div>
            <button
              type="button"
              className="ea-btn"
              data-test="apphub-toggle-btn"
              onClick={() => {
                const next = !hubOpen;
                setHubOpen(next);
                if (next && hubApps.length === 0) void reloadHub();
              }}
            >
              {hubOpen ? 'Hide App Hub' : 'Browse App Hub'}
            </button>
            {hubOpen && (
              <button
                type="button"
                className="ea-btn"
                data-test="apphub-refresh-btn"
                onClick={() => void reloadHub()}
                disabled={hubLoading}
              >
                {hubLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
          {hubOpen && (
            <div style={{ marginTop: 10, border: '1px solid #d7dde5',
                          borderRadius: 6, padding: 12 }}>
              {hubError && (
                <div
                  className="ea-notice ea-notice--error"
                  role="alert"
                  data-test="apphub-error"
                  style={{ padding: '8px 12px', marginBottom: 8,
                           border: '1px solid #a93232',
                           background: '#fdecec', color: '#6b1f1f' }}
                >
                  {hubError}
                </div>
              )}
              {hubLoading && !hubError && (
                <div className="ea-text-muted" data-test="apphub-loading">
                  Loading App Hub catalogue...
                </div>
              )}
              {!hubLoading && !hubError && hubApps.length === 0 && (
                <div className="ea-text-muted" data-test="apphub-empty">
                  No compatible apps from App Hub for this DHIS2 version.
                </div>
              )}
              {hubApps.length > 0 && (
                <table
                  className="ea-table"
                  data-test="apphub-table"
                  style={{ width: '100%', borderCollapse: 'collapse' }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>App</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Available</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Installed</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hubApps.map((row) => {
                      const installing = hubInstallingKey === row.appKey;
                      const alreadyAtThis = row.installedVersion === row.version;
                      const label = row.installedVersion
                        ? (alreadyAtThis ? 'Installed'
                                          : `Upgrade to ${row.version}`)
                        : 'Install';
                      return (
                        <tr key={row.appKey}
                            data-test={`apphub-row-${row.appKey}`}>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontWeight: 600 }}>{row.displayName}</div>
                            <div className="ea-text-muted ea-text-xs">
                              {row.appKey}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.version}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {row.installedVersion ?? '—'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="ea-btn ea-btn--primary"
                              onClick={() => void onInstallFromHub(row)}
                              disabled={installing || alreadyAtThis}
                              data-test={`apphub-install-btn-${row.appKey}`}
                            >
                              {installing ? 'Installing...' : label}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {upgradeFor && (
          <form
            onSubmit={onUpgrade}
            data-test="upgrade-form"
            style={{ marginTop: 16, border: '1px solid #d7dde5',
                     borderRadius: 6, padding: 12 }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Upgrade {upgradeFor}
            </div>
            <div style={{ display: 'grid',
                          gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="ea-label" htmlFor="upgrade-version">New version</label>
                <input
                  id="upgrade-version"
                  className="ea-input"
                  value={upgradeVersion}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setUpgradeVersion(e.target.value)}
                  required
                  data-test="upgrade-version"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="ea-label" htmlFor="upgrade-requires">Requires DER API</label>
                <input
                  id="upgrade-requires"
                  className="ea-input"
                  value={upgradeRequires}
                  onChange={(e) => setUpgradeRequires(e.target.value)}
                  required
                  data-test="upgrade-requires"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="ea-label" htmlFor="upgrade-file">Bundle file</label>
                <input
                  id="upgrade-file"
                  ref={upgradeFileRef}
                  type="file"
                  data-test="upgrade-file"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="submit"
                className="ea-btn ea-btn--primary"
                disabled={upgradeBusy}
                data-test="upgrade-submit-btn"
              >
                {upgradeBusy ? 'Upgrading...' : 'Upgrade'}
              </button>
              <button
                type="button"
                className="ea-btn"
                onClick={resetUpgradeForm}
                style={{ marginLeft: 8 }}
                data-test="upgrade-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
