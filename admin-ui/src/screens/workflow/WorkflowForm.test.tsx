import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowForm } from './WorkflowForm';
import * as edgeApi from '../../api/edgeApi';
import * as md from './wizardMetadata';

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  (globalThis as unknown as { crypto: Crypto }).crypto ??= {} as never;
  if (!globalThis.crypto.randomUUID) {
    (globalThis.crypto as unknown as { randomUUID: () => string })
      .randomUUID = () => 'uuid';
  }
});

function renderAtNew(api: Partial<typeof edgeApi>): void {
  renderWithProviders(
    <Routes>
      <Route path="/workflows/new" element={
        <WorkflowForm api={api as never} />
      } />
      <Route path="/workflows" element={<div data-test="redirected-list" />} />
      <Route path="/workflows/:id" element={<div data-test="redirected-detail" />} />
    </Routes>,
    { route: '/workflows/new' });
}

function renderAtEdit(id: string, api: Partial<typeof edgeApi>): void {
  renderWithProviders(
    <Routes>
      <Route path="/workflows/:id/edit" element={
        <WorkflowForm api={api as never} />
      } />
      <Route path="/workflows" element={<div data-test="redirected-list" />} />
    </Routes>,
    { route: `/workflows/${id}/edit` });
}

describe('WorkflowForm — new mode', () => {
  it('renders the hero + core form controls', async () => {
    renderAtNew({ listDevices: vi.fn().mockResolvedValue({ devices: [] }) });
    expect(await screen.findByTestId('wf-form-root')).toBeInTheDocument();
    expect(screen.getByTestId('wf-form-name')).toBeInTheDocument();
    expect(screen.getByTestId('wf-form-enabled')).toBeInTheDocument();
    expect(screen.getByTestId('wf-form-approval')).toBeInTheDocument();
    expect(screen.getByTestId('wf-form-default-device')).toBeInTheDocument();
    expect(screen.getByTestId('wf-form-type')).toBeInTheDocument();
    // Save disabled until name + metadata chosen.
    expect(screen.getByTestId('wf-form-save')).toBeDisabled();
  });

  it('type=AGGREGATE loads datasets and surfaces the picker', async () => {
    vi.spyOn(md, 'listDataSets').mockResolvedValue([
      { id: 'ds-1', displayName: 'Weekly report' },
    ]);
    renderAtNew({ listDevices: vi.fn().mockResolvedValue({ devices: [] }) });
    await screen.findByTestId('wf-form-root');
    await userEvent.selectOptions(screen.getByTestId('wf-form-type'), 'AGGREGATE');
    await waitFor(() => expect(
      screen.getByTestId('wf-form-metadata-combo')).toBeInTheDocument());
    const input = screen.getByTestId('wf-form-metadata-search');
    await userEvent.click(input);
    await waitFor(() => expect(
      screen.getByTestId('wf-form-metadata-list')).toBeInTheDocument());
  });

  it('type=EVENT loads event programs', async () => {
    const spy = vi.spyOn(md, 'listPrograms').mockResolvedValue([
      { id: 'p-1', displayName: 'HTS',
        programType: 'WITHOUT_REGISTRATION' },
    ]);
    renderAtNew({ listDevices: vi.fn().mockResolvedValue({ devices: [] }) });
    await screen.findByTestId('wf-form-root');
    await userEvent.selectOptions(screen.getByTestId('wf-form-type'), 'EVENT');
    await waitFor(() => expect(spy).toHaveBeenCalledWith('EVENT'));
  });

  it('type=TRACKER loads tracker programs', async () => {
    const spy = vi.spyOn(md, 'listPrograms').mockResolvedValue([]);
    renderAtNew({ listDevices: vi.fn().mockResolvedValue({ devices: [] }) });
    await screen.findByTestId('wf-form-root');
    await userEvent.selectOptions(screen.getByTestId('wf-form-type'), 'TRACKER');
    await waitFor(() => expect(spy).toHaveBeenCalledWith('TRACKER'));
  });

  it('error loading metadata surfaces load-error block', async () => {
    vi.spyOn(md, 'listPrograms')
      .mockRejectedValue(new Error('no programs'));
    renderAtNew({ listDevices: vi.fn().mockResolvedValue({ devices: [] }) });
    await screen.findByTestId('wf-form-root');
    await userEvent.selectOptions(screen.getByTestId('wf-form-type'), 'TRACKER');
    await waitFor(() => expect(
      screen.getByTestId('wf-form-load-error')).toBeInTheDocument());
  });

  it('end-to-end create happy path invokes saveWorkflow', async () => {
    vi.spyOn(md, 'listDataSets').mockResolvedValue([
      { id: 'ds-1', displayName: 'Weekly report' },
    ]);
    vi.spyOn(md, 'listDataSetSections').mockResolvedValue([
      { id: 'sec-1', displayName: 'Births', sectionKind: 'DATASET_SECTION' },
    ]);
    vi.spyOn(md, 'listFieldCandidates').mockResolvedValue([
      { id: 'de-1', displayName: 'Count', compulsory: false },
    ]);
    const api = {
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      getWorkflow: vi.fn(),
      saveWorkflow: vi.fn().mockResolvedValue({
        workflowId: 'wf-new',
      }),
    };
    renderAtNew(api);
    await screen.findByTestId('wf-form-root');
    // Fill name.
    await userEvent.type(screen.getByTestId('wf-form-name'), 'ANC v1');
    // Pick aggregate type.
    await userEvent.selectOptions(screen.getByTestId('wf-form-type'), 'AGGREGATE');
    // Pick dataset via combo (click option).
    await waitFor(() => expect(
      screen.getByTestId('wf-form-metadata-search')).not.toBeDisabled());
    await userEvent.click(screen.getByTestId('wf-form-metadata-search'));
    await waitFor(() => expect(
      screen.getByTestId('wf-form-metadata-list')).toBeInTheDocument());
    const list = screen.getByTestId('wf-form-metadata-list');
    await userEvent.click(within(list).getByText('Weekly report'));
    // Steps load; row-0 should be auto-included (<= 6 sections).
    await waitFor(() => expect(screen.getByTestId('wf-form-steps'))
      .toBeInTheDocument());
    // Save: button becomes enabled once a row is included.
    await waitFor(() => expect(screen.getByTestId('wf-form-save'))
      .not.toBeDisabled());
    await userEvent.click(screen.getByTestId('wf-form-save'));
    await waitFor(() => expect(api.saveWorkflow).toHaveBeenCalled());
    const payload = api.saveWorkflow.mock.calls[0][0];
    expect(payload.displayName).toBe('ANC v1');
    expect(payload.boundMetadataKind).toBe('DATA_SET');
    expect(payload.boundMetadataId).toBe('ds-1');
    expect(payload.steps.length).toBeGreaterThan(0);
  });

  it('save failure surfaces save-error block', async () => {
    vi.spyOn(md, 'listDataSets').mockResolvedValue([
      { id: 'ds-1', displayName: 'Weekly report' },
    ]);
    vi.spyOn(md, 'listDataSetSections').mockResolvedValue([
      { id: 'sec-1', displayName: 'Births', sectionKind: 'DATASET_SECTION' },
    ]);
    vi.spyOn(md, 'listFieldCandidates').mockResolvedValue([]);
    const api = {
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      getWorkflow: vi.fn(),
      saveWorkflow: vi.fn().mockRejectedValue(new Error('bad input')),
    };
    renderAtNew(api);
    await screen.findByTestId('wf-form-root');
    await userEvent.type(screen.getByTestId('wf-form-name'), 'X');
    await userEvent.selectOptions(screen.getByTestId('wf-form-type'), 'AGGREGATE');
    await userEvent.click(screen.getByTestId('wf-form-metadata-search'));
    await waitFor(() => expect(
      screen.getByTestId('wf-form-metadata-list')).toBeInTheDocument());
    await userEvent.click(within(
      screen.getByTestId('wf-form-metadata-list')).getByText('Weekly report'));
    await waitFor(() => expect(screen.getByTestId('wf-form-steps'))
      .toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('wf-form-save'))
      .not.toBeDisabled());
    await userEvent.click(screen.getByTestId('wf-form-save'));
    await waitFor(() => expect(screen.getByTestId('wf-form-save-error'))
      .toBeInTheDocument());
  });
});

describe('WorkflowForm — edit mode', () => {
  const existing: edgeApi.CaptureWorkflowSummary = {
    workflowId: 'wf-99',
    displayName: 'ANC existing',
    boundMetadataKind: 'DATA_SET',
    boundMetadataId: 'ds-1',
    enabled: true, version: 1,
    requiresApproval: false, defaultDeviceId: null,
    steps: [
      { stepId: 'st-1', ordinal: 0, displayName: 'Births',
        ownerRole: 'OPERATOR', ownerDeviceId: null,
        stepKind: 'CAPTURE', sectionKind: 'DATASET_SECTION',
        sectionRef: 'sec-1',
        fields: [{ fieldRef: 'de-1', requirement: 'REQUIRED' }] },
    ],
    dependencies: [],
  };

  it('shows loading then populates existing workflow', async () => {
    vi.spyOn(md, 'detectWorkflowType').mockResolvedValue({
      type: 'AGGREGATE',
      metadata: { id: 'ds-1', displayName: 'Weekly report' },
    });
    vi.spyOn(md, 'listDataSetSections').mockResolvedValue([
      { id: 'sec-1', displayName: 'Births', sectionKind: 'DATASET_SECTION' },
    ]);
    vi.spyOn(edgeApi, 'listSnapshots').mockResolvedValue({ snapshots: [] });
    vi.spyOn(edgeApi, 'getWorkflowPin').mockResolvedValue({ workflowId: 'wf-stub', snapshotId: null });
    const api = {
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      getWorkflow: vi.fn().mockResolvedValue(existing),
      saveWorkflow: vi.fn(),
    };
    renderAtEdit('wf-99', api);
    await waitFor(() => expect(screen.getByTestId('wf-form-root'))
      .toBeInTheDocument());
    // Name prepopulated.
    const name = screen.getByTestId('wf-form-name') as HTMLInputElement;
    expect(name.value).toBe('ANC existing');
    // Advanced link shows in edit mode.
    expect(screen.getByTestId('wf-form-advanced')).toBeInTheDocument();
    // Dataset is locked.
    expect(screen.getByTestId('wf-form-chosen-locked')).toBeInTheDocument();
  });

  it('load error from getWorkflow lands in loading→load-error', async () => {
    vi.spyOn(edgeApi, 'listSnapshots').mockResolvedValue({ snapshots: [] });
    vi.spyOn(edgeApi, 'getWorkflowPin').mockResolvedValue({ workflowId: 'wf-stub', snapshotId: null });
    const api = {
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      getWorkflow: vi.fn().mockRejectedValue(new Error('404')),
      saveWorkflow: vi.fn(),
    };
    renderAtEdit('wf-missing', api);
    await waitFor(() => expect(
      screen.getByTestId('wf-form-load-error')).toBeInTheDocument());
  });

  it('metadata-pin control appears when snapshots exist and changes pin', async () => {
    vi.spyOn(md, 'detectWorkflowType').mockResolvedValue({
      type: 'AGGREGATE',
      metadata: { id: 'ds-1', displayName: 'Weekly report' },
    });
    vi.spyOn(md, 'listDataSetSections').mockResolvedValue([
      { id: 'sec-1', displayName: 'Births', sectionKind: 'DATASET_SECTION' },
    ]);
    vi.spyOn(edgeApi, 'listSnapshots').mockResolvedValue({
      snapshots: [{
        snapshotId: 7, importedFrom: 'x', importedBy: null,
        importedAt: '2026-11-01T10:00:00Z',
        counts: {
          organisationUnits: 0, dataElements: 0, dataSets: 0,
          programs: 0, trackedEntityTypes: 0,
        },
        centralVersion: null, centralRevision: null, fingerprint: null,
        retiredAt: null, retiredBy: null,
        pinnedWorkflows: 0, status: 'ACTIVE',
      }],
    });
    vi.spyOn(edgeApi, 'getWorkflowPin').mockResolvedValue({ workflowId: 'wf-stub', snapshotId: null });
    const setPin = vi.spyOn(edgeApi, 'setWorkflowPin').mockResolvedValue({});
    const api = {
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      getWorkflow: vi.fn().mockResolvedValue(existing),
      saveWorkflow: vi.fn(),
    };
    renderAtEdit('wf-99', api);
    await waitFor(() => expect(screen.getByTestId('wf-form-pin'))
      .toBeInTheDocument());
    await userEvent.selectOptions(screen.getByTestId('wf-form-pin'), '7');
    await waitFor(() => expect(setPin).toHaveBeenCalledWith('wf-99', 7));
  });

  it('non-native sectionKind renders as advanced row with hidden-sections tag', async () => {
    const legacy: edgeApi.CaptureWorkflowSummary = {
      ...existing,
      steps: [
        ...existing.steps,
        {
          stepId: 'st-adv', ordinal: 1, displayName: 'Legacy step',
          ownerRole: 'OPERATOR', ownerDeviceId: null,
          stepKind: 'CAPTURE',
          sectionKind: 'DATA_ELEMENT' as never,
          sectionRef: 'unknown-ref',
          fields: [],
        },
      ],
    };
    vi.spyOn(md, 'detectWorkflowType').mockResolvedValue({
      type: 'AGGREGATE',
      metadata: { id: 'ds-1', displayName: 'Weekly report' },
    });
    vi.spyOn(md, 'listDataSetSections').mockResolvedValue([
      { id: 'sec-1', displayName: 'Births', sectionKind: 'DATASET_SECTION' },
    ]);
    vi.spyOn(edgeApi, 'listSnapshots').mockResolvedValue({ snapshots: [] });
    vi.spyOn(edgeApi, 'getWorkflowPin').mockResolvedValue({ workflowId: 'wf-stub', snapshotId: null });
    const api = {
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      getWorkflow: vi.fn().mockResolvedValue(legacy),
      saveWorkflow: vi.fn(),
    };
    renderAtEdit('wf-99', api);
    await waitFor(() => expect(screen.getByTestId('wf-form-steps'))
      .toBeInTheDocument());
    // The ad-hoc step appears as a wf-form-row-* with "advanced · <KIND>" text.
    expect(screen.getAllByText(/advanced · DATA_ELEMENT/).length)
      .toBeGreaterThan(0);
  });
});
