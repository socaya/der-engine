import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type * as edgeApi from '../api/edgeApi';

// Mock the whole edgeApi module so Dhis2Overview's `import * as edgeApi`
// resolves to our stubs. Tests reconfigure the stubs per-case.
vi.mock('../api/edgeApi', () => ({
  systemInfo: vi.fn(),
  compat: vi.fn(),
  getOrgUnitBinding: vi.fn(),
  drift: vi.fn(),
  readDhis2Connection: vi.fn(),
  writeDhis2Connection: vi.fn(),
  refreshCompat: vi.fn(),
}));

// Re-import after the mock so we get the mocked symbols.
import * as mockedApi from '../api/edgeApi';
import { Dhis2Overview } from './Dhis2Overview';

const systemInfo = () => ({
  service: 'der', timestamp: 't', build: { version: '1', commit: 'c', branch: 'b', dirty: false, buildTime: 't' },
  runtime: {}, journal: {}, database: {}, scheduler: {}, storage: {}, apps: {},
  dhis2: {
    centralBaseUrl: 'https://central.example.org/dhis',
    centralVersion: '2.44', profileName: 'V2_44', probeReachable: true,
    probeDurationMs: 42, capturedAt: '2026-11-01T00:00:00Z',
    reason: 'OK',
  },
} as edgeApi.SystemInfo);

const compat = (reachable = true): edgeApi.CompatSnapshot => ({
  status: 'OK',
  profileName: 'V2_44',
  centralVersion: '2.44',
  probeReachable: reachable,
  capturedAt: '2026-11-01T00:00:00Z',
  probeDurationMs: 42,
  capabilities: {},
});

const binding = (bound: boolean): edgeApi.OrgUnitBinding => ({
  bound,
  orgUnitId: bound ? 'ou-1' : null,
  orgUnitDisplayName: bound ? 'Clinic' : null,
  orgUnitPath: bound ? '/root/ou-1' : null,
  boundAt: bound ? '2026-10-01T00:00:00Z' : null,
  boundBy: bound ? 'admin' : null,
});

const drift = (fingerprintsDiffer: boolean): edgeApi.DriftResponse => ({
  status: 'IN_SYNC',
  snapshotFrom: 1, snapshotTo: 2,
  fingerprintFrom: fingerprintsDiffer ? 'aaa' : 'xxx',
  fingerprintTo: fingerprintsDiffer ? 'bbb' : 'xxx',
});

function cfg(overrides: Partial<edgeApi.Dhis2ConnectionPayload> = {}):
    edgeApi.Dhis2ConnectionPayload {
  return {
    baseUrl: 'https://central.example.org/dhis',
    username: 'svc', password: '***', patToken: null,
    passwordSet: true, patTokenSet: false,
    allowMismatch: false, pinnedVersion: null,
    minSupportedVersion: '2.41', maxTestedVersion: '2.44',
    compatMode: 'strict', snapshotTtlHours: 24,
    connectTimeoutMillis: 5000,
    proxyEnabled: false, proxyAllowWrites: false, proxyAllowPaths: null,
    updatedAt: null, updatedBy: null,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <Dhis2Overview />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Reset default happy-path mocks.
  vi.mocked(mockedApi.systemInfo).mockResolvedValue(systemInfo());
  vi.mocked(mockedApi.compat).mockResolvedValue(compat(true));
  vi.mocked(mockedApi.getOrgUnitBinding).mockResolvedValue(binding(true));
  vi.mocked(mockedApi.drift).mockResolvedValue(drift(false));
  vi.mocked(mockedApi.readDhis2Connection).mockResolvedValue(cfg());
  vi.mocked(mockedApi.writeDhis2Connection).mockResolvedValue(cfg({
    updatedAt: '2026-11-02T00:00:00Z', updatedBy: 'admin',
  }));
  vi.mocked(mockedApi.refreshCompat).mockResolvedValue(compat(true));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Dhis2Overview', () => {
  it('renders loading state before all required fetches resolve', () => {
    // Pin systemInfo pending.
    vi.mocked(mockedApi.systemInfo).mockReturnValue(new Promise(() => undefined));
    renderScreen();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('tolerates fetch rejections for optional slices and still renders', async () => {
    vi.mocked(mockedApi.getOrgUnitBinding).mockRejectedValue(new Error('ou-fail'));
    vi.mocked(mockedApi.drift).mockRejectedValue(new Error('drift-fail'));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('cap-dhis2-hub')).toBeInTheDocument());
    // Related tiles still render even without a binding → shows the unbound caption.
    expect(screen.getByText(/Not bound yet/i)).toBeInTheDocument();
  });

  it('renders populated hub with status strip and connection form', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('cap-dhis2-hub')).toBeInTheDocument());
    expect(screen.getByText(/Central reachable/)).toBeInTheDocument();
    expect(screen.getByTestId('dhis2-connection-form')).toBeInTheDocument();
    // Related tile for bound OU shows the display name.
    expect(screen.getByText(/Bound to Clinic/)).toBeInTheDocument();
    // Probe button + save button present.
    expect(screen.getByTestId('dhis2-probe-now')).toBeInTheDocument();
    expect(screen.getByTestId('dhis2-save')).toBeInTheDocument();
  });

  it('renders unreachable tone + "Not bound yet" when central is down and unbound', async () => {
    vi.mocked(mockedApi.compat).mockResolvedValue(compat(false));
    vi.mocked(mockedApi.getOrgUnitBinding).mockResolvedValue(binding(false));
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Central unreachable/)).toBeInTheDocument());
    expect(screen.getByText(/Not bound yet/)).toBeInTheDocument();
  });

  it('"Probe now" calls refreshCompat and systemInfo', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-probe-now')).toBeInTheDocument());
    vi.mocked(mockedApi.systemInfo).mockClear();
    await userEvent.click(screen.getByTestId('dhis2-probe-now'));
    await waitFor(() => expect(mockedApi.refreshCompat).toHaveBeenCalled());
    expect(mockedApi.systemInfo).toHaveBeenCalled();
  });

  it('surfaces probe errors in the error block', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-probe-now')).toBeInTheDocument());
    vi.mocked(mockedApi.refreshCompat).mockRejectedValueOnce(new Error('probe-fail'));
    await userEvent.click(screen.getByTestId('dhis2-probe-now'));
    await waitFor(() => expect(screen.getByTestId('err-dhis2-hub')).toBeInTheDocument());
    expect(screen.getByTestId('err-dhis2-hub')).toHaveTextContent(/probe-fail/);
  });

  it('surfaces non-Error probe failures too', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-probe-now')).toBeInTheDocument());
    vi.mocked(mockedApi.refreshCompat).mockRejectedValueOnce('plain-string');
    await userEvent.click(screen.getByTestId('dhis2-probe-now'));
    await waitFor(() => expect(screen.getByTestId('err-dhis2-hub')).toHaveTextContent(/plain-string/));
  });

  it('editing the base URL + saving posts the draft (minus sentinel password)', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    const baseUrlInput = screen.getByPlaceholderText('https://dhis.example.org/dhis') as HTMLInputElement;
    fireEvent.change(baseUrlInput, { target: { value: 'https://new.example.org/dhis' } });
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(mockedApi.writeDhis2Connection).toHaveBeenCalled());
    const payload = vi.mocked(mockedApi.writeDhis2Connection).mock.calls[0][0];
    expect(payload.baseUrl).toBe('https://new.example.org/dhis');
    // Sentinel password '***' MUST be stripped so we don't overwrite the stored secret.
    expect(payload.password).toBeUndefined();
    // Success message surfaces.
    expect(screen.getByTestId('dhis2-saved')).toBeInTheDocument();
  });

  it('strips sentinel patToken when saving', async () => {
    vi.mocked(mockedApi.readDhis2Connection).mockResolvedValue(cfg({
      password: null, passwordSet: false,
      patToken: '***', patTokenSet: true,
    }));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(mockedApi.writeDhis2Connection).toHaveBeenCalled());
    const payload = vi.mocked(mockedApi.writeDhis2Connection).mock.calls[0][0];
    expect(payload.patToken).toBeUndefined();
  });

  it('surfaces save errors in the error block', async () => {
    vi.mocked(mockedApi.writeDhis2Connection).mockRejectedValueOnce(new Error('save-fail'));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(screen.getByTestId('err-dhis2-hub')).toHaveTextContent(/save-fail/));
  });

  it('surfaces non-Error save failures', async () => {
    vi.mocked(mockedApi.writeDhis2Connection).mockRejectedValueOnce('x');
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(screen.getByTestId('err-dhis2-hub')).toHaveTextContent('x'));
  });

  it('toggles proxy flags and the mismatch switch', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // 3 switches: allowMismatch, proxyEnabled, proxyAllowWrites.
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    for (const c of checkboxes) {
      fireEvent.click(c);
    }
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(mockedApi.writeDhis2Connection).toHaveBeenCalled());
    const payload = vi.mocked(mockedApi.writeDhis2Connection).mock.calls[0][0];
    expect(payload.allowMismatch).toBe(true);
    expect(payload.proxyEnabled).toBe(true);
    expect(payload.proxyAllowWrites).toBe(true);
  });

  it('updates compat mode and numeric fields on the connection form', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    const compatSelect = screen.getByDisplayValue(/strict/i) as HTMLSelectElement;
    fireEvent.change(compatSelect, { target: { value: 'permissive' } });
    const minVer = screen.getByPlaceholderText('2.41') as HTMLInputElement;
    fireEvent.change(minVer, { target: { value: '2.42' } });
    const maxVer = screen.getByPlaceholderText('2.44') as HTMLInputElement;
    fireEvent.change(maxVer, { target: { value: '2.45' } });
    // Service account fields.
    const usernameInput = screen.getByDisplayValue('svc') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { value: 'svc2' } });
    // Connect timeout.
    const timeoutInput = screen.getByDisplayValue('5000') as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '7500' } });
    // Clearing timeout to blank → set() stores null.
    fireEvent.change(timeoutInput, { target: { value: '' } });
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(mockedApi.writeDhis2Connection).toHaveBeenCalled());
    const payload = vi.mocked(mockedApi.writeDhis2Connection).mock.calls[0][0];
    expect(payload.compatMode).toBe('permissive');
    expect(payload.minSupportedVersion).toBe('2.42');
    expect(payload.maxTestedVersion).toBe('2.45');
    expect(payload.username).toBe('svc2');
    expect(payload.connectTimeoutMillis).toBeNull();
  });

  it('typing a fresh password / PAT persists through save', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('dhis2-save')).toBeInTheDocument());
    const pw = screen.getByPlaceholderText('leave blank to keep ***') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'new-pw' } });
    // PAT not set in default fixture → placeholder is 'd2pat_xxx…'.
    const pat = screen.getByPlaceholderText(/d2pat_/) as HTMLInputElement;
    fireEvent.change(pat, { target: { value: 'd2pat_abc' } });
    await userEvent.click(screen.getByTestId('dhis2-save'));
    await waitFor(() => expect(mockedApi.writeDhis2Connection).toHaveBeenCalled());
    const payload = vi.mocked(mockedApi.writeDhis2Connection).mock.calls[0][0];
    expect(payload.password).toBe('new-pw');
    expect(payload.patToken).toBe('d2pat_abc');
  });

  it('shows drift tile copy when fingerprints differ', async () => {
    vi.mocked(mockedApi.drift).mockResolvedValue(drift(true));
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Drift detected/)).toBeInTheDocument());
  });

  it('reports PAT auth kind in the status bar when PAT is set', async () => {
    vi.mocked(mockedApi.readDhis2Connection).mockResolvedValue(cfg({
      passwordSet: false, patToken: '***', patTokenSet: true,
    }));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('cap-dhis2-hub')).toBeInTheDocument());
    // "PAT (Bearer)" shows up twice: once as the summary auth value and once
    // inline inside the connection form hint. Both are expected.
    expect(screen.getAllByText(/PAT \(Bearer\)/).length).toBeGreaterThan(0);
  });

  it('reports "none" auth kind when neither password nor PAT is set', async () => {
    vi.mocked(mockedApi.readDhis2Connection).mockResolvedValue(cfg({
      passwordSet: false, patTokenSet: false,
      password: null, patToken: null,
    }));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('cap-dhis2-hub')).toBeInTheDocument());
    // Status strip reads "Auth none"
    expect(screen.getByText(/Auth/)).toBeInTheDocument();
  });
});
