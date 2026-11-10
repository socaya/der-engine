import { Link, useLocation } from 'react-router-dom';
import { UiIcon, type UiIconId } from './UiIcon';

/** UI-8 — pill-group sub-nav for the Health cluster. Renders as a
 *  right-aligned row of ea-btn pills (primary for active, ghost
 *  for others) with a leading icon per tab. Doesn't hide or
 *  replace the module nav above — sits in the screen body as a
 *  sub-section selector. */
const TABS: ReadonlyArray<{
  to: string;
  label: string;
  hint: string;
  icon: UiIconId;
  matches: (p: string) => boolean;
}> = [
  { to: '/monitoring/health', label: 'Health', icon: 'health',
    hint: 'Service liveness + dependency readiness',
    matches: (p) => p === '/monitoring/health' || p.startsWith('/monitoring/health/') },
  { to: '/monitoring/metrics', label: 'Metrics', icon: 'analytics',
    hint: 'System-level counters: CPU, memory, requests, drain throughput',
    matches: (p) => p.startsWith('/monitoring/metrics') },
  { to: '/monitoring/storage', label: 'Storage', icon: 'storage',
    hint: 'Database + filesystem usage, WAL state',
    matches: (p) => p.startsWith('/monitoring/storage') },
  { to: '/system/hardware', label: 'Host hardware', icon: 'workstation',
    hint: 'Host CPU / RAM / disk inventory',
    matches: (p) => p.startsWith('/system/hardware') },
];

export function HealthTabBar(): JSX.Element {
  const loc = useLocation();
  return (
    <div className="der-pill-group"
         data-test="health-tabs"
         role="tablist"
         aria-label="Health sub-navigation"
         style={{
           display: 'flex',
           flexWrap: 'wrap',
           gap: 6,
           justifyContent: 'flex-end',
           marginBottom: 10,
         }}>
      {TABS.map((t) => {
        const active = t.matches(loc.pathname);
        return (
          <Link key={t.to}
                to={t.to}
                data-test={`health-tab-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
                title={t.hint}
                role="tab"
                aria-selected={active}
                className={'ea-btn ea-btn--sm'
                  + (active ? ' ea-btn--primary' : ' ea-btn--ghost')}>
            <UiIcon icon={t.icon} size={14} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
