import { useEffect, useState } from 'react';
import {
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumnHeader,
  DataTableHead,
  DataTableRow,
} from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type {
  AccessPointStatus,
  NetworkInterface,
  NetworkStatus as NetStatus,
} from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ScreenStates';

export interface NetworkStatusProps {
  readonly api?: Pick<
    typeof edgeApi,
    'networkStatus' | 'listNetworkInterfaces' | 'networkAccessPoint'
  >;
}

function pickString(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return '—';
}

/**
 * Device-client Module → Network status. Operator-readable view onto:
 *   GET /edge-api/v1/network/status
 *   GET /edge-api/v1/network/interfaces
 *   GET /edge-api/v1/network/access-point
 *
 * Admin-only mutators (AP start/stop/rotate-key, interface edit,
 * firewall, peers) stay in admin-ui.
 */
export function NetworkStatus(
  { api = edgeApi }: NetworkStatusProps = {},
): JSX.Element {
  const [status, setStatus] = useState<NetStatus | null>(null);
  const [ifaces, setIfaces] = useState<NetworkInterface[] | null>(null);
  const [ap, setAp] = useState<AccessPointStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, iResp, a] = await Promise.all([
          api.networkStatus(),
          api.listNetworkInterfaces(),
          api.networkAccessPoint(),
        ]);
        if (!cancelled) {
          setStatus(s);
          setIfaces(iResp.interfaces);
          setAp(a);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  if (error) {
    return (
      <ErrorBlock title="Could not load network status" testId="network-status-error">
        {error}
      </ErrorBlock>
    );
  }
  if (status === null || ifaces === null || ap === null) {
    return <LoadingBlock testId="network-status-loading" />;
  }

  const statusEntries = Object.entries(status).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== 'object',
  );
  const apEntries = Object.entries(ap).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== 'object',
  );

  return (
    <div className="der-module-status">
      <h1 data-test="network-status-heading">Network</h1>
      <p>
        Live view of the edge&apos;s network state — status summary, physical
        interfaces and the access-point used by capture devices.
      </p>

      <Card dataTest="network-status-summary">
        <h2>Summary</h2>
        {statusEntries.length === 0 ? (
          <p data-test="network-status-empty">No network summary available.</p>
        ) : (
          <dl className="der-kv">
            {statusEntries.map(([k, v]) => (
              <div key={k} data-test={`network-status-${k}`}>
                <dt>{k}</dt><dd>{pickString(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card dataTest="network-status-ap">
        <h2>Access point</h2>
        {apEntries.length === 0 ? (
          <p data-test="network-ap-empty">Access-point not configured.</p>
        ) : (
          <dl className="der-kv">
            {apEntries.map(([k, v]) => (
              <div key={k} data-test={`network-ap-${k}`}>
                <dt>{k}</dt><dd>{pickString(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card dataTest="network-status-ifaces">
        <h2>Interfaces</h2>
        {ifaces.length === 0 ? (
          <EmptyBlock title="No interfaces" testId="network-ifaces-empty">
            The edge reports no network interfaces.
          </EmptyBlock>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableColumnHeader>Name</DataTableColumnHeader>
                <DataTableColumnHeader>State</DataTableColumnHeader>
                <DataTableColumnHeader>Purpose</DataTableColumnHeader>
                <DataTableColumnHeader>IPv4</DataTableColumnHeader>
                <DataTableColumnHeader>MAC</DataTableColumnHeader>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {ifaces.map((i) => (
                <DataTableRow key={i.name} dataTest={`network-iface-${i.name}`}>
                  <DataTableCell>{i.name}</DataTableCell>
                  <DataTableCell>{pickString(i.state)}</DataTableCell>
                  <DataTableCell>{pickString(i.purpose)}</DataTableCell>
                  <DataTableCell>{pickString(i.ipv4)}</DataTableCell>
                  <DataTableCell>{pickString(i.mac)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
