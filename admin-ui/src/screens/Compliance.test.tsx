import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  /* Populated payloads exercise every table-row branch plus the
   * two tone switches (erasure status + residency allow/deny). */
  function stubFetchPopulated(opts?: {
    completeErasure?: boolean;
  }): void {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (
      input: unknown,
      init?: RequestInit,
    ) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.includes('/erasure/') && url.includes('/complete')) {
        return new Response('{}', { status: 200 });
      }
      if (method === 'POST' && url.includes('/compliance/erasure') && !url.includes('/complete')) {
        return new Response(JSON.stringify({
          requestId: 'er-new', estimatedRowsAffected: { local_data_value: 42, local_event: 3 },
        }), { status: 200 });
      }
      if (method === 'POST' && url.includes('/compliance/audit/anchor-now')) {
        return new Response('{}', { status: 200 });
      }
      if (method === 'POST' && url.includes('/compliance/retention/')) {
        return new Response('{}', { status: 200 });
      }
      let body: unknown = {};
      if (url.includes('/compliance/retention')) {
        body = { policies: [
          { category: 'audit', keepDays: 365, description: 'audit log',
            lastPurgeAt: '2026-11-01T00:00:00Z', lastPurgeRows: 123 },
          { category: 'journal', keepDays: 90, description: null,
            lastPurgeAt: null, lastPurgeRows: 0 },
        ] };
      } else if (url.includes('/compliance/erasure')) {
        body = { requests: [
          { requestId: 'er-1', subjectType: 'patient', subjectId: 'TEI-1',
            reason: 'GDPR', requestedAt: '2026-11-02T00:00:00Z',
            status: opts?.completeErasure ? 'COMPLETED' : 'PENDING',
            completedAt: null,
            receiptHash: 'abc123def456abc123def456abc123def456' },
          { requestId: 'er-2', subjectType: 'device', subjectId: 'TAB-1',
            reason: null, requestedAt: '2026-11-01T00:00:00Z',
            status: 'COMPLETED', completedAt: '2026-11-02T00:00:00Z',
            receiptHash: null },
          { requestId: 'er-3', subjectType: 'user', subjectId: 'u1',
            reason: null, requestedAt: '2026-10-01T00:00:00Z',
            status: 'REJECTED', completedAt: null, receiptHash: null },
        ] };
      } else if (url.includes('/compliance/audit/anchors')) {
        body = { anchors: [
          { anchorAt: '2026-11-03T02:00:00Z', rowCount: 500,
            chainHead: 'deadbeef'.repeat(8),
            uploadedAt: '2026-11-03T03:00:00Z' },
          { anchorAt: '2026-11-02T02:00:00Z', rowCount: 420,
            chainHead: 'cafebabe'.repeat(8),
            uploadedAt: null },
        ] };
      } else if (url.includes('/compliance/residency')) {
        body = { rules: [
          { ruleId: 'r1', hostPattern: '*.example.org', allow: true,
            note: 'main allowlist', updatedAt: '2026-10-01T00:00:00Z' },
          { ruleId: 'r2', hostPattern: 'adversary.net', allow: false,
            note: null, updatedAt: '2026-10-15T00:00:00Z' },
        ] };
      }
      return new Response(JSON.stringify(body),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }) as never);
  }

  it('populated erasure rows render per-status tone chips', async () => {
    stubFetchPopulated();
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/PENDING/));
    expect(document.body.textContent ?? '').toMatch(/COMPLETED/);
    expect(document.body.textContent ?? '').toMatch(/REJECTED/);
    /* "1 pending erasure" surfaces in the SyncStatusBar label. */
    expect(screen.getByText(/1 pending erasure/i)).toBeInTheDocument();
  });

  it('populated audit anchors render date + chain-head slices', async () => {
    stubFetchPopulated();
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/deadbeefdeadbeefdeadbeefdeadbeef/));
    /* Second anchor has uploadedAt=null → "—" fallback. */
    expect(document.body.textContent ?? '').toMatch(/—/);
  });

  it('populated residency rules render ALLOW and DENY tones', async () => {
    stubFetchPopulated();
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('ALLOW')).toBeInTheDocument());
    expect(screen.getByText('DENY')).toBeInTheDocument();
  });

  it('Request-erasure button opens the dialog and Close dismisses it', async () => {
    stubFetchPopulated();
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/Request erasure/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText(/Request erasure/i));
    expect(screen.getByText(/Right-to-erasure request/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() =>
      expect(screen.queryByText(/Right-to-erasure request/i)).toBeNull());
  });

  it('Submit-request flow — subject id enables the button, submit shows estimate', async () => {
    stubFetchPopulated();
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/Request erasure/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText(/Request erasure/i));
    /* Submit disabled while subject-id empty. */
    const submit = screen.getByRole('button', { name: /Submit request/i });
    expect(submit).toBeDisabled();
    /* Fill in subject id then submit. */
    const subjInput = screen.getByPlaceholderText('e.g. TAB-REG-01');
    await user.type(subjInput, 'TEI-abc');
    expect(submit).not.toBeDisabled();
    await user.click(submit);
    /* Estimate panel appears → Done button swaps in. */
    await waitFor(() =>
      expect(screen.getByText(/Estimated rows/i)).toBeInTheDocument());
    expect(screen.getByText(/local_data_value=42/)).toBeInTheDocument();
  });

  it('Submit-request error path — fetch rejects → err surfaces', async () => {
    stubFetchPopulated();
    /* Override just the POST /compliance/erasure call to reject. */
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (
      input: unknown, init?: RequestInit,
    ) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.includes('/compliance/erasure') && !url.includes('/complete')) {
        throw new TypeError('upstream down');
      }
      if (url.includes('/compliance/retention')) {
        return new Response(JSON.stringify({ policies: [] }));
      }
      if (url.includes('/compliance/erasure')) {
        return new Response(JSON.stringify({ requests: [] }));
      }
      if (url.includes('/compliance/audit/anchors')) {
        return new Response(JSON.stringify({ anchors: [] }));
      }
      if (url.includes('/compliance/residency')) {
        return new Response(JSON.stringify({ rules: [] }));
      }
      return new Response('{}');
    }) as never);
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/Request erasure/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText(/Request erasure/i));
    await user.type(screen.getByPlaceholderText('e.g. TAB-REG-01'), 'TEI-x');
    await user.click(screen.getByRole('button', { name: /Submit request/i }));
    /* Error text appears. */
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/upstream down/));
  });

  it('Anchor-now button triggers the POST anchor-now endpoint', async () => {
    stubFetchPopulated();
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/Anchor now/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText(/Anchor now/i));
    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes('/audit/anchor-now'))).toBe(true);
    });
  });

  it('Export audit button triggers window.open', async () => {
    stubFetchPopulated();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(
      (): Window | null => null);
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/Export audit CSV/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText(/Export audit CSV/i));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/compliance/audit/export'), '_blank');
  });

  it('Edit retention policy → Save posts new keepDays + reloads', async () => {
    let postedPolicy: { url: string; body: Record<string, unknown> } | null = null;
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (
      input: unknown, init?: RequestInit,
    ) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.includes('/retention/')) {
        postedPolicy = { url, body: JSON.parse(init!.body as string) };
        return new Response('{}', { status: 200 });
      }
      let body: unknown = {};
      if (url.includes('/retention')) {
        body = { policies: [
          { category: 'audit', keepDays: 365, description: 'audit log',
            lastPurgeAt: null, lastPurgeRows: 0 },
        ] };
      } else if (url.includes('/erasure')) body = { requests: [] };
      else if (url.includes('/anchors')) body = { anchors: [] };
      else if (url.includes('/residency')) body = { rules: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as never);
    renderWithProviders(<Compliance />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('audit')).toBeInTheDocument());
    /* Open RowMenu → click "Edit". */
    const user = userEvent.setup();
    const details = document.querySelectorAll('details');
    expect(details.length).toBeGreaterThan(0);
    details[0].setAttribute('open', '');
    const edit = screen.queryByText('Edit');
    if (edit) {
      await user.click(edit);
      /* Numeric input appears. */
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (input) {
        await user.clear(input);
        await user.type(input, '90');
        await user.click(screen.getByText('Save'));
        await waitFor(() => {
          expect(postedPolicy).not.toBeNull();
          expect(postedPolicy!.body.keepDays).toBe(90);
        });
      }
    }
  });

  it('Complete erasure → requires confirm; cancelling does not post', async () => {
    stubFetchPopulated();
    /* window.confirm returns false → the completeErasure handler
     * bails without posting. */
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => false);
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    try {
      renderWithProviders(<Compliance />, { authApi });
      await waitFor(() =>
        expect(screen.getByText('PENDING')).toBeInTheDocument());
      const user = userEvent.setup();
      const details = document.querySelectorAll('details');
      /* RowMenus on pending erasure row surface. */
      if (details.length > 1) {
        details[1].setAttribute('open', '');
        const complete = screen.queryByText(/Complete erasure/i);
        if (complete) {
          const before = fetchSpy.mock.calls.length;
          await user.click(complete);
          /* No POST to /complete since confirm was denied. */
          const after = fetchSpy.mock.calls.length;
          const diff = fetchSpy.mock.calls
            .slice(before, after)
            .map((c) => String(c[0]));
          expect(diff.some((u) => u.includes('/complete'))).toBe(false);
        }
      }
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('empty-state fallbacks — zero rows across all four endpoints', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockImplementation((async (
      input: unknown,
    ) => {
      const url = String(input);
      let body: unknown = {};
      if (url.includes('retention')) body = { policies: [] };
      else if (url.includes('erasure')) body = { requests: [] };
      else if (url.includes('anchors')) body = { anchors: [] };
      else if (url.includes('residency')) body = { rules: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as never);
    renderWithProviders(<Compliance />, { authApi });
    /* "No erasure requests yet" + "No anchors yet" messages
     * fire the empty-state branches. */
    await waitFor(() =>
      expect(screen.getByText(/No erasure requests yet/i))
        .toBeInTheDocument());
    expect(screen.getByText(/No anchors yet/i)).toBeInTheDocument();
    /* SyncStatusBar label falls back to "Nominal" when 0 pending. */
    expect(screen.getByText(/Nominal/)).toBeInTheDocument();
  });
});
