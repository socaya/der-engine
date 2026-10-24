import { NavLink, useLocation } from 'react-router-dom';
import { groupForRoute } from '../app/navigation';

/**
 * Secondary tab strip rendered above the main content whenever the
 * current route belongs to a nav group that has more than one
 * visible (non-contextual) item. Mirrors the DER mockup pattern
 * where primary nav lives in the sidebar and sub-pages live as tabs
 * on the section header.
 */
export function SectionTabs(): JSX.Element | null {
  const loc = useLocation();
  const grp = groupForRoute(loc.pathname);
  if (!grp) return null;
  const items = grp.items.filter((it) => it.status !== 'contextual');
  if (items.length < 2) return null;
  return (
    <nav className="ea-section-tabs" aria-label={`${grp.label} sub-navigation`}>
      {items.map((it) => (
        <NavLink
          key={it.id}
          to={it.to}
          end={it.to === '/'}
          className={({ isActive }) =>
            'ea-section-tab' + (isActive ? ' ea-section-tab--active' : '')
          }
          data-test={`tab-${it.id}`}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
