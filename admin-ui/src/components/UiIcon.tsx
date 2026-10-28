/**
 * UiIcon — a small line-SVG vocabulary used in Section Tabs, page
 * action buttons, and empty states. One file keeps the icon vocabulary
 * stable so every surface draws the same glyph for the same concept.
 *
 * Icons are 16×16 by default (14×14 inside Section Tabs), tone colour
 * = currentColor so a parent `color:` cascades in. No fills, no
 * gradients, no fancy effects — Atlassian / Linear line-art register.
 */

export type UiIconId =
  // Nav / sub-nav
  | 'overview'
  | 'metadata'
  | 'data-queue'
  | 'attention'
  | 'worker'
  | 'schedule'
  | 'history'
  | 'settings'
  | 'drift'
  | 'health'
  | 'storage'
  | 'diagnostics'
  | 'analytics'
  | 'evaluation'
  | 'audit'
  | 'backup'
  | 'restore'
  | 'recovery'
  // Action
  | 'pull'
  | 'push'
  | 'refresh'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'external'
  | 'play'
  | 'pause'
  | 'search'
  | 'filter'
  // Entity / activity glyphs
  | 'aggregate'       // data value / grid of cells
  | 'event'           // calendar tick (single event)
  | 'tracker-event'   // calendar document (program-stage event)
  | 'enrollment'      // clipboard check
  | 'tei'             // person
  | 'org-unit'        // building
  | 'program'         // folder-stack
  | 'data-element'    // calculator / abacus
  | 'referral'        // inbox-in
  | 'compat'          // plug (version probe)
  | 'cog'             // generic process
  | 'activity';       // waveform (recent activity)

export function UiIcon(
  { icon, size = 16 }: { icon: UiIconId; size?: number }
): JSX.Element {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true, focusable: false,
  };
  switch (icon) {
    case 'overview':
      return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.2" /><rect x="14" y="3" width="7" height="5" rx="1.2" /><rect x="14" y="12" width="7" height="9" rx="1.2" /><rect x="3" y="16" width="7" height="5" rx="1.2" /></svg>;
    case 'metadata':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="20" cy="18" r="1.5" /></svg>;
    case 'data-queue':
      return <svg {...common}><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>;
    case 'attention':
      return <svg {...common}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5" /><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none" /></svg>;
    case 'worker':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" /></svg>;
    case 'schedule':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'history':
      return <svg {...common}><path d="M3 12a9 9 0 109-9" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>;
    case 'settings':
      return <svg {...common}><path d="M4 6h10M4 12h16M4 18h10" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
    case 'drift':
      return <svg {...common}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7.5a2 2 0 002 2h8" /></svg>;
    case 'health':
      return <svg {...common}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>;
    case 'storage':
      return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>;
    case 'diagnostics':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>;
    case 'analytics':
      return <svg {...common}><path d="M4 20h16" /><path d="M7 16v-4" /><path d="M12 16V8" /><path d="M17 16v-7" /></svg>;
    case 'evaluation':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
    case 'audit':
      return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 10-4.8-1.7-8-5.5-8-10V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'backup':
      return <svg {...common}><path d="M4 7a8 4 0 0116 0v10a8 4 0 01-16 0V7z" /><path d="M4 12a8 4 0 0016 0" /></svg>;
    case 'restore':
      return <svg {...common}><path d="M12 4v10" /><path d="M8 10l4 4 4-4" /><path d="M4 18h16" /></svg>;
    case 'recovery':
      return <svg {...common}><path d="M3 12a9 9 0 019-9c3.5 0 6.5 2 8 5" /><path d="M20 3v5h-5" /><path d="M12 8v5l3 2" /></svg>;
    case 'pull':
      return <svg {...common}><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>;
    case 'push':
      return <svg {...common}><path d="M12 20V8" /><path d="M7 13l5-5 5 5" /><path d="M4 4h16" /></svg>;
    case 'refresh':
      return <svg {...common}><path d="M4 12a8 8 0 0113-6.3L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 01-13 6.3L4 16" /><path d="M4 20v-4h4" /></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'edit':
      return <svg {...common}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17v3z" /><path d="M14 7l3 3" /></svg>;
    case 'trash':
      return <svg {...common}><path d="M4 7h16" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /><path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" /></svg>;
    case 'external':
      return <svg {...common}><path d="M14 4h6v6" /><path d="M20 4L10 14" /><path d="M20 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h4" /></svg>;
    case 'play':
      return <svg {...common}><path d="M7 4l12 8-12 8V4z" /></svg>;
    case 'pause':
      return <svg {...common}><rect x="7" y="4" width="4" height="16" rx="1" /><rect x="13" y="4" width="4" height="16" rx="1" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
    case 'filter':
      return <svg {...common}><path d="M4 5h16" /><path d="M7 11h10" /><path d="M10 17h4" /></svg>;
    case 'aggregate':
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 10h16M4 14h16M10 4v16M14 4v16" /></svg>;
    case 'event':
      return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16" /><path d="M8 3v4M16 3v4" /><path d="M9 15l2 2 4-4" /></svg>;
    case 'tracker-event':
      return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16" /><path d="M8 3v4M16 3v4" /><path d="M8 14h8M8 17h5" /></svg>;
    case 'enrollment':
      return <svg {...common}><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6" /><path d="M9 11l1.5 1.5L14 9" /><path d="M9 16h6" /></svg>;
    case 'tei':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
    case 'org-unit':
      return <svg {...common}><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /><path d="M9 11h.01M15 11h.01" /></svg>;
    case 'program':
      return <svg {...common}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path d="M3 11h18" /></svg>;
    case 'data-element':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>;
    case 'referral':
      return <svg {...common}><path d="M4 13l8 7 8-7" /><path d="M4 13V5a2 2 0 012-2h12a2 2 0 012 2v8" /><path d="M8 9h8" /></svg>;
    case 'compat':
      return <svg {...common}><path d="M9 2v4M15 2v4" /><path d="M7 6h10v4a5 5 0 01-10 0V6z" /><path d="M12 15v7" /></svg>;
    case 'cog':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>;
    case 'activity':
      return <svg {...common}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>;
  }
}
