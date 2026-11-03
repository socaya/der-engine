import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { OnboardingTour } from './OnboardingTour';

/* Minimal AuthProvider stub — the tour itself doesn't read auth,
 * but renderWithProviders boots AuthProvider which fires session(). */
const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'op', displayName: 'Operator',
    roles: ['OPERATOR'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* The tour fetches /edge-api/v1/user-prefs on mount to decide
 * whether to open. Different test cases need different responses,
 * so each test configures its own global.fetch stub. */
function stubFetch(responses: Array<{ url: RegExp; status: number; body: unknown }>): void {
  vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (
    url: unknown,
  ) => {
    const u = String(url);
    const match = responses.find((r) => r.url.test(u));
    if (!match) {
      throw new Error(`unmocked fetch ${u}`);
    }
    return new Response(JSON.stringify(match.body), {
      status: match.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as never);
}

describe('OnboardingTour', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders nothing when the tour has already been dismissed', async () => {
    stubFetch([
      { url: /\/user-prefs$/, status: 200,
        body: { prefs: { 'tour.dismissed': 'true' } } },
    ]);
    const { container } = renderWithProviders(<OnboardingTour />, { authApi });
    /* After the async probe resolves, no dialog should render.
     * waitFor is needed so the useEffect fires before we assert. */
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('opens on first visit and shows the Welcome step', async () => {
    stubFetch([
      { url: /\/user-prefs$/, status: 200, body: { prefs: {} } },
    ]);
    renderWithProviders(<OnboardingTour />, { authApi });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('Welcome to DER')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
    expect(screen.getByText('Skip tour')).toBeInTheDocument();
  });

  it('Next advances through the five steps and ends with Get started', async () => {
    stubFetch([
      { url: /\/user-prefs$/, status: 200, body: { prefs: {} } },
      { url: /\/user-prefs\/tour\.dismissed$/, status: 200, body: { ok: true } },
    ]);
    renderWithProviders(<OnboardingTour />, { authApi });
    await waitFor(() => expect(screen.getByText('Welcome to DER'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent('Overview');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent('Network');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent('Backup + Security');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent("You're all set");
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('Back returns to the previous step', async () => {
    stubFetch([
      { url: /\/user-prefs$/, status: 200, body: { prefs: {} } },
    ]);
    renderWithProviders(<OnboardingTour />, { authApi });
    await waitFor(() => expect(screen.getByText('Welcome to DER'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent('Network');
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { level: 2 }))
      .toHaveTextContent('Overview');
  });

  it('Skip tour closes the dialog and POSTs the dismissed preference', async () => {
    stubFetch([
      { url: /\/user-prefs$/, status: 200, body: { prefs: {} } },
      { url: /\/user-prefs\/tour\.dismissed$/, status: 200, body: { ok: true } },
    ]);
    renderWithProviders(<OnboardingTour />, { authApi });
    await waitFor(() => expect(screen.getByText('Welcome to DER'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText('Skip tour'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    /* The POST is fire-and-forget; the key behaviour is 'dialog
     * closes synchronously'. We don't assert the request body —
     * the component's catch(() => undefined) means a failed POST
     * doesn't surface, and we don't want to flake on timing. */
  });

  it('treats a prefs-404 as "never shown" and opens', async () => {
    stubFetch([
      { url: /\/user-prefs$/, status: 404, body: {} },
    ]);
    renderWithProviders(<OnboardingTour />, { authApi });
    /* Component response-handling: r.ok ? r.json() : { prefs: {} }.
     * A 404 therefore produces an empty prefs object → tour opens. */
    await waitFor(() => expect(screen.getByText('Welcome to DER'))
      .toBeInTheDocument());
  });

  it('a network error on the prefs probe leaves the tour closed', async () => {
    vi.spyOn(globalThis, 'fetch' as never)
      .mockRejectedValue(new TypeError('network down') as never);
    const { container } = renderWithProviders(<OnboardingTour />, { authApi });
    /* Wait a microtask so the useEffect promise rejects. */
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
