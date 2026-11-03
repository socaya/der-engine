import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowQueue } from './WorkflowQueue';
import * as edgeApi from '../../api/edgeApi';

/**
 * EventSource is not implemented in jsdom. Stub a minimal
 * constructor so screens that call `new EventSource(...)` on mount
 * don't blow up the render. The handlers never fire in tests.
 */
class StubEventSource {
  public onopen: ((this: EventSource, ev: Event) => void) | null = null;
  public onmessage: ((this: EventSource, ev: MessageEvent) => void) | null = null;
  public onerror: ((this: EventSource, ev: Event) => void) | null = null;
  public readyState = 1;
  public url: string;
  public withCredentials = false;
  public CONNECTING = 0 as const;
  public OPEN = 1 as const;
  public CLOSED = 2 as const;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener(): void {
    // no-op
  }
  removeEventListener(): void {
    // no-op
  }
  dispatchEvent(): boolean {
    return true;
  }
  close(): void {
    // no-op
  }
}

beforeEach(() => {
  (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
    StubEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeRow = (over: Partial<edgeApi.WorkflowQueueRow> = {}):
    edgeApi.WorkflowQueueRow => ({
  runId: 'run-1', workflowId: 'wf-1', workflowName: 'ANC v1',
  businessKey: 'tei-123', stepId: 'step-1', stepOrdinal: 1, stepName: 'Register',
  ownerRole: 'OPERATOR', ownerDeviceId: null, readiness: 'READY',
  runCreatedAt: '2026-11-01T10:00:00Z',
  runUpdatedAt: '2026-11-01T12:00:00Z',
  validationErrorCount: 0, ...over,
});

describe('WorkflowQueue', () => {
  it('loading → populated with ALL filter', async () => {
    const api = {
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [makeRow(), makeRow({
          runId: 'run-2', stepId: 's2', readiness: 'BLOCKED',
        })], appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({ prefs: {} });
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('queue-table')).toBeInTheDocument());
    expect(screen.getByTestId('queue-row-run-1-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('queue-row-run-2-s2')).toBeInTheDocument();
  });

  it('filter by READY narrows table', async () => {
    const api = {
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [makeRow(), makeRow({
          runId: 'run-2', stepId: 's2', readiness: 'BLOCKED',
        })], appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({ prefs: {} });
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('queue-table')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('queue-tab-ready'));
    expect(screen.queryByTestId('queue-row-run-2-s2')).toBeNull();
    expect(screen.getByTestId('queue-row-run-1-step-1')).toBeInTheDocument();
  });

  it('filter by BLOCKED narrows table + empty for READY-only data', async () => {
    const api = {
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [makeRow()],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({ prefs: {} });
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('queue-table')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('queue-tab-blocked'));
    expect(screen.getByTestId('queue-empty')).toBeInTheDocument();
  });

  it('validation issues chip renders when count > 0', async () => {
    const api = {
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [makeRow({ validationErrorCount: 3 })],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({ prefs: {} });
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => expect(
      screen.getByTestId('queue-row-run-1-step-1-issues')).toBeInTheDocument());
    expect(screen.getByTestId('queue-row-run-1-step-1-issues'))
      .toHaveTextContent('3 issues');
  });

  it('device filter writes pref and reloads', async () => {
    const api = {
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [], appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [{ deviceId: 'd-1', displayName: 'Clinic tablet' } as never],
    });
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({ prefs: {} });
    const write = vi.spyOn(edgeApi, 'writeUserPref').mockResolvedValue({});
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('queue-device-filter'))
      .toBeInTheDocument());
    await userEvent.selectOptions(
      screen.getByTestId('queue-device-filter'), 'd-1');
    await waitFor(() => expect(write).toHaveBeenCalledWith(
      edgeApi.PREF_PREFERRED_DEVICE, 'd-1'));
  });

  it('device filter → "" deletes pref', async () => {
    const api = {
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [], appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [{ deviceId: 'd-1', displayName: 'Clinic tablet' } as never],
    });
    // Pref initially set → "" change should delete.
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({
      prefs: { [edgeApi.PREF_PREFERRED_DEVICE]: 'd-1' },
    });
    const del = vi.spyOn(edgeApi, 'deleteUserPref').mockResolvedValue({});
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => {
      const sel = screen.getByTestId('queue-device-filter') as HTMLSelectElement;
      expect(sel.value).toBe('d-1');
    });
    await userEvent.selectOptions(
      screen.getByTestId('queue-device-filter'), '');
    await waitFor(() => expect(del).toHaveBeenCalledWith(
      edgeApi.PREF_PREFERRED_DEVICE));
  });

  it('surfaces API error', async () => {
    const api = {
      workflowQueue: vi.fn().mockRejectedValue(new Error('boom')),
    };
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    vi.spyOn(edgeApi, 'readAllUserPrefs').mockResolvedValue({ prefs: {} });
    renderWithProviders(<WorkflowQueue api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('queue-error')).toBeInTheDocument());
  });
});
