import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, fmtDate, fmtAgo, usePaged, TablePager, SyncStatusBar,
  Status, RowMenu, confirmThenRun, useCentralReachable,
} from './shared';
import { UiIcon } from '../components/UiIcon';
import { EmptyBlock } from '../components/ScreenStates';

/** Trigger a browser download of a UTF-8 blob — used by every Network
 *  page's "Export" / "Download" action. Returns silently; the browser
 *  decides where the file lands. */
function downloadBlob(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fire-and-forget wrapper for an admin action that may fail (service
 *  pending). Runs after a native-confirm prompt and never leaks an
 *  unhandled rejection. */
function runAction(prompt: string, fn: () => Promise<unknown>, after?: () => void): void {
  confirmThenRun(prompt, () => {
    (async () => {
      try { await fn(); } catch { /* backend not yet deployed */ }
      finally { after?.(); }
    })();
  });
}

/**
 * DER Network Module screens — per
 * docs/requirements/DER_Network_Module_Design_Specification.md
 *
 * Server endpoints at /edge-api/v1/network/* land in Phase N1-N3. Until
 * each one lands this UI gracefully reports "service not yet available"
 * via EmptyBlock, so the full planned shape is visible to operators and
 * reviewers right now.
 */

const UNAVAILABLE_HINT = (
  <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
    This signal comes from the DER Network Agent, which lands in the
    Phase N1 build. Once the service is enabled the page populates with
    live data from <code>/edge-api/v1/network/*</code>.
  </p>
);

/* ─────────────── /network ─────────────── */
export function NetworkOverview(): JSX.Element {
  const [status, setStatus] = useState<edgeApi.NetworkStatus | null>(null);
  const [ap, setAp] = useState<edgeApi.AccessPointStatus | null>(null);
  const [events, setEvents] = useState<edgeApi.NetworkEvent[]>([]);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [peerCount, setPeerCount] = useState<number | null>(null);
  const [servicePending, setServicePending] = useState(false);
  const ping = useCentralReachable();

  async function reload(): Promise<void> {
    const results = await Promise.allSettled([
      edgeApi.networkStatus(), edgeApi.networkAccessPoint(),
      edgeApi.networkEvents(10), edgeApi.networkClients(),
      edgeApi.networkPeers(),
    ]);
    if (results[0].status === 'fulfilled') setStatus(results[0].value);
    if (results[1].status === 'fulfilled') setAp(results[1].value);
    if (results[2].status === 'fulfilled') setEvents(results[2].value.events ?? []);
    if (results[3].status === 'fulfilled') setClientCount(results[3].value.clients.length);
    if (results[4].status === 'fulfilled') setPeerCount(results[4].value.peers.length);
    // When every call fails the Network Agent isn't deployed yet;
    // show the "pending" hint rather than a scary error banner.
    const anySuccess = results.some((r) => r.status === 'fulfilled');
    setServicePending(!anySuccess);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const centralReachable = ping.reachable ?? status?.centralDhis2Available ?? null;
  const overallTone: 'success' | 'warning' | 'danger' =
    status?.state === 'CONNECTED' ? 'success'
    : status?.state === 'OFFLINE_FIRST' || status?.state === 'RECOVERING' ? 'warning'
    : status ? 'danger'
    : centralReachable ? 'success' : 'warning';
  const overallLabel = status?.state ? humanState(status.state)
    : centralReachable ? 'Connected' : 'Offline-first';

  function exportStatus(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      status, accessPoint: ap, clientCount, peerCount,
      recentEvents: events.slice(0, 50),
      centralDhis2: { reachable: ping.reachable, latencyMs: ping.latencyMs },
    };
    downloadBlob(`der-network-status-${new Date().toISOString().slice(0,10)}.json`,
                 JSON.stringify(payload, null, 2), 'application/json');
  }
  return (
    <div className="ea-screen" data-test="network-overview">
      <SyncStatusBar
        tone={overallTone}
        title="DER Network"
        statusLabel={overallLabel}
        subtitle={
          <>
            <span>Trusted local network for this edge.</span>
            <span>·</span>
            <span>Operating mode <strong style={{ color: 'var(--der-ink-900)' }}>{overallLabel}</strong></span>
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={exportStatus}>
              <UiIcon icon="download" size={14} />
              <span>Export status</span>
            </button>
            <Link to="/network/diagnostics" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="diagnostics" size={14} />
              <span>Run diagnostics</span>
            </Link>
            <Link to="/network/settings" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="settings" size={14} />
              <span>Settings</span>
            </Link>
          </>
        }
      />

      <section className="ea-net-grid">
        <NetFacetCard
          icon="access-point" tone={ap?.running ? 'success' : 'muted'}
          label="Local Access Point"
          value={ap?.running ? 'Running' : ap ? 'Stopped' : '—'}
          sub={ap?.ssid ?? 'SSID not configured'}
          to="/network/access-point"
        />
        <NetFacetCard
          icon="tei" tone={clientCount != null && clientCount > 0 ? 'info' : 'muted'}
          label="Connected devices"
          value={clientCount != null ? String(clientCount) : '—'}
          sub={clientCount != null ? `${clientCount} on the local network` : 'Not reporting'}
          to="/network/clients"
        />
        <NetFacetCard
          icon="ethernet"
          tone={status?.localLanAvailable ? 'success' : 'muted'}
          label="Facility LAN"
          value={status?.localLanAvailable ? 'Available' : status ? 'Unavailable' : '—'}
          sub={status?.gateway ? `gateway ${status.gateway}` : 'gateway unknown'}
          to="/network/interfaces"
        />
        <NetFacetCard
          icon="wifi"
          tone={status?.internetAvailable ? 'success' : 'warning'}
          label="Internet"
          value={status?.internetAvailable ? 'Available' : 'Unreachable'}
          sub="General WAN reachability"
          to="/network/diagnostics"
        />
        <NetFacetCard
          icon="compat"
          tone={centralReachable ? 'success' : 'warning'}
          label="Central DHIS2"
          value={centralReachable ? 'Connected' : 'Unreachable'}
          sub={ping.latencyMs != null ? `probe ${ping.latencyMs} ms` : 'probing…'}
          to="/sync/settings"
        />
        <NetFacetCard
          icon="peer" tone={peerCount && peerCount > 0 ? 'info' : 'muted'}
          label="Peer links"
          value={peerCount != null ? String(peerCount) : '—'}
          sub={peerCount != null && peerCount > 0 ? `${peerCount} configured` : 'Optional secure peers (Phase N5)'}
          to="/network/peers"
        />
      </section>

      {servicePending && (
        <section className="ea-state-block ea-state-block--muted" data-test="network-service-missing">
          <div className="ea-state-block-icon" aria-hidden="true">
            <UiIcon icon="wifi" size={20} />
          </div>
          <div className="ea-state-block-body">
            <h2 className="ea-state-block-title">Network service pending</h2>
            <div className="ea-state-block-content">
              {UNAVAILABLE_HINT}
            </div>
          </div>
        </section>
      )}

      <Panel title={`Live activity · ${events.length} events`}
             action={<Link to="/audit/events?category=network" className="ea-link-btn">View all →</Link>}>
        {events.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No network events yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Observed</th><th>Event</th><th>Interface</th>
                <th>Device / node</th><th>Actor</th><th>Outcome</th>
              </tr></thead>
              <tbody>
                {events.slice(0, 12).map((e) => (
                  <tr key={e.eventId}>
                    <td className="ea-mono">{fmtAgo(e.observedAt)}</td>
                    <td style={{ fontWeight: 500 }}>{humaniseEventType(e.eventType)}</td>
                    <td className="ea-mono ea-text-muted">{e.interfaceName ?? '—'}</td>
                    <td className="ea-mono ea-text-muted" style={{ fontSize: 13 }}>
                      {e.deviceId ?? e.nodeId ?? '—'}
                    </td>
                    <td className="ea-mono ea-text-muted">{e.actor ?? '—'}</td>
                    <td>
                      <Status tone={e.outcome === 'SUCCESS' ? 'success'
                                     : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                        {e.outcome}
                      </Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function NetFacetCard({ icon, tone, label, value, sub, to }: {
  icon: Parameters<typeof UiIcon>[0]['icon']; tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  label: string; value: string; sub: string; to: string;
}): JSX.Element {
  return (
    <Link to={to} className="ea-net-facet"
          data-tone={tone}
          data-test={`net-facet-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="ea-net-facet-icon" aria-hidden="true">
        <UiIcon icon={icon} size={22} />
      </div>
      <div className="ea-net-facet-body">
        <div className="ea-net-facet-label">{label}</div>
        <div className="ea-net-facet-value">{value}</div>
        <div className="ea-net-facet-sub">{sub}</div>
      </div>
    </Link>
  );
}

function humanState(s: edgeApi.ConnectivityState): string {
  switch (s) {
    case 'CONNECTED': return 'Connected';
    case 'OFFLINE_FIRST': return 'Offline-first';
    case 'RECOVERING': return 'Recovering';
    case 'LOCAL_NETWORK_DEGRADED': return 'LAN degraded';
    case 'EDGE_NETWORK_UNAVAILABLE': return 'Edge network unavailable';
    case 'CENTRAL_AUTH_FAILURE': return 'Central auth failure';
    case 'DNS_FAILURE': return 'DNS failure';
    case 'CERTIFICATE_FAILURE': return 'Certificate failure';
  }
}

function humaniseEventType(t: string): string {
  return t.toLowerCase().split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/* ─────────────── /network/access-point ─────────────── */
export function NetworkAccessPoint(): JSX.Element {
  const [ap, setAp] = useState<edgeApi.AccessPointStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  async function reload(): Promise<void> {
    try { setAp(await edgeApi.networkAccessPoint()); setMissing(false); }
    catch { setMissing(true); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  function run(label: string, fn: () => Promise<unknown>, prompt: string): void {
    confirmThenRun(prompt, () => {
      setBusy(label);
      (async () => {
        try { await fn(); await reload(); }
        catch { /* backend not yet deployed — status shows pending */ }
        finally { setBusy(null); }
      })();
    });
  }
  return (
    <div className="ea-screen" data-test="network-ap">
      <SyncStatusBar
        tone={ap?.running ? 'success' : 'warning'}
        title="Access Point"
        statusLabel={ap?.running ? 'Running' : ap ? 'Stopped' : 'Not reporting'}
        subtitle={<span>DER-hosted Wi-Fi Access Point for authorised devices.</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={!!busy}
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            {missing ? null : (<>
            {ap?.running ? (
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      disabled={!!busy}
                      onClick={() => run('stop', () => edgeApi.networkApStop(),
                        'Stop the DER Access Point? Connected devices will lose Wi-Fi.')}>
                <UiIcon icon="pause" size={14} />
                <span>{busy === 'stop' ? 'Stopping…' : 'Stop AP'}</span>
              </button>
            ) : (
              <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                      disabled={!!busy}
                      onClick={() => run('start', () => edgeApi.networkApStart(),
                        'Start the DER Access Point? Devices will be able to join once the SSID is broadcasting.')}>
                <UiIcon icon="play" size={14} />
                <span>{busy === 'start' ? 'Starting…' : 'Start AP'}</span>
              </button>
            )}
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={!!busy || !ap?.running}
                    onClick={() => run('restart', () => edgeApi.networkApRestart(),
                      'Restart the DER Access Point? Connected devices will briefly disconnect and auto-rejoin.')}>
              <UiIcon icon="power" size={14} />
              <span>{busy === 'restart' ? 'Restarting…' : 'Restart'}</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={!!busy}
                    onClick={() => run('rotate', () => edgeApi.networkApRotateKey(),
                      'Rotate the Access Point network key? Connected devices will need to re-authenticate.')}>
              <UiIcon icon="refresh" size={14} />
              <span>{busy === 'rotate' ? 'Rotating…' : 'Rotate key'}</span>
            </button>
            </>)}
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setShowEdit(true)}>
              <UiIcon icon="edit" size={14} />
              <span>Edit AP</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setShowQr(true)}>
              <UiIcon icon="qr" size={14} />
              <span>Show QR</span>
            </button>
          </>
        }
      />

      {missing ? (
        <EmptyBlock title="Access Point service not available" testId="empty-ap">
          {UNAVAILABLE_HINT}
        </EmptyBlock>
      ) : (
        <Panel title="Access Point status">
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Status</dt>
              <dd><Status tone={ap?.running ? 'success' : 'muted'}>{ap?.running ? 'Running' : 'Stopped'}</Status></dd></div>
            <div className="ea-def-row"><dt>Interface</dt><dd className="ea-mono">{ap?.interface ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>SSID</dt><dd className="ea-mono">{ap?.ssid ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Band</dt><dd>{ap?.band ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Channel</dt><dd className="ea-mono">{ap?.channel ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Security</dt><dd>{ap?.security ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Clients</dt><dd className="ea-mono">{ap?.clients ?? 0}</dd></div>
            <div className="ea-def-row"><dt>Gateway</dt><dd className="ea-mono">{ap?.gateway ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>DHCP</dt><dd>{ap?.dhcpActive ? 'Active' : 'Inactive'}</dd></div>
            <div className="ea-def-row"><dt>Edge ID</dt><dd className="ea-mono">{ap?.edgeId ?? '—'}</dd></div>
            <div className="ea-def-row"><dt>Started</dt>
              <dd className="ea-mono">{ap?.startedAt ? fmtDate(ap.startedAt) : '—'}</dd></div>
          </dl>
        </Panel>
      )}

      {showQr && <QrEnrolDialog onClose={() => setShowQr(false)} />}
      {showEdit && ap && <ApEditDialog ap={ap}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); reload().catch(() => undefined); }} />}
    </div>
  );
}

function ApEditDialog({ ap, onClose, onSaved }: {
  ap: edgeApi.AccessPointStatus;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [ssid, setSsid] = useState(ap.ssid ?? '');
  const [band, setBand] = useState(ap.band ?? '5GHz');
  const [channel, setChannel] = useState<number>(ap.channel ?? 44);
  const [security, setSecurity] = useState(ap.security ?? 'WPA3-SAE');
  const [iface, setIface] = useState(ap.interface ?? 'wlan0');
  const [gateway, setGateway] = useState(ap.gateway ?? '10.88.0.1');
  const [subnet, setSubnet] = useState(ap.subnet ?? '10.88.0.0/24');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      await edgeApi.networkApEdit({ ssid, band, channel, security,
                                     interfaceName: iface, gateway, subnet });
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
                    padding: 24, maxWidth: 560, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Edit Access Point</h3>
        <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Changes take effect on the next AP (re)start. Clients will need the new PSK on security-mode change.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12 }}>SSID
            <input className="ea-input" value={ssid} onChange={(e) => setSsid(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Interface
            <input className="ea-input" value={iface} onChange={(e) => setIface(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Band
            <select className="ea-input" value={band} onChange={(e) => setBand(e.target.value)}>
              <option value="2.4GHz">2.4 GHz</option>
              <option value="5GHz">5 GHz</option>
              <option value="6GHz">6 GHz</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Channel
            <input className="ea-input" type="number" value={channel}
                   onChange={(e) => setChannel(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 12 }}>Security
            <select className="ea-input" value={security}
                    onChange={(e) => setSecurity(e.target.value)}>
              <option value="WPA3-SAE">WPA3-SAE</option>
              <option value="WPA2-PSK">WPA2-PSK</option>
              <option value="OWE">OWE (enhanced-open)</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Gateway
            <input className="ea-input" value={gateway}
                   onChange={(e) => setGateway(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, gridColumn: '1 / span 2' }}>Subnet
            <input className="ea-input" value={subnet}
                   onChange={(e) => setSubnet(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving || !ssid} onClick={save}>
            {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="edit" size={14} />}
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function QrEnrolDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [qr, setQr] = useState<{ ssid: string; payload: string; qrSvg: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  useEffect(() => {
    (async () => {
      try { setQr(await edgeApi.networkApEnrolmentQr()); }
      catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, []);
  function copyPayload(): void {
    if (qr && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(qr.payload).catch(() => undefined);
    }
  }
  async function issueToken(): Promise<void> {
    setIssuing(true);
    try {
      const r = await edgeApi.networkEnrolTokenIssue({ ttlSeconds: 1800 });
      setToken(r.token);
    } catch { /* ignore */ }
    finally { setIssuing(false); }
  }
  function copyToken(): void {
    if (token && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).catch(() => undefined);
    }
  }
  return (
    <div className="ea-modal-overlay" onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1000 }}>
      <div className="ea-modal" onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface)', border: '1px solid var(--der-border)',
                    padding: 24, maxWidth: 460, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
          Enrol a device — {qr?.ssid ?? '…'}
        </h3>
        <ol className="ea-text-muted" style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
          <li>Scan the QR below on the new device.</li>
          <li>The device joins the DER-EDGE Wi-Fi automatically.</li>
          <li>Open <code>https://der.local</code> and send an enrol request.</li>
          <li>Approve the pending row from the Connected Devices table.</li>
        </ol>
        <div style={{ background: '#fff', padding: 12, border: '1px solid var(--der-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      aspectRatio: '1 / 1' }}
             dangerouslySetInnerHTML={{ __html: qr?.qrSvg ??
                '<div style="color:#99a;font-size:12px;font-family:monospace">loading…</div>' }} />
        {qr && (
          <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 11,
                        color: 'var(--der-ink-500)', wordBreak: 'break-all' }}>
            {qr.payload}
          </div>
        )}
        {err && (
          <div className="ea-text-muted" style={{ margin: '12px 0 0', fontSize: 12 }}>
            Couldn't load QR — {err}
          </div>
        )}
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--der-raised)',
                      border: '1px solid var(--der-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Optional — one-shot enrol token (30 min)
          </div>
          {token ? (
            <div className="ea-mono" style={{ fontSize: 12, wordBreak: 'break-all',
                                               color: 'var(--der-ink-700)' }}>
              {token}
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      style={{ marginLeft: 8 }} onClick={copyToken}>
                <UiIcon icon="copy" size={12} /> <span>Copy</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="ea-text-muted" style={{ fontSize: 12 }}>
                Hand this token to a specific device for a managed first-contact.
              </span>
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      disabled={issuing} onClick={issueToken}>
                <UiIcon icon="plus" size={12} />
                <span>{issuing ? 'Issuing…' : 'Issue token'}</span>
              </button>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  disabled={!qr} onClick={copyPayload}>
            <UiIcon icon="copy" size={14} />
            <span>Copy payload</span>
          </button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── /network/clients ─────────────── */
export function NetworkConnectedDevices(): JSX.Element {
  const [params] = useSearchParams();
  const [clients, setClients] = useState<edgeApi.NetworkClient[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState(params.get('device') ?? '');
  const [certFor, setCertFor] = useState<edgeApi.NetworkClient | null>(null);
  const [editFor, setEditFor] = useState<edgeApi.NetworkClient | null>(null);
  const [showEnrol, setShowEnrol] = useState(false);
  async function reload(): Promise<void> {
    try { setClients((await edgeApi.networkClients()).clients); setMissing(false); }
    catch { setMissing(true); setClients([]); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  const q = query.trim().toLowerCase();
  const filtered = (clients ?? []).filter((c) => !q
    || c.deviceId.toLowerCase().includes(q)
    || (c.owner ?? '').toLowerCase().includes(q)
    || c.ip.includes(q));
  const paged = usePaged(filtered, 25);
  const approve = (id: string): void => runAction(
    `Approve device ${id}? It will be issued a DER identity.`,
    () => edgeApi.networkDeviceApprove(id), () => { reload().catch(() => undefined); });
  const revoke = (id: string): void => runAction(
    `Revoke device ${id}? Its certificate will be invalidated and it will need to re-enrol.`,
    () => edgeApi.networkDeviceRevoke(id), () => { reload().catch(() => undefined); });
  const block = (id: string): void => runAction(
    `Block device ${id}? It will remain visible but can't reach any DER service.`,
    () => edgeApi.networkDeviceBlock(id), () => { reload().catch(() => undefined); });
  const unblock = (id: string): void => runAction(
    `Unblock device ${id}? Its previous trust level is restored.`,
    () => edgeApi.networkDeviceUnblock(id), () => { reload().catch(() => undefined); });
  function exportCsv(): void {
    const rows = (clients ?? []).map((c) =>
      [c.deviceId, c.owner ?? '', c.ip, c.link, c.signalDbm ?? '',
       c.trust, c.lastSeenAt].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = ['deviceId,owner,ip,link,signalDbm,trust,lastSeenAt', ...rows].join('\n');
    downloadBlob(`der-network-clients-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv');
  }

  const pending = (clients ?? []).filter((c) => c.trust === 'PENDING').length;
  const approved = (clients ?? []).filter((c) => c.trust === 'APPROVED').length;
  return (
    <div className="ea-screen" data-test="network-clients">
      <SyncStatusBar
        tone={pending > 0 ? 'warning' : approved > 0 ? 'success' : 'muted'}
        title="Connected Devices"
        statusLabel={clients == null ? 'Loading' : `${clients.length} on network`}
        subtitle={
          <>
            <span>Devices on the DER local network.</span>
            {approved > 0 && (<><span>·</span><span>Approved <strong style={{ color: 'var(--der-ink-900)' }}>{approved}</strong></span></>)}
            {pending > 0 && (<><span>·</span><span>Pending <strong style={{ color: 'var(--der-warning-ink)' }}>{pending}</strong></span></>)}
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={(clients?.length ?? 0) === 0}
                    onClick={exportCsv}>
              <UiIcon icon="download" size={14} />
              <span>Export CSV</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => setShowEnrol(true)}>
              <UiIcon icon="qr" size={14} />
              <span>Enrol a device</span>
            </button>
          </>
        }
      />
      {missing && (clients?.length ?? 0) === 0 ? (
        <EmptyBlock title="Device inventory not available" testId="empty-net-clients">
          {UNAVAILABLE_HINT}
        </EmptyBlock>
      ) : (
        <Panel title={`${filtered.length} device${filtered.length === 1 ? '' : 's'}`}
               action={
                 <input className="ea-input" type="search"
                        style={{ maxWidth: 240 }}
                        placeholder="Search by ID, owner or IP"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)} />
               }>
          {filtered.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>No devices on the local network.</p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr>
                  <th>Device</th><th>User / Owner</th><th>IP</th>
                  <th>Link</th><th>Signal</th><th>Trust</th><th>Last seen</th>
                  <th style={{ width: 48 }} aria-label="Actions"></th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((c) => (
                    <tr key={c.deviceId}>
                      <td className="ea-mono">{c.deviceId}</td>
                      <td>{c.owner ?? '—'}</td>
                      <td className="ea-mono">{c.ip}</td>
                      <td>{c.link === 'wifi' ? 'Wi-Fi' : c.link === 'ethernet' ? 'Ethernet' : 'Cellular'}</td>
                      <td className="ea-mono">{c.signalDbm != null ? `${c.signalDbm} dBm` : '—'}</td>
                      <td>
                        <Status tone={c.trust === 'APPROVED' ? 'success'
                                       : c.trust === 'PENDING' ? 'warning'
                                       : c.trust === 'REVOKED' || c.trust === 'BLOCKED' ? 'danger'
                                       : 'muted'}>
                          {c.trust}
                        </Status>
                      </td>
                      <td className="ea-text-muted" title={c.lastSeenAt}>{fmtAgo(c.lastSeenAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <RowMenu items={[
                          { label: 'Edit label', onSelect: () => setEditFor(c) },
                          ...(c.trust === 'PENDING' ? [{ label: 'Approve', onSelect: () => approve(c.deviceId) }] : []),
                          ...(c.trust === 'APPROVED' ? [{ label: 'Revoke', danger: true, onSelect: () => revoke(c.deviceId) }] : []),
                          ...(c.trust === 'BLOCKED'
                              ? [{ label: 'Unblock', onSelect: () => unblock(c.deviceId) }]
                              : [{ label: 'Block', danger: true, onSelect: () => block(c.deviceId) }]),
                          { label: 'View certificate', onSelect: () => setCertFor(c) },
                          { label: 'View audit', to: `/audit/events?device=${encodeURIComponent(c.deviceId)}` },
                          ...(c.derDeviceId ? [{ label: 'View DER device', to: `/devices/${c.derDeviceId}` }] : []),
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePager {...paged.pagerProps} />
            </div>
          )}
        </Panel>
      )}

      <EnrolTokensPanel />

      {certFor && <DeviceCertDialog client={certFor} onClose={() => setCertFor(null)} />}
      {editFor && <ClientLabelDialog client={editFor}
          onClose={() => setEditFor(null)}
          onSaved={() => { setEditFor(null); reload().catch(() => undefined); }} />}
      {showEnrol && <QrEnrolDialog onClose={() => setShowEnrol(false)} />}
    </div>
  );
}

function EnrolTokensPanel(): JSX.Element {
  const [tokens, setTokens] = useState<edgeApi.NetworkEnrolToken[]>([]);
  async function reload(): Promise<void> {
    try { setTokens((await edgeApi.networkEnrolTokens()).tokens); }
    catch { /* leave previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  function revoke(tokenHash: string): void {
    runAction('Revoke this enrol token? It cannot be used after this.',
      () => edgeApi.networkEnrolTokenRevoke(tokenHash),
      () => { reload().catch(() => undefined); });
  }
  const outstanding = tokens.filter((t) => !t.consumedAt);
  return (
    <Panel title={`Enrolment tokens · ${outstanding.length} outstanding`}
           action={<button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                            onClick={() => { reload().catch(() => undefined); }}>
             <UiIcon icon="refresh" size={14} /><span>Refresh</span>
           </button>}>
      {tokens.length === 0 ? (
        <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
          No enrol tokens issued yet. Use <strong>Enrol a device</strong> above to issue one.
        </p>
      ) : (
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Token (truncated)</th><th>Hint</th><th>Issued</th><th>Expires</th>
              <th>Status</th><th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {tokens.map((t) => {
                const expired = t.expiresAt && new Date(t.expiresAt) < new Date();
                const revoked = t.consumedBy === 'REVOKED';
                const status: { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' } =
                  revoked           ? { label: 'REVOKED',  tone: 'danger' }
                  : t.consumedAt    ? { label: 'CONSUMED', tone: 'success' }
                  : expired         ? { label: 'EXPIRED',  tone: 'muted' }
                                    : { label: 'ACTIVE',   tone: 'success' };
                return (
                  <tr key={t.tokenHash}>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {t.tokenHash.slice(0, 20)}…
                    </td>
                    <td>{t.deviceIdHint ?? '—'}</td>
                    <td className="ea-text-muted">{t.issuedAt ? fmtAgo(t.issuedAt) : '—'}</td>
                    <td className="ea-text-muted">{t.expiresAt ? fmtAgo(t.expiresAt) : '—'}</td>
                    <td><Status tone={status.tone}>{status.label}</Status></td>
                    <td style={{ textAlign: 'right' }}>
                      {!t.consumedAt && !expired && (
                        <RowMenu items={[
                          { label: 'Revoke', danger: true, onSelect: () => revoke(t.tokenHash) },
                        ]} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ClientLabelDialog({ client, onClose, onSaved }: {
  client: edgeApi.NetworkClient;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [owner, setOwner] = useState(client.owner ?? '');
  const [hostname, setHostname] = useState(client.hostname ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      await edgeApi.networkClientEdit(client.deviceId, { owner, hostname });
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
                    padding: 24, maxWidth: 460, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Edit label — {client.deviceId}</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Owner / role
            <input className="ea-input" value={owner}
                   placeholder="e.g. Registration, Laboratory"
                   onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Hostname
            <input className="ea-input" value={hostname}
                   placeholder="e.g. tab-reg-01"
                   onChange={(e) => setHostname(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving} onClick={save}>
            {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="edit" size={14} />}
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DeviceCertDialog({ client, onClose }: {
  client: edgeApi.NetworkClient; onClose: () => void;
}): JSX.Element {
  const [ca, setCa] = useState<edgeApi.NetworkCaInfo | null>(null);
  useEffect(() => {
    edgeApi.networkCa().then(setCa).catch(() => undefined);
  }, []);
  return (
    <div className="ea-modal-overlay" onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="ea-modal" onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface)', border: '1px solid var(--der-border)',
                    padding: 24, maxWidth: 560, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Certificate — {client.deviceId}</h3>
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Trust</dt>
            <dd><Status tone={client.trust === 'APPROVED' ? 'success'
                                : client.trust === 'PENDING' ? 'warning' : 'danger'}>{client.trust}</Status></dd></div>
          <div className="ea-def-row"><dt>Owner</dt><dd>{client.owner ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Hostname</dt><dd className="ea-mono">{client.hostname ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>IP</dt><dd className="ea-mono">{client.ip}</dd></div>
          <div className="ea-def-row"><dt>MAC</dt><dd className="ea-mono">{client.mac ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Link</dt>
            <dd>{client.link === 'wifi' ? 'Wi-Fi' : client.link === 'ethernet' ? 'Ethernet' : 'Cellular'}</dd></div>
          <div className="ea-def-row"><dt>First seen</dt>
            <dd className="ea-mono">{client.firstSeenAt ? fmtDate(client.firstSeenAt) : '—'}</dd></div>
          <div className="ea-def-row"><dt>Last seen</dt><dd className="ea-mono">{fmtDate(client.lastSeenAt)}</dd></div>
          <div className="ea-def-row"><dt>Attestation</dt>
            <dd className="ea-mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
              {client.certificateFingerprint ?? '(none — device enrolled without a public key)'}
            </dd></div>
        </dl>
        {ca && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--der-raised)',
                        border: '1px solid var(--der-border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Signed by DER internal CA
            </div>
            <div className="ea-mono" style={{ fontSize: 11, wordBreak: 'break-all',
                                              color: 'var(--der-ink-700)' }}>
              {ca.algorithm} · {ca.fingerprint}
            </div>
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── /network/interfaces ─────────────── */
export function NetworkInterfaces(): JSX.Element {
  const [ifaces, setIfaces] = useState<edgeApi.NetworkInterface[] | null>(null);
  const [leases, setLeases] = useState<edgeApi.NetworkLease[]>([]);
  const [routes, setRoutes] = useState<edgeApi.NetworkRoute[]>([]);
  const [missing, setMissing] = useState(false);
  const [editIface, setEditIface] = useState<edgeApi.NetworkInterface | null>(null);
  const [showPinLease, setShowPinLease] = useState(false);
  function removeLease(mac: string): void {
    runAction(`Delete lease ${mac}? If the client is still connected it will reacquire a dynamic address.`,
      () => edgeApi.networkLeaseDelete(mac),
      () => { reload().catch(() => undefined); });
  }
  async function reload(): Promise<void> {
    try { setIfaces((await edgeApi.networkInterfaces()).interfaces); setMissing(false); }
    catch { setMissing(true); setIfaces([]); }
    try { setLeases((await edgeApi.networkLeases()).leases); }
    catch { /* leave previous */ }
    try { setRoutes((await edgeApi.networkRoutes()).routes); }
    catch { /* leave previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  const up = (ifaces ?? []).filter((i) => i.state === 'up').length;
  const toggle = (iface: edgeApi.NetworkInterface): void => {
    const target: 'up' | 'down' = iface.state === 'up' ? 'down' : 'up';
    runAction(`${target === 'up' ? 'Bring up' : 'Take down'} interface ${iface.name}? Running traffic may interrupt.`,
      () => edgeApi.networkInterfaceSetState(iface.name, { state: target }),
      () => { reload().catch(() => undefined); });
  };
  return (
    <div className="ea-screen" data-test="network-interfaces">
      <SyncStatusBar
        tone={up > 0 ? 'success' : 'muted'}
        title="Interfaces"
        statusLabel={ifaces == null ? 'Loading' : `${up} up / ${ifaces.length}`}
        subtitle={<span>Network interfaces reported by the DER Network Agent.</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/network/diagnostics" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="diagnostics" size={14} />
              <span>Diagnose</span>
            </Link>
            <Link to="/network/settings" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="edit" size={14} />
              <span>Edit (host config)</span>
            </Link>
          </>
        }
      />
      {missing && (ifaces?.length ?? 0) === 0 ? (
        <EmptyBlock title="Interface inventory not available" testId="empty-net-ifaces">
          {UNAVAILABLE_HINT}
        </EmptyBlock>
      ) : (
        <Panel title="Interfaces">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Name</th><th>Kind</th><th>Purpose</th>
                <th>State</th><th>Address</th><th>MAC</th><th>Link</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {(ifaces ?? []).map((i) => (
                  <tr key={i.name}>
                    <td className="ea-mono" style={{ fontWeight: 500 }}>{i.name}</td>
                    <td>{humaniseKind(i.kind)}</td>
                    <td>{humanisePurpose(i.purpose)}</td>
                    <td>
                      <Status tone={i.state === 'up' ? 'success'
                                     : i.state === 'degraded' ? 'warning'
                                     : i.state === 'down' ? 'muted' : 'muted'}>
                        {i.state}
                      </Status>
                    </td>
                    <td className="ea-mono">{i.address ?? '—'}</td>
                    <td className="ea-mono ea-text-muted" style={{ fontSize: 12 }}>{i.mac ?? '—'}</td>
                    <td className="ea-text-muted">{i.linkSpeed ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Edit (priority / purpose)',
                          onSelect: () => setEditIface(i) },
                        { label: i.state === 'up' ? 'Take down' : 'Bring up',
                          danger: i.state === 'up',
                          disabled: i.kind === 'loopback',
                          onSelect: () => toggle(i) },
                        { label: 'View in diagnostics',  to: '/network/diagnostics' },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title={`Routes · ${routes.length}`}
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>Lower metric evaluated first.</span>}>
        {routes.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>No routes.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Destination</th><th>Gateway</th><th>Interface</th>
                <th>Metric</th><th>Source</th><th>Active</th>
              </tr></thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="ea-mono">{r.destination}</td>
                    <td className="ea-mono">{r.gateway ?? '—'}</td>
                    <td className="ea-mono">{r.interface ?? '—'}</td>
                    <td className="ea-mono">{r.metric}</td>
                    <td className="ea-text-muted">{r.source}</td>
                    <td>
                      <Status tone={r.active ? 'success' : 'muted'}>
                        {r.active ? 'ACTIVE' : 'inactive'}
                      </Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editIface && <InterfaceConfigDialog iface={editIface}
          onClose={() => setEditIface(null)}
          onSaved={() => { setEditIface(null); reload().catch(() => undefined); }} />}

      <Panel title={`DHCP leases · ${leases.length}`}
             action={<button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                              onClick={() => setShowPinLease(true)}>
               <UiIcon icon="plus" size={14} /><span>Pin static lease</span>
             </button>}>
        {leases.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No active DHCP leases. Devices appear here once the local DHCP server grants an address.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>MAC</th><th>IP</th><th>Hostname</th><th>Issued</th><th>Expires</th><th>Kind</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {leases.map((l) => (
                  <tr key={l.mac}>
                    <td className="ea-mono">{l.mac}</td>
                    <td className="ea-mono">{l.ip}</td>
                    <td>{l.hostname ?? '—'}</td>
                    <td className="ea-text-muted">{l.issuedAt ? fmtAgo(l.issuedAt) : '—'}</td>
                    <td className="ea-text-muted">{l.expiresAt ? fmtAgo(l.expiresAt) : '—'}</td>
                    <td>
                      <Status tone={l.staticLease ? 'info' : 'muted'}>
                        {l.staticLease ? 'STATIC' : 'DYNAMIC'}
                      </Status>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Delete lease', danger: true, onSelect: () => removeLease(l.mac) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showPinLease && <StaticLeaseDialog
          onClose={() => setShowPinLease(false)}
          onSaved={() => { setShowPinLease(false); reload().catch(() => undefined); }} />}
    </div>
  );
}

function StaticLeaseDialog({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void;
}): JSX.Element {
  const [mac, setMac] = useState('');
  const [ip, setIp] = useState('');
  const [hostname, setHostname] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      await edgeApi.networkLeasePin({ mac, ip, hostname: hostname || undefined });
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
                    padding: 24, maxWidth: 460, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Pin static DHCP lease</h3>
        <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Reserve an IP for a specific MAC. The DHCP server will always
          hand out this IP when the device joins the network.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>MAC address
            <input className="ea-input" value={mac}
                   placeholder="aa:bb:cc:00:00:01"
                   onChange={(e) => setMac(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>IP address
            <input className="ea-input" value={ip}
                   placeholder="10.88.0.60"
                   onChange={(e) => setIp(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Hostname (optional)
            <input className="ea-input" value={hostname}
                   placeholder="tab-reg-01"
                   onChange={(e) => setHostname(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving || !mac || !ip} onClick={save}>
            {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="plus" size={14} />}
            <span>{saving ? 'Saving…' : 'Pin lease'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InterfaceConfigDialog({ iface, onClose, onSaved }: {
  iface: edgeApi.NetworkInterface;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [priority, setPriority] = useState<number>(iface.priority ?? 100);
  const [purpose, setPurpose] = useState<string>(iface.purpose ?? 'unknown');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      await edgeApi.networkInterfaceEdit(iface.name, { priority, purpose });
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
                    padding: 24, maxWidth: 460, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Edit interface — {iface.name}</h3>
        <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Priority drives WAN failover — lowest value wins. Purpose
          controls whether the interface is eligible as a WAN candidate.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Purpose
            <select className="ea-input" value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}>
              <option value="local-ap">Local AP</option>
              <option value="facility-lan">Facility LAN</option>
              <option value="upstream-wifi">Upstream Wi-Fi</option>
              <option value="cellular-fallback">Cellular fallback</option>
              <option value="unknown">—</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Priority (lower = preferred for WAN)
            <input className="ea-input" type="number" value={priority}
                   onChange={(e) => setPriority(Number(e.target.value))} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving} onClick={save}>
            {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="edit" size={14} />}
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function humaniseKind(k: edgeApi.NetworkInterface['kind']): string {
  switch (k) {
    case 'wifi': return 'Wi-Fi';
    case 'ethernet': return 'Ethernet';
    case 'cellular': return 'Cellular';
    case 'virtual': return 'Virtual';
    case 'loopback': return 'Loopback';
  }
}
function humanisePurpose(k: edgeApi.NetworkInterface['purpose']): string {
  switch (k) {
    case 'local-ap': return 'Local AP';
    case 'facility-lan': return 'Facility LAN';
    case 'upstream-wifi': return 'Upstream Wi-Fi';
    case 'cellular-fallback': return 'Cellular fallback';
    case 'unknown': return '—';
  }
}

/* ─────────────── /network/peers ─────────────── */
export function NetworkPeers(): JSX.Element {
  const [peers, setPeers] = useState<edgeApi.NetworkPeer[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editPeer, setEditPeer] = useState<edgeApi.NetworkPeer | null>(null);
  async function reload(): Promise<void> {
    try { setPeers((await edgeApi.networkPeers()).peers); setMissing(false); }
    catch { setMissing(true); setPeers([]); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  const connect    = (id: string): void => runAction(
    `Connect peer ${id}?`, () => edgeApi.networkPeerConnect(id),
    () => { reload().catch(() => undefined); });
  const disconnect = (id: string): void => runAction(
    `Disconnect peer ${id}? Any in-flight traffic over this tunnel will stop.`,
    () => edgeApi.networkPeerDisconnect(id), () => { reload().catch(() => undefined); });
  const remove     = (id: string): void => runAction(
    `Remove peer ${id}? Its WireGuard config will be deleted. This cannot be undone.`,
    () => edgeApi.networkPeerRemove(id), () => { reload().catch(() => undefined); });
  return (
    <div className="ea-screen" data-test="network-peers">
      <SyncStatusBar
        tone="muted"
        title="Peers"
        statusLabel={peers == null ? 'Loading' : `${peers.length} configured`}
        subtitle={
          <>
            <span>Optional secure peer links (WireGuard / Wi-Fi Direct).</span>
            <span>·</span>
            <span>Peer connectivity does not imply peer-to-peer data sync — DER remains the shared authority.</span>
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => setShowAdd(true)}>
              <UiIcon icon="plus" size={14} />
              <span>Add peer</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/network/settings" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="settings" size={14} />
              <span>Peer settings</span>
            </Link>
          </>
        }
      />
      {missing || (peers?.length ?? 0) === 0 ? (
        <EmptyBlock title="No peers configured" testId="empty-net-peers">
          Peer links are an optional resilience mechanism that lands in
          <strong> Phase N5</strong>. Workflows continue to route through
          DER even when peers are enabled.
        </EmptyBlock>
      ) : (
        <Panel title="Peer links">
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Node</th><th>Site</th><th>Endpoint</th><th>State</th>
                <th>Last handshake</th><th>Trust</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {(peers ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="ea-mono">{p.nodeId}</td>
                    <td>{p.siteId ?? '—'}</td>
                    <td className="ea-mono">{p.endpoint}</td>
                    <td>
                      <Status tone={p.state === 'CONNECTED' ? 'success'
                                     : p.state === 'HANDSHAKING' ? 'info'
                                     : p.state === 'ERROR' ? 'danger' : 'muted'}>
                        {p.state}
                      </Status>
                    </td>
                    <td className="ea-text-muted">{p.lastHandshake ? fmtAgo(p.lastHandshake) : '—'}</td>
                    <td>
                      <Status tone={p.trust === 'TRUSTED' ? 'success'
                                     : p.trust === 'UNVERIFIED' ? 'warning' : 'danger'}>
                        {p.trust}
                      </Status>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Edit peer', onSelect: () => setEditPeer(p) },
                        ...(p.state === 'CONNECTED'
                            ? [{ label: 'Disconnect', onSelect: () => disconnect(p.id) }]
                            : [{ label: 'Connect', onSelect: () => connect(p.id) }]),
                        { label: 'View audit', to: `/audit/events?peer=${encodeURIComponent(p.id)}` },
                        { label: 'Remove peer', danger: true, onSelect: () => remove(p.id) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {showAdd && <PeerDialog mode="add"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); reload().catch(() => undefined); }} />}
      {editPeer && <PeerDialog mode="edit" peer={editPeer}
          onClose={() => setEditPeer(null)}
          onSaved={() => { setEditPeer(null); reload().catch(() => undefined); }} />}
    </div>
  );
}

function PeerDialog({ mode, peer, onClose, onSaved }: {
  mode: 'add' | 'edit';
  peer?: edgeApi.NetworkPeer;
  onClose: () => void; onSaved: () => void;
}): JSX.Element {
  const [nodeId, setNodeId] = useState(peer?.nodeId ?? '');
  const [siteId, setSiteId] = useState(peer?.siteId ?? '');
  const [endpoint, setEndpoint] = useState(peer?.endpoint ?? '');
  const [publicKey, setPublicKey] = useState(peer?.publicKey ?? '');
  const [allowedIps, setAllowedIps] = useState(peer?.allowedIps ?? '10.88.0.0/24');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      if (mode === 'edit' && peer) {
        await edgeApi.networkPeerEdit(peer.id, { nodeId, siteId: siteId || null,
                                                   endpoint, publicKey, allowedIps });
      } else {
        await edgeApi.networkPeerAdd({ nodeId, siteId: siteId || null, endpoint,
                                        publicKey, allowedIps });
      }
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
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
          {mode === 'edit' ? 'Edit WireGuard peer' : 'Add WireGuard peer'}
        </h3>
        <p className="ea-text-muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
          The peer's WireGuard public key + reachable endpoint are
          required. Connection is established after you click Connect
          on the Peers row.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Node ID
            <input className="ea-input" value={nodeId}
                   placeholder="edge-012" onChange={(e) => setNodeId(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Site ID (optional)
            <input className="ea-input" value={siteId}
                   placeholder="e.g. health-centre-nakawa"
                   onChange={(e) => setSiteId(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Endpoint (host:port)
            <input className="ea-input" value={endpoint}
                   placeholder="203.0.113.9:51820"
                   onChange={(e) => setEndpoint(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>WireGuard public key
            <textarea className="ea-input" rows={2}
                      style={{ fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                      value={publicKey}
                      placeholder="base64 public key"
                      onChange={(e) => setPublicKey(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Allowed IPs
            <input className="ea-input" value={allowedIps}
                   onChange={(e) => setAllowedIps(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving || !endpoint || !publicKey}
                  onClick={save}>
            {saving ? <span className="ea-btn-spinner" />
                     : <UiIcon icon={mode === 'edit' ? 'edit' : 'plus'} size={14} />}
            <span>{saving ? 'Saving…' : (mode === 'edit' ? 'Save' : 'Save peer')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── /network/security ─────────────── */
export function NetworkSecurity(): JSX.Element {
  const [rules, setRules] = useState<edgeApi.NetworkPolicyRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState<edgeApi.NetworkPolicyRule | null>(null);
  async function reload(): Promise<void> {
    try { setRules((await edgeApi.networkPolicy()).rules); }
    catch { /* leave previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  function downloadPolicy(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      clientIsolation: true,
      rules,
    };
    downloadBlob(`der-network-policy-${new Date().toISOString().slice(0,10)}.json`,
                 JSON.stringify(payload, null, 2), 'application/json');
  }
  function cycleAction(r: edgeApi.NetworkPolicyRule): void {
    const next: edgeApi.NetworkPolicyRule['action'] =
      r.action === 'allow'      ? 'controlled'
      : r.action === 'controlled' ? 'deny'
      : 'allow';
    runAction(`Change ${r.sourceZone} → ${r.destinationZone} from ${r.action.toUpperCase()} to ${next.toUpperCase()}?`,
      () => edgeApi.networkPolicyUpdate(r.id, { action: next, note: r.note ?? undefined }),
      () => { reload().catch(() => undefined); });
  }
  function removeRule(r: edgeApi.NetworkPolicyRule): void {
    runAction(`Remove rule ${r.sourceZone} → ${r.destinationZone}? Devices will fall through to the default-deny chain.`,
      () => edgeApi.networkPolicyDelete(r.id),
      () => { reload().catch(() => undefined); });
  }
  return (
    <div className="ea-screen" data-test="network-security">
      <SyncStatusBar
        tone="success"
        title="Network security"
        statusLabel="Client isolation on"
        subtitle={
          <>
            <span>Firewall policy and admission controls on the DER local network.</span>
            <span>·</span>
            <span>Per spec §14 — client-to-client traffic is denied by default.</span>
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => setShowAdd(true)}>
              <UiIcon icon="plus" size={14} />
              <span>Add rule</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={rules.length === 0}
                    onClick={downloadPolicy}>
              <UiIcon icon="download" size={14} />
              <span>Download policy</span>
            </button>
            <Link to="/audit/events?category=network" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="audit" size={14} />
              <span>View audit</span>
            </Link>
          </>
        }
      />

      <Panel title="Firewall policy">
        <table className="ea-table ea-table--dense" style={{ margin: 10 }}>
          <thead><tr>
            <th style={{ width: 56 }}>#</th>
            <th>Source</th><th>Destination</th><th>Action</th><th>Note</th>
            <th style={{ width: 48 }} aria-label="Actions"></th>
          </tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="ea-mono">{r.position}</td>
                <td>{r.sourceZone}</td>
                <td>{r.destinationZone}</td>
                <td>
                  <button type="button"
                          onClick={() => cycleAction(r)}
                          style={{ background: 'none', border: 'none', padding: 0,
                                   cursor: 'pointer' }}>
                    <Status tone={r.action === 'allow' ? 'success'
                                   : r.action === 'controlled' ? 'warning' : 'danger'}>
                      {r.action === 'allow' ? 'ALLOW'
                        : r.action === 'controlled' ? 'CONTROLLED' : 'DENY'}
                    </Status>
                  </button>
                </td>
                <td className="ea-text-muted" style={{ fontSize: 12 }}>{r.note ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <RowMenu items={[
                    { label: 'Edit rule', onSelect: () => setEditRule(r) },
                    { label: 'Cycle action', onSelect: () => cycleAction(r) },
                    { label: 'Delete rule', danger: true, onSelect: () => removeRule(r) },
                  ]} />
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={6} className="ea-text-muted"
                      style={{ padding: 14, textAlign: 'center' }}>
                No policy rules. Click <strong>Add rule</strong> to create the first one.
              </td></tr>
            )}
          </tbody>
        </table>
      </Panel>

      <TlsCertPanel />

      {showAdd && <PolicyDialog mode="add"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); reload().catch(() => undefined); }} />}
      {editRule && <PolicyDialog mode="edit" rule={editRule}
          onClose={() => setEditRule(null)}
          onSaved={() => { setEditRule(null); reload().catch(() => undefined); }} />}
    </div>
  );
}

function TlsCertPanel(): JSX.Element {
  const [tls, setTls] = useState<edgeApi.NetworkTlsCert | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    edgeApi.networkTls().then(setTls).catch((e) =>
      setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  function downloadPem(): void {
    if (!tls) return;
    const pem = '-----BEGIN PUBLIC KEY-----\n'
              + tls.publicKeyBase64.match(/.{1,64}/g)?.join('\n') + '\n'
              + '-----END PUBLIC KEY-----\n';
    downloadBlob('der-local-tls.pub.pem', pem, 'application/x-pem-file');
  }
  const expiresAt = tls?.notAfter ? new Date(tls.notAfter) : null;
  const daysLeft  = expiresAt
    ? Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const tone: 'success' | 'warning' | 'danger' =
    daysLeft == null || daysLeft < 0 ? 'danger'
    : daysLeft < 30 ? 'warning' : 'success';
  return (
    <Panel title="TLS certificate — https://der.local"
           action={<button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                            disabled={!tls} onClick={downloadPem}>
             <UiIcon icon="download" size={14} /><span>Download pubkey</span>
           </button>}>
      {err ? (
        <p className="ea-text-muted" style={{ margin: 0, padding: 10,
                                              color: 'var(--der-danger-ink)' }}>
          Couldn't load TLS state — {err}
        </p>
      ) : !tls ? (
        <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>Loading…</p>
      ) : (
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Status</dt>
            <dd><Status tone={tone}>
              {daysLeft != null && daysLeft >= 0
                ? `${daysLeft} days until expiry`
                : 'EXPIRED'}
            </Status></dd></div>
          <div className="ea-def-row"><dt>Subject</dt>
            <dd className="ea-mono">{tls.subject}</dd></div>
          <div className="ea-def-row"><dt>Issuer</dt>
            <dd className="ea-mono">{tls.issuer}</dd></div>
          <div className="ea-def-row"><dt>Algorithm</dt>
            <dd className="ea-mono">{tls.algorithm}</dd></div>
          <div className="ea-def-row"><dt>Fingerprint</dt>
            <dd className="ea-mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
              {tls.fingerprint}
            </dd></div>
          <div className="ea-def-row"><dt>SAN</dt>
            <dd className="ea-mono">{tls.san.join(', ')}</dd></div>
          <div className="ea-def-row"><dt>Not before</dt>
            <dd className="ea-mono">{fmtDate(tls.notBefore)}</dd></div>
          <div className="ea-def-row"><dt>Not after</dt>
            <dd className="ea-mono">{fmtDate(tls.notAfter)}</dd></div>
        </dl>
      )}
    </Panel>
  );
}

function PolicyDialog({ mode, rule, onClose, onSaved }: {
  mode: 'add' | 'edit';
  rule?: edgeApi.NetworkPolicyRule;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [src, setSrc] = useState(rule?.sourceZone ?? 'Client');
  const [dst, setDst] = useState(rule?.destinationZone ?? '');
  const [action, setAction] = useState<edgeApi.NetworkPolicyRule['action']>(rule?.action ?? 'allow');
  const [note, setNote] = useState(rule?.note ?? '');
  const [position, setPosition] = useState<number>(rule?.position ?? 500);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      if (mode === 'edit' && rule) {
        await edgeApi.networkPolicyEditFull(rule.id, { sourceZone: src, destinationZone: dst,
                                                        action, note, position });
      } else {
        await edgeApi.networkPolicyAdd({ sourceZone: src, destinationZone: dst,
                                          action, note, position });
      }
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
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
          {mode === 'edit' ? 'Edit firewall rule' : 'Add firewall rule'}
        </h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Source zone
            <input className="ea-input" value={src} onChange={(e) => setSrc(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Destination zone
            <input className="ea-input" value={dst}
                   placeholder="e.g. DHIS2 Central"
                   onChange={(e) => setDst(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Action
            <select className="ea-input" value={action}
                    onChange={(e) => setAction(e.target.value as typeof action)}>
              <option value="allow">allow</option>
              <option value="controlled">controlled</option>
              <option value="deny">deny</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Position (lower = evaluated first)
            <input className="ea-input" type="number" value={position}
                   onChange={(e) => setPosition(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 12 }}>Note (optional)
            <input className="ea-input" value={note}
                   placeholder="rationale shown in the policy table"
                   onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving || !dst} onClick={save}>
            {saving ? <span className="ea-btn-spinner" />
                     : <UiIcon icon={mode === 'edit' ? 'edit' : 'plus'} size={14} />}
            <span>{saving ? 'Saving…' : (mode === 'edit' ? 'Save' : 'Add rule')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── /network/diagnostics ─────────────── */
export function NetworkDiagnostics(): JSX.Element {
  const [status, setStatus] = useState<edgeApi.NetworkStatus | null>(null);
  const [events, setEvents] = useState<edgeApi.NetworkEvent[]>([]);
  const [missing, setMissing] = useState(false);
  const [probing, setProbing] = useState(false);
  const ping = useCentralReachable();
  async function reload(): Promise<void> {
    try { setStatus(await edgeApi.networkStatus()); } catch { setMissing(true); }
    try { setEvents((await edgeApi.networkEvents(50)).events ?? []); } catch { /* keep previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function reprobe(): Promise<void> {
    setProbing(true);
    try { await edgeApi.dhis2Ping(); } catch { /* ignore */ }
    await reload();
    setProbing(false);
  }
  function exportEvents(): void {
    const rows = events.map((e) =>
      [e.observedAt, e.eventType, e.interfaceName ?? '', e.deviceId ?? '',
       e.nodeId ?? '', e.outcome, e.reason ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = ['observedAt,eventType,interface,deviceId,nodeId,outcome,reason', ...rows].join('\n');
    downloadBlob(`der-network-events-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv');
  }
  function clearEvents(): void {
    runAction('Clear the local network event log? Server-side audit is kept.',
      () => edgeApi.networkEventsClear(), () => { reload().catch(() => undefined); });
  }
  function copyEvent(e: edgeApi.NetworkEvent): void {
    const text = JSON.stringify(e, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
  }
  const paged = usePaged(events, 25);
  return (
    <div className="ea-screen" data-test="network-diagnostics">
      <SyncStatusBar
        tone={status?.state === 'CONNECTED' ? 'success' : 'warning'}
        title="Network diagnostics"
        statusLabel={status?.state ? humanState(status.state) : missing ? 'Service pending' : 'Loading'}
        subtitle={<span>Live probe path from a client through DER to Central DHIS2.</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    disabled={probing}
                    onClick={() => { reprobe().catch(() => undefined); }}>
              {probing ? <span className="ea-btn-spinner" /> : <UiIcon icon="refresh" size={14} />}
              <span>{probing ? 'Probing…' : 'Re-probe path'}</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={events.length === 0}
                    onClick={exportEvents}>
              <UiIcon icon="download" size={14} />
              <span>Export events</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={events.length === 0}
                    onClick={clearEvents}>
              <UiIcon icon="trash" size={14} />
              <span>Clear events</span>
            </button>
            <Link to="/audit/events?category=network" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="audit" size={14} />
              <span>Full audit</span>
            </Link>
          </>
        }
      />

      <Panel title="Probe path">
        <ol className="ea-net-probe-path">
          <ProbeStep label="Client → DER LAN"
                     tone={status?.localLanAvailable === true ? 'success'
                            : status?.localLanAvailable === false ? 'danger' : 'info'}
                     hint={status ? 'Client can reach the DER subnet' : 'awaiting signal'} />
          <ProbeStep label="DER runtime" tone="success" hint="DER server responds locally" />
          <ProbeStep label="DNS resolves Central"
                     tone={status?.dnsAvailable === true ? 'success'
                            : status?.dnsAvailable === false ? 'danger' : 'info'}
                     hint={status ? '/etc/resolv.conf resolves the configured host' : 'awaiting signal'} />
          <ProbeStep label="DER → Internet"
                     tone={status?.internetAvailable === true ? 'success'
                            : status?.internetAvailable === false ? 'danger' : 'info'}
                     hint={status ? 'Reachable WAN gateway' : 'awaiting signal'} />
          <ProbeStep label="DER → Central DHIS2"
                     tone={ping.reachable === false ? 'danger' : ping.reachable ? 'success' : 'info'}
                     hint={ping.latencyMs != null ? `probe ${ping.latencyMs} ms` : 'probing…'} />
        </ol>
      </Panel>

      <MdnsPanel />

      <Panel title="Network events">
        {events.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No network events yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Observed</th><th>Event</th><th>Interface</th>
                <th>Device / node</th><th>Outcome</th><th>Reason</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {paged.rows.map((e) => (
                  <tr key={e.eventId}>
                    <td className="ea-mono">{fmtDate(e.observedAt)}</td>
                    <td style={{ fontWeight: 500 }}>{humaniseEventType(e.eventType)}</td>
                    <td className="ea-mono ea-text-muted">{e.interfaceName ?? '—'}</td>
                    <td className="ea-mono ea-text-muted" style={{ fontSize: 13 }}>
                      {e.deviceId ?? e.nodeId ?? '—'}
                    </td>
                    <td>
                      <Status tone={e.outcome === 'SUCCESS' ? 'success'
                                     : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                        {e.outcome}
                      </Status>
                    </td>
                    <td className="ea-text-muted">{e.reason ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Copy JSON', onSelect: () => copyEvent(e) },
                        ...(e.correlationId
                            ? [{ label: 'View correlation',
                                 to: `/audit/events?correlationId=${encodeURIComponent(e.correlationId)}` }]
                            : []),
                        ...(e.deviceId
                            ? [{ label: 'View device',
                                 to: `/network/clients?device=${encodeURIComponent(e.deviceId)}` }]
                            : []),
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>
    </div>
  );
}

function MdnsPanel(): JSX.Element {
  const [services, setServices] = useState<edgeApi.MdnsService[]>([]);
  useEffect(() => {
    edgeApi.networkMdns().then((r) => setServices(r.services)).catch(() => undefined);
  }, []);
  return (
    <Panel title={`mDNS / service discovery · ${services.length}`}
           action={<span className="ea-text-muted" style={{ fontSize: 12 }}>
             Advertised on the local segment via Avahi.
           </span>}>
      {services.length === 0 ? (
        <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
          No services advertised.
        </p>
      ) : (
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Service type</th><th>Host</th><th>Port</th><th>Description</th>
            </tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.type}>
                  <td className="ea-mono">{s.type}</td>
                  <td className="ea-mono">{s.host}</td>
                  <td className="ea-mono">{s.port}</td>
                  <td className="ea-text-muted">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ProbeStep({ label, tone, hint }: { label: string; tone: 'success' | 'danger' | 'info'; hint: string }): JSX.Element {
  return (
    <li className={'ea-net-probe-step ea-net-probe-step--' + tone}>
      <div className="ea-net-probe-step-dot" aria-hidden="true" />
      <div className="ea-net-probe-step-body">
        <div className="ea-net-probe-step-label">{label}</div>
        <div className="ea-net-probe-step-hint">{hint}</div>
      </div>
      <Status tone={tone}>{tone === 'success' ? 'OK' : tone === 'danger' ? 'FAIL' : 'Checking'}</Status>
    </li>
  );
}

/* ─────────────── /network/settings ─────────────── */
export function NetworkSettings(): JSX.Element {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  async function reload(): Promise<void> {
    try { setSettings((await edgeApi.networkSettings()).settings); }
    catch { /* leave previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function exportBundle(): Promise<void> {
    try {
      const bundle = await edgeApi.networkExport();
      downloadBlob(`der-network-bundle-${new Date().toISOString().slice(0,10)}.json`,
                    JSON.stringify(bundle, null, 2), 'application/json');
    } catch { /* ignore */ }
  }
  function importBundle(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setImporting(true); setImportResult(null);
      try {
        const text = await f.text();
        const bundle = JSON.parse(text);
        const r = await edgeApi.networkImport(bundle);
        setImportResult(
          `Imported: ${r.rules} rules · ${r.settings} settings · `
          + `${r.interfaces} ifaces · ${r.peers} peers · ${r.leases} leases.`);
        await reload();
      } catch (e) {
        setImportResult('Import failed: ' + (e instanceof Error ? e.message : String(e)));
      } finally { setImporting(false); }
    };
    input.click();
  }
  function startEdit(k: string): void {
    setEditKey(k);
    setEditValue(settings[k] ?? '');
  }
  async function commit(): Promise<void> {
    if (!editKey) return;
    setSaving(true);
    try {
      await edgeApi.networkSettingPut(editKey, editValue);
      setEditKey(null);
      await reload();
    } catch { /* leave open */ }
    finally { setSaving(false); }
  }
  function downloadYaml(): void {
    const yaml = Object.entries(settings).sort(([a], [b]) => a.localeCompare(b))
                       .map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
    downloadBlob('network.yaml', yaml, 'text/yaml');
  }
  function copyYaml(): void {
    const yaml = Object.entries(settings).sort(([a], [b]) => a.localeCompare(b))
                       .map(([k, v]) => `${k}: ${v}`).join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(yaml).catch(() => undefined);
    }
  }
  const keys = Object.keys(settings).sort();
  return (
    <div className="ea-screen" data-test="network-settings">
      <SyncStatusBar
        tone="info"
        title="Network settings"
        statusLabel={`${keys.length} keys`}
        subtitle={<span>Live edit of DER network configuration. Changes persist to der.network_settings and are picked up on the next agent reconcile.</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" onClick={exportBundle}>
              <UiIcon icon="download" size={14} />
              <span>Export bundle</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={importing} onClick={importBundle}>
              {importing ? <span className="ea-btn-spinner" /> : <UiIcon icon="restore" size={14} />}
              <span>{importing ? 'Importing…' : 'Import bundle'}</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={downloadYaml}>
              <UiIcon icon="download" size={14} />
              <span>network.yaml</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={copyYaml}>
              <UiIcon icon="copy" size={14} />
              <span>Copy</span>
            </button>
          </>
        }
      />
      {importResult && (
        <div style={{ padding: '10px 14px', background: 'var(--der-raised)',
                       border: '1px solid var(--der-border)', fontSize: 13 }}>
          {importResult}
        </div>
      )}

      <Panel title={`Network settings · ${keys.length}`}>
        {keys.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>No settings.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr><th style={{ width: 280 }}>Key</th><th>Value</th>
                <th style={{ width: 48 }} aria-label="Actions"></th></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{k}</td>
                    <td className="ea-mono">
                      {editKey === k ? (
                        <input className="ea-input" value={editValue}
                               onChange={(e) => setEditValue(e.target.value)}
                               onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                               autoFocus />
                      ) : settings[k]}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {editKey === k ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                                  disabled={saving} onClick={commit}>
                            {saving ? <span className="ea-btn-spinner" /> : null}
                            <span>Save</span>
                          </button>
                          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                  onClick={() => setEditKey(null)}>Cancel</button>
                        </div>
                      ) : (
                        <RowMenu items={[
                          { label: 'Edit', onSelect: () => startEdit(k) },
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
    </div>
  );
}

