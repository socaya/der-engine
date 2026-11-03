import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UiIcon, type UiIconId } from './UiIcon';

/* UiIcon is a pure switch returning per-icon SVG. The vocabulary is
 * large (60+ ids); we drive a full sweep so every switch arm is
 * exercised. Unknown ids fall through — the function returns
 * undefined / nothing. */

const ICONS: UiIconId[] = [
  'overview', 'metadata', 'data-queue', 'attention', 'worker',
  'schedule', 'history', 'settings', 'drift', 'health', 'storage',
  'diagnostics', 'analytics', 'evaluation', 'audit', 'backup',
  'restore', 'recovery', 'route', 'event', 'tracker-event',
  'enrollment', 'aggregate', 'program-stage-section',
  'program-section', 'tei', 'org-unit', 'program', 'data-element',
  'referral', 'compat', 'cog', 'laptop', 'tablet', 'mobile',
  'facility-server', 'unknown-device',
  'activity', 'refresh', 'plus', 'edit', 'trash', 'copy',
  'external', 'download', 'search', 'filter', 'pull', 'push',
  'play', 'pause', 'power',
  'wifi', 'ethernet', 'access-point', 'router', 'firewall',
  'peer', 'workstation', 'qr',
] as unknown as UiIconId[];

describe('UiIcon', () => {
  it.each(ICONS)('renders an SVG for icon=%s', (icon) => {
    const { container } = render(<UiIcon icon={icon} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('unknown icon id falls through to null (no SVG)', () => {
    const { container } = render(
      <UiIcon icon={'not-a-real-icon' as unknown as UiIconId} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('custom size propagates to the SVG width + height', () => {
    const { container } = render(<UiIcon icon="refresh" size={32} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });

  it('default size is 16', () => {
    const { container } = render(<UiIcon icon="refresh" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('16');
  });
});
