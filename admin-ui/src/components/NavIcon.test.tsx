import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavIcon } from './NavIcon';
import type { IconId } from '../app/navigation';

/* NavIcon is a pure switch returning per-icon SVG. The test
 * renders every known IconId + asserts no crashes on an unknown
 * value (default arm returns undefined / nothing). */

const KNOWN: IconId[] = [
  'grid', 'plug', 'sync', 'database', 'users', 'device',
  'chart', 'workflow', 'cog', 'shield', 'wifi',
];

describe('NavIcon', () => {
  it.each(KNOWN)('renders an SVG for icon=%s', (icon) => {
    const { container } = render(<NavIcon icon={icon} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('unknown icon id falls through to the default arm', () => {
    const { container } = render(
      <NavIcon icon={'unknown-icon' as unknown as IconId} />);
    /* The switch has no default arm — the component returns nothing. */
    expect(container.querySelector('svg')).toBeNull();
  });

  it('every known icon id emits unique SVG paths', () => {
    const svgPaths = new Set<string>();
    for (const icon of KNOWN) {
      const { container, unmount } = render(<NavIcon icon={icon} />);
      const svg = container.querySelector('svg');
      svgPaths.add(svg?.innerHTML ?? '');
      unmount();
    }
    /* All 11 shapes should be distinct. */
    expect(svgPaths.size).toBe(KNOWN.length);
  });
});
