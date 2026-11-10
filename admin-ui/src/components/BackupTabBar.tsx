import { Link, useLocation } from 'react-router-dom';
import { UiIcon, type UiIconId } from './UiIcon';

/** UI-8 — pill-group sub-nav for the Backup cluster. Right-aligned,
 *  icon-prefixed, ea-btn primary/ghost. Lives inside the screen
 *  body so the module nav strip above remains visible. */
const TABS: ReadonlyArray<{
  to: string;
  label: string;
  hint: string;
  icon: UiIconId;
  matches: (p: string) => boolean;
}> = [
  { to: '/backup', label: 'Backup', icon: 'backup',
    hint: 'Full + incremental backup runs, PITR WAL state',
    matches: (p) => p === '/backup' || p.startsWith('/backup/') },
  { to: '/restore', label: 'Restore', icon: 'restore',
    hint: 'Restore from local, remote, or uploaded archive',
    matches: (p) => p === '/restore' || p.startsWith('/restore/') },
  { to: '/recovery', label: 'Recovery', icon: 'recovery',
    hint: 'PITR planning + verification runs',
    matches: (p) => p === '/recovery' || p.startsWith('/recovery/') },
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
           justifyContent: 'flex-end',
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
            <UiIcon icon={t.icon} size={14} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
