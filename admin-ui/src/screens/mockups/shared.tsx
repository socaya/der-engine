import { useEffect, useState, type ReactNode, type MouseEvent as ReactMouseEvent, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
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

/** Humanise a scheduled_job_run.triggered_by column:
 *  - "SCHEDULED" → "Scheduled" (cron fired it)
 *  - anything else is a username — preserve it exactly so admins see
 *    who kicked off the run. */
export function humaniseTrigger(value: string | undefined | null): string {
  if (!value) return '—';
  if (value === 'SCHEDULED') return 'Scheduled';
  return value;
}

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

// ────────────────────────────────────────────────────────────────────
// Sync activity shape — turn a Quartz run (jobName + detail JSON) into
// an operator-friendly activity entry with icon, direction arrow and
// plain-English sentence. Powers /sync/history and /sync/queues.
// ────────────────────────────────────────────────────────────────────

export type SyncActivityDirection = 'in' | 'out' | 'two-way' | 'local';

export interface SyncActivityShape {
  readonly category: string;      // "Metadata pull" / "Data push" / "Referral check" / "Analytics" / etc.
  readonly icon: string;          // Single emoji used as the row icon.
  readonly direction: SyncActivityDirection;
  readonly directionArrow: string;      // "←", "→", "↔", "·"
  readonly directionLabel: string;      // "Central → DER" etc.
  readonly sentence: string;      // Plain-English "what happened" line.
}

/** Return the user-visible shape for a Quartz run. */
export function syncActivityShape(jobName: string | null | undefined,
                                   detail: string | null | undefined): SyncActivityShape {
  const name = (jobName ?? '').toUpperCase();
  const parsed = parseDetailObject(detail);

  if (name.includes('METADATA')) {
    return {
      category: 'Metadata pull',
      icon: '📦',
      direction: 'in',
      directionArrow: '→',
      directionLabel: 'Central → DER',
      sentence: metadataSentence(parsed),
    };
  }
  if (name.includes('JOURNAL') || name.includes('DRAIN') || name.includes('PUSH')) {
    return {
      category: dataPushCategory(parsed),
      icon: dataPushIcon(parsed),
      direction: 'out',
      directionArrow: '→',
      directionLabel: 'DER → Central',
      sentence: dataPushSentence(parsed),
    };
  }
  if (name.includes('REFERRAL')) {
    return {
      category: 'Referral check',
      icon: '📥',
      direction: 'in',
      directionArrow: '→',
      directionLabel: 'Central → DER',
      sentence: referralSentence(parsed),
    };
  }
  if (name.includes('ANALYTICS')) {
    return {
      category: 'Analytics refresh',
      icon: '📊',
      direction: 'local',
      directionArrow: '·',
      directionLabel: 'DER-local',
      sentence: 'Rebuilt analytics tables.',
    };
  }
  if (name.includes('COMPAT')) {
    return {
      category: 'Compatibility probe',
      icon: '🔌',
      direction: 'in',
      directionArrow: '→',
      directionLabel: 'Central → DER',
      sentence: 'Re-probed DHIS2 version and capabilities.',
    };
  }
  if (name.includes('BACKUP')) {
    return {
      category: 'Backup rotation',
      icon: '💾',
      direction: 'local',
      directionArrow: '·',
      directionLabel: 'DER-local',
      sentence: 'Rotated backup files.',
    };
  }
  if (name.includes('DRIFT')) {
    return {
      category: 'Drift snapshot',
      icon: '≠',
      direction: 'in',
      directionArrow: '→',
      directionLabel: 'Central → DER',
      sentence: 'Snapshotted metadata fingerprint vs. central.',
    };
  }
  return {
    category: humaniseJob(jobName ?? '—'),
    icon: '⚙',
    direction: 'local',
    directionArrow: '·',
    directionLabel: 'DER-local',
    sentence: detail ?? 'Background flow.',
  };
}

// ────────────────────────────────────────────────────────────────────
// Entity-type helpers — used by both /sync/history detail breakdowns
// and /sync/queues row rendering.
// ────────────────────────────────────────────────────────────────────

const ENTITY_TYPE_LABEL: Readonly<Record<string, string>> = {
  AGGREGATE_DATA_VALUE: 'Aggregate data',
  AGGREGATE: 'Aggregate data',
  DATA_VALUE_SET: 'Aggregate data',
  EVENT: 'Single event',
  PROGRAM_STAGE_EVENT: 'Tracker event',
  ENROLLMENT: 'Enrollment',
  TRACKED_ENTITY: 'Tracked entity',
  TRACKED_ENTITY_INSTANCE: 'Tracked entity',
  TEI: 'Tracked entity',
  REFERRAL: 'Referral',
  METADATA: 'Metadata',
  DATA_ELEMENT: 'Data element',
  PROGRAM: 'Program',
  ORG_UNIT: 'Organisation unit',
};

const ENTITY_TYPE_ICON: Readonly<Record<string, string>> = {
  AGGREGATE_DATA_VALUE: '📊',
  AGGREGATE: '📊',
  DATA_VALUE_SET: '📊',
  EVENT: '📍',
  PROGRAM_STAGE_EVENT: '📝',
  ENROLLMENT: '📋',
  TRACKED_ENTITY: '👤',
  TRACKED_ENTITY_INSTANCE: '👤',
  TEI: '👤',
  REFERRAL: '📥',
  METADATA: '📦',
  DATA_ELEMENT: '🧮',
  PROGRAM: '🗂',
  ORG_UNIT: '🏥',
};

/** Humanise an entityType enum value. */
export function entityTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Operation';
  const key = type.toUpperCase();
  return ENTITY_TYPE_LABEL[key] ?? humaniseJob(type);
}

/** Icon for an entityType enum value. */
export function entityTypeIcon(type: string | null | undefined): string {
  if (!type) return '⚙';
  const key = type.toUpperCase();
  return ENTITY_TYPE_ICON[key] ?? '⚙';
}

function dataPushCategory(d: Record<string, unknown>): string {
  const byType = d.byType;
  if (byType && typeof byType === 'object') {
    const keys = Object.keys(byType);
    if (keys.length === 1) return `${entityTypeLabel(keys[0])} push`;
    if (keys.length > 1) return 'Mixed data push';
  }
  return 'Data push';
}

function dataPushIcon(d: Record<string, unknown>): string {
  const byType = d.byType;
  if (byType && typeof byType === 'object') {
    const keys = Object.keys(byType);
    if (keys.length === 1) return entityTypeIcon(keys[0]);
  }
  return '🩺';
}

/** Pull the byType breakdown out of a detail JSON blob, if present. */
export function parseByType(detail: string | null | undefined): ReadonlyArray<readonly [string, number]> {
  const parsed = parseDetailObject(detail);
  const byType = parsed.byType;
  if (!byType || typeof byType !== 'object') return [];
  const out: Array<[string, number]> = [];
  for (const [k, v] of Object.entries(byType as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out.push([k, n]);
  }
  return out;
}

/** Return the parsed detail JSON as an entry list for drawer rendering. */
export function detailEntries(detail: string | null | undefined): ReadonlyArray<readonly [string, string]> {
  const parsed = parseDetailObject(detail);
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(parsed)) {
    if (k === 'byType' || k === 'operationIds') continue;
    out.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Operator-facing state language (per DER Sync requirements §20).
// Backend state is detailed — operators see 6 states.
// ────────────────────────────────────────────────────────────────────

export type OperatorState = 'Waiting' | 'Sending' | 'Sent' | 'Retrying' | 'Rejected' | 'Needs attention';

const BACKEND_TO_OPERATOR: Readonly<Record<string, OperatorState>> = {
  PENDING: 'Waiting',
  QUEUED: 'Waiting',
  IN_FLIGHT: 'Sending',
  SYNCHRONISING: 'Sending',
  CENTRAL_ACCEPTED: 'Sent',
  ACCEPTED: 'Sent',
  SUCCESS: 'Sent',
  SUCCEEDED: 'Sent',
  RETRYABLE: 'Retrying',
  RETRY_PENDING: 'Retrying',
  UNKNOWN_OUTCOME: 'Retrying',
  CENTRAL_REJECTED: 'Rejected',
  REJECTED: 'Rejected',
  FAILED: 'Rejected',
  FAILURE: 'Rejected',
  CONFLICT_REVIEW: 'Needs attention',
  CONFLICT: 'Needs attention',
  REQUIRES_REVIEW: 'Needs attention',
};

export function operatorState(backend: string | null | undefined): OperatorState {
  if (!backend) return 'Waiting';
  return BACKEND_TO_OPERATOR[backend.toUpperCase()] ?? 'Waiting';
}

/** Tone (chip colour) for an operator-facing state. */
export function operatorStateTone(s: OperatorState): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  switch (s) {
    case 'Sent': return 'success';
    case 'Rejected': return 'danger';
    case 'Needs attention': return 'warning';
    case 'Sending': return 'info';
    case 'Retrying': return 'warning';
    case 'Waiting': return 'muted';
  }
}

// ────────────────────────────────────────────────────────────────────
// Status — quiet status indicator used in table cells.
// Replaces the background-filled pill chip with a small line-icon
// prefix + tone-coloured text. Classic ✓ / ✕ / ⚠ / ◦ glyphs — not
// playful shapes — so the result column reads as hierarchy, not
// highlight.
// ────────────────────────────────────────────────────────────────────

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

function StatusIcon({ tone }: { tone: StatusTone }): JSX.Element {
  const common = {
    width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true, focusable: false,
  };
  switch (tone) {
    case 'success':
      return <svg {...common}><path d="M2.5 6.5l2.2 2.2L9.5 3.8" /></svg>;
    case 'danger':
      return <svg {...common}><path d="M3 3l6 6M9 3l-6 6" /></svg>;
    case 'warning':
      return <svg {...common}><path d="M6 2.2l4.3 7.6H1.7L6 2.2z" /><path d="M6 5v2.2" /><circle cx="6" cy="8.6" r="0.4" fill="currentColor" stroke="none" /></svg>;
    case 'info':
      return <svg {...common}><circle cx="6" cy="6" r="4" /><path d="M6 5.4v2.6" /><circle cx="6" cy="4.1" r="0.35" fill="currentColor" stroke="none" /></svg>;
    case 'muted':
      return <svg {...common}><path d="M2.5 6h7" /></svg>;
  }
}

/** Quiet status marker — tone-coloured text with a small line-icon prefix.
 *  Use in table result/status columns instead of background-filled chips. */
export function Status(
  { tone, children, title }: { tone: StatusTone; children: ReactNode; title?: string }
): JSX.Element {
  return (
    <span className={`ea-status ea-status--${tone}`} title={title}>
      <StatusIcon tone={tone} />
      <span>{children}</span>
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// SyncStatusBar — compact one-liner replacement for the chunky
// hero-style status cards. Status tone + text + optional actions on
// a single row, no large icon slot.
// ────────────────────────────────────────────────────────────────────

export type SyncStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE_CHIP_CLASS: Readonly<Record<SyncStatusTone, string>> = {
  success: 'ea-chip ea-chip--success',
  warning: 'ea-chip ea-chip--warning',
  danger: 'ea-chip ea-chip--danger',
  info: 'ea-chip ea-chip--info',
  muted: 'ea-chip ea-chip--neutral',
};

/** Quiet page header: title + optional status chip inline with the h1,
 *  short subtitle (details) beneath, and action buttons right-aligned.
 *  No card background, no accent stripes — matches the standard
 *  `.ea-screen-header` pattern used by the rest of the admin UI. */
export function SyncStatusBar({ tone, title, statusLabel, details, subtitle, actions }: {
  tone: SyncStatusTone;
  title: string;
  statusLabel?: string;
  details?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  const sub = subtitle ?? details;
  return (
    <header className="ea-screen-header" data-test="sync-status-header">
      <div className="ea-screen-header-text">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span data-test="sync-status-title">{title}</span>
          {statusLabel && (
            <span className={TONE_CHIP_CLASS[tone]}>{statusLabel}</span>
          )}
        </h1>
        {sub && (
          <div className="ea-screen-header-sub"
               style={{ fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap',
                        alignItems: 'center' }}>
            {sub}
          </div>
        )}
      </div>
      {actions && <div className="ea-screen-header-right">{actions}</div>}
    </header>
  );
}

/** Confirmation helper for destructive actions (§13.4 / P1 line in
 *  UI Visibility standard). Returns a wrapped onClick that pops a
 *  native browser confirm with an explicit effect message. */
export function confirmThenRun(effect: string, onConfirm: () => void): void {
  const text = `${effect}\n\nThis action cannot be undone from this screen.`;
  if (typeof window !== 'undefined' && window.confirm(text)) onConfirm();
}

/** Back-link rendered above a details page title. */
export function BackLink({ to, label }: { to: string; label: string }): JSX.Element {
  return (
    <Link to={to}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: 'var(--der-ink-500)',
            marginBottom: 6, textDecoration: 'none',
          }}>
      ← {label}
    </Link>
  );
}

export interface RowMenuItem {
  readonly label: string;
  readonly onSelect?: () => void;
  readonly to?: string;        // Link navigation instead of callback.
  readonly danger?: boolean;   // Red tone (destructive actions).
  readonly disabled?: boolean;
}

/** Per-row context menu rendered as a native `<details>` dropdown
 *  anchored to a `⋮` kebab icon. Sits in the last column, far right. */
export function RowMenu({ items, label = 'Actions' }: {
  items: ReadonlyArray<RowMenuItem>;
  label?: string;
}): JSX.Element {
  // Stop the row-click handler from firing when the operator clicks
  // inside the menu or on the kebab.
  const stop = (e: ReactMouseEvent): void => { e.stopPropagation(); };
  return (
    <details className="ea-row-menu"
             onClick={stop}
             style={{ position: 'relative', display: 'inline-block' }}>
      <summary
        aria-label={label}
        style={{
          listStyle: 'none', cursor: 'pointer', userSelect: 'none',
          width: 24, height: 24, borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--der-ink-500)',
          border: '1px solid var(--der-border-subtle)',
          background: 'white', fontSize: 16, lineHeight: 1,
        }}>
        ⋮
      </summary>
      <div role="menu"
           style={{
             position: 'absolute', right: 0, top: 'calc(100% + 4px)',
             zIndex: 50, minWidth: 200,
             background: 'white',
             border: '1px solid var(--der-border)',
             boxShadow: '0 4px 12px rgba(15, 28, 46, 0.08)',
             padding: 4,
           }}>
        {items.map((it, i) => {
          const style: CSSProperties = {
            display: 'block', width: '100%', textAlign: 'left',
            padding: '7px 12px',
            background: 'none', border: 'none',
            fontSize: 13, cursor: it.disabled ? 'not-allowed' : 'pointer',
            color: it.disabled ? 'var(--der-ink-300)'
                 : it.danger ? 'var(--der-danger-ink)'
                 : 'var(--der-ink-900)',
            textDecoration: 'none',
          };
          if (it.to) {
            return (
              <Link key={i} to={it.to} role="menuitem" style={style}>{it.label}</Link>
            );
          }
          return (
            <button key={i} type="button" role="menuitem" style={style}
                    disabled={it.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Close the menu by removing the open attribute.
                      const details = (e.currentTarget.closest('details'));
                      if (details) details.removeAttribute('open');
                      it.onSelect?.();
                    }}>
              {it.label}
            </button>
          );
        })}
      </div>
    </details>
  );
}

/** Inline spinner for in-progress sync actions. */
export function Spinner({ size = 12 }: { size?: number }): JSX.Element {
  return (
    <span aria-hidden="true"
          style={{
            display: 'inline-block',
            width: size, height: size,
            border: `2px solid currentColor`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'der-spin 0.8s linear infinite',
            verticalAlign: 'middle',
          }} />
  );
}

// Inject the spin keyframes once per page load.
if (typeof document !== 'undefined' && !document.getElementById('der-spin-kf')) {
  const s = document.createElement('style');
  s.id = 'der-spin-kf';
  s.textContent = '@keyframes der-spin { to { transform: rotate(360deg); } }'
    + ' @keyframes der-prog { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }';
  document.head.appendChild(s);
}

// ────────────────────────────────────────────────────────────────────
// useTriggerAndWatch — trigger a Quartz job and poll until a new run
// for that job shows up with a terminal outcome. Returns a tuple of
// `[state, run]` where state is 'idle' | 'triggering' | 'running' |
// 'done' | 'failed' | 'timeout', and run is the matching JobRun once
// detected. Used by /sync overview + /sync/metadata + /sync/data to
// show progress on the Pull / Push actions.
// ────────────────────────────────────────────────────────────────────

export type TriggerState = 'idle' | 'triggering' | 'running' | 'done' | 'failed' | 'timeout';

export function useTriggerAndWatch(): {
  state: TriggerState;
  message: string;
  trigger: (jobName: string) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<TriggerState>('idle');
  const [message, setMessage] = useState<string>('');

  async function trigger(jobName: string): Promise<void> {
    setState('triggering');
    setMessage('Starting…');
    let baseline: number;
    try {
      const before = await edgeApi.listJobs(10);
      baseline = before
        .filter((j) => j.jobName === jobName)
        .map((j) => Date.parse(j.startedAt))
        .reduce((a, b) => Math.max(a, b), 0);
    } catch {
      baseline = Date.now();
    }
    try {
      const r = await edgeApi.triggerJob(jobName);
      if (r.error) { setState('failed'); setMessage(r.error); return; }
      setState('running');
      setMessage('Running…');
    } catch (e) {
      setState('failed');
      setMessage(e instanceof Error ? e.message : String(e));
      return;
    }
    // Poll for completion. 2s cadence, 60s cap.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const now = await edgeApi.listJobs(20);
        const fresh = now.find((j) =>
          j.jobName === jobName && Date.parse(j.startedAt) > baseline);
        if (fresh) {
          const ok = fresh.outcome === 'SUCCEEDED' || fresh.outcome === 'SUCCESS';
          const failed = fresh.outcome === 'FAILED' || fresh.outcome === 'FAILURE';
          if (ok || failed) {
            setState(ok ? 'done' : 'failed');
            const summary = summariseJobDetail(fresh.detail);
            setMessage(ok
              ? (summary ? `Completed · ${summary}` : 'Completed.')
              : (summary ? `Failed · ${summary}` : 'Failed.'));
            return;
          }
          // Found a run but no outcome yet — keep polling.
          setMessage('Running…');
        }
      } catch { /* keep polling */ }
    }
    setState('timeout');
    setMessage('Still running in the background — check History for the result.');
  }

  function reset(): void {
    setState('idle'); setMessage('');
  }

  return { state, message, trigger, reset };
}

function summariseJobDetail(detail: string | null | undefined): string {
  const parsed = parseDetailObject(detail);
  const parts: string[] = [];
  if (typeof parsed.accepted === 'number' && parsed.accepted > 0) parts.push(`${parsed.accepted} accepted`);
  if (typeof parsed.rejected === 'number' && parsed.rejected > 0) parts.push(`${parsed.rejected} rejected`);
  if (typeof parsed.conflicts === 'number' && parsed.conflicts > 0) parts.push(`${parsed.conflicts} need review`);
  if (typeof parsed.picked === 'number' && parsed.picked === 0 && parts.length === 0) {
    return 'nothing to send';
  }
  if (typeof parsed.pulled === 'number') parts.push(`${parsed.pulled} updates`);
  return parts.join(' · ');
}

/** Pull the operationIds list out of a detail JSON blob, if present. */
export function parseOperationIds(detail: string | null | undefined): ReadonlyArray<string> {
  const parsed = parseDetailObject(detail);
  const arr = parsed.operationIds;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === 'string');
}

function parseDetailObject(detail: string | null | undefined): Record<string, unknown> {
  if (!detail) return {};
  try {
    const obj = JSON.parse(detail);
    return (obj && typeof obj === 'object') ? obj as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function metadataSentence(d: Record<string, unknown>): string {
  const pulled = num(d.pulled) ?? num(d.mirrored);
  if (pulled != null && pulled > 0) return `Mirrored ${pulled.toLocaleString()} metadata records from DHIS2.`;
  if (pulled === 0) return 'Metadata already up to date.';
  return 'Pulled metadata from DHIS2.';
}

function dataPushSentence(d: Record<string, unknown>): string {
  const picked = num(d.picked);
  const accepted = num(d.accepted);
  const rejected = num(d.rejected);
  const conflicts = num(d.conflicts);
  const retryable = num(d.retryable);
  if (picked != null && picked === 0 && !accepted && !rejected) {
    return 'Nothing waiting to send — queue was empty.';
  }
  const byType = d.byType && typeof d.byType === 'object'
    ? Object.entries(d.byType as Record<string, unknown>)
        .map(([k, v]) => `${v} ${entityTypeLabel(k).toLowerCase()}`)
        .join(' · ')
    : '';
  const outcomes: string[] = [];
  if (accepted) outcomes.push(`${accepted} accepted`);
  if (rejected) outcomes.push(`${rejected} rejected`);
  if (conflicts) outcomes.push(`${conflicts} needed review`);
  if (retryable) outcomes.push(`${retryable} to retry`);
  if (byType && outcomes.length) return `Pushed ${byType} · ${outcomes.join(' · ')}.`;
  if (byType) return `Picked ${byType} to push.`;
  if (outcomes.length) return `Pushed to DHIS2 · ${outcomes.join(' · ')}.`;
  if (picked != null) return `Picked ${picked.toLocaleString()} operations to push.`;
  return 'Pushed outgoing data to DHIS2.';
}

function referralSentence(d: Record<string, unknown>): string {
  const found = num(d.found) ?? num(d.pulled);
  if (found != null && found > 0) return `Pulled ${found} inbound referrals.`;
  if (found === 0) return 'No new inbound referrals.';
  return 'Checked for inbound referrals.';
}

// ────────────────────────────────────────────────────────────────────
// Entity-type icons for /sync/queues rows (incoming + outgoing)
// ────────────────────────────────────────────────────────────────────

const QUEUE_ICON_BY_TYPE: Readonly<Record<string, string>> = {
  DATA_VALUE_SET: '🩺',
  AGGREGATE: '🩺',
  AGGREGATE_PUSH: '🩺',
  EVENT: '📝',
  EVENT_PUSH: '📝',
  ENROLLMENT: '📋',
  TRACKED_ENTITY: '👤',
  TRACKED_ENTITY_INSTANCE: '👤',
  TEI: '👤',
  REFERRAL: '📥',
  METADATA: '📦',
  DATA_ELEMENT: '🧮',
  PROGRAM: '🗂',
  ORG_UNIT: '🏥',
};

/** Pick a single emoji icon for a queue row based on its type / kind. */
export function queueEntityIcon(type: string | null | undefined): string {
  if (!type) return '⚙';
  const key = type.toUpperCase();
  return QUEUE_ICON_BY_TYPE[key] ?? '⚙';
}

/** Human-readable label for a queue entity type. Keeps the raw as a tooltip. */
export function queueEntityLabel(type: string | null | undefined): string {
  if (!type) return 'Operation';
  const key = type.toUpperCase();
  const map: Record<string, string> = {
    DATA_VALUE_SET: 'Aggregate data',
    AGGREGATE: 'Aggregate data',
    AGGREGATE_PUSH: 'Aggregate data',
    EVENT: 'Event',
    EVENT_PUSH: 'Event',
    ENROLLMENT: 'Enrollment',
    TRACKED_ENTITY: 'Tracked entity',
    TRACKED_ENTITY_INSTANCE: 'Tracked entity',
    TEI: 'Tracked entity',
    REFERRAL: 'Referral',
    METADATA: 'Metadata',
    DATA_ELEMENT: 'Data element',
    PROGRAM: 'Program',
    ORG_UNIT: 'Organisation unit',
  };
  return map[key] ?? humaniseJob(type);
}

// ────────────────────────────────────────────────────────────────────
// DrawerTabs — simple tab navigation used in modernised side-drawers
// ────────────────────────────────────────────────────────────────────

export interface DrawerTab {
  readonly id: string;
  readonly label: string;
  readonly badge?: string | number;
}

export function DrawerTabs({ tabs, active, onChange }: {
  tabs: ReadonlyArray<DrawerTab>;
  active: string;
  onChange: (id: string) => void;
}): JSX.Element {
  return (
    <div className="ea-section-tabs" role="tablist" style={{ marginBottom: 14 }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={isActive}
                  data-test={`drawer-tab-${t.id}`}
                  className={'ea-section-tab' + (isActive ? ' ea-section-tab--active' : '')}
                  onClick={() => onChange(t.id)}>
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge !== '' && (
              <span style={{
                marginLeft: 6,
                background: isActive ? 'var(--der-primary)' : 'var(--der-ink-100)',
                color: isActive ? 'white' : 'var(--der-ink-700)',
                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                minWidth: 16, textAlign: 'center', display: 'inline-block',
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// JsonViewer — syntax-coloured collapsible JSON tree with copy button
// ────────────────────────────────────────────────────────────────────

export function JsonViewer({ value, maxDepth = 2, label }: {
  value: unknown;
  maxDepth?: number;
  label?: string;
}): JSX.Element {
  const [copied, setCopied] = useState<boolean>(false);
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }
  return (
    <div className="ea-json-viewer"
         style={{
           border: '1px solid var(--der-border-subtle)',
           background: 'var(--der-raised)',
         }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid var(--der-border-subtle)',
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em',
        color: 'var(--der-ink-500)', fontWeight: 600,
      }}>
        <span>{label ?? 'JSON'}</span>
        <button type="button" className="ea-link-btn"
                data-test="json-copy"
                onClick={() => { copy().catch(() => undefined); }}
                style={{ fontSize: 11 }}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: 12, fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11, lineHeight: 1.55, maxHeight: 360, overflow: 'auto',
        color: 'var(--der-ink-900)', whiteSpace: 'pre',
        background: 'white',
      }}>
        <JsonNode value={value} depth={0} maxDepth={maxDepth} path="$" />
      </pre>
    </div>
  );
}

function JsonNode({ value, depth, maxDepth, path }: {
  value: unknown; depth: number; maxDepth: number; path: string;
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(depth < maxDepth);
  const indent = '  '.repeat(depth);
  if (value === null) {
    return <span style={{ color: '#999' }}>null</span>;
  }
  if (typeof value === 'string') {
    return <span style={{ color: '#047857' }}>"{value}"</span>;
  }
  if (typeof value === 'number') {
    return <span style={{ color: '#b45309' }}>{String(value)}</span>;
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: '#7c3aed' }}>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: '#999' }}>[]</span>;
    return (
      <>
        <span onClick={() => setOpen(!open)}
              style={{ cursor: 'pointer', color: 'var(--der-ink-500)' }}
              data-test={`json-toggle-${path}`}>
          {open ? '▼' : '▶'} [{value.length}]
        </span>
        {open && (
          <>
            {value.map((v, i) => (
              <div key={i} style={{ paddingLeft: 14 }}>
                {indent}  <span style={{ color: '#64748b' }}>{i}:</span>{' '}
                <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth}
                          path={`${path}[${i}]`} />
              </div>
            ))}
            <div>{indent}]</div>
          </>
        )}
      </>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: '#999' }}>{'{}'}</span>;
    return (
      <>
        <span onClick={() => setOpen(!open)}
              style={{ cursor: 'pointer', color: 'var(--der-ink-500)' }}
              data-test={`json-toggle-${path}`}>
          {open ? '▼' : '▶'} {`{${entries.length}}`}
        </span>
        {open && (
          <>
            {entries.map(([k, v]) => (
              <div key={k} style={{ paddingLeft: 14 }}>
                {indent}  <span style={{ color: '#1d4ed8' }}>"{k}"</span>:{' '}
                <JsonNode value={v} depth={depth + 1} maxDepth={maxDepth}
                          path={`${path}.${k}`} />
              </div>
            ))}
            <div>{indent}{'}'}</div>
          </>
        )}
      </>
    );
  }
  return <span>{String(value)}</span>;
}
