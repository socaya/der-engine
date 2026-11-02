import { Link, useLocation } from 'react-router-dom';
import { groupForRoute } from '../app/navigation';
import { UiIcon } from './UiIcon';

/**
 * Secondary tab strip rendered above the main content whenever the
 * current route belongs to a nav group that has more than one
 * visible (non-contextual) item. Mirrors the DER mockup pattern
 * where primary nav lives in the sidebar and sub-pages live as tabs
 * on the section header.
 *
 * §2.3.116 R-AM — active-tab detection switched from
 * {@code <NavLink end>} to a longest-prefix match. The {@code end}
 * flag only matched exact URLs, so visiting
 * {@code /data/tracker/tei/<uid>} failed to highlight the Tracker
 * tab (route is {@code /data/tracker}). Longest-prefix picks the
 * narrowest tab whose path is a prefix of the current location.
 */
export function SectionTabs(): JSX.Element | null {
  const loc = useLocation();
  const grp = groupForRoute(loc.pathname);
  if (!grp) return null;
  const items = grp.items.filter((it) => it.status !== 'contextual');
  if (items.length < 2) return null;

  // Find the longest-prefix item that matches the current path. We
  // prefer longer prefixes so /data/tracker beats /data for a route
  // like /data/tracker/tei/<uid>.
  let activeId: string | null = null;
  let activeLen = 0;
  for (const it of items) {
    if (loc.pathname === it.to || loc.pathname.startsWith(it.to + '/')) {
      if (it.to.length > activeLen) {
        activeId = it.id;
        activeLen = it.to.length;
      }
    }
  }

  return (
    <nav className="ea-section-tabs" aria-label={`${grp.label} sub-navigation`}>
      {items.map((it) => {
        const isActive = it.id === activeId;
        return (
          <Link
            key={it.id}
            to={it.to}
            className={'ea-section-tab' + (isActive ? ' ea-section-tab--active' : '')}
            aria-current={isActive ? 'page' : undefined}
            data-test={`tab-${it.id}`}
          >
            {it.tabIcon && <UiIcon icon={it.tabIcon} size={14} />}
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
