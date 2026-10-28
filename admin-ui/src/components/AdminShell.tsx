import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NAV_GROUPS, groupForRoute, type NavGroup } from '../app/navigation';
import { NavIcon } from './NavIcon';
import { SectionTabs } from './SectionTabs';
import { useOrgUnit } from './OrgUnitContext';
import * as edgeApi from '../api/edgeApi';

/**
 * DER Runtime indicator — polled from `/edge-api/v1/system/health` and
 * `/edge-api/v1/compat`. Replaces the hard-coded "DER server · online"
 * footer per §6.3 of the UI Visibility 10/10 standard.
 */
type RuntimeMode = 'operational' | 'degraded' | 'offline-first' | 'recovering' | 'starting' | 'unknown';

function useRuntimeMode(): { mode: RuntimeMode; label: string; sub: string; detail: string } {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [p, setP] = useState<edgeApi.PingSnapshot | null>(null);
  const [probing, setProbing] = useState(true);
  useEffect(() => {
    let cancel = false;
    async function tick(): Promise<void> {
      try {
        const [hr, pr] = await Promise.allSettled([edgeApi.health(), edgeApi.dhis2Ping()]);
        if (!cancel) {
          if (hr.status === 'fulfilled') setH(hr.value);
          if (pr.status === 'fulfilled') setP(pr.value);
          setProbing(false);
        }
      } catch { if (!cancel) setProbing(false); }
    }
    tick().catch(() => undefined);
    const id = window.setInterval(() => { tick().catch(() => undefined); }, 15_000);
    return () => { cancel = true; window.clearInterval(id); };
  }, []);
  if (!h) return { mode: 'unknown', label: 'DER Runtime · Checking', sub: '', detail: 'Checking status…' };
  const derUp = h.status === 'UP' || h.status === 'ready';
  const starting = h.status === 'starter-ready' || h.status === 'starting';
  // Ping is authoritative — it does a live GET against central with a short
  // timeout and caches server-side for 10 s. If the probe hasn't landed yet
  // (first 15 s after mount) we show "Checking" rather than guess.
  const centralReachable = p?.reachable === true;
  const centralUnreachable = p != null && p.reachable === false;
  if (!derUp && !starting) return { mode: 'degraded', label: 'DER Runtime · Degraded', sub: h.status ?? 'unavailable', detail: 'DER runtime is not operational.' };
  if (starting) return { mode: 'starting', label: 'DER Runtime · Starting', sub: '', detail: 'DER is initialising.' };
  if (centralReachable) return { mode: 'operational', label: 'DER Connected', sub: 'Central reachable', detail: 'DER is connected to Central DHIS2. Local operations are available and eligible changes are being synchronised.' };
  if (centralUnreachable) return { mode: 'offline-first', label: 'DER Offline-First', sub: 'Central unavailable', detail: p?.message ?? 'Central DHIS2 is unavailable. DER remains operational on the local network. Locally accepted changes are being stored safely and queued for synchronisation.' };
  if (probing) return { mode: 'unknown', label: 'DER Runtime · Checking', sub: '', detail: 'Checking central reachability…' };
  return { mode: 'operational', label: 'DER Connected', sub: '', detail: 'DER is operational.' };
}

/**
 * DER admin shell per
 * docs/media/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md.
 *
 * Shell:
 *   ┌──────────┬────────────────────────────────────┐
 *   │ sidebar  │ topbar (search · bell · OU · user) │
 *   │ (navy)   ├────────────────────────────────────┤
 *   │          │ main (breadcrumbs + screen)        │
 *   └──────────┴────────────────────────────────────┘
 *
 * - Flat quiet surfaces per §3 (no gradient blocks, no bright
 *   decorative cards).
 * - Approved DER logo asset served from /admin/der-logo.png.
 * - 10 nav groups from the registry; capability-gap items shown
 *   greyed with a "n/a" badge.
 * - Responsive: labels hidden on ≤1024 px, drawer on ≤768 px.
 */

export interface AdminShellProps {
  readonly children: ReactNode;
}

function initials(nameOrUsername: string): string {
  const parts = nameOrUsername.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function RuntimeFooter(): JSX.Element {
  const r = useRuntimeMode();
  return (
    <Link to="/sync" className="ea-sidebar-footer ea-sidebar-footer-link"
          title={r.detail} data-test="runtime-footer">
      <span className={'ea-sidebar-footer-dot ea-sidebar-footer-dot--' + r.mode} aria-hidden="true" />
      <span className="ea-sidebar-footer-text">{r.label}</span>
      {r.sub && <span className="ea-sidebar-footer-sub">{r.sub}</span>}
    </Link>
  );
}

/** AttentionCentre — §17 functional notification dropdown. Aggregates
 *  attention sources (conflicts, pending approvals, pending referrals,
 *  worker paused) into a single actionable list. Polls every 30 s. */
interface AttentionItem {
  readonly kind: string;
  readonly label: string;
  readonly count: number;
  readonly tone: 'danger' | 'warning' | 'info';
  readonly to: string;
}

function useAttentionItems(): { items: AttentionItem[]; total: number } {
  const [items, setItems] = useState<AttentionItem[]>([]);
  useEffect(() => {
    let cancel = false;
    async function tick(): Promise<void> {
      try {
        const [c, a, r, w] = await Promise.allSettled([
          edgeApi.listConflicts(100),
          edgeApi.listPendingApprovals(100),
          edgeApi.listReferralInbox(100),
          edgeApi.workerHealth(),
        ]);
        if (cancel) return;
        const next: AttentionItem[] = [];
        if (c.status === 'fulfilled' && c.value.length > 0) {
          next.push({ kind: 'conflict', label: 'Attention needed on captured records',
            count: c.value.length, tone: 'danger', to: '/sync/attention' });
        }
        if (a.status === 'fulfilled' && a.value.rows.length > 0) {
          next.push({ kind: 'approval', label: 'Approvals pending review',
            count: a.value.rows.length, tone: 'warning', to: '/approvals' });
        }
        if (r.status === 'fulfilled') {
          const pending = r.value.entries.filter((x) => x.status === 'PENDING').length;
          if (pending > 0) {
            next.push({ kind: 'referral', label: 'Referrals waiting to be handled',
              count: pending, tone: 'warning', to: '/referral/inbox' });
          }
        }
        if (w.status === 'fulfilled' && !w.value.enabled) {
          next.push({ kind: 'worker', label: 'Sync worker paused',
            count: 1, tone: 'warning', to: '/sync/worker' });
        }
        setItems(next);
      } catch { /* ignore */ }
    }
    tick().catch(() => undefined);
    const id = window.setInterval(() => { tick().catch(() => undefined); }, 30_000);
    return () => { cancel = true; window.clearInterval(id); };
  }, []);
  const total = items.reduce((a, b) => a + b.count, 0);
  return { items, total };
}

function AttentionCentre(): JSX.Element {
  const { items, total } = useAttentionItems();
  return (
    <details className="ea-attention-centre" style={{ position: 'relative' }}>
      <summary className="ea-topbar-icon-btn" aria-label={`Attention (${total})`}
               data-test="topbar-bell">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5" />
          <path d="M10 21a2 2 0 004 0" />
        </svg>
        {total > 0 && <span className="ea-attention-badge" aria-hidden="true">
          {total > 99 ? '99+' : total}
        </span>}
      </summary>
      <div className="ea-attention-popover" role="menu">
        <div className="ea-attention-popover-head">
          <strong>Attention</strong>
          <span className="ea-attention-popover-sub">
            {total === 0 ? 'All clear' : `${total} item${total === 1 ? '' : 's'}`}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="ea-attention-popover-empty">
            Nothing needs attention right now.
          </div>
        ) : (
          <ul className="ea-attention-popover-list">
            {items.map((it) => (
              <li key={it.kind}>
                <Link to={it.to} className="ea-attention-popover-item" role="menuitem"
                      onClick={(e) => {
                        const d = (e.currentTarget.closest('details'));
                        if (d) d.removeAttribute('open');
                      }}>
                  <span className={'ea-attention-dot ea-attention-dot--' + it.tone} aria-hidden="true" />
                  <span className="ea-attention-popover-label">{it.label}</span>
                  <span className="ea-attention-popover-count">{it.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="ea-attention-popover-foot">
          <Link to="/sync/attention"
                onClick={(e) => {
                  const d = (e.currentTarget.closest('details'));
                  if (d) d.removeAttribute('open');
                }}>
            Open Attention page →
          </Link>
        </div>
      </div>
    </details>
  );
}

/** Topbar operating-mode pill (§6.2 mandatory global operating-state control). */
function TopbarOperatingMode(): JSX.Element {
  const r = useRuntimeMode();
  return (
    <Link to="/sync" className={'ea-topbar-mode ea-topbar-mode--' + r.mode}
          title={r.detail} data-test="topbar-mode">
      <span className="ea-topbar-mode-dot" aria-hidden="true" />
      <span className="ea-topbar-mode-label">{r.label.replace(/^DER /, '')}</span>
    </Link>
  );
}

function SidebarPrimary({ grp, activeGroupId }: {
  grp: NavGroup; activeGroupId: string | null;
}): JSX.Element | null {
  const primary = grp.items.find((it) => it.id === grp.primaryId);
  if (!primary) return null;
  const isActive = activeGroupId === grp.id;
  return (
    <NavLink
      to={primary.to}
      end={primary.to === '/'}
      data-test={`nav-${grp.id}`}
      className={({ isActive: linkActive }) =>
        'ea-sidebar-item'
          + (linkActive || isActive ? ' ea-sidebar-item-active' : '')
      }
      title={grp.label}
    >
      <span className="ea-sidebar-icon" aria-hidden="true">
        <NavIcon icon={grp.icon} />
      </span>
      <span className="ea-sidebar-label">{grp.label}</span>
    </NavLink>
  );
}

export function AdminShell({ children }: AdminShellProps): JSX.Element {
  const { state, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { binding: ou } = useOrgUnit();
  const onSignIn = location.pathname === '/sign-in';
  const authed = state.status === 'AUTHENTICATED';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate('/sign-in', { replace: true });
  }

  const shellCls =
    'ea-shell' +
    (onSignIn ? ' ea-shell--signin' : '') +
    (mobileOpen ? ' ea-shell--mobile-open' : '');

  return (
    <div className={shellCls}>
      {!onSignIn && (
        <aside className="ea-sidebar" data-test="sidebar">
          <div className="ea-sidebar-brand">
            <img
              src="/admin/der-logo.png"
              alt="DER — DHIS2 Edge Runtime"
              className="ea-sidebar-logo-img"
              width="140"
              height="40"
            />
            <img
              src="/admin/der-logo-short.png"
              alt="DER"
              className="ea-sidebar-logo-img-sm"
              width="36"
              height="36"
            />
          </div>
          <nav className="ea-sidebar-nav" aria-label="Primary">
            {NAV_GROUPS.map((grp) => (
              <SidebarPrimary key={grp.id} grp={grp}
                              activeGroupId={groupForRoute(location.pathname)?.id ?? null} />
            ))}
          </nav>
          <RuntimeFooter />
        </aside>
      )}
      {!onSignIn && (
        <div
          className="ea-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <header className="ea-topbar" data-test="headerbar">
        {!onSignIn && (
          <button
            type="button"
            className="ea-topbar-toggle"
            aria-label="Toggle navigation"
            data-test="topbar-toggle"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        )}
        {onSignIn && (
          <Link to="/" className="ea-brand" data-test="brand" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src="/admin/der-logo.png" alt="DER — DHIS2 Edge Runtime" style={{ height: 36 }} />
          </Link>
        )}
        {!onSignIn && (
          <>
            {/* §18: Search removed until functional. Hidden by default; expose
                via Ctrl/Cmd+K keyboard shortcut in a later release. */}
            <div style={{ flex: 1 }} />
            <div data-test="brand" style={{ display: 'none' }}>DER</div>
          </>
        )}
        <div className="ea-topbar-right">
          {authed && !onSignIn && <TopbarOperatingMode />}
          {authed && !onSignIn && (
            <>
              <Link
                to="/integration/organisation-unit"
                className={'ea-topbar-ou'
                    + (ou?.bound ? ' ea-topbar-ou--bound' : ' ea-topbar-ou--unbound')}
                aria-label={ou?.bound
                    ? `Bound organisation unit: ${ou.orgUnitDisplayName ?? ou.orgUnitId}`
                    : 'No organisation unit bound — click to bind'}
                title={ou?.bound
                    ? `Bound to ${ou.orgUnitDisplayName ?? ou.orgUnitId}`
                    : 'No organisation unit bound — click to bind'}
                data-test="topbar-ou"
              >
                <span className="ea-topbar-ou-label">OU</span>
                <span className="ea-topbar-ou-value">
                  {ou == null ? '…'
                      : ou.bound ? (ou.orgUnitDisplayName ?? ou.orgUnitId ?? '—')
                      : 'Not bound'}
                </span>
              </Link>
              <AttentionCentre />
              <div className="ea-user-chip" data-test="headerbar-user">
                <span className="ea-user-avatar" aria-hidden="true">
                  {initials(state.user.displayName ?? state.user.username)}
                </span>
                <div className="ea-user-chip-info">
                  <span className="ea-user-chip-name">
                    {state.user.displayName ?? state.user.username}
                  </span>
                  <span className="ea-user-chip-role">
                    {state.user.roles.join(' · ')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="ea-headerbar-signout"
                data-test="headerbar-signout"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <main className="ea-main" data-der-app="admin-ui">
        <div className="ea-main-inner">
          {!onSignIn && <SectionTabs />}
          {children}
        </div>
      </main>
    </div>
  );
}
