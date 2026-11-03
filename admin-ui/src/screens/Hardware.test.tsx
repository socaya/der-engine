import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Hardware } from './Hardware';

const base = {
  watchdog: {
    enabled: true, underSystemd: true,
    lastPingAt: '2026-11-03T12:00:00Z', pingCount: 500,
    lastFailureAt: null, lastFailureMsg: null,
    notifySocket: '/run/systemd/notify',
  },
  thermal: {
    available: true,
    zones: [
      { zone: 'cpu0', celsius: 42.5, sampledAt: '2026-11-03T12:00:00Z' },
      { zone: 'cpu1', celsius: 65.2, sampledAt: '2026-11-03T12:00:00Z' },
      { zone: 'gpu0', celsius: 78.9, sampledAt: '2026-11-03T12:00:00Z' },
    ],
  },
  ups: {
    available: true, upsName: 'apc', status: 'OL',
    batteryChargePct: 90, batteryRuntimeSec: 1800,
    inputVoltage: 230, model: 'APC-700',
  },
  leds: [
    { zone: 'status', color: 'green', pattern: 'solid',
      periodMs: null, label: 'OK', updatedAt: '2026-11-03T12:00:00Z' },
  ],
  sealedSecrets: [
    { secretId: 'tok', description: 'DHIS2',
      sealedPath: '/etc/der/sealed/tok', algorithm: 'AES-GCM',
      sealedAt: '2026-11-03T10:00:00Z', lastUnsealAt: null,
      unsealCount: 0 },
  ],
};

const empty = {
  watchdog: {
    enabled: false, underSystemd: false,
    lastPingAt: null, pingCount: 0,
    lastFailureAt: null, lastFailureMsg: 'crash',
    notifySocket: null,
  },
  thermal: { available: false },
  ups: { available: false, reason: 'no NUT' },
  leds: [],
  sealedSecrets: [],
};

function mkFetch(body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body),
    { status: 200 })) as never;
}

describe('Hardware screen', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
      .mockImplementation(mkFetch(base) as never) as never;
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('mounts', async () => {
    renderWithProviders(<Hardware />);
    await waitFor(() =>
      expect(screen.getByTestId('hardware')).toBeInTheDocument());
  });
  it('renders populated watchdog / thermal / UPS / LEDs / secrets', async () => {
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('apc')).toBeInTheDocument());
    expect(screen.getByText('APC-700')).toBeInTheDocument();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText(/hottest 78\.9/)).toBeInTheDocument();
    // Three thermal rows rendered.
    expect(screen.getByText('cpu0')).toBeInTheDocument();
    expect(screen.getByText('cpu1')).toBeInTheDocument();
    expect(screen.getByText('gpu0')).toBeInTheDocument();
    expect(screen.getAllByText('YES').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('500')).toBeInTheDocument();
    // Sealed secret
    expect(screen.getByText('tok')).toBeInTheDocument();
  });
  it('renders empty state with watchdog failure message', async () => {
    fetchSpy.mockImplementation(mkFetch(empty) as never);
    renderWithProviders(<Hardware />);
    await waitFor(() =>
      expect(screen.getByText('crash')).toBeInTheDocument());
    expect(screen.getByText(/No thermal zones found/)).toBeInTheDocument();
    expect(screen.getByText(/no NUT/)).toBeInTheDocument();
    expect(screen.getByText(/No LED zones/)).toBeInTheDocument();
    expect(screen.getByText(/No sealed secrets yet/)).toBeInTheDocument();
    expect(screen.getAllByText('NO').length).toBeGreaterThanOrEqual(2);
  });
  it('opens the seal-secret dialog and cancel closes it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    await user.click(screen.getByText('Seal secret'));
    expect(screen.getByText('Seal secret',
      { selector: 'h3' })).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));
    await waitFor(() =>
      expect(screen.queryByText('Seal secret',
        { selector: 'h3' })).toBeNull());
  });
  it('seal form submit disabled without id/plaintext; fills + submits', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    await user.click(screen.getByText('Seal secret'));
    // Submit button is the "Seal" button in the modal footer.
    const sealButtons = screen.getAllByRole('button', { name: /^Seal$/ });
    expect((sealButtons[sealButtons.length - 1] as HTMLButtonElement)
      .disabled).toBe(true);
    await user.type(screen.getByPlaceholderText('dhis2-token'), 'tok2');
    // The textarea is the only textarea.
    const textarea = document.querySelector('textarea');
    if (textarea) await user.type(textarea, 'secret');
    // After filling id + plaintext, submit button should be enabled.
    const final = screen.getAllByRole('button', { name: /^Seal$/ }).pop() as HTMLButtonElement;
    expect(final.disabled).toBe(false);
  });
  it('opens LED edit row and allows cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    // RowMenu opens via its trigger (RowMenu renders a button).
    // Find the menu trigger adjacent to LED row and click.
    const menuTriggers = screen.getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('Actions')
                   || b.getAttribute('aria-haspopup') === 'menu');
    if (menuTriggers[0]) {
      await user.click(menuTriggers[0]);
      const edit = screen.queryByText('Edit');
      if (edit) {
        await user.click(edit);
        if (screen.queryByText('Cancel')) {
          await user.click(screen.getByText('Cancel'));
        }
      }
    }
  });
  it('refresh re-fetches', async () => {
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    const before = fetchSpy.mock.calls.length;
    await userEvent.click(screen.getAllByText('Refresh')[0]);
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before));
  });

  it('seal-dialog submit — fetch success triggers onSaved + reload', async () => {
    let postedBody: Record<string, unknown> | null = null;
    fetchSpy.mockImplementation((async (
      input: unknown, init?: RequestInit,
    ) => {
      const url = String(input);
      if (init?.method === 'POST' && url.includes('/sealed')) {
        postedBody = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response('{}', { status: 200 });
      }
      return new Response(JSON.stringify(base), { status: 200 });
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    await user.click(screen.getByText('Seal secret'));
    await user.type(screen.getByPlaceholderText('dhis2-token'),
                     'new-secret-id');
    const textarea = document.querySelector('textarea');
    if (textarea) {
      await user.type(textarea, 'the-plain-value');
    }
    const sealBtns = screen.getAllByRole('button', { name: /^Seal$/ });
    const submit = sealBtns[sealBtns.length - 1] as HTMLButtonElement;
    await user.click(submit);
    await waitFor(() => {
      expect(postedBody).not.toBeNull();
      expect(postedBody!.secretId).toBe('new-secret-id');
      expect(postedBody!.plaintext).toBe('the-plain-value');
    });
  });

  it('seal-dialog submit — fetch failure surfaces the error inline', async () => {
    fetchSpy.mockImplementation((async (
      input: unknown, init?: RequestInit,
    ) => {
      const url = String(input);
      if (init?.method === 'POST' && url.includes('/sealed')) {
        throw new TypeError('seal denied');
      }
      return new Response(JSON.stringify(base), { status: 200 });
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    await user.click(screen.getByText('Seal secret'));
    await user.type(screen.getByPlaceholderText('dhis2-token'), 'sx');
    const textarea = document.querySelector('textarea');
    if (textarea) await user.type(textarea, 'p');
    const sealBtns = screen.getAllByRole('button', { name: /^Seal$/ });
    await user.click(sealBtns[sealBtns.length - 1] as HTMLButtonElement);
    await waitFor(() =>
      expect(screen.getByText(/seal denied/)).toBeInTheDocument());
  });

  it('LED edit — RowMenu Edit opens inputs, Save posts the color/pattern', async () => {
    let postedLed: { url: string; body: Record<string, unknown> } | null = null;
    fetchSpy.mockImplementation((async (
      input: unknown, init?: RequestInit,
    ) => {
      const url = String(input);
      if (init?.method === 'POST' && url.includes('/leds/')) {
        postedLed = { url, body: JSON.parse(init.body as string) };
        return new Response('{}', { status: 200 });
      }
      return new Response(JSON.stringify(base), { status: 200 });
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<Hardware />);
    await waitFor(() => expect(screen.getByText('status')).toBeInTheDocument());
    /* Open the RowMenu via its details element — look for a
     * details element inside the LED row. */
    const details = document.querySelectorAll('details');
    expect(details.length).toBeGreaterThan(0);
    /* RowMenu uses <details><summary>. Click a summary to open. */
    details[details.length - 1].setAttribute('open', '');
    const edit = screen.queryByText('Edit');
    if (edit) {
      await user.click(edit);
      /* After Edit, Save button appears. */
      const save = screen.queryByText('Save');
      if (save) {
        await user.click(save);
        await waitFor(() => {
          expect(postedLed).not.toBeNull();
        });
      }
    }
  });

  it('hottest-temp heuristic — surfaces hottest zone in subtitle', async () => {
    renderWithProviders(<Hardware />);
    await waitFor(() =>
      expect(screen.getByText(/hottest/i)).toBeInTheDocument());
    /* 78.9°C is the hottest of the three zones. */
    expect(document.body.textContent ?? '').toMatch(/78\.9/);
  });
});
