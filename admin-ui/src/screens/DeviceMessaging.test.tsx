import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { DeviceMessaging } from './DeviceMessaging';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function stubAll(): void {
  vi.spyOn(edgeApi, 'messagingStats').mockResolvedValue({
    messagesPublished: 0, messagesDelivered: 0,
    activeSubscriptions: 0, connectedStreams: 0,
    topChannels: [], devicePresence: [], windowStart: 'now',
  } as unknown as edgeApi.MessagingStats);
  vi.spyOn(edgeApi, 'messagingStreamStats').mockResolvedValue({
    openStreams: 0, totalEventsEmitted: 0,
    rejectedConnections: 0, lastEmittedAt: null,
  } as unknown as edgeApi.MessagingStreamStats);
  vi.spyOn(edgeApi, 'messagingLog').mockResolvedValue({ messages: [] });
  vi.spyOn(edgeApi, 'messagingSubscriptions').mockResolvedValue({ subscriptions: [] });
  vi.spyOn(edgeApi, 'messagingKeys').mockResolvedValue({ keys: [] });
  vi.spyOn(edgeApi, 'messagingDocuments').mockResolvedValue({ documents: [] });
  vi.spyOn(edgeApi, 'messagingForwards').mockResolvedValue({ forwards: [] });
}

/* jsdom doesn't ship EventSource — the DeviceMessaging screen
 * opens an SSE stream in a useEffect. Mock a minimal class so the
 * component can construct one without crashing. */
class FakeEventSource {
  readonly url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(url: string) { this.url = url; }
  addEventListener(): void { /* no-op */ }
  removeEventListener(): void { /* no-op */ }
  close(): void { /* no-op */ }
  dispatchEvent(): boolean { return true; }
}

describe('DeviceMessaging', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { EventSource: typeof FakeEventSource })
      .EventSource = FakeEventSource;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders the screen scaffold after the sequential probes complete', async () => {
    stubAll();
    const { container } = renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() => expect(container.querySelector('.ea-screen'))
      .not.toBeNull());
    expect(document.body.textContent ?? '').toMatch(/device messaging|publish|subscribe|channel|stream/i);
  });

  it('does not crash when every probe rejects — each try/catch swallows the error', async () => {
    vi.spyOn(edgeApi, 'messagingStats').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'messagingStreamStats').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'messagingLog').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'messagingSubscriptions').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'messagingKeys').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'messagingDocuments').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'messagingForwards').mockRejectedValue(new Error('x'));
    const { container } = renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() => expect(container.querySelector('.ea-screen'))
      .not.toBeNull());
  });
});
