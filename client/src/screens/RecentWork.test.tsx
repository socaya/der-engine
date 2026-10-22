import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecentWork } from './RecentWork';
import type { ActivityEntry } from '../api/edgeApi';

const entries: ActivityEntry[] = [
  { auditId: 1, eventType: 'SIGN_IN_SUCCESS', outcome: 'SUCCESS', observedAt: '2026-10-22T09:00:00Z' },
  { auditId: 2, eventType: 'USER_CREATED', outcome: 'SUCCESS', observedAt: '2026-10-22T09:05:00Z' },
];

describe('RecentWork', () => {
  it('renders the activity table once loaded', async () => {
    const api = { recentActivity: vi.fn().mockResolvedValue({ entries }) };
    render(<RecentWork api={api} />);
    await waitFor(() => expect(screen.getByTestId('recent-heading')).toBeInTheDocument());
    expect(screen.getByTestId('recent-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('recent-row-2')).toBeInTheDocument();
    expect(api.recentActivity).toHaveBeenCalledWith(20);
  });

  it('renders the empty state when there is no activity', async () => {
    const api = { recentActivity: vi.fn().mockResolvedValue({ entries: [] }) };
    render(<RecentWork api={api} />);
    await waitFor(() => expect(screen.getByText(/No activity recorded yet/i)).toBeInTheDocument());
  });

  it('renders an error on fetch failure', async () => {
    const api = { recentActivity: vi.fn().mockRejectedValue(new Error('kaboom')) };
    render(<RecentWork api={api} />);
    await waitFor(() => expect(screen.getByTestId('recent-error')).toBeInTheDocument());
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
  });

  it('renders an error for non-Error rejections too', async () => {
    const api = { recentActivity: vi.fn().mockRejectedValue('plain-string-reject' as unknown as Error) };
    render(<RecentWork api={api} />);
    await waitFor(() => expect(screen.getByTestId('recent-error')).toBeInTheDocument());
    expect(screen.getByText(/plain-string-reject/)).toBeInTheDocument();
  });
});
