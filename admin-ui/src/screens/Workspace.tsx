import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Dot, fmtAgo, fmtBytes, humaniseJob,
} from './shared';
import { useRuntimeStatus } from '../components/RuntimeStatusProvider';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/**
 * Overview — DER Admin landing page.
 *
 * Executive-summary layout, deliberately consolidated to four
 * visual blocks (not a long stack of panels):
 *
 *   1. One compact header: title · operational state · meta row
 *      (version, recent success rate, last updated, conflicts link).
 *   2. One status strip: four flat cells answering the four
 *      questions a site administrator lands here to resolve —
 *      Local server · Local capture · Central DHIS2 · Sync queue.
 *      (One optional attention strip appears below this when
 *      conflicts > 0.)
 *   3. One main dashboard row: a 7-day stacked sync-activity bar
 *      chart on the left, a single resource-summary panel on the
 *      right that stacks three horizontal segmented bars
 *      (Workflows · Storage · Devices) together, so the three
 *      secondary surfaces appear as *one* coherent summary rather
 *      than three separate panels.
 *   4. One activity row: recent sync runs (left) · common tasks
 *      (right).
 *
 * All data comes from the real /edge-api/v1 probes — no mocks.
 * Charts are inline SVG (no new dependencies). Visual language
 * is flat institutional: hairline 1 px borders, zero corner-radius,
 * no chip-style pills.
 *
 * Loading contract — once Promise.allSettled for the seven probes
 * resolves the shell always renders, even if individual probes
 * failed (their slot shows `Unknown` and the ErrorBlock surfaces
 * the failing reason).
 */
export function Workspace(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Date | null>(null);
  const [settled, setSettled] = useState(false);
  const runtime = useRuntimeStatus();

  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.listJobs(200),
      edgeApi.listConflicts(50),
      edgeApi.listDevices(), edgeApi.listWorkflows(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setSi(r[1].value);
      if (r[2].status === 'fulfilled') setC(r[2].value);
      if (r[3].status === 'fulfilled') setJobs(r[3].value);
      if (r[4].status === 'fulfilled') setConflicts(r[4].value);
      if (r[5].status === 'fulfilled') setDevices(r[5].value.devices);
      if (r[6].status === 'fulfilled') setWfs(r[6].value.workflows);
      setT(new Date());
      setSettled(true);
      const first = r.find((x) => x.status === 'rejected');
      if (first && first.status === 'rejected') {
        setErr(first.reason instanceof Error ? first.reason.message : String(first.reason));
      }
    });
  }, []);

  const sync7 = useMemo(() => bucketJobsByDay(jobs ?? [], 7), [jobs]);
  const maxDay = sync7.reduce((m, d) => Math.max(m, d.ok + d.fail + d.conflict), 0);

  if (!settled) return <LoadingBlock testId="loading" />;

  // ── Derived state ──────────────────────────────────────────────
  const derUp = h ? (h.status === 'UP' || h.status === 'starter-ready' || h.status === 'ready') : null;
  const derStatusLabel = derUp === null ? 'Unknown' : derUp ? 'Running' : (h?.status ?? 'Unavailable');
  const derTone: Tone = derUp === null ? 'muted' : derUp ? 'success' : 'danger';

  const dhis2Known = c != null;
  const dhis2Up = c?.probeReachable === true;
  const dhis2StatusLabel = !dhis2Known ? 'Unknown' : dhis2Up ? 'Reachable' : 'Unreachable';
  const dhis2Tone: Tone = !dhis2Known ? 'muted' : dhis2Up ? 'success' : 'warning';

  const dbUp = si ? Boolean(si.database.product) && (si.database.migrationCount ?? 0) > 0 : null;
  const captureReady = derUp === true && dbUp === true;
  const captureLabel = captureReady === null ? 'Unknown' : captureReady ? 'Available' : 'Limited';
  const captureTone: Tone = captureReady === null ? 'muted' : captureReady ? 'success' : 'warning';

  const totalConflicts = (conflicts ?? []).length;
  const schedStarted = si?.scheduler?.started === true;
  const totalRuns = (jobs ?? []).length;
  const succeeded = (jobs ?? []).filter((j) => j.outcome === 'SUCCEEDED').length;
  const failed = (jobs ?? []).filter((j) => j.outcome === 'FAILED').length;
  const reliability = totalRuns ? Math.round((100 * succeeded) / totalRuns) : null;
  const activeWf = (wfs ?? []).filter((x) => x.enabled).length;
  const totalWf = (wfs ?? []).length;

  const storageTotal = si?.storage.totalBytes ?? 0;
  const storageFiles = si?.storage.derDataRootBytes ?? 0;
  const storageDb = si?.storage.derDbSchemaBytes ?? 0;
  const storageFree = si?.storage.usableBytes ?? 0;
  const storageUsed = storageFiles + storageDb;
  const storageOther = Math.max(0, storageTotal - storageUsed - storageFree);

  const approvedDevices = (devices ?? []).filter((d) => d.status === 'APPROVED');
  const pendingDevices = (devices ?? []).filter((d) => d.status === 'PENDING');

  const allOps = derUp === true && dhis2Up && dbUp === true && schedStarted;
  const heroTone: Tone = allOps ? 'success'
    : derUp === false ? 'danger' : 'warning';
  const heroLabel = allOps ? 'All systems operational'
    : derUp === false ? (h?.status ?? 'DEGRADED')
    : dhis2Known && !dhis2Up ? 'Central DHIS2 unreachable'
    : 'Partial outage';

  const recentJobs = (jobs ?? []).slice(0, 8);

  return (
    <div className="ea-screen ea-overview" data-test="workspace-overview">

      {/* ── Block 1 — compact header row, title + inline meta. Soft
          UI: no bordered chips. Status is colour-only text. ── */}
      <section className="ea-overview-header">
        <div className="ea-overview-heading">
          <h1 className="ea-overview-title">DER Server</h1>
          <p className="ea-overview-sub">
            Local data capture and synchronisation with Central DHIS2.
          </p>
        </div>
        <div className="ea-overview-header-meta">
          <SoftStatus tone={heroTone}>{heroLabel}</SoftStatus>
          {si && <span className="ea-overview-meta-item">Version {si.build.version}</span>}
          {reliability != null && (
            <span className="ea-overview-meta-item"
                  title={`${succeeded} of ${totalRuns} tracked job runs succeeded`}>
              Recent sync success {reliability}% · {totalRuns} runs
            </span>
          )}
          {totalConflicts > 0 && (
            <Link to="/sync/attention" className="ea-overview-meta-item ea-overview-meta-link">
              {totalConflicts} to review
            </Link>
          )}
          {t && <span className="ea-overview-meta-item">Updated {fmtAgo(t.toISOString())}</span>}
        </div>
      </section>

      {err && (
        <ErrorBlock title="Partial load" testId="err-workspace">
          {err}
        </ErrorBlock>
      )}

      {/* ── Block 2 — four-cell status summary. Soft UI: hairline
          dividers between cells, top-edge tone accent, no bordered
          cards. ── */}
      <div className="ea-overview-status" data-test="workspace-status-row">
        <StatusCell
          label="Local server"
          value={derStatusLabel}
          tone={derTone}
          detail={runtime.detail}
          to="/monitoring/health"
        />
        <StatusCell
          label="Local capture"
          value={captureLabel}
          tone={captureTone}
          detail={captureReady
            ? 'Local database and scheduler are up. Capture clients can submit data.'
            : 'Local database or scheduler is not ready — capture may be limited.'}
          to="/data"
        />
        <StatusCell
          label="Central DHIS2"
          value={dhis2StatusLabel}
          tone={dhis2Tone}
          detail={!dhis2Known
            ? 'Checking Central DHIS2 connection…'
            : dhis2Up
              ? `Central DHIS2 ${c?.centralVersion ?? ''} reachable.`
              : 'Central DHIS2 is unavailable. Local work continues; pending changes will retry.'}
          to="/dhis2/compat"
        />
        <StatusCell
          label="Sync queue"
          value={
            totalConflicts > 0 ? `${totalConflicts} to review`
              : totalRuns === 0 ? 'No recent runs'
              : 'No items waiting'
          }
          tone={totalConflicts > 0 ? 'warning' : 'success'}
          detail="Captured records waiting to synchronise, or conflicts needing review."
          to={totalConflicts > 0 ? '/sync/attention' : '/sync'}
        />
      </div>
      {/* Attention strip removed per DER Soft UI guidance — the
          "N to review" meta link on the header + the warning tone on
          the Sync queue status cell already surface the conflict
          state without a stacked yellow alert block. */}

      {/* ── Block 3 — main dashboard row. ── */}
      <div className="ea-overview-dashboard">
        {/* Left: sync activity 7 days */}
        <section className="ea-overview-panel ea-overview-panel--main"
                 data-test="chart-sync-activity">
          <header className="ea-overview-panel-head">
            <h2>Synchronisation activity · 7 days</h2>
            <div className="ea-overview-panel-meta">
              <LegendSwatch tone="success" label={`${succeeded} succeeded`} />
              <LegendSwatch tone="danger" label={`${failed} failed`} />
              <Link to="/sync/history" className="ea-overview-link">Full history →</Link>
            </div>
          </header>
          <SyncActivityChart days={sync7} max={maxDay} />
        </section>

        {/* Right: compact resource summary — Workflows / Storage / Devices
         * rolled together into ONE panel so Overview stops stacking
         * three near-identical panels. */}
        <section className="ea-overview-panel ea-overview-panel--summary"
                 data-test="summary-resources">
          <header className="ea-overview-panel-head">
            <h2>Resources</h2>
          </header>

          <SummaryRow
            label="Workflows"
            metric={`${activeWf} / ${totalWf} active`}
            to="/workflows"
            segments={[
              { label: 'Active', value: activeWf, tone: 'success' },
              { label: 'Disabled', value: Math.max(0, totalWf - activeWf), tone: 'muted' },
            ]}
          />
          <SummaryRow
            label="Storage"
            metric={si ? `${fmtBytes(storageUsed)} used` : 'Unknown'}
            to="/monitoring/storage"
            caption={si ? `${fmtBytes(storageFree)} free of ${fmtBytes(storageTotal)}` : undefined}
            segments={[
              { label: `DER files · ${fmtBytes(storageFiles)}`, value: storageFiles, tone: 'primary' },
              { label: `PostgreSQL · ${fmtBytes(storageDb)}`, value: storageDb, tone: 'teal' },
              { label: `Other · ${fmtBytes(storageOther)}`, value: storageOther, tone: 'warning' },
              { label: `Free · ${fmtBytes(storageFree)}`, value: storageFree, tone: 'muted' },
            ]}
          />
          <SummaryRow
            label="Devices"
            metric={`${approvedDevices.length} approved`}
            to="/devices"
            caption={pendingDevices.length > 0
              ? `${pendingDevices.length} pending approval`
              : undefined}
            segments={[
              { label: 'Approved', value: approvedDevices.length, tone: 'success' },
              { label: 'Pending', value: pendingDevices.length, tone: 'warning' },
            ]}
          />
        </section>
      </div>

      {/* ── Block 4 — activity + actions row. ── */}
      <div className="ea-overview-dashboard">
        <section className="ea-overview-panel ea-overview-panel--main"
                 data-test="activity-feed">
          <header className="ea-overview-panel-head">
            <h2>Recent sync activity</h2>
            <Link to="/sync/history" className="ea-overview-link">Full history →</Link>
          </header>
          {recentJobs.length === 0 ? (
            <p className="ea-overview-list-empty">No sync runs recorded yet.</p>
          ) : (
            <table className="ea-overview-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Outcome</th>
                  <th>Trigger</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j) => (
                  <tr key={j.runId}>
                    <td>{humaniseJob(j.jobName)}</td>
                    <td>
                      <span className={'ea-overview-outcome ea-overview-outcome--' + (
                        j.outcome === 'SUCCEEDED' ? 'ok'
                          : j.outcome === 'FAILED' ? 'fail'
                          : 'muted')}>
                        {j.outcome}
                      </span>
                    </td>
                    <td>{j.triggeredBy}</td>
                    <td>{fmtAgo(j.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="ea-overview-panel ea-overview-panel--summary"
                 data-test="quick-actions">
          <header className="ea-overview-panel-head">
            <h2>Common tasks</h2>
          </header>
          <nav className="ea-overview-actions" data-test="workspace-quick-actions">
            <Link to="/data" className="ea-overview-action">
              <span className="ea-overview-action-title">View captured data</span>
              <span className="ea-overview-action-sub">Aggregate, events and tracker records</span>
            </Link>
            <Link to="/sync" className="ea-overview-action">
              <span className="ea-overview-action-title">Check synchronisation</span>
              <span className="ea-overview-action-sub">Pending, in progress, accepted, conflicts</span>
            </Link>
            <Link to="/devices" className="ea-overview-action">
              <span className="ea-overview-action-title">Manage devices</span>
              <span className="ea-overview-action-sub">Registered clients and network peers</span>
            </Link>
            <Link to="/dhis2/compat" className="ea-overview-action">
              <span className="ea-overview-action-title">Test DHIS2 connection</span>
              <span className="ea-overview-action-sub">Live probe against Central DHIS2</span>
            </Link>
          </nav>
        </section>
      </div>
    </div>
  );
}

// ───────────────────── helpers ─────────────────────────────────

type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'primary' | 'teal';

function StatusCell(props: {
  label: string;
  value: string;
  tone: Tone;
  detail: string;
  to: string;
}): JSX.Element {
  return (
    <Link
      to={props.to}
      className={'ea-overview-status-cell ea-overview-status-cell--' + props.tone}
      title={props.detail}
      data-test={`status-cell-${props.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="ea-overview-status-label">{props.label}</span>
      <span className="ea-overview-status-value">
        <Dot tone={props.tone as 'success' | 'warning' | 'danger' | 'muted'} />
        {props.value}
      </span>
    </Link>
  );
}

/** Soft-UI status label — colour only, no border, no fill. Matches
 *  the DER <Status> component idiom used across other screens. */
function SoftStatus({ tone, children }: { tone: Tone; children: React.ReactNode }): JSX.Element {
  return (
    <span className={'ea-overview-soft-status ea-overview-soft-status--' + tone}>
      <span className={'ea-overview-soft-status-dot ea-overview-soft-status-dot--' + tone} aria-hidden="true" />
      {children}
    </span>
  );
}

function LegendSwatch({ tone, label }: { tone: Tone; label: string }): JSX.Element {
  return (
    <span className="ea-overview-legend">
      <span className={'ea-overview-legend-swatch ea-overview-legend-swatch--' + tone} aria-hidden="true" />
      {label}
    </span>
  );
}

/** One row of the right-hand Resources summary: label, big metric,
 *  thin horizontal segmented bar, optional caption, link. All three
 *  secondary summaries (Workflows / Storage / Devices) share this
 *  component so they look like one summary rather than three panels. */
function SummaryRow(props: {
  label: string;
  metric: string;
  to: string;
  caption?: string;
  segments: ReadonlyArray<{ label: string; value: number; tone: Tone }>;
}): JSX.Element {
  const total = props.segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="ea-overview-summary-row">
      <div className="ea-overview-summary-head">
        <span className="ea-overview-summary-label">{props.label}</span>
        <Link to={props.to} className="ea-overview-summary-link">View →</Link>
      </div>
      <div className="ea-overview-summary-metric">{props.metric}</div>
      {total === 0 ? (
        <div className="ea-overview-segbar ea-overview-segbar--empty">No data</div>
      ) : (
        <div className="ea-overview-segbar" role="img"
             aria-label={props.segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
          {props.segments.map((s, i) => {
            if (s.value === 0) return null;
            const pct = (s.value / total) * 100;
            return (
              <div
                key={i}
                className={'ea-overview-segbar-seg ea-overview-segbar-seg--' + s.tone}
                style={{ width: pct + '%' }}
                title={`${s.label}: ${s.value}`}
              />
            );
          })}
        </div>
      )}
      {props.caption && (
        <div className="ea-overview-summary-caption">{props.caption}</div>
      )}
    </div>
  );
}

interface DayBucket { readonly dayLabel: string; readonly ok: number; readonly fail: number; readonly conflict: number }

function bucketJobsByDay(jobs: ReadonlyArray<edgeApi.JobRun>, days: number): ReadonlyArray<DayBucket> {
  const now = new Date();
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    buckets.push({
      dayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
      ok: 0, fail: 0, conflict: 0,
    });
  }
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86_400_000;
  for (const j of jobs) {
    const t = Date.parse(j.startedAt);
    if (!Number.isFinite(t)) continue;
    const diffDays = Math.floor((midnight - new Date(t).setHours(0, 0, 0, 0)) / DAY);
    const idx = days - 1 - diffDays;
    if (idx < 0 || idx >= days) continue;
    if (j.outcome === 'SUCCEEDED') (buckets[idx] as { ok: number }).ok += 1;
    else if (j.outcome === 'FAILED') (buckets[idx] as { fail: number }).fail += 1;
    else if (j.outcome === 'CONFLICT' || j.outcome === 'DEFERRED') (buckets[idx] as { conflict: number }).conflict += 1;
    else (buckets[idx] as { fail: number }).fail += 1;
  }
  return buckets;
}

function SyncActivityChart({ days, max }: { days: ReadonlyArray<DayBucket>; max: number }): JSX.Element {
  const safeMax = Math.max(1, max);
  const h = 180;
  const w = 100;
  const barW = 100 / days.length;
  return (
    <div className="ea-overview-chart">
      <svg
        role="img"
        aria-label="Synchronisation activity for the last 7 days, stacked bar chart"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        height={h}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0" x2={w}
            y1={h - f * (h - 20) - 10}
            y2={h - f * (h - 20) - 10}
            stroke="currentColor"
            strokeWidth={f === 0 ? 0.3 : 0.15}
            opacity={f === 0 ? 0.6 : 0.3}
          />
        ))}
        {days.map((d, i) => {
          const total = d.ok + d.fail + d.conflict;
          if (total === 0) return null;
          const x = i * barW + barW * 0.18;
          const width = barW * 0.64;
          const inner = h - 20;
          const unit = (v: number) => (v / safeMax) * inner;
          const hOk = unit(d.ok);
          const hFail = unit(d.fail);
          const hConf = unit(d.conflict);
          let y = h - 10 - hOk;
          return (
            <g key={i}>
              {d.ok > 0 && (
                <rect x={x} y={y} width={width} height={hOk}
                      fill="var(--der-success, #16a34a)">
                  <title>{d.dayLabel} · succeeded {d.ok}</title>
                </rect>
              )}
              {d.fail > 0 && (() => {
                const yy = y - hFail;
                y = yy;
                return (
                  <rect x={x} y={yy} width={width} height={hFail}
                        fill="var(--der-danger, #dc2626)">
                    <title>{d.dayLabel} · failed {d.fail}</title>
                  </rect>
                );
              })()}
              {d.conflict > 0 && (() => {
                const yy = y - hConf;
                return (
                  <rect x={x} y={yy} width={width} height={hConf}
                        fill="var(--der-warning, #d97706)">
                    <title>{d.dayLabel} · conflict/deferred {d.conflict}</title>
                  </rect>
                );
              })()}
            </g>
          );
        })}
      </svg>
      <div className="ea-overview-chart-xaxis">
        {days.map((d, i) => (
          <span key={i} className="ea-overview-chart-xlabel">{d.dayLabel}</span>
        ))}
      </div>
    </div>
  );
}
