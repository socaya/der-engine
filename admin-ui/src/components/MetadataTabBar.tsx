import { Link, useLocation } from 'react-router-dom';

/** UI-3 / UI-8 — pill-group sub-nav for the DHIS2 metadata cluster.
 *  Visual match for the DataAggregate action strip (ea-btn--sm with
 *  primary-for-active, ghost-for-others). */
const TABS: ReadonlyArray<{
  to: string;
  label: string;
  hint: string;
  matches: (p: string) => boolean;
}> = [
  {
    to: '/dhis2/metadata',
    label: 'Catalogue',
    hint: 'Read-only mirror of DHIS2 reference metadata',
    matches: (p) => p === '/dhis2/metadata'
      || (p.startsWith('/dhis2/metadata/') && !p.startsWith('/dhis2/metadata-'))
      || p.startsWith('/dhis2/organisation-unit')
      || p.startsWith('/dhis2/connection'),
  },
  {
    to: '/metadata/snapshots',
    label: 'Snapshots',
    hint: 'Point-in-time snapshots of the DHIS2 metadata catalogue',
    matches: (p) => p.startsWith('/metadata/snapshots'),
  },
  {
    to: '/dhis2/metadata-drift',
    label: 'Changes',
    hint: 'Delta between the two most recent snapshots',
    matches: (p) => p.startsWith('/dhis2/metadata-drift'),
  },
  {
    to: '/dhis2/metadata-sync',
    label: 'Sync',
    hint: 'Pull latest metadata from DHIS2 central',
    matches: (p) => p.startsWith('/dhis2/metadata-sync'),
  },
  {
    to: '/dhis2/compat',
    label: 'Compatibility',
    hint: 'Schema + feature compatibility probe',
    matches: (p) => p === '/dhis2/compat' || p.startsWith('/dhis2/compat-'),
  },
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
            <span>{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
