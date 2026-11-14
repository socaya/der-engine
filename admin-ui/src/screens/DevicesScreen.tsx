import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { Panel } from './shared';

/** UI-1 — unified devices view.
 *
 *  <p>Before this screen, DER had three competing device surfaces:
 *  {@code /devices} (DHIS2 fleet registry), {@code /fleet} (fleet
 *  peers), {@code /network/clients} (LAN mesh clients). Operators
 *  saw devices in one but not another, and sessions landing at
 *  localhost:5174 went missing from the mesh view entirely because
 *  loopback browsers never register in network_client.</p>
 *
 *  <p>This one screen merges both registries via the new
 *  /devices/unified endpoint and surfaces every device the DER has
 *  seen, with chips identifying which registries each device appears
 *  in. A "Needs approval" filter defaults ON so freshly-enrolled
 *  sessions show up immediately.</p> */
export function DevicesScreen(
  { api = edgeApi }:
  { api?: Pick<typeof edgeApi, 'listUnifiedDevices'
            | 'approveDevice' | 'suspendDevice' | 'revokeDevice'
            | 'getDeviceApprovalPolicy' | 'setDeviceApprovalPolicy'> } = {},
): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter')
      ?? 'PENDING') as FilterKey;
  const initialSource = (searchParams.get('source')
      ?? 'ALL') as SourceFilter;
  const initialSearch = searchParams.get('q') ?? '';

  const [rows, setRows] = useState<edgeApi.UnifiedDevice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialSource);
  const [search, setSearch] = useState<string>(initialSearch);

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const r = await api.listUnifiedDevices();
      setRows(r.devices);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message ?? 'Failed to load devices');
    }
  }, [api]);

  useEffect(() => { void refetch(); }, [refetch]);

  // Keep URL in sync so filter state survives share/reload.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filter !== 'PENDING') next.set('filter', filter);
    if (sourceFilter !== 'ALL') next.set('source', sourceFilter);
    if (search) next.set('q', search);
    setSearchParams(next, { replace: true });
  }, [filter, sourceFilter, search, setSearchParams]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (sourceFilter !== 'ALL'
          && !r.sources.includes(sourceFilter)) return false;
      if (s) {
        const hay = [r.displayName, r.id, r.ip ?? '', r.mac ?? '',
                     r.userAgent ?? '', r.owner ?? '']
          .join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filter, sourceFilter, search]);

  const counts = useMemo(() => ({
    total: rows?.length ?? 0,
    pending: rows?.filter((r) => r.status === 'PENDING').length ?? 0,
    approved: rows?.filter((r) => r.status === 'APPROVED').length ?? 0,
    revoked: rows?.filter((r) =>
      r.status === 'REVOKED' || r.status === 'SUSPENDED').length ?? 0,
    fleet: rows?.filter((r) =>
      r.sources.includes('DHIS2_FLEET')).length ?? 0,
    lan: rows?.filter((r) =>
      r.sources.includes('LAN_CLIENT')).length ?? 0,
  }), [rows]);

  async function run(action: 'approve' | 'suspend' | 'revoke',
      id: string): Promise<void> {
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} this device?`)) {
      return;
    }
    setBusy(id);
    try {
      if (action === 'approve') await api.approveDevice(id);
      if (action === 'suspend') await api.suspendDevice(id);
      if (action === 'revoke') await api.revokeDevice(id);
      await refetch();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (err && !rows) {
    return (
      <ErrorBlock title="Could not load devices" testId="devices-error">
        {err}
      </ErrorBlock>
    );
  }
  if (!rows) return <LoadingBlock testId="devices-loading" />;

  return (
    <div className="ea-screen" data-test="devices-screen">
      <PageHeader title="Devices"
        subtitle={`${counts.total} total · ${counts.pending} awaiting approval · ${counts.fleet} in DHIS2 fleet · ${counts.lan} on local network`} />

      <ApprovalPolicyPanel api={api} />

      <Panel title="Filter">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8,
                       alignItems: 'center' }}>
          {([
            { k: 'PENDING',   label: `Needs approval (${counts.pending})` },
            { k: 'APPROVED',  label: `Approved (${counts.approved})` },
            { k: 'REVOKED',   label: `Revoked / suspended (${counts.revoked})` },
            { k: 'ALL',       label: `All (${counts.total})` },
          ] as const).map((o) => (
            <button key={o.k} type="button"
                    data-test={`devices-filter-${o.k}`}
                    onClick={() => setFilter(o.k)}
                    className={'ea-btn ea-btn--sm'
                      + (filter === o.k ? ' ea-btn--primary' : ' ea-btn--ghost')}>
              {o.label}
            </button>
          ))}
          <span style={{ width: 1, height: 20,
                          background: 'var(--der-border-soft, #e2e6ef)',
                          margin: '0 4px' }} />
          {([
            { k: 'ALL',          label: 'All sources' },
            { k: 'DHIS2_FLEET',  label: `DHIS2 fleet (${counts.fleet})` },
            { k: 'LAN_CLIENT',   label: `LAN client (${counts.lan})` },
          ] as const).map((o) => (
            <button key={o.k} type="button"
                    data-test={`devices-source-${o.k}`}
                    onClick={() => setSourceFilter(o.k)}
                    className={'ea-btn ea-btn--sm'
                      + (sourceFilter === o.k
                        ? ' ea-btn--primary' : ' ea-btn--ghost')}>
              {o.label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <input value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search name, ID, IP, MAC…"
                 data-test="devices-search"
                 className="ea-input"
                 style={{ minWidth: 220, maxWidth: 320 }} />
        </div>
      </Panel>

      <Panel title={`Devices (${filtered.length})`}>
        {filtered.length === 0 ? (
          <p className="ea-text-muted"
             data-test="devices-empty"
             style={{ margin: 0 }}>
            No devices match these filters.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="devices-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Seen in</th>
                  <th>Last seen</th>
                  <th>Network</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}
                      data-test={`devices-row-${d.id}`}
                      data-status={d.status}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.displayName}</div>
                      <div className="ea-mono ea-text-muted"
                           style={{ fontSize: 10 }}>
                        {d.id}
                      </div>
                      {d.userAgent && (
                        <div className="ea-text-muted"
                             style={{ fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: 320,
                                      whiteSpace: 'nowrap' }}
                             title={d.userAgent}>
                          {d.userAgent}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusChip status={d.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4,
                                     flexWrap: 'wrap' }}>
                        {d.sources.map((s) => (
                          <span key={s}
                                data-test={`devices-source-chip-${s}`}
                                className="ea-chip ea-chip--info"
                                title={sourceLabel(s)}>
                            {sourceShort(s)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}>
                      {d.lastSeenAt ? fmtRel(d.lastSeenAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {d.ip ? (
                        <>
                          <code>{d.ip}</code>
                          {d.mac && (
                            <div className="ea-text-muted"
                                 style={{ fontSize: 10 }}>
                              {d.mac}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="ea-text-muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActions
                        device={d}
                        busy={busy === d.id}
                        onRun={(a) => run(a, d.fleetDeviceId ?? d.id)} />
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

type FilterKey = 'PENDING' | 'APPROVED' | 'REVOKED' | 'ALL';
type SourceFilter = 'ALL' | 'DHIS2_FLEET' | 'LAN_CLIENT';

function StatusChip({ status }:
  { status: edgeApi.UnifiedDevice['status'] }): JSX.Element {
  const tone =
    status === 'APPROVED' ? 'success' :
    status === 'PENDING' ? 'warning' :
    'danger';
  const label =
    status === 'APPROVED' ? 'Approved' :
    status === 'PENDING' ? 'Needs approval' :
    status === 'SUSPENDED' ? 'Suspended' :
    'Revoked';
  return (
    <span className={`ea-chip ea-chip--${tone}`}
          data-test={`devices-status-${status}`}>
      {label}
    </span>
  );
}

interface MenuItem {
  key: string;
  label: string;
  tone?: 'primary' | 'danger' | 'default';
  onSelect: () => void;
}

function RowActions(
  { device, busy, onRun }: {
    device: edgeApi.UnifiedDevice;
    busy: boolean;
    onRun: (a: 'approve' | 'suspend' | 'revoke') => void;
  },
): JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      const t = e.target as Node | null;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const inFleet = device.sources.includes('DHIS2_FLEET');
  const items: MenuItem[] = [];
  if (inFleet && device.status === 'PENDING') {
    items.push({ key: 'approve', label: 'Approve', tone: 'primary',
      onSelect: () => onRun('approve') });
  }
  if (inFleet && device.status === 'APPROVED') {
    items.push({ key: 'suspend', label: 'Suspend',
      onSelect: () => onRun('suspend') });
  }
  if (inFleet && device.status === 'SUSPENDED') {
    items.push({ key: 'reapprove', label: 'Reapprove', tone: 'primary',
      onSelect: () => onRun('approve') });
  }
  if (inFleet && device.status !== 'REVOKED') {
    items.push({ key: 'revoke', label: 'Revoke', tone: 'danger',
      onSelect: () => onRun('revoke') });
  }

  if (!inFleet && items.length === 0) {
    return <span className="ea-empty-cell">—</span>;
  }

  return (
    <div className="ea-row-menu">
      <button type="button"
              ref={triggerRef}
              className="ea-btn ea-btn--ghost ea-btn--sm"
              data-test={`devices-actions-${device.id}`}
              aria-haspopup="menu"
              aria-expanded={open}
              disabled={busy}
              onClick={() => setOpen((v) => !v)}>
        Actions ▾
      </button>
      {open && (
        <div ref={menuRef}
             role="menu"
             className="ea-row-menu-panel"
             data-test={`devices-actions-menu-${device.id}`}>
          {items.map((it) => (
            <button key={it.key}
                    type="button"
                    role="menuitem"
                    className={`ea-row-menu-item${
                      it.tone === 'danger' ? ' ea-row-menu-item--danger'
                      : it.tone === 'primary' ? ' ea-row-menu-item--primary'
                      : ''}`}
                    data-test={`devices-${it.key}-${device.id}`}
                    disabled={busy}
                    onClick={() => { setOpen(false); it.onSelect(); }}>
              {it.label}
            </button>
          ))}
          {inFleet && (
            <Link to={`/devices/${device.id}`}
                  role="menuitem"
                  className="ea-row-menu-item"
                  onClick={() => setOpen(false)}>
              Details
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function sourceLabel(s: edgeApi.DeviceSource): string {
  return s === 'DHIS2_FLEET'
      ? 'DHIS2 fleet registry (edge_device) — a bearer-token enrolled device'
      : 'Local-LAN mesh (network_client) — observed on the Access Point';
}
function sourceShort(s: edgeApi.DeviceSource): string {
  return s === 'DHIS2_FLEET' ? 'Fleet' : 'LAN';
}
function fmtRel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} d ago`;
  return new Date(iso).toLocaleDateString();
}

function ApprovalPolicyPanel({ api }: {
  api: Pick<typeof edgeApi,
    'getDeviceApprovalPolicy' | 'setDeviceApprovalPolicy'>;
}): JSX.Element | null {
  const [required, setRequired] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.getDeviceApprovalPolicy()
      .then((r) => setRequired(r.required))
      .catch((e) => setErr((e as Error).message));
  }, [api]);
  const toggle = useCallback(async () => {
    if (required === null) return;
    const next = !required;
    const label = next ? 'strict' : 'permissive';
    if (!window.confirm(`Switch device approval to ${label} mode?`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.setDeviceApprovalPolicy(next);
      setRequired(r.required);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, required]);
  if (required === null && !err) return null;
  return (
    <Panel title="Approval policy">
      <div className="ea-policy-strip">
        <div data-test="approval-policy-state">
          <strong>{required ? 'Strict' : 'Permissive'}</strong>
          {' · '}
          <span className="ea-policy-strip-desc">
            {required
              ? 'Only APPROVED devices can run client apps or write.'
              : 'Any enrolled device can run client apps; approval is advisory only.'}
          </span>
        </div>
        <button type="button"
                className="ea-btn ea-btn--sm ea-btn--ghost"
                onClick={toggle}
                disabled={busy || required === null}
                data-test="approval-policy-toggle">
          {busy ? 'Saving…' : required ? 'Switch to permissive' : 'Switch to strict'}
        </button>
      </div>
      {err && <p className="ea-policy-strip-err">{err}</p>}
    </Panel>
  );
}
