import { Link, useLocation } from 'react-router-dom';
import { UiIcon, type UiIconId } from './UiIcon';

/** UI-3 / UI-8 — pill-group sub-nav for the DHIS2 metadata cluster.
 *  Right-aligned, icon-prefixed, ea-btn primary/ghost. Lives inside
 *  the screen body so the module nav strip above remains visible. */
const TABS: ReadonlyArray<{
  to: string;
  label: string;
  hint: string;
  icon: UiIconId;
  matches: (p: string) => boolean;
}> = [
  { to: '/dhis2/metadata', label: 'Catalogue', icon: 'metadata',
    hint: 'Read-only mirror of DHIS2 reference metadata',
    matches: (p) => p === '/dhis2/metadata'
      || (p.startsWith('/dhis2/metadata/') && !p.startsWith('/dhis2/metadata-'))
      || p.startsWith('/dhis2/organisation-unit')
      || p.startsWith('/dhis2/connection') },
  { to: '/metadata/snapshots', label: 'Snapshots', icon: 'history',
    hint: 'Point-in-time snapshots of the DHIS2 metadata catalogue',
    matches: (p) => p.startsWith('/metadata/snapshots') },
  { to: '/dhis2/metadata-drift', label: 'Changes', icon: 'drift',
    hint: 'Delta between the two most recent snapshots',
    matches: (p) => p.startsWith('/dhis2/metadata-drift') },
  { to: '/dhis2/metadata-sync', label: 'Sync', icon: 'pull',
    hint: 'Pull latest metadata from DHIS2 central',
    matches: (p) => p.startsWith('/dhis2/metadata-sync') },
  { to: '/dhis2/compat', label: 'Compatibility', icon: 'compat',
    hint: 'Schema + feature compatibility probe',
    matches: (p) => p === '/dhis2/compat' || p.startsWith('/dhis2/compat-') },
];

export function MetadataTabBar(): JSX.Element {
  const loc = useLocation();
  return (
    <div className="der-pill-group"
         data-test="metadata-tabs"
         role="tablist"
         aria-label="Metadata sub-navigation"
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
                data-test={`metadata-tab-${t.label.toLowerCase()}`}
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
