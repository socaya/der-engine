import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Compliance } from './Compliance';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* Compliance reads four endpoints on mount via raw fetch(). Stub a
 * matcher that returns the right shape per URL. */
function stubFetch(): void {
  vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (
    input: unknown,
  ) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes('/compliance/retention')) {
      body = { policies: [
        { category: 'audit', keepDays: 365, description: 'audit log',
          lastPurgeAt: null, lastPurgeRows: 0 },
      ] };
    } else if (url.includes('/compliance/erasure')) {
      body = { requests: [] };
    } else if (url.includes('/compliance/audit/anchors')) {
      body = { anchors: [] };
    } else if (url.includes('/compliance/residency')) {
      body = { rules: [] };
    }
    return new Response(JSON.stringify(body),
      { status: 200, headers: { 'content-type': 'application/json' } });
  }) as never);
}

describe('Compliance', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders the screen scaffold', async () => {
    stubFetch();
    const { container } = renderWithProviders(<Compliance />, { authApi });
    /* Compliance has no LoadingBlock — it just renders empty tables
     * until data arrives. Wait for the root screen class to appear. */
    await waitFor(() =>
      expect(container.querySelector('.ea-screen')).not.toBeNull());
    expect(document.body.textContent ?? '').toMatch(/compliance|retention|erasure|audit/i);
  });

  it('populates the retention policy row from the retention fetch', async () => {
    stubFetch();
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/audit log/i));
  });

  it('tolerates fetch rejections on every endpoint without crashing', async () => {
    /* The component's j() helper reads text first, so a thrown
     * fetch is caught by the try/catch around each setter. The
     * initial useState([]) stays, so the body renders. */
    vi.spyOn(globalThis, 'fetch' as never).mockRejectedValue(
      new TypeError('network down') as never);
    const { container } = renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(container.querySelector('.ea-screen')).not.toBeNull());
  });
});
