import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  NetworkStatusBadge, statusFill, statusLabel,
} from './NetworkStatusBadge';

describe('NetworkStatusBadge', () => {
  it('renders every status without label by default', () => {
    (['online', 'degraded', 'offline', 'unknown'] as const).forEach((s) => {
      const { unmount } = render(<NetworkStatusBadge status={s} />);
      expect(screen.getByLabelText(statusLabel(s))).toBeInTheDocument();
      unmount();
    });
  });
  it('shows the label text when showLabel is true', () => {
    render(<NetworkStatusBadge status="online" showLabel />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
  it('respects custom size', () => {
    const { container } = render(<NetworkStatusBadge status="online" size={24} />);
    const dot = container.querySelector('span > span') as HTMLElement;
    expect(dot.style.width).toBe('24px');
    expect(dot.style.height).toBe('24px');
  });
  it('statusFill returns the colour variable', () => {
    expect(statusFill('online')).toMatch(/success-ink/);
    expect(statusFill('degraded')).toMatch(/warning-ink/);
    expect(statusFill('offline')).toMatch(/danger-ink/);
    expect(statusFill('unknown')).toMatch(/ink-500/);
  });
  it('statusLabel returns the human string', () => {
    expect(statusLabel('online')).toBe('Online');
    expect(statusLabel('degraded')).toBe('Degraded');
    expect(statusLabel('offline')).toBe('Offline');
    expect(statusLabel('unknown')).toBe('Unknown');
  });
});
