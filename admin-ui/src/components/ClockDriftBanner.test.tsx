import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { ClockDriftBanner } from './ClockDriftBanner';
import * as edgeApi from '../api/edgeApi';

/* NFR-28 — ClockDriftBanner behaviour matrix. */

describe('ClockDriftBanner', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  /** Pins the browser's Date.now() so the drift math is deterministic. */
  function pinBrowserClock(callerEpochMillis: number): void {
    vi.spyOn(Date, 'now').mockReturnValue(callerEpochMillis);
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: 'Africa/Kampala' }) }) as never);
  }

  it('renders nothing when drift is within tolerance', async () => {
    pinBrowserClock(1_700_000_000_000);
    vi.spyOn(edgeApi, 'clockProbe').mockResolvedValue({
      serverTime: '2026-11-04T10:00:00Z',
      serverEpochMillis: 1_700_000_010_000,
      serverTimeZone: 'Africa/Kampala',
      systemTimeZone: 'Africa/Kampala',
      unsafeDriftMillis: 60_000,
      note: 'ok',
    });
    vi.spyOn(edgeApi, 'clockReport').mockResolvedValue({
      driftMillis: 10_000, unsafe: false,
      serverEpochMillis: 1_700_000_010_000,
      unsafeDriftMillis: 60_000,
    });
    const { container } = renderWithProviders(<ClockDriftBanner />);
    /* Flush the useEffect. */
    await new Promise((r) => setTimeout(r, 0));
    expect(container.firstChild).toBeNull();
  });

  it('renders the unsafe-drift banner when report.unsafe is true', async () => {
    pinBrowserClock(1_700_000_000_000);
    vi.spyOn(edgeApi, 'clockProbe').mockResolvedValue({
      serverTime: '2026-11-04T10:02:00Z',
      serverEpochMillis: 1_700_000_120_000,
      serverTimeZone: 'Africa/Kampala',
      systemTimeZone: 'Africa/Kampala',
      unsafeDriftMillis: 60_000,
      note: '',
    });
    vi.spyOn(edgeApi, 'clockReport').mockResolvedValue({
      driftMillis: 120_000, unsafe: true,
      serverEpochMillis: 1_700_000_120_000,
      unsafeDriftMillis: 60_000,
    });
    renderWithProviders(<ClockDriftBanner />);
    await waitFor(() =>
      expect(screen.getByTestId('clock-drift-banner')).toBeInTheDocument());
    expect(screen.getByTestId('clock-drift-detail'))
      .toHaveTextContent(/120s out of sync/);
  });

  it('renders the zone-mismatch note when server and browser disagree', async () => {
    pinBrowserClock(1_700_000_000_000);
    vi.spyOn(edgeApi, 'clockProbe').mockResolvedValue({
      serverTime: '2026-11-04T10:00:00Z',
      serverEpochMillis: 1_700_000_000_000,
      serverTimeZone: 'America/Chicago',
      systemTimeZone: 'America/Chicago',
      unsafeDriftMillis: 60_000,
      note: '',
    });
    vi.spyOn(edgeApi, 'clockReport').mockResolvedValue({
      driftMillis: 0, unsafe: false,
      serverEpochMillis: 1_700_000_000_000,
      unsafeDriftMillis: 60_000,
    });
    renderWithProviders(<ClockDriftBanner />);
    await waitFor(() =>
      expect(screen.getByTestId('clock-zone-detail')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/America\/Chicago/);
    expect(document.body.textContent ?? '').toMatch(/Africa\/Kampala/);
  });

  it('Dismiss hides the banner for the rest of the session', async () => {
    pinBrowserClock(1_700_000_000_000);
    vi.spyOn(edgeApi, 'clockProbe').mockResolvedValue({
      serverTime: 'x', serverEpochMillis: 1_700_000_120_000,
      serverTimeZone: 'Z', systemTimeZone: 'Z',
      unsafeDriftMillis: 60_000, note: '',
    });
    vi.spyOn(edgeApi, 'clockReport').mockResolvedValue({
      driftMillis: 120_000, unsafe: true,
      serverEpochMillis: 1_700_000_120_000,
      unsafeDriftMillis: 60_000,
    });
    renderWithProviders(<ClockDriftBanner />);
    await waitFor(() =>
      expect(screen.getByTestId('clock-drift-banner')).toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByTestId('clock-drift-dismiss'));
    await waitFor(() =>
      expect(screen.queryByTestId('clock-drift-banner')).toBeNull());
  });

  it('silently no-ops when the clock probe itself fails', async () => {
    pinBrowserClock(1_700_000_000_000);
    vi.spyOn(edgeApi, 'clockProbe').mockRejectedValue(new Error('offline'));
    const { container } = renderWithProviders(<ClockDriftBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.firstChild).toBeNull();
  });
});
