import { useEffect, useState } from 'react';
import { Card, Tag } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { CompatSnapshot, Dhis2PingSnapshot } from '../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

export interface Dhis2StatusProps {
  readonly api?: Pick<typeof edgeApi, 'dhis2Ping' | 'dhis2Compat'>;
}

function statusTag(s: string): JSX.Element {
  if (s === 'COMPATIBLE' || s === 'OK' || s === 'UP') return <Tag positive>{s}</Tag>;
  if (s === 'DEGRADED' || s === 'WARNING') return <Tag neutral>{s}</Tag>;
  return <Tag negative>{s}</Tag>;
}

/**
 * Device-client Module → DHIS2 status. Read-only operator view onto
 * the server endpoints the DHIS2 server-module exposes:
 *   GET /edge-api/v1/dhis2/ping
 *   GET /edge-api/v1/dhis2/compatibility
 *
 * Admin-only mutators (edit connection, refresh compat) stay in
 * admin-ui.
 */
export function Dhis2Status({ api = edgeApi }: Dhis2StatusProps = {}): JSX.Element {
  const [ping, setPing] = useState<Dhis2PingSnapshot | null>(null);
  const [compat, setCompat] = useState<CompatSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, c] = await Promise.all([api.dhis2Ping(), api.dhis2Compat()]);
        if (!cancelled) { setPing(p); setCompat(c); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  if (error) {
    return (
      <ErrorBlock title="Could not load DHIS2 status" testId="dhis2-status-error">
        {error}
      </ErrorBlock>
    );
  }
  if (!ping || !compat) {
    return <LoadingBlock testId="dhis2-status-loading" />;
  }

  return (
    <div className="der-module-status">
      <h1 data-test="dhis2-status-heading">DHIS2</h1>
      <p>
        Live view onto the central DHIS2 your edge is paired with. Read-only;
        connection settings live in the admin UI.
      </p>

      <Card dataTest="dhis2-status-ping">
        <h2>Central reachability</h2>
        <dl className="der-kv">
          <dt>Reachable</dt>
          <dd>
            {ping.reachable
              ? <Tag positive dataTest="dhis2-ping-ok">Yes</Tag>
              : <Tag negative dataTest="dhis2-ping-fail">No</Tag>}
          </dd>
          <dt>Observed version</dt>
          <dd data-test="dhis2-ping-version">{ping.observedVersion ?? '—'}</dd>
          <dt>Latency</dt>
          <dd data-test="dhis2-ping-latency">{ping.latencyMs} ms</dd>
          <dt>Probed at</dt>
          <dd>{ping.probedAt}</dd>
          {ping.message && (<>
            <dt>Message</dt>
            <dd data-test="dhis2-ping-message">{ping.message}</dd>
          </>)}
        </dl>
      </Card>

      <Card dataTest="dhis2-status-compat">
        <h2>Compatibility</h2>
        <dl className="der-kv">
          <dt>Status</dt>
          <dd data-test="dhis2-compat-status">{statusTag(compat.status)}</dd>
          <dt>Pinned version</dt>
          <dd data-test="dhis2-compat-pin">{compat.pinnedVersion ?? '—'}</dd>
          <dt>Observed version</dt>
          <dd data-test="dhis2-compat-observed">{compat.observedVersion ?? '—'}</dd>
          <dt>Revision</dt>
          <dd>{compat.revision ?? '—'}</dd>
          <dt>Build time</dt>
          <dd>{compat.buildTime ?? '—'}</dd>
          {compat.message && (<>
            <dt>Message</dt>
            <dd data-test="dhis2-compat-message">{compat.message}</dd>
          </>)}
        </dl>
      </Card>
    </div>
  );
}
