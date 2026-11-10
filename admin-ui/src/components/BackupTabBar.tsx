import { Link, useLocation } from 'react-router-dom';

/** UI-7 — tab bar grouping the data-recovery screens so backup
 *  + restore + recovery live under one "Backup" surface in the
 *  System module's nav row. */
const TABS: ReadonlyArray<{
  to: string;
  label: string;
  hint: string;
  matches: (p: string) => boolean;
}> = [
  {
    to: '/backup',
    label: 'Backup',
    hint: 'Full + incremental backup runs, PITR WAL state',
    matches: (p) => p === '/backup' || p.startsWith('/backup/'),
  },
  {
    to: '/restore',
    label: 'Restore',
    hint: 'Restore from local, remote, or uploaded archive',
    matches: (p) => p === '/restore' || p.startsWith('/restore/'),
  },
  {
    to: '/recovery',
    label: 'Recovery',
    hint: 'PITR planning + verification runs',
    matches: (p) => p === '/recovery' || p.startsWith('/recovery/'),
  },
];

export function BackupTabBar(): JSX.Element {
  const loc = useLocation();
  return (
    <nav className="der-section-tabs"
         data-test="backup-tabs"
         aria-label="Backup sub-navigation"
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
                data-test={`backup-tab-${t.label.toLowerCase()}`}
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
