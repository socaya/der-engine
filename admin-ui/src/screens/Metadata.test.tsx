import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type * as edgeApi from '../api/edgeApi';

vi.mock('../api/edgeApi', () => ({
  metadataList: vi.fn(),
  listJobs: vi.fn(),
  drift: vi.fn(),
  compat: vi.fn(),
}));

import * as mockedApi from '../api/edgeApi';
import { MockupMetadata, MockupMetadataDetail } from './Metadata';

function makeItem(id: string, overrides: Record<string, unknown> = {}): edgeApi.MetadataListItem {
  return {
    id, displayName: `Item ${id}`, href: `/api/dataElements/${id}`,
    ...overrides,
  } as edgeApi.MetadataListItem;
}

function listResponse(resource: string, items: edgeApi.MetadataListItem[]) {
  return {
    [resource]: items,
    pager: { total: items.length, pageCount: 1, page: 1 },
  };
}

function renderList(route = '/dhis2/metadata') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/dhis2/metadata" element={<MockupMetadata />} />
        <Route path="/dhis2/metadata/:resource/:id" element={<DummyLanded />} />
      </Routes>
    </MemoryRouter>,
  );
}

function DummyLanded(): JSX.Element {
  return <div data-test="landed-detail">landed</div>;
}

function renderDetail(resource: string, id: string) {
  return render(
    <MemoryRouter initialEntries={[`/dhis2/metadata/${resource}/${id}`]}>
      <Routes>
        <Route path="/dhis2/metadata/:resource/:id" element={<MockupMetadataDetail />} />
        <Route path="/dhis2/metadata" element={<div data-test="landed-back">back</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(mockedApi.listJobs).mockResolvedValue([]);
  vi.mocked(mockedApi.drift).mockResolvedValue({ status: 'IN_SYNC' });
  vi.mocked(mockedApi.compat).mockResolvedValue({
    status: 'OK', probeReachable: true, profileName: 'V2_44',
  });
  // Default: every metadataList call returns three dataElements regardless of resource.
  vi.mocked(mockedApi.metadataList).mockImplementation(async (resource: string) =>
    listResponse(resource, [
      makeItem('UID-1', { code: 'CODE-1', shortName: 'Short 1', lastUpdated: '2026-11-01T00:00:00Z' }),
      makeItem('UID-2'),
      makeItem('UID-3'),
    ]) as never,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MockupMetadata (list)', () => {
  it('renders loading state before metadataList resolves', () => {
    vi.mocked(mockedApi.metadataList).mockReturnValue(new Promise(() => undefined));
    renderList();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders error block when the primary resource load rejects', async () => {
    vi.mocked(mockedApi.metadataList).mockRejectedValue(new Error('metadata-fail'));
    renderList();
    await waitFor(() => expect(screen.getByTestId('err-meta')).toBeInTheDocument());
    expect(screen.getByTestId('err-meta')).toHaveTextContent(/metadata-fail/);
  });

  it('renders error block when rejection is a non-Error value', async () => {
    vi.mocked(mockedApi.metadataList).mockRejectedValue('plain-fail');
    renderList();
    await waitFor(() => expect(screen.getByTestId('err-meta')).toHaveTextContent(/plain-fail/));
  });

  it('renders populated rows + health summary + default resource selectors', async () => {
    renderList();
    await waitFor(() => expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument());
    expect(screen.getByTestId('metadata-health')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-category')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-resource')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-action-sync')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-action-drift')).toBeInTheDocument();
  });

  it('renders empty-state row when the resource has zero items', async () => {
    vi.mocked(mockedApi.metadataList).mockImplementation(async (resource: string) =>
      listResponse(resource, []) as never);
    renderList();
    await waitFor(() => expect(screen.getByText(/No metadata mirrored for this resource/)).toBeInTheDocument());
  });

  it('search field filters current page rows and shows match count', async () => {
    renderList();
    await waitFor(() => expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument());
    const search = screen.getByPlaceholderText(/Search by name/);
    fireEvent.change(search, { target: { value: 'UID-1' } });
    expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument();
    expect(screen.queryByTestId('meta-row-UID-2')).toBeNull();
    expect(screen.getByText(/1 match on this page/)).toBeInTheDocument();
  });

  it('search with no matches shows the "No metadata matches" empty row', async () => {
    renderList();
    await waitFor(() => expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: 'ZZZZZ' } });
    expect(screen.getByText(/No metadata matches that search/)).toBeInTheDocument();
  });

  it('clicking a row navigates to the detail route', async () => {
    renderList();
    await waitFor(() => expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('meta-row-UID-1'));
    await waitFor(() => expect(screen.getByTestId('landed-detail')).toBeInTheDocument());
  });

  it('switching domain + resource triggers a new fetch', async () => {
    renderList();
    await waitFor(() => expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument());
    vi.mocked(mockedApi.metadataList).mockClear();
    // Switch the resource dropdown.
    fireEvent.change(screen.getByTestId('metadata-category'), { target: { value: 'Tracker' } });
    await waitFor(() => expect(mockedApi.metadataList).toHaveBeenCalled());
    const calls = vi.mocked(mockedApi.metadataList).mock.calls.map((c) => c[0]);
    // Snaps to the first tracker resource, 'programs'.
    expect(calls).toContain('programs');
  });

  it('respects ?resource= deep link to preselect a non-default resource', async () => {
    renderList('/dhis2/metadata?resource=programs');
    await waitFor(() => expect(screen.getByTestId('meta-row-UID-1')).toBeInTheDocument());
    const resourceSel = screen.getByTestId('metadata-resource') as HTMLSelectElement;
    expect(resourceSel.value).toBe('programs');
  });

  it('surfaces last-sync label when a successful metadata-pull job exists', async () => {
    vi.mocked(mockedApi.listJobs).mockResolvedValue([{
      runId: 1, jobName: 'metadata-pull',
      startedAt: '2026-11-01T00:00:00Z', finishedAt: '2026-11-01T00:01:00Z',
      outcome: 'SUCCESS', durationMs: 60000, detail: null, triggeredBy: 'cron',
    }]);
    renderList();
    await waitFor(() => expect(screen.getByText(/Last successful sync/)).toBeInTheDocument());
  });

  it('surfaces failed-sync label when the latest job did not succeed', async () => {
    vi.mocked(mockedApi.listJobs).mockResolvedValue([{
      runId: 2, jobName: 'metadata-pull',
      startedAt: '2026-11-01T00:00:00Z', finishedAt: '2026-11-01T00:00:30Z',
      outcome: 'FAILED', durationMs: 30000, detail: 'boom', triggeredBy: 'cron',
    }]);
    renderList();
    await waitFor(() => expect(screen.getByText(/Last attempt/)).toBeInTheDocument());
  });

  it('reflects DRIFT status in the health summary', async () => {
    vi.mocked(mockedApi.drift).mockResolvedValue({ status: 'DRIFT' });
    renderList();
    await waitFor(() => expect(screen.getByText(/Drift detected/)).toBeInTheDocument());
  });

  it('reflects STALE status in the health summary', async () => {
    vi.mocked(mockedApi.drift).mockResolvedValue({ status: 'STALE' });
    renderList();
    await waitFor(() => expect(screen.getByText(/Stale/)).toBeInTheDocument());
  });
});

describe('MockupMetadataDetail', () => {
  it('renders loading state before fetch resolves', () => {
    vi.mocked(mockedApi.metadataList).mockReturnValue(new Promise(() => undefined));
    renderDetail('dataElements', 'UID-1');
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders error block when the fetch rejects', async () => {
    vi.mocked(mockedApi.metadataList).mockRejectedValue(new Error('load-fail'));
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('err-meta-detail')).toBeInTheDocument());
  });

  it('renders not-found error when the record is absent from the mirror', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('OTHER'),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('err-meta-detail')).toHaveTextContent(/Record not found/));
  });

  it('renders populated detail with Summary tab active by default', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('UID-1', {
        code: 'CODE-1', shortName: 'Short 1', lastUpdated: '2026-11-01T00:00:00Z',
        valueType: 'INTEGER', aggregationType: 'SUM', domainType: 'AGGREGATE',
        categoryCombo: { id: 'cc-1', displayName: 'Default' },
        zeroIsSignificant: true, optionSet: { id: 'os-1', displayName: 'Options' },
      }),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    // Name shows in header + repeated inside the drawer heading.
    expect(screen.getAllByText('Item UID-1').length).toBeGreaterThan(0);
    // Type-specific summary rows for a dataElement.
    expect(screen.getByText(/Value type/)).toBeInTheDocument();
    expect(screen.getByText('INTEGER')).toBeInTheDocument();
    expect(screen.getByText(/Aggregation type/)).toBeInTheDocument();
    expect(screen.getByText('SUM')).toBeInTheDocument();
  });

  it('switches to Relationships tab and shows extracted refs', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('UID-1', {
        categoryCombo: { id: 'cc-1', displayName: 'Default' },
        organisationUnits: [
          { id: 'ou-1', displayName: 'Clinic One' },
          { id: 'ou-2', displayName: 'Clinic Two' },
        ],
      }),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    // Click the Relationships tab via its label.
    await userEvent.click(screen.getByRole('tab', { name: /Relationships/i }));
    await waitFor(() => expect(screen.getByTestId('meta-relationships')).toBeInTheDocument());
    expect(screen.getByText(/Clinic One/)).toBeInTheDocument();
  });

  it('relationships tab shows empty state when no refs present', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('UID-1'),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /Relationships/i }));
    expect(screen.getByText(/No related metadata references/)).toBeInTheDocument();
  });

  it('rules tab surfaces program-rule actions and expressions', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('programRules', [
      makeItem('UID-1', {
        condition: 'd2:hasValue(#{value})',
        programRuleActions: [
          { programRuleActionType: 'HIDEFIELD', data: '#{foo}' },
          { programRuleActionType: 'SHOWWARNING', content: 'Warning' },
        ],
      }),
    ]) as never);
    renderDetail('programRules', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /Rules/i }));
    await waitFor(() => expect(screen.getByTestId('meta-rules')).toBeInTheDocument());
    expect(screen.getByText('HIDEFIELD')).toBeInTheDocument();
    expect(screen.getByText('SHOWWARNING')).toBeInTheDocument();
  });

  it('rules tab shows empty copy when no rule-ish fields are set', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('UID-1'),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /Rules/i }));
    expect(screen.getByText(/No program rules/)).toBeInTheDocument();
  });

  it('raw tab renders the JsonViewer', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('UID-1', { foo: 'bar' }),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /Raw JSON/i }));
    expect(screen.getByText(/Diagnostic view/)).toBeInTheDocument();
  });

  it('type-specific rows render for dataSets', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataSets', [
      makeItem('DS-1', {
        periodType: 'Monthly',
        categoryCombo: { id: 'cc-1', displayName: 'Default' },
        dataSetElements: [{}, {}, {}],
        organisationUnits: [{}],
        formType: 'DEFAULT', expiryDays: 7, openFuturePeriods: 2,
      }),
    ]) as never);
    renderDetail('dataSets', 'DS-1');
    await waitFor(() => expect(screen.getByText(/Period type/)).toBeInTheDocument());
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('DEFAULT')).toBeInTheDocument();
  });

  it('type-specific rows render for programs', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('programs', [
      makeItem('P-1', {
        programType: 'WITH_REGISTRATION',
        trackedEntityType: { id: 'tet-1', displayName: 'Person' },
        programStages: [{}, {}],
        programRuleVariables: [{}],
        onlyEnrollOnce: true, displayFrontPageList: false,
      }),
    ]) as never);
    renderDetail('programs', 'P-1');
    await waitFor(() => expect(screen.getByText(/Program type/)).toBeInTheDocument());
    expect(screen.getByText('WITH_REGISTRATION')).toBeInTheDocument();
  });

  it('type-specific rows render for programStages', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('programStages', [
      makeItem('PS-1', {
        program: { id: 'P-1', displayName: 'HIV' },
        repeatable: true, autoGenerateEvent: false,
        programStageDataElements: [{}], programStageSections: [{}, {}],
        openAfterEnrollment: true,
      }),
    ]) as never);
    renderDetail('programStages', 'PS-1');
    await waitFor(() => expect(screen.getByText(/Repeatable/)).toBeInTheDocument());
  });

  it('type-specific rows render for organisationUnits', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('organisationUnits', [
      makeItem('OU-1', {
        level: 3, path: '/root/a/OU-1',
        parent: { id: 'p-1', displayName: 'Parent' },
        openingDate: '2020-01-01', closedDate: null,
      }),
    ]) as never);
    renderDetail('organisationUnits', 'OU-1');
    await waitFor(() => expect(screen.getByText(/Level/)).toBeInTheDocument());
    expect(screen.getByText('/root/a/OU-1')).toBeInTheDocument();
  });

  it('type-specific rows render for trackedEntityAttributes', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('trackedEntityAttributes', [
      makeItem('TEA-1', {
        valueType: 'TEXT', unique: true, pattern: '^[A-Z]+$', confidential: false,
      }),
    ]) as never);
    renderDetail('trackedEntityAttributes', 'TEA-1');
    await waitFor(() => expect(screen.getByText('TEXT')).toBeInTheDocument());
  });

  it('type-specific rows render for indicators', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('indicators', [
      makeItem('IND-1', {
        numerator: '#{a}', denominator: '#{b}',
        indicatorType: { id: 'it-1', displayName: 'Simple' },
      }),
    ]) as never);
    renderDetail('indicators', 'IND-1');
    await waitFor(() => expect(screen.getByText(/Numerator/)).toBeInTheDocument());
  });

  it('type-specific rows render for userGroups', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('userGroups', [
      makeItem('UG-1', { users: [{}, {}], managedByGroups: [{}] }),
    ]) as never);
    renderDetail('userGroups', 'UG-1');
    await waitFor(() => expect(screen.getByText(/Members/)).toBeInTheDocument());
  });

  it('type-specific rows render for userRoles', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('userRoles', [
      makeItem('UR-1', { authorities: ['A', 'B'], users: [{}] }),
    ]) as never);
    renderDetail('userRoles', 'UR-1');
    await waitFor(() => expect(screen.getByText(/Authorities/)).toBeInTheDocument());
  });

  it('resources without a type-specific case fall back to generic summary only', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('documents', [
      makeItem('DOC-1'),
    ]) as never);
    renderDetail('documents', 'DOC-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    // Generic rows are present even without type-specific fields.
    expect(screen.getByText('Code')).toBeInTheDocument();
  });

  it('array relationships truncate at 10 items with a "more" marker', async () => {
    vi.mocked(mockedApi.metadataList).mockResolvedValue(listResponse('dataElements', [
      makeItem('UID-1', {
        organisationUnits: Array.from({ length: 15 }, (_, i) => ({
          id: `ou-${i}`, displayName: `OU ${i}`,
        })),
      }),
    ]) as never);
    renderDetail('dataElements', 'UID-1');
    await waitFor(() => expect(screen.getByTestId('meta-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /Relationships/i }));
    expect(screen.getByText(/…5 more/)).toBeInTheDocument();
  });
});
