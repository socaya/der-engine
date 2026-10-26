import { useEffect, useState, type ReactNode } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { useOrgUnit } from '../../components/OrgUnitContext';

/**
 * Mockup-matched helpers used across the Dashboard, Overview, Sync,
 * Metadata, Data, Queues, History and Users pages (docs/media/ui/*).
 */

// ────────────────────────────────────────────────────────────────────
// OU picker — crumb pills shown above most mockups
// ────────────────────────────────────────────────────────────────────

export interface OuContext {
  readonly country: string;
  readonly district: string;
  readonly facility: string;
  readonly facilityId: string | null;
  readonly bound: boolean;
}

/** Parse the DER OU binding into a country/district/facility triple. */
export function readOuContext(b: edgeApi.OrgUnitBinding | null): OuContext {
  if (!b || !b.bound) {
    return { country: 'Country', district: 'District', facility: 'Facility', facilityId: null, bound: false };
  }
  const path = b.orgUnitPath ?? '';
  const parts = path.split('/').filter(Boolean);
  const facility = b.orgUnitDisplayName ?? parts[parts.length - 1] ?? 'Facility';
  const district = parts[parts.length - 2] ?? 'District';
  const country = parts[0] ?? 'Country';
  return { country, district, facility, facilityId: b.orgUnitId, bound: true };
}

export function useOuContext(): [OuContext, edgeApi.OrgUnitBinding | null] {
  // Prefer the app-wide OrgUnit context so bind/rebind events on the
  // Organisation unit page propagate everywhere (topbar chip, hero
  // banners, OU breadcrumbs on data pages, etc.). Falls back to a
  // local fetch if the provider isn't mounted (test harnesses).
  const { binding } = useOrgUnit();
  const [local, setLocal] = useState<edgeApi.OrgUnitBinding | null>(null);
  useEffect(() => {
    if (binding == null) {
      edgeApi.getOrgUnitBinding().then(setLocal).catch(() => undefined);
    }
  }, [binding]);
  const b = binding ?? local;
  return [readOuContext(b), b];
}

export function OuPicker({ ctx, right }: {
  ctx: OuContext; right?: ReactNode;
}): JSX.Element {
  return (
    <div className="ea-ou-bar">
      <div className="ea-ou-bar-left">
        <span className="ea-ou-bar-label">Organisation Unit (Single OU)</span>
        <div className="ea-ou-crumbs">
          <span className="ea-ou-crumb">{ctx.country}</span>
          <ChevronRight />
          <span className="ea-ou-crumb">{ctx.district}</span>
          <ChevronRight />
          <span className="ea-ou-crumb ea-ou-crumb--active">{ctx.facility}</span>
        </div>
      </div>
      <div className="ea-ou-bar-right">
        {right ?? (
          <a href="/admin/integration/organisation-unit" className="ea-btn ea-btn--ghost ea-btn--sm">
            View OU Details
          </a>
        )}
      </div>
    </div>
  );
}

function ChevronRight(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" style={{ color: 'var(--der-ink-300)' }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// KPI tile with icon on the left (dashboard mockup style)
// ────────────────────────────────────────────────────────────────────

export function KpiTile({ icon, label, value, caption, tone = 'default', right }: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  right?: ReactNode;
}): JSX.Element {
  return (
    <div className={`ea-kpi-tile ea-kpi-tile--${tone}`}>
      {icon && <div className="ea-kpi-tile-icon" aria-hidden="true">{icon}</div>}
      <div className="ea-kpi-tile-body">
        <div className="ea-kpi-tile-label">{label}</div>
        <div className="ea-kpi-tile-value">{value}</div>
        {caption && <div className="ea-kpi-tile-caption">{caption}</div>}
      </div>
      {right && <div className="ea-kpi-tile-right">{right}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Panel card used throughout the mockups
// ────────────────────────────────────────────────────────────────────

export function Panel({ title, action, children }: {
  title?: string; action?: ReactNode; children: ReactNode;
}): JSX.Element {
  const hasHead = Boolean(title) || Boolean(action);
  return (
    <section className="ea-panel">
      {hasHead && (
        <header className="ea-panel-head">
          {title ? <h2 className="ea-panel-title">{title}</h2> : <span />}
          {action && <div className="ea-panel-action">{action}</div>}
        </header>
      )}
      <div className="ea-panel-body">{children}</div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────
// Split layout: scrollable table + right side-drawer with details
// ────────────────────────────────────────────────────────────────────

export function SplitWithDrawer({ main, drawer, drawerOpen }: {
  main: ReactNode; drawer: ReactNode; drawerOpen: boolean;
}): JSX.Element {
  return (
    <div className={'ea-split' + (drawerOpen ? ' ea-split--open' : '')}>
      <div className="ea-split-main">{main}</div>
      <aside className="ea-split-drawer" aria-label="Item details">{drawer}</aside>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Progress ring (used by Storage & Resources on Dashboard / Overview)
// ────────────────────────────────────────────────────────────────────

export function Ring({ percent, label, size = 92, color = 'var(--der-primary)' }: {
  percent: number; label?: string; size?: number; color?: string;
}): JSX.Element {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="ea-ring-wrap">
      <div className="ea-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke="var(--der-border-subtle)" strokeWidth="8" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={color} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <div className="ea-ring-text">
          <strong>{Math.round(percent)}%</strong>
        </div>
      </div>
      {label && <div className="ea-ring-label">{label}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Mini bar chart (sync activity 24h)
// ────────────────────────────────────────────────────────────────────

export function MiniBarChart({ bars, max }: {
  bars: ReadonlyArray<{ label: string; value: number }>;
  max?: number;
}): JSX.Element {
  const m = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="ea-barchart">
      {bars.map((b) => (
        <div key={b.label} className="ea-barchart-col" title={`${b.label}: ${b.value}`}>
          <div className="ea-barchart-bar"
               style={{ height: `${Math.round((100 * b.value) / m)}%` }} />
          <div className="ea-barchart-label">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Status dot inline
// ────────────────────────────────────────────────────────────────────

export function Dot({ tone }: { tone: 'success' | 'warning' | 'danger' | 'muted' }): JSX.Element {
  const color = {
    success: 'var(--der-success)',
    warning: 'var(--der-warning)',
    danger: 'var(--der-danger)',
    muted: 'var(--der-ink-300)',
  }[tone];
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0,
    }} />
  );
}

// ────────────────────────────────────────────────────────────────────
// Format helpers
// ────────────────────────────────────────────────────────────────────

export function fmtBytes(n?: number): string {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${u[i]}`;
}
export function fmtDur(ms?: number | null): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
export function fmtAgo(from: string | null | undefined): string {
  if (!from) return '—';
  const d = Date.parse(from);
  if (isNaN(d)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - d) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────────────
// Client-side pagination hook — slices a fully-loaded array before
// render. Pair with <TablePager {...paged.pagerProps} />.
// ────────────────────────────────────────────────────────────────────

export function usePaged<T>(rows: ReadonlyArray<T>, defaultPageSize = 50): {
  rows: ReadonlyArray<T>;
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  pagerProps: {
    page: number; pageSize: number; pageCount: number; total: number;
    onPage: (p: number) => void; onPageSize: (n: number) => void;
  };
} {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamp page when the data shrinks (filter/search) so we don't
  // get stuck on an empty page past the end.
  const safePage = Math.min(page, pageCount);
  const from = (safePage - 1) * pageSize;
  const paged = rows.slice(from, from + pageSize);
  return {
    rows: paged, page: safePage, pageSize, pageCount, total,
    pagerProps: {
      page: safePage, pageSize, pageCount, total,
      onPage: setPage,
      onPageSize: (n: number) => { setPageSize(n); setPage(1); },
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Shared pagination control for tables backed by a server pager
// ({page, pageSize, total, pageCount}). Drop below a table.
// ────────────────────────────────────────────────────────────────────

export function TablePager({ page, pageCount, pageSize, total, onPage, onPageSize }: {
  page: number; pageCount: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize?: (n: number) => void;
}): JSX.Element | null {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="ea-table-footer" data-test="table-pager">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="ea-text-muted" style={{ fontSize: 12 }}>
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
        </span>
        {onPageSize && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span className="ea-text-muted">Rows:</span>
            <select className="ea-input" style={{ height: 24, padding: '0 6px', fontSize: 12 }}
                    value={pageSize}
                    onChange={(e) => onPageSize(Number(e.target.value))}
                    data-test="pager-size">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                disabled={page <= 1}
                data-test="pager-first"
                onClick={() => onPage(1)}>« First</button>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                disabled={page <= 1}
                data-test="pager-prev"
                onClick={() => onPage(page - 1)}>‹ Prev</button>
        <span style={{ fontSize: 12, padding: '0 6px' }}>
          Page {page} of {pageCount}
        </span>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                disabled={page >= pageCount}
                data-test="pager-next"
                onClick={() => onPage(page + 1)}>Next ›</button>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                disabled={page >= pageCount}
                data-test="pager-last"
                onClick={() => onPage(pageCount)}>Last »</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// User-friendly labels for Quartz job identifiers and journal states.
// Operators shouldn't need to decode `METADATA_SYNC_FULL` or `IN_FLIGHT`
// — these helpers map internal constants to plain-English.
// ────────────────────────────────────────────────────────────────────

const JOB_LABELS: Readonly<Record<string, string>> = {
  METADATA_SYNC_FULL: 'Pull latest metadata',
  METADATA_SYNC_INCR: 'Pull metadata updates',
  JOURNAL_WORKER_DRAIN: 'Push outgoing data',
  AGGREGATE_DATA_PUSH: 'Push aggregate data',
  AGGREGATE_DATA_PULL: 'Pull aggregate data',
  TRACKER_DATA_PUSH: 'Push tracker records',
  EVENT_DATA_PUSH: 'Push event data',
  ANALYTICS_REFRESH: 'Rebuild analytics tables',
  REFERRAL_INBOX_POLL: 'Check incoming referrals',
  BACKUP_ROUTINE_DRAIN: 'Rotate backups',
  COMPAT_REFRESH: 'Refresh DHIS2 compatibility',
  DRIFT_SNAPSHOT: 'Snapshot metadata drift',
};

/** Humanise a Quartz job name like `METADATA_SYNC_FULL`. Falls back
 *  to Title-Case of the raw constant when no mapping exists. */
export function humaniseJob(name: string | undefined | null): string {
  if (!name) return '—';
  const mapped = JOB_LABELS[name];
  if (mapped) return mapped;
  return name
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const STATE_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Waiting to send',
  IN_FLIGHT: 'In transit',
  CENTRAL_ACCEPTED: 'Accepted by DHIS2',
  CENTRAL_REJECTED: 'Rejected by DHIS2',
  RETRYABLE: 'Will retry',
  UNKNOWN_OUTCOME: 'Unknown response',
  CONFLICT_REVIEW: 'Needs review',
  SUCCEEDED: 'Succeeded',
  SUCCESS: 'Succeeded',
  FAILED: 'Failed',
  FAILURE: 'Failed',
  ERROR: 'Failed',
  QUEUED: 'Queued',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  RESOLVED: 'Resolved',
  SCHEDULED: 'Scheduled',
};

/** Humanise a journal / worker state like `IN_FLIGHT`. */
export function humaniseState(state: string | undefined | null): string {
  if (!state) return '—';
  return STATE_LABELS[state]
    ?? state.toLowerCase().split(/[_\s]+/).filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Translate a Quartz-style cron expression into plain English.
 *  Keeps the raw expression as a tooltip for operators who need the exact
 *  syntax. Supports the common patterns we actually ship — anything
 *  weirder falls back to "custom schedule". */
export function describeCron(expr: string | undefined | null): string {
  if (!expr) return 'Not scheduled';
  const parts = expr.trim().split(/\s+/);
  // Quartz: seconds minutes hours day-of-month month day-of-week [year]
  if (parts.length < 6) return 'Custom schedule';
  const [sec, min, hr, dom, mon, dow] = parts;
  // Every N minutes:  "0 */5 * * * ?"
  const everyMinMatch = min.match(/^\*\/(\d+)$/);
  if (sec === '0' && everyMinMatch && hr === '*' && dom === '*' && mon === '*' && (dow === '?' || dow === '*')) {
    const n = Number(everyMinMatch[1]);
    return n === 1 ? 'Every minute' : `Every ${n} minutes`;
  }
  // Every N hours:  "0 0 */2 * * ?"
  const everyHourMatch = hr.match(/^\*\/(\d+)$/);
  if (sec === '0' && min === '0' && everyHourMatch && dom === '*' && mon === '*' && (dow === '?' || dow === '*')) {
    const n = Number(everyHourMatch[1]);
    return n === 1 ? 'Every hour' : `Every ${n} hours`;
  }
  // Every day at HH:MM:  "0 30 2 * * ?"
  if (sec === '0' && /^\d+$/.test(min) && /^\d+$/.test(hr) && dom === '*' && mon === '*' && (dow === '?' || dow === '*')) {
    return `Daily at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  return 'Custom schedule';
}

/** Map a Quartz job name to the sub-screens where its payload lives,
 *  so an operator inspecting a run can jump straight to the data it
 *  processed instead of hunting through the sidebar. Shared between
 *  the Sync History drawer and anywhere else that drills into a run. */
export function relatedLinksForJob(jobName: string): ReadonlyArray<readonly [string, string, string]> {
  const name = (jobName ?? '').toUpperCase();
  if (name.includes('METADATA')) {
    return [
      ['Metadata browser', '/dhis2/metadata', 'Mirrored resources this run pulled from central.'],
      ['Metadata drift', '/dhis2/metadata-drift', 'Fingerprint comparison vs. central.'],
    ] as const;
  }
  if (name.includes('JOURNAL') || name.includes('DRAIN') || name.includes('PUSH')) {
    return [
      ['Queues', '/sync/queues', 'Journal items pushed up to DHIS2 central.'],
      ['Conflicts', '/journal/conflicts', 'Operations that failed to drain.'],
    ] as const;
  }
  if (name.includes('REFERRAL')) {
    return [
      ['Referral inbox', '/referral/inbox', 'Inbound referrals pulled from central.'],
    ] as const;
  }
  return [] as const;
}
