import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import * as edgeApi from '../../api/edgeApi';
import { WorkflowPeerExchange } from './WorkflowPeerExchange';

// jsdom has no EventSource; the embedded WorkflowImportInbox opens
// one on mount.  Stub it with a no-op so the shell can render both tabs.
beforeAll(() => {
  if (typeof globalThis.EventSource === 'undefined') {
    class StubEventSource {
      addEventListener(): void { /* no-op */ }
      close(): void { /* no-op */ }
    }
    (globalThis as unknown as { EventSource: typeof StubEventSource })
      .EventSource = StubEventSource;
  }
});

/**
 * WorkflowPeerExchange is the tab shell binding outbound Peers +
 * inbound Import inbox under /network/workflow-sharing.  The inner
 * components run in embedded mode and already have their own
 * dedicated tests; here we only validate the shell wiring.
 */

afterEach(() => vi.restoreAllMocks());

describe('WorkflowPeerExchange shell', () => {
  it('renders the status bar + tab strip + outbound tab by default', async () => {
    // Stub the inner-component endpoints so the embedded screens don't
    // hit the network and crash the harness.
    vi.spyOn(edgeApi, 'listWorkflowPeers').mockResolvedValue({ peers: [] });
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });

    renderWithProviders(<WorkflowPeerExchange />);
    await waitFor(() =>
      expect(screen.getByTestId('peer-exchange-root')).toBeInTheDocument());

    // Status bar labels the active direction.
    expect(document.body.textContent ?? '').toMatch(/Outbound peers/);
    expect(screen.getByTestId('peer-exchange-tab-outbound'))
      .toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('peer-exchange-tab-inbound'))
      .toHaveAttribute('aria-selected', 'false');
  });

  it('switches to the inbound tab on click and flips the status label', async () => {
    vi.spyOn(edgeApi, 'listWorkflowPeers').mockResolvedValue({ peers: [] });
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
    vi.spyOn(edgeApi, 'listImportInbox').mockResolvedValue({ entries: [] });

    renderWithProviders(<WorkflowPeerExchange />);
    await waitFor(() =>
      expect(screen.getByTestId('peer-exchange-root')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByTestId('peer-exchange-tab-inbound'));
    expect(screen.getByTestId('peer-exchange-tab-inbound'))
      .toHaveAttribute('aria-selected', 'true');
    expect(document.body.textContent ?? '').toMatch(/Inbound inbox/);
  });

  it('cross-link buttons point at the right routes', async () => {
    vi.spyOn(edgeApi, 'listWorkflowPeers').mockResolvedValue({ peers: [] });
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
    renderWithProviders(<WorkflowPeerExchange />);
    await waitFor(() =>
      expect(screen.getByTestId('peer-exchange-open-catalogue'))
        .toBeInTheDocument());
    expect(screen.getByTestId('peer-exchange-open-catalogue'))
      .toHaveAttribute('href', '/workflows/manage');
    expect(screen.getByTestId('peer-exchange-open-wg-peers'))
      .toHaveAttribute('href', '/network/peers');
  });
});
