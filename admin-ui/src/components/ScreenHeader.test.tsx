import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScreenHeader } from './ScreenHeader';

describe('ScreenHeader', () => {
  it('renders title only — no subtitle, no stale, no actions, no refresh', () => {
    render(<ScreenHeader title="Dashboard" />);
    expect(screen.getByTestId('screen-header')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' }))
      .toBeInTheDocument();
    /* No lastFetched → no stale pill. */
    expect(screen.queryByTestId('screen-header-stale')).toBeNull();
  });

  it('renders subtitle when supplied', () => {
    render(<ScreenHeader title="Devices" subtitle="4 enrolled" />);
    expect(screen.getByText('4 enrolled')).toBeInTheDocument();
  });

  it('renders stale label in each fmtAgo band', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      /* Seconds band — <60s ago. */
      const { rerender } = render(
        <ScreenHeader title="x"
          lastFetched={new Date(now.getTime() - 30_000)} />);
      expect(screen.getByText(/30s ago/)).toBeInTheDocument();
      /* Minutes band — <60m ago. */
      rerender(<ScreenHeader title="x"
        lastFetched={new Date(now.getTime() - 15 * 60_000)} />);
      expect(screen.getByText(/15m ago/)).toBeInTheDocument();
      /* Hours band — <24h ago. */
      rerender(<ScreenHeader title="x"
        lastFetched={new Date(now.getTime() - 5 * 3600_000)} />);
      expect(screen.getByText(/5h ago/)).toBeInTheDocument();
      /* Days band — ≥24h ago. */
      rerender(<ScreenHeader title="x"
        lastFetched={new Date(now.getTime() - 3 * 86_400_000)} />);
      expect(screen.getByText(/3d ago/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls onRefresh when Refresh button clicked', async () => {
    const onRefresh = vi.fn();
    render(<ScreenHeader title="x" onRefresh={onRefresh} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders secondary actions slot', () => {
    render(<ScreenHeader title="x"
             actions={<button type="button" data-test="extra-btn">Extra</button>} />);
    expect(screen.getByTestId('extra-btn')).toBeInTheDocument();
  });

  it('custom testId overrides the default screen-header id', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    render(<ScreenHeader title="x"
             testId="custom-head"
             lastFetched={new Date(now.getTime() - 5_000)} />);
    expect(screen.getByTestId('custom-head')).toBeInTheDocument();
    expect(screen.getByTestId('custom-head-stale')).toBeInTheDocument();
  });

  it('stale interval triggers re-render tick without crashing', () => {
    vi.useFakeTimers();
    try {
      const now = new Date();
      render(<ScreenHeader title="x" lastFetched={now} />);
      /* Advance one tick (15s) — the useEffect timer fires setTick,
       * exercising the interval branch. */
      vi.advanceTimersByTime(15_000);
      /* Still mounted — the tick path doesn't throw. */
      expect(screen.getByTestId('screen-header')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
