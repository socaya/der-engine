import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CentralPayloadDrawer } from './CentralPayloadDrawer';
import * as edgeApi from '../api/edgeApi';

/* CentralPayloadDrawer dispatches on `kind` to one of three preview
 * API helpers. The body renders differently based on the load state
 * (loading / error / empty / populated), the counts object (tracker
 * only), and a Copy-JSON button that writes to navigator.clipboard. */

describe('CentralPayloadDrawer', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('aggregate kind — loads via previewAggregatePayload + renders payload JSON', async () => {
    vi.spyOn(edgeApi, 'previewAggregatePayload').mockResolvedValue({
      endpoint: '/api/dataValueSets', count: 3,
      payload: { dataValues: [{ v: 1 }, { v: 2 }, { v: 3 }] },
    } as never);
    render(<CentralPayloadDrawer kind="aggregate"
             workflowId={null} workflowRunId={null}
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('central-payload-body'))
        .toBeInTheDocument());
    /* Title + endpoint surface. */
    expect(screen.getByText(/Ready for Central — DataValueSet/))
      .toBeInTheDocument();
    expect(screen.getByText('/api/dataValueSets')).toBeInTheDocument();
    expect(screen.getByText('3 ready to push')).toBeInTheDocument();
  });

  it('events kind — dispatches to previewEventsPayload', async () => {
    vi.spyOn(edgeApi, 'previewEventsPayload').mockResolvedValue({
      endpoint: '/api/events', count: 7,
      payload: { events: [] },
    } as never);
    render(<CentralPayloadDrawer kind="events"
             workflowId="wf-1" workflowRunId={null}
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Ready for Central — Events/))
        .toBeInTheDocument());
    expect(edgeApi.previewEventsPayload)
      .toHaveBeenCalledWith(expect.objectContaining({ workflowId: 'wf-1' }));
  });

  it('tracker kind — dispatches to previewTrackerPayload + renders counts chip', async () => {
    vi.spyOn(edgeApi, 'previewTrackerPayload').mockResolvedValue({
      endpoint: '/api/tracker', count: 10,
      counts: { trackedEntities: 3, enrollments: 4, events: 3 },
      payload: { trackedEntities: [], enrollments: [], events: [] },
    } as never);
    render(<CentralPayloadDrawer kind="tracker"
             workflowId={null} workflowRunId="wfr-1"
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByText(/Ready for Central — Tracker/))
        .toBeInTheDocument());
    /* Counts chip surfaces TE/Enrol/Events strongs. */
    expect(document.body.textContent ?? '').toMatch(/TE/);
    expect(document.body.textContent ?? '').toMatch(/Enrol/);
    expect(document.body.textContent ?? '').toMatch(/Events/);
    expect(edgeApi.previewTrackerPayload)
      .toHaveBeenCalledWith(expect.objectContaining({ workflowRunId: 'wfr-1' }));
  });

  it('empty payload (count=0) renders the empty-state branch', async () => {
    vi.spyOn(edgeApi, 'previewAggregatePayload').mockResolvedValue({
      endpoint: '/api/dataValueSets', count: 0,
      payload: { dataValues: [] },
    } as never);
    render(<CentralPayloadDrawer kind="aggregate"
             workflowId={null} workflowRunId={null}
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('central-payload-empty'))
        .toBeInTheDocument());
    /* Copy button disabled when count is zero. */
    expect(screen.getByTestId('central-payload-copy')).toBeDisabled();
  });

  it('loader rejection renders the error branch', async () => {
    vi.spyOn(edgeApi, 'previewAggregatePayload').mockRejectedValue(
      new Error('load fail'));
    render(<CentralPayloadDrawer kind="aggregate"
             workflowId={null} workflowRunId={null}
             onClose={() => undefined} />);
    await waitFor(() =>
      expect(screen.getByTestId('central-payload-error'))
        .toBeInTheDocument());
    /* Multiple matches — error body + "load failed" header hint. */
    expect(screen.getAllByText(/load fail/).length).toBeGreaterThan(0);
    expect(screen.getByText('load failed')).toBeInTheDocument();
  });

  it('Close button fires onClose', async () => {
    vi.spyOn(edgeApi, 'previewAggregatePayload').mockResolvedValue({
      endpoint: '/x', count: 1, payload: {},
    } as never);
    const onClose = vi.fn();
    render(<CentralPayloadDrawer kind="aggregate"
             workflowId={null} workflowRunId={null}
             onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('central-payload-close'))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('central-payload-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onClose', async () => {
    vi.spyOn(edgeApi, 'previewAggregatePayload').mockResolvedValue({
      endpoint: '/x', count: 1, payload: {},
    } as never);
    const onClose = vi.fn();
    render(<CentralPayloadDrawer kind="aggregate"
             workflowId={null} workflowRunId={null}
             onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('central-payload-drawer'))
        .toBeInTheDocument());
    /* Window-level keydown. */
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Copy JSON button fires without crashing when clipboard works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const original = (navigator as unknown as { clipboard?: unknown })
      .clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true,
      value: { writeText },
    });
    try {
      vi.spyOn(edgeApi, 'previewAggregatePayload').mockResolvedValue({
        endpoint: '/x', count: 1, payload: { k: 'v' },
      } as never);
      render(<CentralPayloadDrawer kind="aggregate"
               workflowId={null} workflowRunId={null}
               onClose={() => undefined} />);
      await waitFor(() =>
        expect(screen.getByTestId('central-payload-body'))
          .toBeInTheDocument());
      /* fireEvent.click avoids any userEvent pointerdown-focus quirks. */
      fireEvent.click(screen.getByTestId('central-payload-copy'));
      /* Give the microtask queue a tick for the async handler. */
      await new Promise((r) => setTimeout(r, 10));
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify({ k: 'v' }, null, 2));
      /* Label flips to "Copied" within the 1800ms timeout. */
      await waitFor(() =>
        expect(screen.getByText('Copied')).toBeInTheDocument());
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true, writable: true, value: original,
      });
    }
  });

  it('Clipboard rejection is swallowed — Copy button stays functional', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const original = (navigator as unknown as { clipboard?: unknown })
      .clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true,
      value: { writeText },
    });
    try {
      vi.spyOn(edgeApi, 'previewAggregatePayload').mockResolvedValue({
        endpoint: '/x', count: 1, payload: {},
      } as never);
      render(<CentralPayloadDrawer kind="aggregate"
               workflowId={null} workflowRunId={null}
               onClose={() => undefined} />);
      await waitFor(() =>
        expect(screen.getByTestId('central-payload-copy'))
          .toBeInTheDocument());
      /* Should not throw. */
      fireEvent.click(screen.getByTestId('central-payload-copy'));
      await new Promise((r) => setTimeout(r, 10));
      expect(writeText).toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true, writable: true, value: original,
      });
    }
  });
});
