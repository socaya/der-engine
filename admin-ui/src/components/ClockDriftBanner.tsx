import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';

/**
 * NFR-28 — Clock-drift banner.
 *
 *  Probes GET /admin/metrics/clock on mount, computes drift against
 *  the browser's local clock, and if it exceeds the server-advertised
 *  unsafe threshold it POSTs a report (which triggers the
 *  CLOCK_DRIFT_WARN audit event server-side) + renders a warning
 *  banner so operators notice something is wrong.
 *
 *  Mounted inside AdminShell so the warning follows the user across
 *  every page while the issue persists. Silently no-ops when drift
 *  is within tolerance so there's nothing to see on healthy edges.
 */
export function ClockDriftBanner(): JSX.Element | null {
  const [drift, setDrift] = useState<edgeApi.ClockReportResponse | null>(null);
  const [zoneMismatch, setZoneMismatch] = useState<
    { server: string; browser: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const probe = await edgeApi.clockProbe();
        if (cancelled) return;
        const callerEpochMillis = Date.now();
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        /* Flag a zone mismatch independently of drift — different
         * zones can show no drift if the clocks both tick UTC-aligned,
         * but still produce wrong local-time displays. */
        if (probe.serverTimeZone !== browserZone
             && probe.serverTimeZone !== 'Z'
             && probe.serverTimeZone !== 'UTC') {
          setZoneMismatch({
            server: probe.serverTimeZone,
            browser: browserZone,
          });
        }
        const report = await edgeApi.clockReport({
          callerEpochMillis, callerTimeZone: browserZone,
        });
        if (!cancelled && report.unsafe) setDrift(report);
      } catch { /* silent — a clock probe failure shouldn't block the shell */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (dismissed) return null;
  if (!drift && !zoneMismatch) return null;

  const driftSeconds = drift ? Math.round(drift.driftMillis / 1000) : 0;
  const thresholdSeconds = drift
    ? Math.round(drift.unsafeDriftMillis / 1000) : 60;

  return (
    <div role="alert"
         data-test="clock-drift-banner"
         style={{
           background: 'var(--der-warning-bg, #fff7ed)',
           borderBottom: '1px solid var(--der-warning-ink, #c2410c)',
           color: 'var(--der-warning-ink, #c2410c)',
           padding: '8px 16px',
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'space-between',
           gap: 12,
           fontSize: 13,
         }}>
      <div>
        <strong>Clock issue detected · </strong>
        {drift && (
          <span data-test="clock-drift-detail">
            This device is {driftSeconds}s out of sync with the DER server
            (threshold {thresholdSeconds}s).
          </span>
        )}
        {zoneMismatch && (
          <span style={{ marginLeft: drift ? 8 : 0 }}
                data-test="clock-zone-detail">
            Server time zone <code>{zoneMismatch.server}</code>; this browser
            is <code>{zoneMismatch.browser}</code>.
          </span>
        )}
        <span style={{ marginLeft: 8, opacity: 0.85 }}>
          Captured timestamps use the server clock — re-sync your device
          clock + time zone to avoid confusion.
        </span>
      </div>
      <button type="button"
              className="ea-btn ea-btn--ghost ea-btn--sm"
              data-test="clock-drift-dismiss"
              aria-label="Dismiss clock-drift warning"
              onClick={() => setDismissed(true)}>
        Dismiss
      </button>
    </div>
  );
}
