import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RecentActivity } from './RecentActivity';
import type { AuditEventRow } from '../api/edgeApi';

/* RecentActivity renders a 10-row audit-events list with per-row
 * dot + outcome chip. Four states: loading, error, empty, populated.
 * fmtAgo has four bands (<60s, <60m, <24h, ≥24h). Outcome ternary
 * has three arms (SUCCESS, DENIED, else). */

function row(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    eventType: 'LOGIN', outcome: 'SUCCESS',
    actorUserId: 'u1', observedAt: '2026-11-03T11:00:00Z',
    detail: '{}',
    ...overrides,
  } as unknown as AuditEventRow;
}

function wrap(ui: JSX.Element): JSX.Element {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

describe('RecentActivity', () => {
  it('loading state surfaces while the probe is in flight', () => {
    const api = { listAuditEvents: vi.fn(() => new Promise(() => undefined)) };
    render(wrap(<RecentActivity api={api as never} />));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('error state surfaces when listAuditEvents rejects', async () => {
    const api = { listAuditEvents: vi.fn().mockRejectedValue(new Error('boom')) };
    render(wrap(<RecentActivity api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('activity-error')).toBeInTheDocument());
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('empty state surfaces when events array is empty', async () => {
    const api = { listAuditEvents: vi.fn().mockResolvedValue({ events: [] }) };
    render(wrap(<RecentActivity api={api as never} />));
    await waitFor(() =>
      expect(screen.getByText('No events yet.')).toBeInTheDocument());
  });

  it('populated rows render per-outcome dot + chip tones', async () => {
    const now = Date.now();
    const api = { listAuditEvents: vi.fn().mockResolvedValue({ events: [
      row({ eventType: 'LOGIN', outcome: 'SUCCESS',
            observedAt: new Date(now - 30_000).toISOString() }),
      row({ eventType: 'ACCESS_DENIED', outcome: 'DENIED',
            observedAt: new Date(now - 30 * 60_000).toISOString() }),
      row({ eventType: 'SYNC_SKIPPED', outcome: 'INFO',
            observedAt: new Date(now - 6 * 3600_000).toISOString() }),
      row({ eventType: 'DRAIN_RUN', outcome: 'FAILURE',
            observedAt: new Date(now - 2 * 86_400_000).toISOString() }),
    ] }) };
    render(wrap(<RecentActivity api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('activity-row-0')).toBeInTheDocument());
    /* All four rows surface. */
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
    expect(screen.getByText('ACCESS_DENIED')).toBeInTheDocument();
    expect(screen.getByText('SYNC_SKIPPED')).toBeInTheDocument();
    expect(screen.getByText('DRAIN_RUN')).toBeInTheDocument();
    /* All four outcome labels surface as chips. */
    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('DENIED')).toBeInTheDocument();
    expect(screen.getByText('INFO')).toBeInTheDocument();
    expect(screen.getByText('FAILURE')).toBeInTheDocument();
    /* fmtAgo bands surface — ranges are loose to allow for test
     * execution time. */
    expect(document.body.textContent ?? '').toMatch(/s ago/);
    expect(document.body.textContent ?? '').toMatch(/30m ago/);
    expect(document.body.textContent ?? '').toMatch(/6h ago/);
    expect(document.body.textContent ?? '').toMatch(/2d ago/);
  });

  it('null actorUserId falls back to "system" label', async () => {
    const api = { listAuditEvents: vi.fn().mockResolvedValue({ events: [
      row({ actorUserId: null }),
    ] }) };
    render(wrap(<RecentActivity api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('activity-row-0')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/system/);
  });

  it('long actorUserId is sliced to 8 chars', async () => {
    const api = { listAuditEvents: vi.fn().mockResolvedValue({ events: [
      row({ actorUserId: 'abcdefghijklmno' }),
    ] }) };
    render(wrap(<RecentActivity api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('activity-row-0')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/by abcdefgh/);
    expect(document.body.textContent ?? '').not.toMatch(/abcdefghi/);
  });

  it('default api injection — module import works', () => {
    /* Rendering without the api prop uses the default edgeApi.
     * The listAuditEvents call will fail in jsdom (no server) and
     * fall into the error branch — just prove the module import
     * path (default argument) doesn't crash. */
    render(wrap(<RecentActivity />));
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
  });
});
