import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { Panel, RowMenu, type RowMenuItem, usePaged, TablePager } from './shared';

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

  /* Paginated client-side slice — 25 rows per page by default.
   * Must be declared BEFORE the error / loading early-returns so
   * React sees the same hook call order on every render. */
  const paged = usePaged(filtered, 25);

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
        subtitle={`${counts.total} total · ${counts.pending} awaiting approval`} />

      <ApprovalPolicyPanel api={api} />

      <Panel title={`Devices (${filtered.length})`}
             action={
               <div className="ea-data-filterbar" role="group" aria-label="Filters">
                 <select className="ea-input ea-input--compact"
                         value={filter}
                         onChange={(e) => setFilter(e.target.value as FilterKey)}
                         data-test="devices-filter"
                         title="Filter devices by approval status">
                   <option value="PENDING">Needs approval ({counts.pending})</option>
                   <option value="APPROVED">Approved ({counts.approved})</option>
                   <option value="REVOKED">Revoked or suspended ({counts.revoked})</option>
                   <option value="ALL">All statuses ({counts.total})</option>
                 </select>
                 <select className="ea-input ea-input--compact"
                         value={sourceFilter}
                         onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                         data-test="devices-source"
                         title="Filter devices by registry source">
                   <option value="ALL">All sources</option>
                   <option value="DHIS2_FLEET">DHIS2 fleet ({counts.fleet})</option>
                   <option value="LAN_CLIENT">Local network ({counts.lan})</option>
                 </select>
                 <input className="ea-input ea-input--compact" type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, ID, IP, MAC…"
                        data-test="devices-search" />
               </div>
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted"
             data-test="devices-empty"
             style={{ margin: 0 }}>
            No devices match these filters.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--nowrap"
                   data-test="devices-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th className="ea-col-w-110">Status</th>
                  <th className="ea-col-w-90">Source</th>
                  <th className="ea-col-w-140">Network</th>
                  <th className="ea-col-w-110 ea-text-right">Last seen</th>
                  <th className="ea-col-w-110 ea-text-right"
                      aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((d) => (
                  <tr key={d.id}
                      data-test={`devices-row-${d.id}`}
                      data-status={d.status}>
                    <td title={d.id}>
                      <span className="ea-fw-medium">{d.displayName}</span>{' '}
                      <span className="ea-mono ea-text-muted ea-text-2xs">
                        {d.id.slice(0, 8)}
                      </span>
                    </td>
                    <td>
                      <StatusChip status={d.status} />
                    </td>
                    <td>
                      {d.sources.map((s) => (
                        <span key={s}
                              data-test={`devices-source-chip-${s}`}
                              className="ea-chip ea-chip--info"
                              title={sourceLabel(s)}
                              style={{ marginRight: 4 }}>
                          {sourceShort(s)}
                        </span>
                      ))}
                    </td>
                    <td className="ea-mono ea-text-2xs"
                        title={d.mac ?? ''}>
                      {d.ip ?? '—'}
                    </td>
                    <td className="ea-mono ea-text-2xs ea-text-right">
                      {d.lastSeenAt ? fmtRel(d.lastSeenAt) : '—'}
                    </td>
                    <td className="ea-text-right">
                      <RowActions
                        device={d}
                        busy={busy === d.id}
                        onRun={(a) => run(a, d.fleetDeviceId ?? d.id)} />
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

function RowActions(
  { device, busy, onRun }: {
    device: edgeApi.UnifiedDevice;
    busy: boolean;
    onRun: (a: 'approve' | 'suspend' | 'revoke') => void;
  },
): JSX.Element {
  /* Phase-4B: replaced the bespoke "Actions ▾" dropdown with the
   * shared `RowMenu` kebab so every table in the admin UI uses the
   * same context-menu pattern (⋮ trigger + aligned panel). The
   * per-item `data-test` IDs that existed on the old buttons
   * (devices-approve-{id} / devices-suspend-{id} / devices-revoke-{id}
   * / devices-reapprove-{id}) are carried forward via the
   * `dataTest` prop added to `RowMenuItem`. */
  const inFleet = device.sources.includes('DHIS2_FLEET');
  const items: RowMenuItem[] = [];
  if (inFleet && device.status === 'PENDING') {
    items.push({
      label: 'Approve',
      onSelect: () => onRun('approve'),
      dataTest: `devices-approve-${device.id}`,
      disabled: busy,
    });
  }
  if (inFleet && device.status === 'APPROVED') {
    items.push({
      label: 'Suspend',
      onSelect: () => onRun('suspend'),
      dataTest: `devices-suspend-${device.id}`,
      disabled: busy,
    });
  }
  if (inFleet && device.status === 'SUSPENDED') {
    items.push({
      label: 'Reapprove',
      onSelect: () => onRun('approve'),
      dataTest: `devices-reapprove-${device.id}`,
      disabled: busy,
    });
  }
  if (inFleet && device.status !== 'REVOKED') {
    items.push({
      label: 'Revoke',
      danger: true,
      onSelect: () => onRun('revoke'),
      dataTest: `devices-revoke-${device.id}`,
      disabled: busy,
    });
  }
  if (inFleet) {
    items.push({
      label: 'Open details',
      to: `/devices/${device.id}`,
      dataTest: `devices-details-${device.id}`,
    });
  }

  if (items.length === 0) {
    return <span className="ea-empty-cell">—</span>;
  }

  return <RowMenu items={items} />;
}

function sourceLabel(s: edgeApi.DeviceSource): string {
  return s === 'DHIS2_FLEET'
      ? 'Enrolled device (registered with DER via bearer token)'
      : 'Local-network client (seen on the access point)';
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
  /* Phase-4B: compacted from a Panel + its heading into a single
   * subtle info-strip above the filter row, so the Devices landing
   * uses two visual lines above the table instead of five. */
  return (
    <div className="ea-info-strip" data-test="approval-policy-strip">
      <span className="ea-info-strip-label">Approval policy</span>
      <strong data-test="approval-policy-state"
              className={'ea-info-strip-value'
                + (required ? '' : ' ea-info-strip-value--muted')}>
        {required ? 'Strict' : 'Permissive'}
      </strong>
      <span className="ea-info-strip-desc">
        {required
          ? 'Only approved devices can submit data.'
          : 'Any enrolled device can submit data — approval is advisory only.'}
      </span>
      <button type="button"
              className="ea-btn ea-btn--sm ea-btn--ghost"
              onClick={toggle}
              disabled={busy || required === null}
              data-test="approval-policy-toggle">
        {busy ? 'Saving…' : required ? 'Switch to permissive' : 'Switch to strict'}
      </button>
      {err && <span className="ea-info-strip-err">{err}</span>}
    </div>
  );
}
