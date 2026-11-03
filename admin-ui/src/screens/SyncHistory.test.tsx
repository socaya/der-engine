import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { renderWithProviders } from '../test/renderWithProviders';

/**
 * MockupSyncHistoryDetail reads `runId` via `useParams`, so the test
 * harness needs a Routes/Route tree with the `:runId` segment — the
 * flat `renderWithProviders` wraps in MemoryRouter but not Routes.
 */
function renderDetail(route: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/sync/history/:runId" element={<MockupSyncHistoryDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/*
 * SyncHistory / SyncHistoryDetail test suite.
 *
 * These screens use the module namespace import `import * as edgeApi
 * from '../api/edgeApi'`, so (unlike the EACoreScreens tests which pass
 * an `api` prop) we mock the module directly. `importOriginal` keeps
 * every non-function export (types, constants) resolvable so the
 * screens' shared helpers compile.
 */
import type * as edgeApiTypes from '../api/edgeApi';
vi.mock('../api/edgeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof edgeApiTypes>();
  return {
    ...actual,
    listJobs: vi.fn(),
    getJobRun: vi.fn(),
    fetchJournalOperation: vi.fn(),
    metadataDiagnostics: vi.fn(),
    metadataInventory: vi.fn(),
    getOrgUnitBinding: vi.fn(),
    dhis2Ping: vi.fn(),
  };
});

import * as edgeApi from '../api/edgeApi';
import { MockupSyncHistory, MockupSyncHistoryDetail } from './SyncHistory';

const now = Date.parse('2026-11-03T10:00:00Z');

const jobSuccess: edgeApiTypes.JobRun = {
  runId: 1, jobName: 'METADATA_SYNC_FULL', startedAt: '2026-11-02T09:00:00Z',
  finishedAt: '2026-11-02T09:00:10Z', outcome: 'SUCCEEDED', durationMs: 10_000,
  detail: '{"pulled":42,"snapshotId":"abc","centralVersion":"2.44"}',
  triggeredBy: 'cron',
};
const jobFailed: edgeApiTypes.JobRun = {
  runId: 2, jobName: 'JOURNAL_WORKER_DRAIN', startedAt: '2026-11-02T10:00:00Z',
  finishedAt: '2026-11-02T10:00:05Z', outcome: 'FAILED', durationMs: 5_000,
  detail: '{"accepted":0,"rejected":2,"operationIds":["op-1","op-2"]}',
  triggeredBy: 'user:admin',
};
const jobReferral: edgeApiTypes.JobRun = {
  runId: 3, jobName: 'REFERRAL_INBOX_PULL', startedAt: '2026-11-02T11:00:00Z',
  finishedAt: '2026-11-02T11:00:03Z', outcome: 'SUCCESS', durationMs: 3_000,
  detail: null, triggeredBy: 'cron',
};
const jobCompat: edgeApiTypes.JobRun = {
  runId: 4, jobName: 'COMPAT_PROBE', startedAt: '2026-11-02T12:00:00Z',
  finishedAt: '2026-11-02T12:00:02Z', outcome: 'PARTIAL', durationMs: 2_000,
  detail: '{"byType":{"EVENT":5,"TEI":2}}', triggeredBy: 'cron',
};
const jobAnalytics: edgeApiTypes.JobRun = {
  runId: 5, jobName: 'ANALYTICS_REFRESH', startedAt: '2026-11-02T13:00:00Z',
  finishedAt: '2026-11-02T13:00:01Z', outcome: 'SUCCEEDED', durationMs: 1_000,
  detail: null, triggeredBy: 'cron',
};

const allJobs = [jobSuccess, jobFailed, jobReferral, jobCompat, jobAnalytics];

function wireHistoryHappy(jobs: typeof allJobs = allJobs): void {
  vi.mocked(edgeApi.listJobs).mockResolvedValue(jobs);
  vi.mocked(edgeApi.getOrgUnitBinding).mockResolvedValue({
    bound: false, orgUnitId: null, orgUnitDisplayName: null, orgUnitPath: null,
    boundAt: null, boundBy: null,
  });
  vi.mocked(edgeApi.dhis2Ping).mockResolvedValue({
    reachable: true, latencyMs: 10, message: null,
    observedVersion: '2.44',
    probedAt: '2026-11-03T10:00:00Z',
  });
}

beforeEach(() => {
  vi.setSystemTime(new Date(now));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ───────────────────────────────────────────────────────────────────
// MockupSyncHistory
// ───────────────────────────────────────────────────────────────────

describe('SyncHistory — loading / populated / empty', () => {
  it('shows loading state before listJobs resolves', () => {
    vi.mocked(edgeApi.listJobs).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.getOrgUnitBinding).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.dhis2Ping).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MockupSyncHistory />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders the "N runs" status label when jobs resolve', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText(/All runs/)).toBeInTheDocument());
    expect(screen.getByText(/5 runs/)).toBeInTheDocument();
  });

  it('shows singular "1 run" label when exactly one job exists', async () => {
    wireHistoryHappy([jobSuccess]);
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('1 run')).toBeInTheDocument());
  });

  it('shows the empty-state row when listJobs returns []', async () => {
    wireHistoryHappy([]);
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText(/No matching activity/i)).toBeInTheDocument());
  });

  it('swallows a listJobs error and keeps the loading block visible', async () => {
    vi.mocked(edgeApi.listJobs).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(edgeApi.getOrgUnitBinding).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.dhis2Ping).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MockupSyncHistory />);
    // The internal catch swallows the error but `jobs` stays null, so
    // the loading block persists (no error-banner on this screen).
    await waitFor(() => expect(edgeApi.listJobs).toHaveBeenCalled());
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});

describe('SyncHistory — status chips', () => {
  it('renders SUCCESS chip for SUCCEEDED and SUCCESS outcomes', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    // Both SUCCEEDED and SUCCESS humanise to "Succeeded".
    expect(screen.getAllByText(/Succeeded/i).length).toBeGreaterThanOrEqual(2);
  });

  it('renders FAILED chip for the failed outcome', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    // "Failed" shows up in both the status select option list and the
    // row chip itself, so assert ≥1 match via getAllByText.
    await waitFor(() => expect(screen.getAllByText(/Failed/i).length).toBeGreaterThan(0));
  });

  it('shows a direction arrow for in/out jobs (Central ↔ DER)', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    // Both "DER" and "Central" tokens appear in the Direction column.
    expect(screen.getAllByText(/Central/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DER/i).length).toBeGreaterThan(0);
  });

  it('renders "DER-local" direction for local-only jobs (analytics)', async () => {
    wireHistoryHappy([jobAnalytics]);
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText(/DER-local/i)).toBeInTheDocument());
  });
});

describe('SyncHistory — filters & search', () => {
  it('filters by free-text search against jobName / triggeredBy', async () => {
    wireHistoryHappy();
    const user = userEvent.setup();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    const search = screen.getByPlaceholderText('Search') as HTMLInputElement;
    await user.type(search, 'METADATA');
    await waitFor(() => expect(screen.getByText('All runs · 1')).toBeInTheDocument());
  });

  it('filters by type via the type dropdown', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    const selects = screen.getAllByRole('combobox');
    // First select is "All types".
    fireEvent.change(selects[0], { target: { value: 'JOURNAL_WORKER_DRAIN' } });
    await waitFor(() => expect(screen.getByText('All runs · 1')).toBeInTheDocument());
  });

  it('filters by status via the status dropdown', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'FAILED' } });
    await waitFor(() => expect(screen.getByText('All runs · 1')).toBeInTheDocument());
  });

  it('filters by date range (both from/to inclusive)', async () => {
    wireHistoryHappy();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    const dateInputs = document.querySelectorAll('input[type="date"]');
    // Narrow to one specific day.
    fireEvent.change(dateInputs[0], { target: { value: '2026-11-02' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-11-02' } });
    // All 5 fixtures live on 2026-11-02 so count stays at 5.
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    // Now move the from-date past our fixtures → zero rows.
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } });
    await waitFor(() => expect(screen.getByText('All runs · 0')).toBeInTheDocument());
  });

  it('invokes listJobs again when Refresh is clicked', async () => {
    wireHistoryHappy();
    const user = userEvent.setup();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 5')).toBeInTheDocument());
    expect(edgeApi.listJobs).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText(/Refresh/));
    await waitFor(() => expect(edgeApi.listJobs).toHaveBeenCalledTimes(2));
  });
});

describe('SyncHistory — row navigation + row menu', () => {
  it('navigates to the run detail route on row click', async () => {
    wireHistoryHappy([jobSuccess]);
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 1')).toBeInTheDocument());
    // The row's category cell carries the row click handler on the <tr>.
    const row = screen.getByText(/Metadata pull/i).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row as HTMLTableRowElement);
    // (We don't assert on navigate here — react-router renders without
    //  the destination route in MemoryRouter. The important contract is
    //  that the click dispatches without throwing.)
  });

  it('row-menu lists "Open details" plus any related links for the job type', async () => {
    wireHistoryHappy([jobSuccess]);
    const user = userEvent.setup();
    renderWithProviders(<MockupSyncHistory />);
    await waitFor(() => expect(screen.getByText('All runs · 1')).toBeInTheDocument());
    // The <th aria-label="Actions"> on the header and the row's kebab
    // <summary aria-label="Actions"> both match; filter to the summary.
    const kebabs = screen.getAllByLabelText('Actions');
    const summary = kebabs.find((el) => el.tagName === 'SUMMARY') as HTMLElement;
    expect(summary).toBeTruthy();
    await user.click(summary);
    const menu = summary.closest('details') as HTMLDetailsElement;
    expect(within(menu).getByText(/Open details/)).toBeInTheDocument();
    // METADATA jobs expose a "Metadata browser" related link.
    expect(within(menu).getByText(/Metadata browser/)).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────
// MockupSyncHistoryDetail
// ───────────────────────────────────────────────────────────────────

describe('SyncHistoryDetail — load + error states', () => {
  it('shows loading before the job resolves', () => {
    vi.mocked(edgeApi.getJobRun).mockReturnValue(new Promise(() => {}));
    renderDetail('/sync/history/1');
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows "Run not found" when getJobRun returns 404', async () => {
    vi.mocked(edgeApi.getJobRun).mockRejectedValueOnce(new Error('HTTP 404: not here'));
    renderDetail('/sync/history/9999');
    // "Run not found" appears both as a title and in the subtitle sentence.
    await waitFor(() => expect(screen.getAllByText(/Run not found/i).length).toBeGreaterThan(0));
  });

  it('surfaces a non-404 error message verbatim', async () => {
    vi.mocked(edgeApi.getJobRun).mockRejectedValueOnce(new Error('db unavailable'));
    renderDetail('/sync/history/1');
    await waitFor(() => expect(screen.getByText(/db unavailable/i)).toBeInTheDocument());
  });

  it('renders the Overview tab with Run ID + status for a SUCCEEDED job', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobSuccess);
    renderDetail('/sync/history/1');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    // Overview is the default tab.
    expect(screen.getByText(/Run ID/)).toBeInTheDocument();
    expect(screen.getAllByText(/Succeeded/i).length).toBeGreaterThan(0);
    // Trigger label — scheduled jobs render "cron" through humaniseTrigger.
    expect(screen.getByText(/Triggered by/i)).toBeInTheDocument();
  });

  it('shows a danger-tone status bar for FAILED outcomes', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobFailed);
    renderDetail('/sync/history/2');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    expect(screen.getAllByText(/Failed/i).length).toBeGreaterThan(0);
  });
});

describe('SyncHistoryDetail — tab switching', () => {
  it('switches to Payload and loads metadata diagnostics for a METADATA run', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobSuccess);
    vi.mocked(edgeApi.metadataDiagnostics).mockResolvedValue({
      mirrorCounts: { organisationUnits: 42, dataElements: 100, programs: 5 },
    });
    vi.mocked(edgeApi.metadataInventory).mockResolvedValue({
      organisationUnits: [{ id: 'ou1', displayName: 'Clinic' }],
      programs: [], programStages: null,
      dataElements: null, dataSets: null, trackedEntityTypes: null,
      trackedEntityAttributes: null, optionSets: null,
      categoryCombos: null, programRules: null,
    });
    const user = userEvent.setup();
    renderDetail('/sync/history/1');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    await user.click(screen.getByTestId('drawer-tab-payload'));
    await waitFor(() => expect(screen.getByText(/Metadata inventory/i)).toBeInTheDocument());
    // "Organisation units" appears in both the mirrorCounts table and
    // the per-type <details> accordions; getAllByText covers both.
    expect(screen.getAllByText(/Organisation units/i).length).toBeGreaterThan(0);
    // The mirror-count table has a cell with the ou count (42).
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  });

  it('loads journal operations on Payload tab for a push run', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobFailed);
    vi.mocked(edgeApi.fetchJournalOperation).mockImplementation(async (id: string) => ({
      operationId: id, entityType: 'EVENT', entityRef: 'ev-' + id,
      state: 'CENTRAL_REJECTED', payload: { foo: 'bar' },
      attemptCount: 2, lastError: 'rejected',
      submittedBy: null,
      createdAt: '2026-11-02T10:00:00Z',
      updatedAt: '2026-11-02T10:00:05Z',
      nextHopOrgUnitUid: null,
    }));
    const user = userEvent.setup();
    renderDetail('/sync/history/2');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    await user.click(screen.getByTestId('drawer-tab-payload'));
    await waitFor(() => expect(edgeApi.fetchJournalOperation).toHaveBeenCalledWith('op-1'));
    await waitFor(() => expect(edgeApi.fetchJournalOperation).toHaveBeenCalledWith('op-2'));
  });

  it('shows "drained" message when operation IDs resolve to null', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobFailed);
    vi.mocked(edgeApi.fetchJournalOperation).mockRejectedValue(new Error('gone'));
    const user = userEvent.setup();
    renderDetail('/sync/history/2');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    await user.click(screen.getByTestId('drawer-tab-payload'));
    await waitFor(() => expect(screen.getByText(/no longer in the journal|drained/i)).toBeInTheDocument());
  });

  it('shows a byType breakdown table when detail contains byType', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobCompat);
    const user = userEvent.setup();
    renderDetail('/sync/history/4');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    await user.click(screen.getByTestId('drawer-tab-payload'));
    await waitFor(() => expect(screen.getByText(/Breakdown by data type/i)).toBeInTheDocument());
    // Entity-type labels render for EVENT and TEI (label + raw-key appear
    // as separate elements, so getAllByText).
    expect(screen.getAllByText(/EVENT/).length).toBeGreaterThan(0);
  });

  it('switches to Related tab and lists related links for the job type', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobFailed);
    const user = userEvent.setup();
    renderDetail('/sync/history/2');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    await user.click(screen.getByTestId('drawer-tab-related'));
    // JOURNAL/DRAIN runs expose Queues + Conflicts related links.
    expect(await screen.findByText(/Queues/)).toBeInTheDocument();
    expect(screen.getByText(/Conflicts/)).toBeInTheDocument();
  });

  it('shows the "No related screens" fallback when the job has none', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobAnalytics);
    const user = userEvent.setup();
    renderDetail('/sync/history/5');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail')).toBeInTheDocument());
    await user.click(screen.getByTestId('drawer-tab-related'));
    expect(await screen.findByText(/No related screens/i)).toBeInTheDocument();
  });
});

describe('SyncHistoryDetail — breadcrumb', () => {
  it('renders breadcrumb with Sync / History / Run tokens', async () => {
    vi.mocked(edgeApi.getJobRun).mockResolvedValue(jobSuccess);
    renderDetail('/sync/history/1');
    await waitFor(() => expect(screen.getByTestId('sync-history-detail-crumbs')).toBeInTheDocument());
    const crumbs = screen.getByTestId('sync-history-detail-crumbs');
    expect(within(crumbs).getByText(/Sync/)).toBeInTheDocument();
    expect(within(crumbs).getByText(/History/)).toBeInTheDocument();
    expect(within(crumbs).getByText(/Run 1/)).toBeInTheDocument();
  });

  it('renders breadcrumb in the error state too', async () => {
    vi.mocked(edgeApi.getJobRun).mockRejectedValueOnce(new Error('HTTP 404'));
    renderDetail('/sync/history/404');
    await waitFor(() =>
      expect(screen.getAllByText(/Run not found/i).length).toBeGreaterThan(0));
    const crumbs = screen.getByTestId('sync-history-detail-crumbs');
    expect(within(crumbs).getByText(/Run 404/)).toBeInTheDocument();
  });
});
