import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, usePaged, TablePager, SyncStatusBar, RowMenu, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { titleCase } from '../sync/WorkerHealth';

export function DeviceFleet(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listDevices()).devices); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const q = query.trim().toLowerCase();
  const filtered = (rows ?? []).filter((r) => !q
    || r.deviceId.toLowerCase().includes(q)
    || (r.userAgent ?? '').toLowerCase().includes(q)
    || (r.displayName ?? '').toLowerCase().includes(q)
    || (r.formFactor ?? '').toLowerCase().includes(q));
  const paged = usePaged(filtered, 25);

  if (err) return <ErrorBlock title="Device load failed" testId="err-devices">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const approved = rows.filter((r) => r.status === 'APPROVED').length;
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const suspended = rows.filter((r) => r.status !== 'APPROVED' && r.status !== 'PENDING').length;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={suspended > 0 ? 'warning' : pending > 0 ? 'info' : 'success'}
        title="Device fleet"
        statusLabel={`${rows.length} enrolled`}
        subtitle={
          <>
            <span>Edge devices registered against this DER instance.</span>
            <span>·</span>
            <span>Approved <strong>{approved}</strong></span>
            {pending > 0 && (<><span>·</span><span>Pending <strong>{pending}</strong></span></>)}
            {suspended > 0 && (<><span>·</span><span>Suspended / revoked <strong style={{ color: 'var(--der-danger-ink)' }}>{suspended}</strong></span></>)}
          </>
        }
        actions={
          <>
            <Link to="/devices/enrolment"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="dev-fleet-open-enrolment">
              <UiIcon icon="enrollment" size={14} />
              <span>Device enrolment</span>
            </Link>
            <Link to="/devices/diagnostics"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="dev-fleet-open-diagnostics">
              <UiIcon icon="diagnostics" size={14} />
              <span>Device diagnostics</span>
            </Link>
            <Link to="/devices/ownership"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="dev-fleet-open-ownership">
              <UiIcon icon="worker" size={14} />
              <span>Ownership</span>
            </Link>
          </>
        }
      />

      <Panel title={`Devices (${rows.length})`}
             action={<input className="ea-input" style={{ maxWidth: 240 }} type="search"
                            placeholder="Search by ID or user agent" value={query}
                            onChange={(e) => setQuery(e.target.value)} />}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense ea-table--selectable">
            <thead><tr>
              <th>Device</th>
              <th>Form factor</th>
              <th>Status</th>
              <th>Enrolled</th>
              <th>Last seen</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.deviceId}
                    onClick={() => navigate(`/devices/${r.deviceId}`)}
                    data-test={`dev-row-${r.deviceId}`}>
                  <td>
                    <div style={{ fontWeight: r.displayName ? 500 : 400 }}>
                      {r.displayName ?? <em className="ea-text-muted">unnamed</em>}
                    </div>
                    <div className="ea-text-muted ea-mono"
                         style={{ fontSize: 11 }} title={r.deviceId}>
                      {r.deviceId.slice(0, 12)}…
                    </div>
                  </td>
                  <td>{r.formFactor && r.formFactor !== 'UNKNOWN'
                        ? titleCase(r.formFactor)
                        : <span className="ea-text-muted">—</span>}</td>
                  <td>
                    <Status tone={
                      r.status === 'APPROVED' ? 'success'
                      : r.status === 'PENDING' ? 'warning' : 'danger'}>
                      {r.status}
                    </Status>
                  </td>
                  <td className="ea-mono">{fmtDate(r.enrolledAt)}</td>
                  <td className="ea-mono">{fmtAgo(r.lastSeenAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <RowMenu items={[
                      { label: 'Open details', to: `/devices/${r.deviceId}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePager {...paged.pagerProps} />
        </div>
      </Panel>
    </div>
  );
}

