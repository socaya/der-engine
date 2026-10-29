import { useEffect, useState } from 'react';
import {
  Panel, fmtAgo, SyncStatusBar, Status, RowMenu,
} from './shared';
import { UiIcon } from '../components/UiIcon';

interface HardwareSummary {
  watchdog: {
    enabled: boolean; underSystemd: boolean;
    lastPingAt: string | null; pingCount: number;
    lastFailureAt: string | null; lastFailureMsg: string | null;
    notifySocket: string | null;
  };
  thermal: {
    available: boolean;
    zones?: Array<{ zone: string; celsius: number; sampledAt: string }>;
  };
  ups: {
    available: boolean; reason?: string;
    upsName?: string; status?: string;
    batteryChargePct?: number | null;
    batteryRuntimeSec?: number | null;
    inputVoltage?: number | null;
    model?: string | null;
  };
  leds: Array<{
    zone: string; color: string; pattern: string;
    periodMs: number | null; label: string | null;
    updatedAt: string;
  }>;
  sealedSecrets: Array<{
    secretId: string; description: string | null;
    sealedPath: string; algorithm: string;
    sealedAt: string; lastUnsealAt: string | null;
    unsealCount: number;
  }>;
}

async function j<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method, credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function Hardware(): JSX.Element {
  const [data, setData] = useState<HardwareSummary | null>(null);
  const [editLed, setEditLed] = useState<string | null>(null);
  const [editColor, setEditColor] = useState('');
  const [editPattern, setEditPattern] = useState('');
  const [showSeal, setShowSeal] = useState(false);

  async function reload(): Promise<void> {
    try { setData(await j<HardwareSummary>('GET', '/edge-api/v1/system/hardware')); }
    catch { /* ignore */ }
  }
  useEffect(() => {
    reload().catch(() => undefined);
    const t = setInterval(() => reload().catch(() => undefined), 10000);
    return () => clearInterval(t);
  }, []);

  async function saveLed(zone: string): Promise<void> {
    try {
      await j('POST', `/edge-api/v1/system/hardware/leds/${encodeURIComponent(zone)}`,
               { color: editColor, pattern: editPattern });
      setEditLed(null);
      await reload();
    } catch { /* leave open */ }
  }

  const watchdogOk = !!data?.watchdog?.lastPingAt;
  const upsOk = data?.ups?.available === true;
  const tempZones = data?.thermal?.zones ?? [];
  const hottest = tempZones.length
    ? Math.max(...tempZones.map((z) => z.celsius)) : null;

  return (
    <div className="ea-screen" data-test="hardware">
      <SyncStatusBar
        tone={watchdogOk ? 'success' : 'muted'}
        title="Hardware"
        statusLabel={data ? 'Live' : 'Loading…'}
        subtitle={<span>systemd watchdog · thermal · UPS · status LEDs · TPM-sealed secrets.</span>}
        actions={
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} /><span>Refresh</span>
          </button>
        }
      />

      <Panel title="Watchdog">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Enabled</dt>
            <dd><Status tone={data?.watchdog.enabled ? 'success' : 'muted'}>
              {data?.watchdog.enabled ? 'YES' : 'NO'}</Status></dd></div>
          <div className="ea-def-row"><dt>Under systemd</dt>
            <dd><Status tone={data?.watchdog.underSystemd ? 'success' : 'muted'}>
              {data?.watchdog.underSystemd ? 'YES' : 'NO'}</Status></dd></div>
          <div className="ea-def-row"><dt>Last ping</dt>
            <dd className="ea-mono">
              {data?.watchdog.lastPingAt ? fmtAgo(data.watchdog.lastPingAt) : '—'}
            </dd></div>
          <div className="ea-def-row"><dt>Ping count</dt>
            <dd className="ea-mono">{data?.watchdog.pingCount ?? 0}</dd></div>
          <div className="ea-def-row"><dt>Notify socket</dt>
            <dd className="ea-mono" style={{ fontSize: 12 }}>
              {data?.watchdog.notifySocket ?? '—'}
            </dd></div>
          {data?.watchdog.lastFailureMsg && (
            <div className="ea-def-row"><dt>Last failure</dt>
              <dd className="ea-text-muted" style={{ fontSize: 12 }}>
                {data.watchdog.lastFailureMsg}
              </dd></div>
          )}
        </dl>
      </Panel>

      <Panel title={`Thermal · ${tempZones.length} zones${hottest != null ? ` · hottest ${hottest.toFixed(1)}°C` : ''}`}>
        {!data?.thermal.available ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No thermal zones found. /sys/class/thermal is only populated on Linux
            (dev host returns empty).
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Zone</th><th>Temperature (°C)</th><th>Sampled</th>
              </tr></thead>
              <tbody>
                {tempZones.map((z) => {
                  const tone: 'success' | 'warning' | 'danger' = z.celsius > 75 ? 'danger'
                    : z.celsius > 60 ? 'warning' : 'success';
                  return (
                    <tr key={z.zone}>
                      <td className="ea-mono">{z.zone}</td>
                      <td>
                        <Status tone={tone}>{z.celsius.toFixed(1)}</Status>
                      </td>
                      <td className="ea-text-muted">{fmtAgo(z.sampledAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="UPS">
        {!upsOk ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            {data?.ups.reason ?? 'UPS not configured.'} Set <code>DER_HARDWARE_UPS_NAME</code>
            (e.g. <code>apc@localhost</code>) with <code>nut</code> installed to enable.
          </p>
        ) : (
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>UPS</dt>
              <dd className="ea-mono">{data!.ups.upsName}</dd></div>
            <div className="ea-def-row"><dt>Status</dt>
              <dd><Status tone={data!.ups.status?.includes('OL') ? 'success' : 'warning'}>
                {data!.ups.status}
              </Status></dd></div>
            <div className="ea-def-row"><dt>Battery</dt>
              <dd className="ea-mono">
                {data!.ups.batteryChargePct ?? '—'} %
              </dd></div>
            <div className="ea-def-row"><dt>Runtime</dt>
              <dd className="ea-mono">
                {data!.ups.batteryRuntimeSec != null
                  ? Math.round(data!.ups.batteryRuntimeSec / 60) + ' min'
                  : '—'}
              </dd></div>
            <div className="ea-def-row"><dt>Input voltage</dt>
              <dd className="ea-mono">{data!.ups.inputVoltage ?? '—'} V</dd></div>
            <div className="ea-def-row"><dt>Model</dt>
              <dd className="ea-mono">{data!.ups.model ?? '—'}</dd></div>
          </dl>
        )}
      </Panel>

      <Panel title={`Status LEDs · ${data?.leds.length ?? 0}`}
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>
               Pi-side daemon polls <code>GET /system/hardware/leds</code> every 2 s.
             </span>}>
        {!data?.leds.length ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>No LED zones.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Zone</th><th>Color</th><th>Pattern</th><th>Period</th>
                <th>Label</th><th>Updated</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {data.leds.map((l) => (
                  <tr key={l.zone}>
                    <td className="ea-mono">{l.zone}</td>
                    <td>
                      {editLed === l.zone ? (
                        <input className="ea-input" value={editColor}
                               onChange={(e) => setEditColor(e.target.value)}
                               style={{ width: 100 }} />
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%',
                                         background: l.color === 'off' ? 'transparent' : l.color,
                                         border: '1px solid var(--der-border)' }} />
                          {l.color}
                        </span>
                      )}
                    </td>
                    <td>
                      {editLed === l.zone ? (
                        <select className="ea-input" value={editPattern}
                                onChange={(e) => setEditPattern(e.target.value)}>
                          <option value="solid">solid</option>
                          <option value="pulse">pulse</option>
                          <option value="blink">blink</option>
                          <option value="off">off</option>
                        </select>
                      ) : l.pattern}
                    </td>
                    <td className="ea-mono">{l.periodMs ? l.periodMs + ' ms' : '—'}</td>
                    <td className="ea-text-muted">{l.label ?? '—'}</td>
                    <td className="ea-text-muted">{fmtAgo(l.updatedAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {editLed === l.zone ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                                  onClick={() => saveLed(l.zone)}>Save</button>
                          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                  onClick={() => setEditLed(null)}>Cancel</button>
                        </div>
                      ) : (
                        <RowMenu items={[
                          { label: 'Edit', onSelect: () => {
                              setEditLed(l.zone);
                              setEditColor(l.color);
                              setEditPattern(l.pattern);
                            } },
                        ]} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`TPM-sealed secrets · ${data?.sealedSecrets.length ?? 0}`}
             action={<button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                              onClick={() => setShowSeal(true)}>
               <UiIcon icon="plus" size={14} /><span>Seal secret</span>
             </button>}>
        {!data?.sealedSecrets.length ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No sealed secrets yet. Falls back to file-sealed with a KEK derived
            from <code>/etc/machine-id</code> when no TPM is available.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Secret ID</th><th>Algorithm</th><th>Sealed</th>
                <th>Unseals</th><th>Last unseal</th><th>Description</th>
              </tr></thead>
              <tbody>
                {data.sealedSecrets.map((s) => (
                  <tr key={s.secretId}>
                    <td className="ea-mono">{s.secretId}</td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>{s.algorithm}</td>
                    <td className="ea-text-muted">{fmtAgo(s.sealedAt)}</td>
                    <td className="ea-mono">{s.unsealCount}</td>
                    <td className="ea-text-muted">
                      {s.lastUnsealAt ? fmtAgo(s.lastUnsealAt) : '—'}
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}>
                      {s.description ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showSeal && <SealDialog onClose={() => setShowSeal(false)}
                                  onSaved={() => { setShowSeal(false); reload(); }} />}
    </div>
  );
}

function SealDialog({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void;
}): JSX.Element {
  const [secretId, setSecretId] = useState('');
  const [description, setDescription] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      await j('POST', '/edge-api/v1/system/hardware/sealed',
               { secretId, description, plaintext });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  return (
    <div className="ea-modal-overlay" onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="ea-modal" onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface)', border: '1px solid var(--der-border)',
                    padding: 24, maxWidth: 520, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Seal secret</h3>
        <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Stored under <code>/etc/der/sealed/</code>. TPM-sealed if <code>/dev/tpm0</code>
          + <code>tpm2-tools</code> present, otherwise file-sealed with PBKDF2-of-machine-id.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Secret ID
            <input className="ea-input" value={secretId}
                   placeholder="dhis2-token"
                   onChange={(e) => setSecretId(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Description
            <input className="ea-input" value={description}
                   onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Plaintext
            <textarea className="ea-input" rows={4}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                      value={plaintext}
                      onChange={(e) => setPlaintext(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving || !secretId || !plaintext} onClick={save}>
            {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="plus" size={14} />}
            <span>{saving ? 'Sealing…' : 'Seal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
