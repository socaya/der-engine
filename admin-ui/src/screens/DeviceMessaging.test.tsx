import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    messagesTotal: 0, messagesLastHour: 0,
    devicesSubscribed: 0, channelsActive: 0,
  } as unknown as edgeApi.MessagingStats);
  vi.spyOn(edgeApi, 'messagingStreamStats').mockResolvedValue({
    openStreams: 0, totalEventsEmitted: 0, liveStreams: 0,
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

  it('populated stats surface the SyncStatusBar meta fields', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'messagingStats').mockResolvedValue({
      messagesTotal: 1234, messagesLastHour: 42,
      devicesSubscribed: 8, channelsActive: 5,
      topChannels: [
        { channel: 'broadcast',       n: 20, lastAt: '2026-11-03T10:00:00Z' },
        { channel: 'role:ANC-NURSE',  n: 15, lastAt: '2026-11-03T09:00:00Z' },
      ],
      devicePresence: [], windowStart: 'now',
    } as unknown as edgeApi.MessagingStats);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/1234 messages/)).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/42/);
    expect(screen.getByText('broadcast')).toBeInTheDocument();
    expect(screen.getByText('role:ANC-NURSE')).toBeInTheDocument();
  });

  it('populated messages render the per-row table + encrypted chip', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'messagingLog').mockResolvedValue({ messages: [
      { messageId: 'm-plain', channel: 'broadcast',
        fromDeviceId: 'DEV-1', messageType: 'STOCK_ALERT',
        payload: '{"items":12}',
        encrypted: false,
        expiresAt: '2026-12-01T00:00:00Z',
        createdAt: '2026-11-03T10:00:00Z' },
      { messageId: 'm-enc', channel: 'direct:DEV-2',
        fromDeviceId: 'DEV-1', messageType: 'DIRECT',
        payload: '(opaque)',
        encrypted: true,
        expiresAt: null,
        createdAt: '2026-11-03T11:00:00Z' },
    ] as unknown as edgeApi.DeviceMessage[] });
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('STOCK_ALERT')).toBeInTheDocument());
    expect(screen.getByText('DIRECT')).toBeInTheDocument();
    /* E2E badge surfaces for encrypted message. */
    expect(screen.getByText('E2E')).toBeInTheDocument();
    /* Opaque body text replaces the encrypted payload. */
    expect(screen.getByText(/encrypted — server opaque/i)).toBeInTheDocument();
  });

  it('populated subscriptions render fresh vs stale polls', async () => {
    stubAll();
    const freshIso = new Date().toISOString();  /* <60s → success tone */
    const staleIso = new Date(Date.now() - 2 * 3600_000).toISOString();
    vi.spyOn(edgeApi, 'messagingSubscriptions').mockResolvedValue({
      subscriptions: [
        { deviceId: 'DEV-fresh', channel: 'broadcast',
          cursorAt: freshIso, lastPollAt: freshIso },
        { deviceId: 'DEV-stale', channel: 'direct:X',
          cursorAt: null,  /* exercises the em-dash fallback */
          lastPollAt: staleIso },
        { deviceId: 'DEV-never', channel: 'role:A',
          cursorAt: null, lastPollAt: null },
      ],
    } as never);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('DEV-fresh')).toBeInTheDocument());
    expect(screen.getByText('DEV-stale')).toBeInTheDocument();
    expect(screen.getByText('DEV-never')).toBeInTheDocument();
    expect(screen.getByText('never')).toBeInTheDocument();
  });

  it('populated crypto keys render with Ed25519 null-fallback branch', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'messagingKeys').mockResolvedValue({ keys: [
      { deviceId: 'DEV-full',
        x25519PublicKeyBase64: 'x25519-fullkey-base64-encoded-stuff',
        ed25519PublicKeyBase64: 'ed25519-fullkey-base64-encoded',
        updatedAt: '2026-11-03T10:00:00Z' },
      { deviceId: 'DEV-nos',
        x25519PublicKeyBase64: 'x25519-other-key-base64-encoded',
        ed25519PublicKeyBase64: null,  /* em-dash branch */
        updatedAt: '2026-11-03T09:00:00Z' },
    ] } as never);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('DEV-full')).toBeInTheDocument());
    expect(screen.getByText('DEV-nos')).toBeInTheDocument();
  });

  it('populated CRDT docs + forwards exercise their table branches', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'messagingDocuments').mockResolvedValue({
      documents: [
        { docId: 'crdt:stock', docType: 'STOCK_LEDGER',
          createdBy: 'DEV-1', opCount: 42,
          lastOpAt: '2026-11-03T10:00:00Z' },
        { docId: 'crdt:empty', docType: 'LWW_MAP',
          createdBy: 'DEV-2', opCount: 0,
          lastOpAt: null },  /* em-dash fallback */
      ],
    } as never);
    vi.spyOn(edgeApi, 'messagingForwards').mockResolvedValue({
      forwards: [
        { forwardId: 'fw-ok', targetEdgeId: 'EDGE-A',
          outcome: 'SUCCESS', httpStatus: 200,
          reason: null, attemptedAt: '2026-11-03T10:00:00Z' },
        { forwardId: 'fw-nopeer', targetEdgeId: 'EDGE-B',
          outcome: 'NO_PEER', httpStatus: null,
          reason: 'peer offline', attemptedAt: '2026-11-03T09:00:00Z' },
        { forwardId: 'fw-fail', targetEdgeId: 'EDGE-C',
          outcome: 'FAILED', httpStatus: 503,
          reason: 'retrying', attemptedAt: '2026-11-03T08:00:00Z' },
      ],
    } as never);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('crdt:stock')).toBeInTheDocument());
    expect(screen.getByText('STOCK_LEDGER')).toBeInTheDocument();
    /* Forward outcome arms: SUCCESS, NO_PEER, FAILED. */
    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('NO_PEER')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('Publish dialog opens on click + close button dismisses it', async () => {
    stubAll();
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Publish$/ }))
        .toBeInTheDocument());
    const user = userEvent.setup();
    const before = screen.getAllByText(/Publish/).length;
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    /* Dialog mount adds more "Publish" occurrences (title + submit). */
    await waitFor(() => {
      expect(screen.getAllByText(/Publish/).length).toBeGreaterThan(before);
    });
  });

  it('PublishDialog — submit happy path calls messagingPublish + onSaved', async () => {
    stubAll();
    const publish = vi.spyOn(edgeApi, 'messagingPublish').mockResolvedValue(
      { messageId: 'msg-new' } as never);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Publish$/ }))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    /* Dialog mounts → Publish-form submit button appears. */
    const dialogButtons = screen.getAllByRole('button',
      { name: /^Publish$/ });
    const submit = dialogButtons[dialogButtons.length - 1];
    await user.click(submit);
    await waitFor(() => expect(publish).toHaveBeenCalled());
    const call = publish.mock.calls[0][0];
    expect(call.channel).toBe('broadcast');
    expect(call.fromDeviceId).toBe('ADMIN-UI');
    expect(call.messageType).toBe('STOCK_ALERT');
    /* TTL default = 60 min = 3600 seconds. */
    expect(call.ttlSeconds).toBe(3600);
  });

  it('PublishDialog — invalid JSON payload surfaces the parse error', async () => {
    stubAll();
    const publish = vi.spyOn(edgeApi, 'messagingPublish').mockResolvedValue(
      { messageId: 'msg' } as never);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Publish$/ }))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    /* Replace payload textarea content with invalid JSON. */
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'not json {{');
    const dialogButtons = screen.getAllByRole('button',
      { name: /^Publish$/ });
    const submit = dialogButtons[dialogButtons.length - 1];
    await user.click(submit);
    /* Error surfaces, messagingPublish not called. */
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/Unexpected token|JSON/i));
    expect(publish).not.toHaveBeenCalled();
  });

  it('PublishDialog — ttlMinutes=0 omits ttlSeconds from the payload', async () => {
    stubAll();
    const publish = vi.spyOn(edgeApi, 'messagingPublish').mockResolvedValue(
      { messageId: 'msg' } as never);
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Publish$/ }))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    /* Set TTL input to 0. */
    const ttlInput = document.querySelector(
      'input[type="number"]') as HTMLInputElement;
    await user.clear(ttlInput);
    await user.type(ttlInput, '0');
    const dialogButtons = screen.getAllByRole('button',
      { name: /^Publish$/ });
    await user.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => expect(publish).toHaveBeenCalled());
    const call = publish.mock.calls[0][0];
    expect(call.ttlSeconds).toBeUndefined();
  });

  it('PublishDialog — Cancel closes without posting', async () => {
    stubAll();
    const publish = vi.spyOn(edgeApi, 'messagingPublish');
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Publish$/ }))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    /* Dialog mounted — click Cancel. */
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(publish).not.toHaveBeenCalled();
  });

  it('Refresh button triggers reload (second call to messagingStats)', async () => {
    stubAll();
    renderWithProviders(<DeviceMessaging />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Refresh/ }))
        .toBeInTheDocument());
    const callsBefore = (edgeApi.messagingStats as unknown as
      ReturnType<typeof vi.fn>).mock.calls.length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => {
      const callsAfter = (edgeApi.messagingStats as unknown as
        ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});
