import { Link, useLocation } from 'react-router-dom';

/** UI-8 — pill-group sub-nav (matches DataAggregate action strip). */
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
    <div className="der-pill-group"
         data-test="backup-tabs"
         role="tablist"
         aria-label="Backup sub-navigation"
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
                data-test={`backup-tab-${t.label.toLowerCase()}`}
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
