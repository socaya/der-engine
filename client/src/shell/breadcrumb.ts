import { matchPath } from 'react-router-dom';

/**
 * Route → breadcrumb trail. First match wins; the raw `:param`
 * placeholders in the pattern land in the crumb unchanged so the
 * strip is stable even for dynamic routes. Screens that want a
 * trailing crumb derived from loaded data (e.g. a run business
 * key, a dataset display name) can override via useBreadcrumb()
 * — that hook lands in Phase C-UI-2 when we add state.
 */

export interface BreadcrumbTrail {
  readonly label: string;
  readonly to?: string;
}

interface Route {
  readonly pattern: string;
  readonly trail: readonly BreadcrumbTrail[];
}

const ROUTES: readonly Route[] = [
  { pattern: '/',               trail: [] },
  { pattern: '/launcher',       trail: [] },
  { pattern: '/sign-in',        trail: [{ label: 'Sign in' }] },
  { pattern: '/edge-error',     trail: [{ label: 'Edge error' }] },

  { pattern: '/dhis2/status',   trail: [{ label: 'DHIS2' }, { label: 'Status' }] },

  { pattern: '/sync/status',    trail: [{ label: 'Synchronisation' }, { label: 'Status' }] },

  { pattern: '/network/status', trail: [{ label: 'Network' }, { label: 'Status' }] },

  { pattern: '/capture/runs',   trail: [{ label: 'Workflows' }, { label: 'Capture runs' }] },
  { pattern: '/capture/runs/:id/form',
    trail: [{ label: 'Workflows' },
            { label: 'Capture runs', to: '/capture/runs' },
            { label: 'Run' }] },

  { pattern: '/aggregate/datasets',
    trail: [{ label: 'Data' }, { label: 'Aggregate' }] },
  { pattern: '/aggregate/entry',
    trail: [{ label: 'Data' },
            { label: 'Aggregate', to: '/aggregate/datasets' },
            { label: 'Entry' }] },
  { pattern: '/programs',
    trail: [{ label: 'Data' }, { label: 'Programs' }] },
  { pattern: '/programs/:program/events',
    trail: [{ label: 'Data' },
            { label: 'Programs', to: '/programs' },
            { label: 'Events' }] },
  { pattern: '/programs/:program/events/new',
    trail: [{ label: 'Data' },
            { label: 'Programs', to: '/programs' },
            { label: 'New event' }] },
  { pattern: '/tracker/:program/search',
    trail: [{ label: 'Data' }, { label: 'Tracker' }, { label: 'Search' }] },
  { pattern: '/tracker/:program/tei/:tei',
    trail: [{ label: 'Data' }, { label: 'Tracker' }, { label: 'TEI' }] },
  { pattern: '/tracker/:program/enroll',
    trail: [{ label: 'Data' }, { label: 'Tracker' }, { label: 'Enrol' }] },
  { pattern: '/tracker/:program/stage/:stage/new',
    trail: [{ label: 'Data' }, { label: 'Tracker' }, { label: 'New event' }] },
  { pattern: '/scheduled',
    trail: [{ label: 'Data' }, { label: 'Scheduled' }] },
  { pattern: '/review',
    trail: [{ label: 'Data' }, { label: 'Review' }] },
  { pattern: '/drafts',
    trail: [{ label: 'Data' }, { label: 'Drafts' }] },

  { pattern: '/session', trail: [{ label: 'Administration' }, { label: 'Session' }] },
  { pattern: '/recent',  trail: [{ label: 'Administration' }, { label: 'Recent work' }] },

  { pattern: '/metadata/*', trail: [{ label: 'DHIS2' }, { label: 'Metadata' }] },
];

export function trailFor(pathname: string): readonly BreadcrumbTrail[] {
  for (const r of ROUTES) {
    if (matchPath({ path: r.pattern, end: r.pattern.endsWith('*') ? false : true },
                    pathname)) {
      return r.trail;
    }
  }
  return [];
}
