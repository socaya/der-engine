import type { IconId } from '../app/navigation';

/**
 * Inline SVG icons used by the sidebar primary items. Kept small and
 * flat — no bitmap assets, no icon-font dependency.
 */
export function NavIcon({ icon }: { icon: IconId }): JSX.Element {
  const common = {
    width: 20, height: 20, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (icon) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'plug':
      return (
        <svg {...common}>
          <path d="M9 2v4M15 2v4" />
          <path d="M7 6h10v4a5 5 0 01-10 0V6z" />
          <path d="M12 15v7" />
        </svg>
      );
    case 'sync':
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 0113-6.3L20 8" />
          <path d="M20 4v4h-4" />
          <path d="M20 12a8 8 0 01-13 6.3L4 16" />
          <path d="M4 20v-4h4" />
        </svg>
      );
    case 'workflow':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="14" height="4" rx="1" />
          <rect x="3" y="10" width="14" height="4" rx="1" />
          <rect x="3" y="16" width="14" height="4" rx="1" />
          <circle cx="20" cy="6" r="1.5" />
          <circle cx="20" cy="12" r="1.5" />
          <circle cx="20" cy="18" r="1.5" />
        </svg>
      );
    case 'database':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
          <circle cx="17" cy="7" r="2.5" />
          <path d="M15 14c3 0 7 1.7 7 5" />
        </svg>
      );
    case 'device':
      return (
        <svg {...common}>
          <rect x="5" y="2" width="14" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V8" />
          <path d="M17 16v-3" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 10-4.8-1.7-8-5.5-8-10V6l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'cog':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      );
    case 'wifi':
      return (
        <svg {...common}>
          <path d="M4.5 10.5a12 12 0 0115 0" />
          <path d="M7 13.5a8 8 0 0110 0" />
          <path d="M9.5 16.5a4 4 0 015 0" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
