import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowImportInbox } from './WorkflowImportInbox';
import type * as edgeApi from '../../api/edgeApi';

class StubEventSource {
  public onopen = null; public onmessage = null; public onerror = null;
  public readyState = 1; public url: string; public withCredentials = false;
  public CONNECTING = 0 as const; public OPEN = 1 as const; public CLOSED = 2 as const;
  constructor(url: string) { this.url = url; }
  addEventListener(): void { /* no-op */ }
  removeEventListener(): void { /* no-op */ }
  dispatchEvent(): boolean { return true; }
  close(): void { /* no-op */ }
}

beforeEach(() => {
  (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
    StubEventSource as unknown as typeof EventSource;
});
afterEach(() => vi.restoreAllMocks());

const pending = (over: Partial<edgeApi.ImportInboxEntry> = {}):
    edgeApi.ImportInboxEntry => ({
  importId: 'imp-1', receivedAt: '2026-11-01T10:00:00Z',
  fromLabel: 'peer-a', displayName: 'ANC v2',
  boundKind: 'PROGRAM', boundId: 'p1', status: 'PENDING',
  decidedAt: null, decidedBy: null, decisionNote: null,
  acceptedWorkflowId: null, ...over,
});

describe('WorkflowImportInbox', () => {
  it('loading → empty', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-empty')).toBeInTheDocument());
  });

  it('populated → row visible', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [pending()] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1'))
      .toBeInTheDocument());
  });

  it('error path renders error block', async () => {
    const api = {
      listImportInbox: vi.fn().mockRejectedValue(new Error('server down')),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-error')).toBeInTheDocument());
  });

  it('tab change refetches with new status filter', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-tabs')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('inbox-tab-accepted'));
    await waitFor(() => expect(api.listImportInbox)
      .toHaveBeenCalledWith('ACCEPTED'));
    await userEvent.click(screen.getByTestId('inbox-tab-all'));
    await waitFor(() => expect(api.listImportInbox).toHaveBeenCalledWith(undefined));
  });

  it('accept flow calls api and surfaces result', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [pending()] }),
      acceptImport: vi.fn().mockResolvedValue({}),
      rejectImport: vi.fn(), importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1-accept'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('inbox-row-imp-1-accept'));
    await waitFor(() => expect(api.acceptImport).toHaveBeenCalledWith('imp-1'));
    expect(screen.getByTestId('inbox-last-result')).toHaveTextContent(/accepted/);
  });

  it('reject flow sends note', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [pending()] }),
      acceptImport: vi.fn(),
      rejectImport: vi.fn().mockResolvedValue({}),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1-reject'))
      .toBeInTheDocument());
    await userEvent.type(
      screen.getByTestId('inbox-row-imp-1-note'), 'spam');
    await userEvent.click(screen.getByTestId('inbox-row-imp-1-reject'));
    await waitFor(() => expect(api.rejectImport)
      .toHaveBeenCalledWith('imp-1', 'spam'));
  });

  it('review toggles diff block (NEW_WORKFLOW)', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [pending()] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn().mockResolvedValue({
        importId: 'imp-1',
        incoming: { displayName: 'ANC v2', boundKind: 'PROGRAM',
                     boundId: 'p1', stepCount: 3 },
        matchStrategy: 'NONE', local: null, summary: 'NEW_WORKFLOW',
      }),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1-review'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('inbox-row-imp-1-review'));
    await waitFor(() => expect(screen.getByTestId('inbox-diff-new'))
      .toBeInTheDocument());
    // Toggle off hides the diff row.
    await userEvent.click(screen.getByTestId('inbox-row-imp-1-review'));
    await waitFor(() => expect(screen.queryByTestId('inbox-diff-new')).toBeNull());
  });

  it('diff with replacement renders added/removed/changed', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [pending()] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn().mockResolvedValue({
        importId: 'imp-1',
        incoming: { displayName: 'ANC v2', boundKind: 'PROGRAM',
                     boundId: 'p1', stepCount: 2 },
        matchStrategy: 'BINDING',
        local: { workflowId: 'wf-local', displayName: 'ANC v1', stepCount: 2 },
        summary: 'REPLACEMENT',
        added: [{ ordinal: 2, displayName: 'New step',
                   stepKind: 'CAPTURE', fieldCount: 1 }],
        removed: [{ ordinal: 1, displayName: 'Old step', stepKind: 'CAPTURE' }],
        changed: [{ ordinal: 0,
                     local: { displayName: 'Reg', stepKind: 'CAPTURE', fieldCount: 2 },
                     incoming: { displayName: 'Reg v2', stepKind: 'CAPTURE', fieldCount: 3 } }],
      }),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1-review'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('inbox-row-imp-1-review'));
    await waitFor(() => expect(screen.getByTestId('inbox-diff-replacement'))
      .toBeInTheDocument());
    expect(screen.getByTestId('inbox-diff-added')).toHaveTextContent('New step');
    expect(screen.getByTestId('inbox-diff-removed')).toHaveTextContent('Old step');
    expect(screen.getByTestId('inbox-diff-changed')).toHaveTextContent('Reg v2');
  });

  it('diff NO_CHANGES renders nochange block', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [pending()] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn().mockResolvedValue({
        importId: 'imp-1',
        incoming: { displayName: 'ANC v2', boundKind: 'PROGRAM',
                     boundId: 'p1', stepCount: 1 },
        matchStrategy: 'DISPLAY_NAME',
        local: { workflowId: 'wf-local', displayName: 'ANC v2', stepCount: 1 },
        summary: 'NO_CHANGES',
      }),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1-review'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('inbox-row-imp-1-review'));
    await waitFor(() => expect(screen.getByTestId('inbox-diff-nochange'))
      .toBeInTheDocument());
  });

  it('ACCEPTED entry shows decision metadata, not action buttons', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [
        pending({ status: 'ACCEPTED',
                   decidedAt: '2026-11-01T11:00:00Z',
                   decisionNote: 'ok by me' }),
      ] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('inbox-row-imp-1'))
      .toBeInTheDocument());
    expect(screen.queryByTestId('inbox-row-imp-1-accept')).toBeNull();
    expect(screen.getByTestId('inbox-row-imp-1')).toHaveTextContent('ok by me');
  });

  it('embedded prop suppresses the HeroHeader', async () => {
    const api = {
      listImportInbox: vi.fn().mockResolvedValue({ entries: [] }),
      acceptImport: vi.fn(), rejectImport: vi.fn(),
      importInboxDiff: vi.fn(),
    };
    renderWithProviders(<WorkflowImportInbox api={api as never} embedded />);
    await waitFor(() => expect(screen.getByTestId('inbox-empty'))
      .toBeInTheDocument());
    // Hero header title "Import inbox" shouldn't appear as a heading
    // when embedded (it stays as the visually-hidden h1 only).
    expect(screen.getAllByText(/Import inbox/i)).toHaveLength(1);
  });
});
