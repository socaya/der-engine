import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, SyncStatusBar, Breadcrumbs, confirmThenRun } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/** `/admin/devices/:deviceId` — per-device details page.
 *  Replaces the former right-side drawer. */
export function DeviceDetail(): JSX.Element {
  const navigate = useNavigate();
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<edgeApi.EdgeDeviceRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.listDevices();
      const d = r.devices.find((x) => x.deviceId === deviceId);
      if (!d) { setErr('Device not found on this edge.'); return; }
      setDevice(d);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  // Why: reload closes over state; re-run only when deviceId changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [deviceId]);

  function act(effect: string, fn: (id: string) => Promise<unknown>): void {
    if (!device) return;
    confirmThenRun(effect, async () => {
      setBusy(true);
      try { await fn(device.deviceId); await reload(); }
      finally { setBusy(false); }
    });
  }

  if (err) return <ErrorBlock title="Could not load device" testId="err-device-detail">{err}</ErrorBlock>;
  if (!device) return <LoadingBlock testId="loading" />;

  const tone = device.status === 'APPROVED' ? 'success'
             : device.status === 'PENDING'  ? 'warning' : 'danger';
  const shortId = device.deviceId.slice(0, 8);
  const displayLabel = device.displayName
                        ? `${device.displayName} · ${shortId}`
                        : `Device ${shortId}`;
  return (
    <div className="ea-screen" data-test="device-detail">
      <Breadcrumbs
        testId="device-detail-crumbs"
        items={[
          { label: 'Devices', to: '/devices' },
          { label: displayLabel },
        ]} />
      <SyncStatusBar
        tone={tone}
        title={device.displayName ?? 'Device'}
        statusLabel={device.status}
        subtitle={
          <>
            <span className="ea-mono">{device.deviceId}</span>
            {device.lastSeenAt && (
              <>
                <span>·</span>
                <span>Last seen {fmtAgo(device.lastSeenAt)}</span>
              </>
            )}
          </>
        }
        actions={
          <>
            {device.status === 'PENDING' && (
              <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                      onClick={() => { act(`Approve device ${device.deviceId.slice(0, 12)}…? It will be allowed to sync data to this edge.`, edgeApi.approveDevice); }}>
                Approve
              </button>
            )}
            {device.status === 'APPROVED' && (
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" disabled={busy}
                      onClick={() => { act(`Suspend device ${device.deviceId.slice(0, 12)}…? It will keep its enrolment but stop accepting new sessions.`, edgeApi.suspendDevice); }}>
                Suspend
              </button>
            )}
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger" disabled={busy}
                    onClick={() => { act(`Revoke device ${device.deviceId.slice(0, 12)}…? Its credentials will be invalidated — it will need to re-enrol to come back.`, edgeApi.revokeDevice); }}>
              Revoke
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={() => navigate('/devices')}>
              Close
            </button>
          </>
        }
      />
      <section className="ea-panel">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Device ID</dt><dd className="ea-mono">{device.deviceId}</dd></div>
          <div className="ea-def-row"><dt>Status</dt><dd>{device.status}</dd></div>
          <div className="ea-def-row"><dt>Enrolled</dt><dd className="ea-mono">{fmtDate(device.enrolledAt)}</dd></div>
          <div className="ea-def-row"><dt>Approved by</dt><dd>{device.approvedBy ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Last seen</dt>
            <dd className="ea-mono">{device.lastSeenAt ? fmtDate(device.lastSeenAt) : '—'}</dd></div>
          <div className="ea-def-row"><dt>User agent</dt>
            <dd className="ea-mono" style={{ wordBreak: 'break-all' }}>{device.userAgent ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Firmware</dt>
            <dd className="ea-mono">{device.firmwareVersion ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Display name</dt>
            <dd>{device.displayName ?? <em className="ea-text-muted">unnamed</em>}</dd></div>
          <div className="ea-def-row"><dt>Form factor</dt>
            <dd>{device.formFactor ?? 'UNKNOWN'}</dd></div>
        </dl>
      </section>
      <DeviceProfileEditor device={device} onSaved={() => { reload().catch(() => undefined); }} />
      <DeviceRelatedActivity device={device} />
    </div>
  );
}

/** §2.3.79 — soft cross-link panel on the device detail page.
 *  Journal ops and workflow runs don't yet carry a device-id column
 *  we can filter on from the client, so for now this panel lists
 *  the obvious outbound destinations (Sync queue, Attention,
 *  Workflow monitoring, Network client row) that an admin would
 *  typically open next after inspecting a device. Data-driven
 *  filters are a follow-up once operation_journal grows
 *  `submitted_device_id`. */
function DeviceRelatedActivity(
  { device }: { device: edgeApi.EdgeDeviceRow }
): JSX.Element {
  const links: Array<{ to: string; label: string; hint: string; icon: 'data-queue' | 'attention' | 'analytics' | 'tei' }> = [
    { to: '/data/queue',            icon: 'data-queue',
      label: 'Sync queue',
      hint:  'Pending contributions awaiting push to DHIS2 Central.' },
    { to: '/sync/attention',       icon: 'attention',
      label: 'Sync attention',
      hint:  'Unresolved conflicts and failures requiring review.' },
    { to: '/workflows/monitoring', icon: 'analytics',
      label: 'Workflow monitoring',
      hint:  'Workflow activity feed; find runs this device contributed to.' },
    { to: '/network/clients',      icon: 'tei',
      label: 'Network client row',
      hint:  'LAN view: IP, trust, last-seen on the facility network.' },
  ];
  return (
    <Panel title="Related activity">
      <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}
         data-test="device-related-activity">
        Quick exits to where this device’s traffic appears across the
        other modules. Deep filtering by device id will follow once
        the journal schema carries it.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 10 }}>
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to}
                  className="ea-card ea-card--interactive"
                  data-test={`device-link-${l.icon}`}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: 12, textDecoration: 'none',
                            color: 'var(--der-ink-900)',
                            border: '1px solid var(--der-border)',
                            borderRadius: 6, background: 'var(--der-raised)' }}>
              <UiIcon icon={l.icon} size={18} />
              <span style={{ display: 'block' }}>
                <strong style={{ display: 'block', fontSize: 13 }}>{l.label}</strong>
                <span style={{ display: 'block', fontSize: 11,
                                 color: 'var(--der-ink-500)', marginTop: 2 }}>
                  {l.hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="ea-text-muted" style={{ margin: '12px 0 0', fontSize: 11 }}>
        Device id: <span className="ea-mono">{device.deviceId}</span>
      </p>
    </Panel>
  );
}

/** V043 — operator rename + form-factor edit used by the mesh topology. */
function DeviceProfileEditor(
  { device, onSaved }: { device: edgeApi.EdgeDeviceRow; onSaved(): void }
): JSX.Element {
  const [displayName, setDisplayName] = useState<string>(device.displayName ?? '');
  const [formFactor, setFormFactor] = useState<edgeApi.DeviceFormFactor>(
    device.formFactor ?? 'UNKNOWN');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true); setErr(null);
    try {
      await edgeApi.updateDeviceProfile(device.deviceId, {
        displayName: displayName.trim() === '' ? null : displayName.trim(),
        formFactor,
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="ea-panel" data-test="device-profile-editor">
      <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>Profile</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px',
                     alignItems: 'center', fontSize: 13 }}>
        <label htmlFor="dev-display-name" style={{ color: 'var(--der-ink-500)' }}>
          Display name
        </label>
        <input id="dev-display-name" type="text" value={displayName}
               data-test="input-display-name"
               placeholder="e.g. Registration, Triage Tablet"
               onChange={(e) => setDisplayName(e.target.value)}
               style={{ padding: '6px 8px', border: '1px solid var(--der-border)',
                         borderRadius: 4, maxWidth: 320 }} />
        <label htmlFor="dev-form-factor" style={{ color: 'var(--der-ink-500)' }}>
          Form factor
        </label>
        <select id="dev-form-factor" value={formFactor}
                data-test="select-form-factor"
                onChange={(e) => setFormFactor(e.target.value as edgeApi.DeviceFormFactor)}
                style={{ padding: '6px 8px', border: '1px solid var(--der-border)',
                          borderRadius: 4, maxWidth: 320 }}>
          <option value="UNKNOWN">Unknown</option>
          <option value="WORKSTATION">Workstation</option>
          <option value="LAPTOP">Laptop</option>
          <option value="TABLET">Tablet</option>
          <option value="MOBILE">Mobile · P2P</option>
        </select>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                data-test="btn-save-profile"
                onClick={() => { save().catch(() => undefined); }}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        {err && <span className="ea-text-danger" style={{ fontSize: 12 }}>{err}</span>}
      </div>
    </section>
  );
}

