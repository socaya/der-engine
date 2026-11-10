import { Link, useLocation } from 'react-router-dom';

/** UI-7 — tab bar grouping the observability screens under one
 *  "Health" surface so the System module fits on a single nav row.
 *  Same visual pattern as MetadataTabBar (UI-3): preserves routes,
 *  highlights current tab, hover hint per tab. */
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
    <nav className="der-section-tabs"
         data-test="health-tabs"
         aria-label="Health sub-navigation"
         style={{
           display: 'flex',
           flexWrap: 'wrap',
           gap: 4,
           padding: '6px 0',
           marginBottom: 12,
           borderBottom: '1px solid var(--der-border-soft, #e2e6ef)',
         }}>
      {TABS.map((t) => {
        const active = t.matches(loc.pathname);
        return (
          <Link key={t.to}
                to={t.to}
                data-test={`health-tab-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
                title={t.hint}
                aria-current={active ? 'page' : undefined}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  textDecoration: 'none',
                  color: active
                    ? 'var(--der-primary, #2563eb)'
                    : 'var(--der-text, #0f172a)',
                  fontWeight: active ? 600 : 500,
                  borderBottom: active
                    ? '2px solid var(--der-primary, #2563eb)'
                    : '2px solid transparent',
                  marginBottom: -1,
                }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
