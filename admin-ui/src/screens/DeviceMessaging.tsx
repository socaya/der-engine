import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, fmtAgo, usePaged, TablePager, SyncStatusBar, Status, RowMenu,
} from './shared';
import { UiIcon } from '../components/UiIcon';

/** Phase N5 — DER-MSG v1 admin view.
 *
 *  Devices on the same DER-EDGE Wi-Fi exchange data through this bus.
 *  Admin page shows: live stats, recent-message log across every
 *  channel, current subscriptions, and a Publish dialog for operator
 *  demos / announcements. */
export function DeviceMessaging(): JSX.Element {
  const [stats, setStats] = useState<edgeApi.MessagingStats | null>(null);
  const [messages, setMessages] = useState<edgeApi.DeviceMessage[]>([]);
  const [subs, setSubs] = useState<edgeApi.DeviceSubscription[]>([]);
  const [showPublish, setShowPublish] = useState(false);

  async function reload(): Promise<void> {
    try { setStats(await edgeApi.messagingStats()); } catch { /* ignore */ }
    try { setMessages((await edgeApi.messagingLog(100)).messages); } catch { /* ignore */ }
    try { setSubs((await edgeApi.messagingSubscriptions()).subscriptions); } catch { /* ignore */ }
  }
  useEffect(() => {
    reload().catch(() => undefined);
    const t = setInterval(() => reload().catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, []);

  const paged = usePaged(messages, 25);

  return (
    <div className="ea-screen" data-test="device-messaging">
      <SyncStatusBar
        tone={stats && stats.messagesLastHour > 0 ? 'success' : 'muted'}
        title="Device messaging"
        statusLabel={stats ? `${stats.messagesTotal} messages` : 'Loading…'}
        subtitle={
          <>
            <span>DER-MSG v1 — devices on this edge exchange data over DER as broker.</span>
            {stats && (<>
              <span>·</span>
              <span>Devices subscribed <strong style={{ color: 'var(--der-ink-900)' }}>{stats.devicesSubscribed}</strong></span>
              <span>·</span>
              <span>Channels active <strong style={{ color: 'var(--der-ink-900)' }}>{stats.channelsActive}</strong></span>
              <span>·</span>
              <span>Last hour <strong style={{ color: 'var(--der-ink-900)' }}>{stats.messagesLastHour}</strong></span>
            </>)}
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => setShowPublish(true)}>
              <UiIcon icon="plus" size={14} /><span>Publish</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} /><span>Refresh</span>
            </button>
          </>
        }
      />

      <Panel title={`Top channels (last 24 h) · ${stats?.topChannels.length ?? 0}`}>
        {!stats?.topChannels.length ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No channels active yet. Publish a message to see traffic.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Channel</th><th>Messages (24 h)</th><th>Last activity</th>
              </tr></thead>
              <tbody>
                {stats.topChannels.map((c) => (
                  <tr key={c.channel}>
                    <td className="ea-mono">{c.channel}</td>
                    <td className="ea-mono">{c.n}</td>
                    <td className="ea-text-muted">{fmtAgo(c.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Recent messages · ${messages.length}`}
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>
               Auto-refreshing every 5 s.
             </span>}>
        {messages.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No messages yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>When</th><th>Channel</th><th>From device</th>
                <th>Type</th><th>Payload</th><th>Expires</th>
              </tr></thead>
              <tbody>
                {paged.rows.map((m) => (
                  <tr key={m.messageId}>
                    <td className="ea-text-muted">{fmtAgo(m.createdAt)}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{m.channel}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{m.fromDeviceId}</td>
                    <td style={{ fontWeight: 500 }}>{m.messageType}</td>
                    <td className="ea-mono" style={{ fontSize: 11, maxWidth: 320,
                                                      overflow: 'hidden', textOverflow: 'ellipsis',
                                                      whiteSpace: 'nowrap' }}
                        title={m.payload}>
                      {m.payload}
                    </td>
                    <td className="ea-text-muted">{m.expiresAt ? fmtAgo(m.expiresAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>

      <Panel title={`Device subscriptions · ${subs.length}`}>
        {subs.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No subscriptions. Devices call <code>POST /messaging/subscribe</code> to
            opt into role / broadcast channels; direct messages are received without
            an explicit subscription.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Device</th><th>Channel</th><th>Cursor</th><th>Last poll</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.deviceId + s.channel}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{s.deviceId}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{s.channel}</td>
                    <td className="ea-text-muted">{s.cursorAt ? fmtAgo(s.cursorAt) : '—'}</td>
                    <td className="ea-text-muted">
                      <Status tone={s.lastPollAt
                        && Date.now() - new Date(s.lastPollAt).getTime() < 60_000
                        ? 'success' : 'muted'}>
                        {s.lastPollAt ? fmtAgo(s.lastPollAt) : 'never'}
                      </Status>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Unsubscribe', danger: true, onSelect: () => {
                          edgeApi.messagingUnsubscribe(s.deviceId, s.channel)
                                 .then(() => reload())
                                 .catch(() => undefined);
                        } },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showPublish && <PublishDialog
          onClose={() => setShowPublish(false)}
          onSaved={() => { setShowPublish(false); reload().catch(() => undefined); }} />}
    </div>
  );
}

function PublishDialog({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void;
}): JSX.Element {
  const [fromDevice, setFromDevice] = useState('ADMIN-UI');
  const [channel, setChannel] = useState('broadcast');
  const [messageType, setMessageType] = useState('STOCK_ALERT');
  const [payloadJson, setPayloadJson] = useState(
    '{\n  "severity": "medium",\n  "item": "Amoxicillin 500mg",\n  "note": "running low"\n}');
  const [ttlMinutes, setTtlMinutes] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      const payload = JSON.parse(payloadJson);
      await edgeApi.messagingPublish({
        channel, fromDeviceId: fromDevice, messageType, payload,
        ttlSeconds: ttlMinutes > 0 ? ttlMinutes * 60 : undefined,
      });
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
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Publish message</h3>
        <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Appears to every device subscribed to <code>{channel}</code>. Prefix with
          <code> device:&lt;id&gt;</code> for direct, <code>role:&lt;role&gt;</code> for
          role fan-out, <code>broadcast</code> for everyone.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12 }}>From device
            <input className="ea-input" value={fromDevice}
                   onChange={(e) => setFromDevice(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Channel
            <input className="ea-input" value={channel}
                   onChange={(e) => setChannel(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>Message type
            <select className="ea-input" value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}>
              <option value="REFERRAL_INTERNAL">REFERRAL_INTERNAL</option>
              <option value="STOCK_ALERT">STOCK_ALERT</option>
              <option value="PATIENT_HANDOFF">PATIENT_HANDOFF</option>
              <option value="CHAT">CHAT</option>
              <option value="PRESENCE">PRESENCE</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>TTL (minutes, 0 = no expiry)
            <input className="ea-input" type="number" value={ttlMinutes}
                   onChange={(e) => setTtlMinutes(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 12, gridColumn: '1 / span 2' }}>Payload (JSON)
            <textarea className="ea-input" rows={6}
                      style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                      value={payloadJson}
                      onChange={(e) => setPayloadJson(e.target.value)} />
          </label>
        </div>
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Cancel</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={saving} onClick={save}>
            {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="plus" size={14} />}
            <span>{saving ? 'Publishing…' : 'Publish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
