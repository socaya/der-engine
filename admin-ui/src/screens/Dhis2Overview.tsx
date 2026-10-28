import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { fmtAgo, fmtDate, SyncStatusBar } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';

/**
 * DHIS2 — single landing page that merges the old Overview and the
 * Central-connection editor. One screen gives operators:
 *
 *   1. A live status strip (reachable, central version, profile,
 *      probe RTT, auth kind, last probe) with a "Probe now" action.
 *   2. The inline connection + compatibility + proxy editor,
 *      saved from the same page.
 *   3. Quick-access tiles for the rest of the DHIS2 group
 *      (OU binding, compatibility, metadata, sync, drift).
 *   4. Read-only probe snapshot details.
 */
export function MockupDhis2Overview(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [b, setB] = useState<edgeApi.OrgUnitBinding | null>(null);
  const [d, setD] = useState<edgeApi.DriftResponse | null>(null);
  const [cfg, setCfg] = useState<edgeApi.Dhis2ConnectionPayload | null>(null);
  const [draft, setDraft] = useState<Partial<edgeApi.Dhis2ConnectionPayload>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const r = await Promise.allSettled([
      edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.getOrgUnitBinding(), edgeApi.drift(),
      edgeApi.readDhis2Connection(),
    ]);
    if (r[0].status === 'fulfilled') setSi(r[0].value);
    if (r[1].status === 'fulfilled') setC(r[1].value);
    if (r[2].status === 'fulfilled') setB(r[2].value);
    if (r[3].status === 'fulfilled') setD(r[3].value);
    if (r[4].status === 'fulfilled') { setCfg(r[4].value); setDraft(r[4].value); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function probeNow(): Promise<void> {
    setRefreshing(true); setErr(null); setMsg(null);
    try {
      setC(await edgeApi.refreshCompat());
      setSi(await edgeApi.systemInfo());
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setRefreshing(false); }
  }

  async function save(): Promise<void> {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const payload: Partial<edgeApi.Dhis2ConnectionPayload> = { ...draft };
      if (payload.password === '***') delete (payload as Record<string, unknown>).password;
      if (payload.patToken === '***') delete (payload as Record<string, unknown>).patToken;
      const saved = await edgeApi.writeDhis2Connection(payload);
      setCfg(saved); setDraft(saved);
      setMsg('Connection settings saved. Changes take effect on next sync / probe.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  function set<K extends keyof edgeApi.Dhis2ConnectionPayload>(
      k: K, v: edgeApi.Dhis2ConnectionPayload[K] | string | boolean | number | null): void {
    setDraft((d) => ({ ...d, [k]: v as edgeApi.Dhis2ConnectionPayload[K] }));
  }

  if (!si || !c || !cfg) return <LoadingBlock testId="loading" />;

  const reach = c.probeReachable;
  const bound = b?.bound ?? false;
  const drift = d?.fingerprintFrom && d?.fingerprintTo && d.fingerprintFrom !== d.fingerprintTo;
  const authKind: 'PAT' | 'Basic' | 'none' = cfg.patTokenSet ? 'PAT' : cfg.passwordSet ? 'Basic' : 'none';

  return (
    <div className="ea-screen" data-test="cap-dhis2-hub">
      <SyncStatusBar
        tone={reach ? 'success' : 'danger'}
        title="DHIS2"
        statusLabel={reach ? 'Central reachable' : 'Central unreachable'}
        subtitle={
          <>
            <span>Central <strong style={{ color: 'var(--der-ink-900)' }}>{c.centralVersion ?? '—'}</strong></span>
            <span>·</span>
            <span>Profile <strong style={{ color: 'var(--der-ink-900)' }}>{c.profileName ?? '—'}</strong></span>
            <span>·</span>
            <span>RTT <strong style={{ color: 'var(--der-ink-900)' }}>{si.dhis2.probeDurationMs != null ? `${si.dhis2.probeDurationMs} ms` : '—'}</strong></span>
            <span>·</span>
            <span>Auth <strong style={{ color: 'var(--der-ink-900)' }}>{authKind === 'PAT' ? 'PAT (Bearer)' : authKind === 'Basic' ? 'Basic' : 'none'}</strong></span>
            <span>·</span>
            <span>Last probe <strong style={{ color: 'var(--der-ink-900)' }}>{c.capturedAt ? fmtAgo(c.capturedAt) : '—'}</strong></span>
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={refreshing}
                    data-test="dhis2-probe-now"
                    onClick={() => { probeNow().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>{refreshing ? 'Probing…' : 'Probe now'}</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    disabled={saving}
                    data-test="dhis2-save"
                    onClick={() => { save().catch(() => undefined); }}>
              <span>{saving ? 'Saving…' : 'Save connection'}</span>
            </button>
          </>
        }
      />

      {msg && <p className="ea-saved" data-test="dhis2-saved">{msg}</p>}
      {err && <ErrorBlock title="Connection error" testId="err-dhis2-hub">{err}</ErrorBlock>}

      <section className="ea-card ea-form-card" data-test="dhis2-connection-form">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Connection</h2>
            <p>Base URL + optional service-account authentication to the central DHIS2.</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Base URL</span>
              <input className="ea-input ea-mono" type="url"
                     placeholder="https://dhis.example.org/dhis"
                     value={draft.baseUrl ?? ''}
                     onChange={(e) => set('baseUrl', e.target.value)} />
              <span className="ea-field-hint">
                No trailing slash. Current compiled default: {si.dhis2.centralBaseUrl ?? '—'}
              </span>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Service account username</span>
              <input className="ea-input" type="text" autoComplete="off"
                     value={draft.username ?? ''}
                     onChange={(e) => set('username', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Service account password</span>
              <input className="ea-input" type="password" autoComplete="new-password"
                     placeholder={cfg.passwordSet ? 'leave blank to keep ***' : 'password'}
                     value={draft.password === '***' ? '' : (draft.password ?? '')}
                     onChange={(e) => set('password', e.target.value)} />
              <span className="ea-field-hint">
                {cfg.passwordSet
                  ? 'A password is already set. Leave blank to keep it unchanged.'
                  : 'Stored encrypted (AES-256-GCM via SecretEnvelope) when der.security.secret-key is configured.'}
              </span>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Personal access token (PAT)</span>
              <input className="ea-input ea-mono" type="password" autoComplete="new-password"
                     placeholder={cfg.patTokenSet ? 'leave blank to keep ***' : 'd2pat_xxx…'}
                     value={draft.patToken === '***' ? '' : (draft.patToken ?? '')}
                     onChange={(e) => set('patToken', e.target.value)} />
              <span className="ea-field-hint">
                If set, DER prefers the PAT (Bearer) over username/password Basic auth.
              </span>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Connect timeout (ms)</span>
              <input className="ea-input ea-mono" type="number" min={1000} max={120000}
                     value={draft.connectTimeoutMillis ?? ''}
                     onChange={(e) => set('connectTimeoutMillis', e.target.value ? Number(e.target.value) : null)} />
            </label>
          </div>
        </div>

        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Compatibility</h2>
            <p>ADR-0006 compatibility policy — hard floor, max tested version and probe strictness.</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Minimum supported DHIS2 version</span>
              <input className="ea-input ea-mono" placeholder="2.41"
                     value={draft.minSupportedVersion ?? ''}
                     onChange={(e) => set('minSupportedVersion', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Maximum tested version</span>
              <input className="ea-input ea-mono" placeholder="2.44"
                     value={draft.maxTestedVersion ?? ''}
                     onChange={(e) => set('maxTestedVersion', e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Probe mode</span>
              <select className="ea-input" value={draft.compatMode ?? 'strict'}
                      onChange={(e) => set('compatMode', e.target.value)}>
                <option value="strict">strict — fail closed on probe exceptions</option>
                <option value="permissive">permissive — warn, keep running</option>
              </select>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Snapshot TTL (hours)</span>
              <input className="ea-input ea-mono" type="number" min={1} max={720}
                     value={draft.snapshotTtlHours ?? ''}
                     onChange={(e) => set('snapshotTtlHours', e.target.value ? Number(e.target.value) : null)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Allow version mismatch</span>
              <label className="ea-flag-row">
                <input type="checkbox" className="ea-switch"
                       checked={!!draft.allowMismatch}
                       onChange={(e) => set('allowMismatch', e.target.checked)} />
                <span className="ea-flag-name">
                  Boot even when the central version is outside min / max
                </span>
              </label>
            </label>
          </div>
        </div>

        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>DHIS2 /api/** proxy</h2>
            <p>Opt-in passthrough so custom DHIS2 apps running on DER can call analytics / dataStore / etc. straight through to central.</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Enabled</span>
              <label className="ea-flag-row">
                <input type="checkbox" className="ea-switch"
                       checked={!!draft.proxyEnabled}
                       onChange={(e) => set('proxyEnabled', e.target.checked)} />
                <span className="ea-flag-name">Pass /api/** through to central (read-side only by default)</span>
              </label>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Allow writes</span>
              <label className="ea-flag-row">
                <input type="checkbox" className="ea-switch"
                       checked={!!draft.proxyAllowWrites}
                       onChange={(e) => set('proxyAllowWrites', e.target.checked)} />
                <span className="ea-flag-name">Also pass POST / PUT / DELETE / PATCH through (bypasses the journal)</span>
              </label>
            </label>
            <label className="ea-field" style={{ gridColumn: '1 / -1' }}>
              <span className="ea-field-label">Allow-path prefixes (CSV, blank = defaults)</span>
              <input className="ea-input ea-mono"
                     placeholder="/api/analytics,/api/dataStore,…"
                     value={draft.proxyAllowPaths ?? ''}
                     onChange={(e) => set('proxyAllowPaths', e.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <section>
        <div className="ea-section-title">Related</div>
        <div className="ea-tile-grid">
          <Link to="/dhis2/organisation-unit" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">⌖</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Organisation unit</div>
              <div className="ea-link-tile-desc">
                {bound ? `Bound to ${b?.orgUnitDisplayName}` : 'Not bound yet — pick a facility.'}
              </div>
            </div>
          </Link>
          <Link to="/dhis2/compat" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">✓</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Compatibility</div>
              <div className="ea-link-tile-desc">
                Live probe + ADR-0006 policy. Last probe {c.capturedAt ? fmtAgo(c.capturedAt) : '—'}.
              </div>
            </div>
          </Link>
          <Link to="/dhis2/metadata" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">◱</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata</div>
              <div className="ea-link-tile-desc">Read-only mirror of every DHIS2 metadata resource.</div>
            </div>
          </Link>
          <Link to="/dhis2/metadata-sync" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">▶</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata sync</div>
              <div className="ea-link-tile-desc">Trigger an immediate metadata pull from central.</div>
            </div>
          </Link>
          <Link to="/dhis2/metadata-drift" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">≠</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata drift</div>
              <div className="ea-link-tile-desc">
                {drift ? 'Drift detected — review before next sync.' : 'Fingerprints match central.'}
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section>
        <div className="ea-section-title">Probe details</div>
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Compiled default URL</dt>
            <dd className="ea-mono">{si.dhis2.centralBaseUrl ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Observed version</dt>
            <dd>{si.dhis2.centralVersion ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Captured at</dt>
            <dd className="ea-mono">{si.dhis2.capturedAt ? fmtDate(si.dhis2.capturedAt) : '—'}</dd></div>
          <div className="ea-def-row"><dt>Reason</dt>
            <dd>{si.dhis2.reason ?? '—'}</dd></div>
        </dl>
      </section>
    </div>
  );
}

