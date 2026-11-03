import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type * as edgeApi from '../api/edgeApi';

vi.mock('../api/edgeApi', () => ({
  compat: vi.fn(),
  compatHistory: vi.fn(),
  refreshCompat: vi.fn(),
}));

import * as mockedApi from '../api/edgeApi';
import { MockupCompatMatrix } from './CompatMatrix';

function snap(overrides: Partial<edgeApi.CompatSnapshot> = {}): edgeApi.CompatSnapshot {
  return {
    status: 'OK', profileName: 'V2_44', centralVersion: '2.44',
    probeReachable: true,
    capabilities: {
      trackerLegacyRemoved: true,
      supportedPeriodTypes: ['Daily', 'Monthly'],
      metadataBulkProfile: 'DHIS2_2_44',
      nested: { foo: 'bar' },
      nullish: null,
      empty: [],
    },
    message: 'All good',
    snapshotId: 100,
    capturedAt: '2026-11-01T00:00:00Z',
    probeDurationMs: 42,
    ...overrides,
  };
}

function renderScreen(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <MockupCompatMatrix />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(mockedApi.compat).mockResolvedValue(snap());
  vi.mocked(mockedApi.compatHistory).mockResolvedValue({
    snapshots: [
      snap({ snapshotId: 100 }),
      snap({ snapshotId: 99, probeReachable: false }),
      snap({ snapshotId: 98 }),
    ],
  });
  vi.mocked(mockedApi.refreshCompat).mockResolvedValue(snap());
  // jsdom's window.location is read-only but hash is writable.
  if (typeof window !== 'undefined') window.location.hash = '';
});

afterEach(() => {
  vi.clearAllMocks();
  if (typeof window !== 'undefined') window.location.hash = '';
});

describe('MockupCompatMatrix', () => {
  it('renders loading state before compat + history resolve', () => {
    vi.mocked(mockedApi.compat).mockReturnValue(new Promise(() => undefined));
    renderScreen();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders error state when compat probe rejects (Error)', async () => {
    vi.mocked(mockedApi.compat).mockRejectedValue(new Error('probe-fail'));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('err-compat')).toBeInTheDocument());
    expect(screen.getByTestId('err-compat')).toHaveTextContent(/probe-fail/);
  });

  it('renders error state when compat probe rejects (non-Error)', async () => {
    vi.mocked(mockedApi.compat).mockRejectedValue('plain-rejection');
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('err-compat')).toBeInTheDocument());
    expect(screen.getByTestId('err-compat')).toHaveTextContent(/plain-rejection/);
  });

  it('renders empty history gracefully (no snapshots)', async () => {
    vi.mocked(mockedApi.compatHistory).mockResolvedValue({ snapshots: [] });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('matrix-row-V2_44')).toBeInTheDocument());
    // Reliability is 0% when zero snapshots.
    expect(screen.getByText(/0% reliability/)).toBeInTheDocument();
  });

  it('renders populated overview with the version matrix and active profile marker', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('matrix-row-V2_44')).toBeInTheDocument());
    expect(screen.getByTestId('matrix-row-V2_41')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-row-V2_42')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-row-V2_43')).toBeInTheDocument();
    // Active profile row is marked.
    expect(screen.getByTestId('matrix-row-V2_44').className).toContain('ea-row--active');
    expect(screen.getByText(/Central reachable/)).toBeInTheDocument();
  });

  it('renders Live profile capabilities with all four value renderers', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Live profile capabilities/)).toBeInTheDocument());
    // Boolean -> yes/no chip; array -> info chips; object -> JSON pre; null -> em-dash.
    expect(screen.getByText(/Tracker legacy removed/i)).toBeInTheDocument();
    // Array value rendered.
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('renders muted "no capabilities" when probe lacks capabilities', async () => {
    vi.mocked(mockedApi.compat).mockResolvedValue(snap({ capabilities: undefined }));
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Probe hasn't returned a capabilities snapshot/)).toBeInTheDocument());
  });

  it('"Probe now" calls refreshCompat and the history endpoint', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Probe now')).toBeInTheDocument());
    vi.mocked(mockedApi.compatHistory).mockClear();
    await userEvent.click(screen.getByText('Probe now'));
    await waitFor(() => expect(mockedApi.refreshCompat).toHaveBeenCalled());
    expect(mockedApi.compatHistory).toHaveBeenCalled();
  });

  it('surfaces refresh failures via error block', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Probe now')).toBeInTheDocument());
    vi.mocked(mockedApi.refreshCompat).mockRejectedValueOnce(new Error('refresh-boom'));
    await userEvent.click(screen.getByText('Probe now'));
    // Err lives inline — not full-screen since snap is still present.
    await waitFor(() => expect(mockedApi.refreshCompat).toHaveBeenCalled());
  });

  it('clicking the history tab reveals the snapshot history table', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('compat-tab-history')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('compat-tab-history'));
    // "Snapshot history" appears both as tab label and panel title.
    expect(screen.getAllByText(/Snapshot history/).length).toBeGreaterThan(0);
    // Three snapshot rows → three "#" cells.
    expect(screen.getByText('#100')).toBeInTheDocument();
    expect(screen.getByText('#99')).toBeInTheDocument();
    expect(screen.getByText('#98')).toBeInTheDocument();
  });

  it('history tab deep-link via #history hash loads directly', async () => {
    // Set window hash before mount.
    window.location.hash = '#history';
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('compat-tab-history')).toBeInTheDocument());
    // Should show history by default.
    expect(screen.getByText('#100')).toBeInTheDocument();
  });

  it('toggles window.location.hash between overview and history', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('compat-tab-history')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('compat-tab-history'));
    await waitFor(() => expect(window.location.hash).toBe('#history'));
    await userEvent.click(screen.getByTestId('compat-tab-overview'));
    await waitFor(() => expect(window.location.hash).toBe(''));
  });

  it('history pagination controls appear when > pageSize snapshots', async () => {
    const many = Array.from({ length: 55 }, (_, i) =>
      snap({ snapshotId: i, probeReachable: i % 2 === 0 }));
    vi.mocked(mockedApi.compatHistory).mockResolvedValue({ snapshots: many });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('compat-tab-history')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('compat-tab-history'));
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    // Next advances.
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    // Previous returns.
    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('history tab with zero snapshots shows the empty message', async () => {
    vi.mocked(mockedApi.compatHistory).mockResolvedValue({ snapshots: [] });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('compat-tab-history')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('compat-tab-history'));
    expect(screen.getByText(/No snapshots recorded/)).toBeInTheDocument();
  });

  it('renders unreachable status + single-probe label', async () => {
    vi.mocked(mockedApi.compat).mockResolvedValue(snap({ probeReachable: false }));
    vi.mocked(mockedApi.compatHistory).mockResolvedValue({
      snapshots: [snap({ snapshotId: 1, probeReachable: false })],
    });
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Central unreachable/)).toBeInTheDocument());
    // Reliability label uses singular "probe" when exactly one.
    expect(screen.getByText(/1 probe$/)).toBeInTheDocument();
  });
});
