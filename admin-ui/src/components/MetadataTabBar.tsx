import { Link, useLocation } from 'react-router-dom';

/**
 * UI-3 — shared tab bar for the DHIS2 metadata cluster.
 *
 * <p>Four screens address one operator concern ("has remote metadata
 * changed and does our local mirror match?") — Catalogue (read-only
 * reference), Snapshots (point-in-time compare), Changes (drift
 * detector), Compatibility (version schema check). Before this bar
 * each lived under a different label with no visual link. The bar
 * renders at the top of all four so operators always see the
 * cluster + their current position inside it.</p>
 *
 * <p>Keeps the existing routes — zero bookmark churn. Pure visual
 * glue.</p>
 */
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
    matches: (p) => p === '/dhis2/compat'
      || p.startsWith('/dhis2/compat-'),
  },
];

export function MetadataTabBar(): JSX.Element {
  const loc = useLocation();
  return (
    <nav className="der-metadata-tabs"
         data-test="metadata-tabs"
         aria-label="Metadata sub-navigation"
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
                data-test={`metadata-tab-${t.label.toLowerCase()}`}
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
