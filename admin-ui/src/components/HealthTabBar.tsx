import { Link, useLocation } from 'react-router-dom';

/** UI-8 — pill-group sub-nav. Visual match for the DataAggregate
 *  action strip at /admin/data/aggregate:
 *  one primary pill (active) + ghost pills (others), small size,
 *  same ea-btn classes so the rhythm is identical across screens. */
const TABS: ReadonlyArray<{
  to: string;
  label: string;
  hint: string;
  matches: (p: string) => boolean;
}> = [
  {
    to: '/monitoring/health',
    label: 'Health',
    hint: 'Service liveness + dependency readiness',
    matches: (p) => p === '/monitoring/health' || p.startsWith('/monitoring/health/'),
  },
  {
    to: '/monitoring/metrics',
    label: 'Metrics',
    hint: 'System-level counters: CPU, memory, requests, drain throughput',
    matches: (p) => p.startsWith('/monitoring/metrics'),
  },
  {
    to: '/monitoring/storage',
    label: 'Storage',
    hint: 'Database + filesystem usage, WAL state',
    matches: (p) => p.startsWith('/monitoring/storage'),
  },
  {
    to: '/system/hardware',
    label: 'Host hardware',
    hint: 'Host CPU / RAM / disk inventory',
    matches: (p) => p.startsWith('/system/hardware'),
  },
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
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
