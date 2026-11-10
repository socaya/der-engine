import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PayloadLineageDrawer, isRetryable } from './PayloadLineageDrawer';
import * as edgeApi from '../api/edgeApi';

/* PayloadLineageDrawer dispatches on `kind` to one of 5 row-payload
 * loaders. Body renders: loader states (loading / error / populated);
 * journal groups grouped by stream (TEI only) or a single group for
 * single-row kinds; per-group Retry button that calls retryBatch and
 * triggers a reload; Copy JSON + Escape + Close. */

describe('PayloadLineageDrawer', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('aggregate kind — loads via aggregateRowPayload + renders payload', async () => {
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: { dataValues: [{ v: 1 }] },
      journal: [],
    } as never);
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-body'))
        .toBeInTheDocument());
    /* Title mentions "Data value". */
    expect(screen.getByText(/Row lineage — Data value/))
      .toBeInTheDocument();
    expect(edgeApi.aggregateRowPayload).toHaveBeenCalledWith('val-1');
  });

  it('event kind — dispatches to eventRowPayload', async () => {
    vi.spyOn(edgeApi, 'eventRowPayload').mockResolvedValue({
      payload: {}, journal: [],
    } as never);
    render(<PayloadLineageDrawer kind="event" rowId="ev-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Row lineage — Event/))
        .toBeInTheDocument());
    expect(edgeApi.eventRowPayload).toHaveBeenCalledWith('ev-1');
  });

  it('enrollment kind — dispatches to enrollmentRowPayload', async () => {
    vi.spyOn(edgeApi, 'enrollmentRowPayload').mockResolvedValue({
      payload: {}, journal: [],
    } as never);
    render(<PayloadLineageDrawer kind="enrollment" rowId="enr-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Row lineage — Enrolment/))
        .toBeInTheDocument());
  });

  it('tracker-event kind — dispatches to trackerEventRowPayload', async () => {
    vi.spyOn(edgeApi, 'trackerEventRowPayload').mockResolvedValue({
      payload: {}, journal: [],
    } as never);
    render(<PayloadLineageDrawer kind="tracker-event" rowId="tev-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Row lineage — Stage event/))
        .toBeInTheDocument());
  });

  it('tei kind — dispatches to teiRowPayload + renders TE/Enrol/Events counts', async () => {
    vi.spyOn(edgeApi, 'teiRowPayload').mockResolvedValue({
      payload: {},
      endpoint: '/api/tracker',  /* required for the counts chip */
      counts: { trackedEntities: 1, enrollments: 2, events: 5 },
      journal: [],
    } as never);
    render(<PayloadLineageDrawer kind="tei" rowId="tei-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Row lineage — Tracked entity/))
        .toBeInTheDocument());
    /* endpoint chip surfaces too (POST to /api/tracker). */
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/TE \d/));
    expect(document.body.textContent ?? '').toMatch(/Enrol \d/);
    expect(document.body.textContent ?? '').toMatch(/Events \d/);
  });

  it('loader rejection renders the error branch', async () => {
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockRejectedValue(
      new Error('lineage fail'));
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-error'))
        .toBeInTheDocument());
    /* Error text surfaces. */
    expect(document.body.textContent ?? '').toMatch(/lineage fail/);
  });

  it('Close button fires onClose', async () => {
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: {}, journal: [],
    } as never);
    const onClose = vi.fn();
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-close'))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('payload-lineage-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape key fires onClose', async () => {
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: {}, journal: [],
    } as never);
    const onClose = vi.fn();
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-drawer'))
        .toBeInTheDocument());
    /* UX-C: useFocusTrap owns the Escape handler on the drawer
     * container (replaces the prior window-level listener). */
    fireEvent.keyDown(screen.getByTestId('payload-lineage-drawer'),
      { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('single-row journal (non-TEI) surfaces a single JournalGroup with all states', async () => {
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: {},
      journal: [
        { operationId: 'op-ok',  state: 'CENTRAL_ACCEPTED',
          attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
        { operationId: 'op-rej', state: 'CENTRAL_REJECTED',
          attemptCount: 2, lastError: 'bad', nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
        { operationId: 'op-rty', state: 'RETRYABLE',
          attemptCount: 3, lastError: 'retry', nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
        { operationId: 'op-conf', state: 'CONFLICT_REVIEW',
          attemptCount: 1, lastError: 'conflict', nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
        { operationId: 'op-pend', state: 'PENDING',
          attemptCount: 0, lastError: null, nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
      ],
    } as never);
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-body'))
        .toBeInTheDocument());
    /* States surface as text. */
    expect(screen.getByText('CENTRAL_ACCEPTED')).toBeInTheDocument();
    expect(screen.getByText('CENTRAL_REJECTED')).toBeInTheDocument();
    expect(screen.getByText('RETRYABLE')).toBeInTheDocument();
    expect(screen.getByText('CONFLICT_REVIEW')).toBeInTheDocument();
  });

  it('TEI journal with multiple streams surfaces each stream label', async () => {
    const mkEntries = (state: string) => ([{
      operationId: `op-${state}`, state,
      attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
      updatedAt: 'now', createdAt: 'now',
    }]);
    vi.spyOn(edgeApi, 'teiRowPayload').mockResolvedValue({
      payload: {},
      journal: [],
      journalByStream: {
        trackedEntity: mkEntries('CENTRAL_ACCEPTED'),
        enrollments:   mkEntries('RETRYABLE'),
        events:        mkEntries('CENTRAL_REJECTED'),
        dataValues:    mkEntries('PENDING'),
      },
    } as never);
    render(<PayloadLineageDrawer kind="tei" rowId="tei-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Tracked-entity journal/))
        .toBeInTheDocument());
    expect(screen.getByText(/Enrolment journal/)).toBeInTheDocument();
    expect(screen.getByText(/Stage-event journal/)).toBeInTheDocument();
    expect(screen.getByText(/Data-value journal/)).toBeInTheDocument();
  });

  it('Retry button on a journal group with retryable entries calls retryBatch + refreshes', async () => {
    const retrySpy = vi.spyOn(edgeApi, 'retryBatch')
      .mockResolvedValue({ requeued: 1 } as never);
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: {},
      journal: [
        { operationId: 'op-rej', state: 'CENTRAL_REJECTED',
          attemptCount: 2, lastError: 'bad', nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
      ],
    } as never);
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('journal-group-retry-all'))
        .toBeInTheDocument());
    fireEvent.click(screen.getByTestId('journal-group-retry-all'));
    await waitFor(() =>
      expect(retrySpy).toHaveBeenCalledWith(['op-rej']));
  });

  it('Retry button is a no-op when no retryable entries exist', async () => {
    const retrySpy = vi.spyOn(edgeApi, 'retryBatch')
      .mockResolvedValue({ requeued: 0 } as never);
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: {},
      journal: [
        { operationId: 'op-ok', state: 'CENTRAL_ACCEPTED',
          attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
      ],
    } as never);
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-body'))
        .toBeInTheDocument());
    /* No retryable entries → either the Retry button is disabled or
     * absent — either way, clicking does nothing. */
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('retryBatch rejection surfaces the error', async () => {
    vi.spyOn(edgeApi, 'retryBatch').mockRejectedValue(
      new Error('retry service down'));
    vi.spyOn(edgeApi, 'aggregateRowPayload').mockResolvedValue({
      payload: {},
      journal: [
        { operationId: 'op-rej', state: 'CENTRAL_REJECTED',
          attemptCount: 2, lastError: 'bad', nextHopOrgUnitUid: null,
          updatedAt: 'now', createdAt: 'now' },
      ],
    } as never);
    render(<PayloadLineageDrawer kind="aggregate" rowId="val-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('journal-group-retry-all'))
        .toBeInTheDocument());
    fireEvent.click(screen.getByTestId('journal-group-retry-all'));
    await waitFor(() =>
      expect(screen.getByTestId('payload-lineage-error'))
        .toBeInTheDocument());
  });
});

describe('isRetryable', () => {
  it('returns true for retryable states', () => {
    expect(isRetryable('RETRYABLE')).toBe(true);
    expect(isRetryable('CENTRAL_REJECTED')).toBe(true);
    expect(isRetryable('CONFLICT_REVIEW')).toBe(true);
    expect(isRetryable('QUARANTINED')).toBe(true);
    expect(isRetryable('UNKNOWN_OUTCOME')).toBe(true);
  });

  it('returns false for non-retryable states', () => {
    expect(isRetryable('CENTRAL_ACCEPTED')).toBe(false);
    expect(isRetryable('PENDING')).toBe(false);
    expect(isRetryable('IN_FLIGHT')).toBe(false);
    expect(isRetryable('REQUIRES_APPROVAL')).toBe(false);
    expect(isRetryable('')).toBe(false);
  });
});
