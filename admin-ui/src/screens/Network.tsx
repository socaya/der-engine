import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

      {!servicePending && (
      <Panel title="Recent network events"
             action={<Link to="/network/diagnostics#events" className="ea-link-btn">View all →</Link>}>
        {events.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No network events yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Observed</th><th>Event</th><th>Device / node</th>
                <th>Outcome</th><th>Reason</th>
              </tr></thead>
              <tbody>
                {events.slice(0, 10).map((e) => (
                  <tr key={e.eventId}>
                    <td className="ea-mono">{fmtDate(e.observedAt)}</td>
                    <td style={{ fontWeight: 500 }}>{humaniseEventType(e.eventType)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      )}
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

      <Panel title="QR enrolment"
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>Phase N2</span>}>
        <p className="ea-text-muted" style={{ margin: 0, padding: 10, fontSize: 13 }}>
          Devices join the SSID, scan the QR, then open <code>https://der.local</code> to request
          enrolment. Approve each pending device from <Link to="/network/clients">Connected Devices</Link>.
        </p>
      </Panel>

      {showQr && <QrEnrolDialog onClose={() => setShowQr(false)} />}
    </div>
  );
}

function QrEnrolDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [qr, setQr] = useState<{ ssid: string; payload: string; qrSvg: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
  const [clients, setClients] = useState<edgeApi.NetworkClient[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState('');
  const [certFor, setCertFor] = useState<edgeApi.NetworkClient | null>(null);
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
                          ...(c.trust === 'PENDING' ? [{ label: 'Approve', onSelect: () => approve(c.deviceId) }] : []),
                          ...(c.trust === 'APPROVED' ? [{ label: 'Revoke', danger: true, onSelect: () => revoke(c.deviceId) }] : []),
                          ...(c.trust === 'BLOCKED'
                              ? [{ label: 'Unblock', onSelect: () => unblock(c.deviceId) }]
                              : [{ label: 'Block', danger: true, onSelect: () => block(c.deviceId) }]),
                          { label: 'View certificate', onSelect: () => setCertFor(c) },
                          { label: 'View audit', to: `/security/audit?device=${encodeURIComponent(c.deviceId)}` },
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

      {certFor && <DeviceCertDialog client={certFor} onClose={() => setCertFor(null)} />}
      {showEnrol && <QrEnrolDialog onClose={() => setShowEnrol(false)} />}
    </div>
  );
}

function DeviceCertDialog({ client, onClose }: {
  client: edgeApi.NetworkClient; onClose: () => void;
}): JSX.Element {
  return (
    <div className="ea-modal-overlay" onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="ea-modal" onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface)', border: '1px solid var(--der-border)',
                    padding: 24, maxWidth: 520, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Certificate — {client.deviceId}</h3>
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Trust</dt>
            <dd><Status tone={client.trust === 'APPROVED' ? 'success'
                                : client.trust === 'PENDING' ? 'warning' : 'danger'}>{client.trust}</Status></dd></div>
          <div className="ea-def-row"><dt>Owner</dt><dd>{client.owner ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Hostname</dt><dd className="ea-mono">{client.hostname ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>IP</dt><dd className="ea-mono">{client.ip}</dd></div>
          <div className="ea-def-row"><dt>Link</dt>
            <dd>{client.link === 'wifi' ? 'Wi-Fi' : client.link === 'ethernet' ? 'Ethernet' : 'Cellular'}</dd></div>
          <div className="ea-def-row"><dt>Last seen</dt><dd className="ea-mono">{fmtDate(client.lastSeenAt)}</dd></div>
        </dl>
        <p className="ea-text-muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
          Full X.509 certificate chain lands when the Network Agent (§13 Device Identity) ships
          in Phase N2.
        </p>
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
  const [missing, setMissing] = useState(false);
  async function reload(): Promise<void> {
    try { setIfaces((await edgeApi.networkInterfaces()).interfaces); setMissing(false); }
    catch { setMissing(true); setIfaces([]); }
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
                        { label: i.state === 'up' ? 'Take down' : 'Bring up',
                          danger: i.state === 'up',
                          disabled: i.kind === 'loopback',
                          onSelect: () => toggle(i) },
                        { label: 'Rename / reconfigure', to: '/network/settings' },
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
                    onClick={() => runAction(
                      'Peer provisioning is Phase N5. Open Network settings to prepare config?',
                      async () => undefined,
                      () => undefined)}>
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
                        ...(p.state === 'CONNECTED'
                            ? [{ label: 'Disconnect', onSelect: () => disconnect(p.id) }]
                            : [{ label: 'Connect', onSelect: () => connect(p.id) }]),
                        { label: 'View audit', to: `/security/audit?peer=${encodeURIComponent(p.id)}` },
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
    </div>
  );
}

/* ─────────────── /network/security ─────────────── */
export function NetworkSecurity(): JSX.Element {
  function downloadPolicy(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      clientIsolation: true,
      rules: FIREWALL_RULES,
    };
    downloadBlob(`der-network-policy-${new Date().toISOString().slice(0,10)}.json`,
                 JSON.stringify(payload, null, 2), 'application/json');
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
            <Link to="/network/settings" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="edit" size={14} />
              <span>Edit policy</span>
            </Link>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={downloadPolicy}>
              <UiIcon icon="download" size={14} />
              <span>Download policy</span>
            </button>
            <Link to="/security/audit?category=network" className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="audit" size={14} />
              <span>View audit</span>
            </Link>
          </>
        }
      />

      <Panel title="Default firewall policy">
        <table className="ea-table ea-table--dense" style={{ margin: 10 }}>
          <thead><tr><th>Source</th><th>Destination</th><th>Policy</th></tr></thead>
          <tbody>
            {FIREWALL_RULES.map((r) => (
              <tr key={r.source + r.dest}>
                <td>{r.source}</td><td>{r.dest}</td>
                <td>
                  <Status tone={r.allow === 'allow' ? 'success'
                                 : r.allow === 'controlled' ? 'warning' : 'danger'}>
                    {r.allow === 'allow' ? 'ALLOW'
                      : r.allow === 'controlled' ? 'CONTROLLED' : 'DENY'}
                  </Status>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Layered security model (§10)">
        <ol style={{ margin: 10, padding: '0 0 0 20px', fontSize: 14, lineHeight: 1.7 }}>
          <li>Wi-Fi / Ethernet connectivity</li>
          <li>Network admission</li>
          <li>Device identity</li>
          <li>TLS / encrypted tunnel</li>
          <li>DER user authentication</li>
          <li>DHIS2-derived authorization</li>
          <li>Workflow / record access rules</li>
          <li>Audit</li>
        </ol>
        <p className="ea-text-muted" style={{ margin: 10, fontSize: 13 }}>
          Can join DER network <strong>≠</strong> can access DER application / data.
        </p>
      </Panel>
    </div>
  );
}

const FIREWALL_RULES = [
  { source: 'Client', dest: 'DER HTTPS',       allow: 'allow' as const },
  { source: 'Client', dest: 'DER DNS',         allow: 'allow' as const },
  { source: 'Client', dest: 'DER DHCP',        allow: 'allow' as const },
  { source: 'Client', dest: 'Admin API',       allow: 'controlled' as const },
  { source: 'Client', dest: 'Client',          allow: 'deny' as const },
  { source: 'Client', dest: 'DER PostgreSQL',  allow: 'deny' as const },
  { source: 'Client', dest: 'DER SSH',         allow: 'deny' as const },
];

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
            <Link to="/security/audit?category=network" className="ea-btn ea-btn--ghost ea-btn--sm">
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
                                 to: `/security/audit?correlationId=${encodeURIComponent(e.correlationId)}` }]
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
  const config = useMemo(() => DEFAULT_CONFIG, []);
  function copyConfig(): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(config).catch(() => undefined);
    }
  }
  function editHint(): void {
    runAction(
      'Edit network settings is Phase N1 — settings land on disk at /etc/der/network.yaml and reload on service restart. Open the host-config docs?',
      async () => undefined, () => undefined);
  }
  return (
    <div className="ea-screen" data-test="network-settings">
      <SyncStatusBar
        tone="info"
        title="Network settings"
        statusLabel="Read-only"
        subtitle={<span>Network configuration applied to this edge. Managed via the DER host config.</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" onClick={editHint}>
              <UiIcon icon="edit" size={14} />
              <span>Edit (host config)</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => downloadBlob('network.yaml', config, 'text/yaml')}>
              <UiIcon icon="download" size={14} />
              <span>Download</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={copyConfig}>
              <UiIcon icon="copy" size={14} />
              <span>Copy</span>
            </button>
          </>
        }
      />

      <Panel title="network.yaml"
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>Phase N1 — edit via host config</span>}>
        <pre className="ea-log-tail" style={{ fontSize: 12, maxHeight: 'none', height: 'auto', padding: 14 }}>{config}</pre>
      </Panel>

      <Panel title="Scope boundary (§31)">
        <div style={{ padding: 10 }}>
          <strong>In scope</strong>
          <p className="ea-text-muted" style={{ margin: '4px 0 10px', fontSize: 13 }}>
            Access Point · LAN management · DHCP · local DNS · service discovery ·
            device enrolment · network isolation · HTTPS/TLS · network monitoring ·
            connectivity-state detection · offline-first mode · WAN recovery.
          </p>
          <strong>Optional / experimental</strong>
          <p className="ea-text-muted" style={{ margin: '4px 0 10px', fontSize: 13 }}>
            WireGuard overlay · Wi-Fi Direct · peer tunnels · local peer relay.
          </p>
          <strong>Out of core scope</strong>
          <p className="ea-text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Peer-to-peer record sync · CRDT client mesh · nationwide mesh networking.
          </p>
        </div>
      </Panel>
    </div>
  );
}

const DEFAULT_CONFIG = `network:
  mode: managed

  lan:
    subnet: 10.88.0.0/24
    gateway: 10.88.0.1

  accessPoint:
    enabled: true
    interface: wlan0
    ssid: DER-EDGE
    security: WPA3-SAE

  dhcp:
    enabled: true
    start: 10.88.0.50
    end: 10.88.0.200

  discovery:
    mdns: true
    hostname: der.local

  peer:
    enabled: false

  firewall:
    clientIsolation: true

  central:
    probeIntervalSeconds: 30
`;
