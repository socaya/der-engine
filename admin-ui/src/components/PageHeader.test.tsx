import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title only — no subtitle, no stale, no actions, no refresh', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' }))
      .toBeInTheDocument();
    expect(screen.queryByTestId('page-header-stale')).toBeNull();
  });

  it('renders subtitle when supplied', () => {
    render(<PageHeader title="Devices" subtitle="4 enrolled" />);
    expect(screen.getByText('4 enrolled')).toBeInTheDocument();
  });

  it('renders stale label in each fmtAgo band', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const { rerender } = render(
        <PageHeader title="x"
          lastFetched={new Date(now.getTime() - 30_000)} />);
      expect(screen.getByText(/30s ago/)).toBeInTheDocument();
      rerender(<PageHeader title="x"
        lastFetched={new Date(now.getTime() - 15 * 60_000)} />);
      expect(screen.getByText(/15m ago/)).toBeInTheDocument();
      rerender(<PageHeader title="x"
        lastFetched={new Date(now.getTime() - 5 * 3600_000)} />);
      expect(screen.getByText(/5h ago/)).toBeInTheDocument();
      rerender(<PageHeader title="x"
        lastFetched={new Date(now.getTime() - 3 * 86_400_000)} />);
      expect(screen.getByText(/3d ago/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls onRefresh when Refresh button clicked', async () => {
    const onRefresh = vi.fn();
    render(<PageHeader title="x" onRefresh={onRefresh} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders secondary actions slot', () => {
    render(<PageHeader title="x"
             actions={<button type="button" data-test="extra-btn">Extra</button>} />);
    expect(screen.getByTestId('extra-btn')).toBeInTheDocument();
  });

  it('custom testId overrides the default page-header id', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    render(<PageHeader title="x"
             testId="custom-head"
             lastFetched={new Date(now.getTime() - 5_000)} />);
    expect(screen.getByTestId('custom-head')).toBeInTheDocument();
    expect(screen.getByTestId('custom-head-stale')).toBeInTheDocument();
  });

  it('stale interval triggers re-render tick without crashing', () => {
    vi.useFakeTimers();
    try {
      const now = new Date();
      render(<PageHeader title="x" lastFetched={now} />);
      vi.advanceTimersByTime(15_000);
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
