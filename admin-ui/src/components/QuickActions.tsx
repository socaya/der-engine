import { Link } from 'react-router-dom';

/**
 * M1: Quick Actions grid for the Overview. Four compact cards
 * linking to the most-used ops surfaces.
 */

interface Action {
  readonly to: string;
  readonly title: string;
  readonly desc: string;
  readonly tone: 'primary' | 'teal' | 'amber' | 'green';
  readonly icon: () => JSX.Element;
}

function IconLightning(): JSX.Element {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
}
function IconUserPlus(): JSX.Element {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="4"/><path d="M3 20v-2a4 4 0 014-4h4a4 4 0 014 4v2M19 9v6M16 12h6"/></svg>;
}
function IconApps(): JSX.Element {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>;
}
function IconShield(): JSX.Element {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l9 4v5c0 5-3.6 8.5-9 10-5.4-1.5-9-5-9-10V7l9-4z"/><path d="M9 12l2 2 4-4"/></svg>;
}

const ACTIONS: readonly Action[] = [
  { to: '/sync/jobs/trigger', title: 'Trigger sync', desc: 'Fire a sync job now', tone: 'primary', icon: IconLightning },
  { to: '/provisioning/users/new', title: 'Add user', desc: 'Provision a new operator', tone: 'teal', icon: IconUserPlus },
  { to: '/apps', title: 'Install app', desc: 'Upload a DHIS2 custom app', tone: 'amber', icon: IconApps },
  { to: '/audit/events', title: 'Audit events', desc: 'Review recent activity', tone: 'green', icon: IconShield },
];

export function QuickActions(): JSX.Element {
  return (
    <section className="ea-quick" data-test="quick-actions">
      <h2>Quick actions</h2>
      <div className="ea-quick-grid">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className={`ea-quick-card ea-quick-card--${a.tone}`}
              data-test={`quick-${a.to.replace(/[^A-Za-z]+/g, '-')}`}
            >
              <div className="ea-quick-icon"><Icon /></div>
              <div>
                <div className="ea-quick-title">{a.title}</div>
                <div className="ea-quick-desc">{a.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
