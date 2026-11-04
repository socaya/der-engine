import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowPeers } from './WorkflowPeers';
import type * as edgeApi from '../../api/edgeApi';

type Api = NonNullable<Parameters<typeof WorkflowPeers>[0]>['api'];

function mkApi(partial: Partial<Record<keyof NonNullable<Api>, unknown>>): Api {
  const peers: edgeApi.WorkflowPeer[] = [{
    peerId: 'p1-aaaaaaaaaaa', displayName: 'Nakivale', baseUrl: 'https://nak.local',
    addedAt: '2026-10-01T00:00:00Z', addedBy: 'alice',
    lastPushAt: '2026-11-01T00:00:00Z', lastPushStatus: 'OK',
    authUsername: 'der-peer', directImport: false,
  }, {
    peerId: 'p2-bbbbbbbbbbb', displayName: 'Kampala', baseUrl: 'https://k.local',
    addedAt: '2026-10-02T00:00:00Z', addedBy: null,
    lastPushAt: null, lastPushStatus: null,
    authUsername: null, directImport: true,
  }];
  const workflows: edgeApi.CaptureWorkflowSummary[] = [{
    workflowId: 'w1', displayName: 'ANC-1',
    boundMetadataKind: 'PROGRAM', metadataRef: 'prog-1',
    status: 'PUBLISHED',
    publishedAt: '2026-10-01T00:00:00Z', isDraft: false,
    draftFromVersion: null, nextDraftFromVersion: null,
    designerBaseline: null,
  } as never];
  const base: Record<string, unknown> = {
    listWorkflowPeers: vi.fn().mockResolvedValue({ peers }),
    listWorkflows: vi.fn().mockResolvedValue({ workflows }),
    addWorkflowPeer: vi.fn().mockResolvedValue({}),
    deleteWorkflowPeer: vi.fn().mockResolvedValue({}),
    pushWorkflowToPeer: vi.fn().mockResolvedValue({ status: 'OK' }),
    setWorkflowPeerCredentials: vi.fn().mockResolvedValue({}),
    setWorkflowPeerTrust: vi.fn().mockResolvedValue({}),
  };
  return { ...base, ...partial } as Api;
}

afterEach(() => vi.restoreAllMocks());

describe('WorkflowPeers screen', () => {
  it('shows loading state before api resolves', () => {
    const api = mkApi({
      listWorkflowPeers: vi.fn(() => new Promise(() => undefined)),
      listWorkflows: vi.fn(() => new Promise(() => undefined)),
    });
    renderWithProviders(<WorkflowPeers api={api} />);
    expect(screen.getByTestId('peers-loading')).toBeInTheDocument();
  });
  it('shows error state when api rejects', async () => {
    const api = mkApi({
      listWorkflowPeers: vi.fn().mockRejectedValue(new Error('boom')),
    });
    renderWithProviders(<WorkflowPeers api={api} />);
    await waitFor(() =>
      expect(screen.getByTestId('peers-error')).toBeInTheDocument());
    expect(screen.getByTestId('peers-error')).toHaveTextContent(/boom/);
  });
  it('renders populated peer list', async () => {
    renderWithProviders(<WorkflowPeers api={mkApi({})} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    expect(screen.getByText('Nakivale')).toBeInTheDocument();
    expect(screen.getByText('Kampala')).toBeInTheDocument();
    /* Auth state rendered as title-cased Status chips. */
    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
  });
  it('renders empty state when there are no peers', async () => {
    const api = mkApi({
      listWorkflowPeers: vi.fn().mockResolvedValue({ peers: [] }),
    });
    renderWithProviders(<WorkflowPeers api={api} />);
    await waitFor(() =>
      expect(screen.getByTestId('peers-empty')).toBeInTheDocument());
  });
  it('add-peer flow calls addWorkflowPeer with trimmed inputs', async () => {
    const add = vi.fn().mockResolvedValue({});
    const api = mkApi({ addWorkflowPeer: add });
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPeers api={api} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    await user.type(screen.getByTestId('peers-new-name'), ' Clinic ');
    await user.type(screen.getByTestId('peers-new-url'), ' https://c.local ');
    await user.type(screen.getByTestId('peers-new-auth-user'), ' u1 ');
    await user.type(screen.getByTestId('peers-new-auth-pass'), 'secret');
    await user.click(screen.getByTestId('peers-add'));
    await waitFor(() => expect(add).toHaveBeenCalledWith({
      displayName: 'Clinic', baseUrl: 'https://c.local',
      authUsername: 'u1', authPassword: 'secret',
    }));
  });
  it('add-peer button is disabled with empty required fields', async () => {
    renderWithProviders(<WorkflowPeers api={mkApi({})} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    expect((screen.getByTestId('peers-add') as HTMLButtonElement).disabled).toBe(true);
  });
  it('remove button calls deleteWorkflowPeer', async () => {
    const del = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPeers api={mkApi({ deleteWorkflowPeer: del })} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    await user.click(screen.getByTestId('peers-row-p1-aaaaaaaaaaa-remove'));
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith('p1-aaaaaaaaaaa'));
  });
  it('trust checkbox toggles setWorkflowPeerTrust', async () => {
    const trust = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPeers api={mkApi({ setWorkflowPeerTrust: trust })} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    await user.click(screen.getByTestId('peers-row-p1-aaaaaaaaaaa-trust'));
    await waitFor(() =>
      expect(trust).toHaveBeenCalledWith('p1-aaaaaaaaaaa', true));
  });
  it('push flow selects a workflow and calls pushWorkflowToPeer', async () => {
    const push = vi.fn().mockResolvedValue({ status: 'OK' });
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPeers api={mkApi({ pushWorkflowToPeer: push })} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    const sel = screen.getByTestId('peers-row-p1-aaaaaaaaaaa-wf') as HTMLSelectElement;
    await user.selectOptions(sel, 'w1');
    await user.click(screen.getByTestId('peers-row-p1-aaaaaaaaaaa-push'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('p1-aaaaaaaaaaa', 'w1'));
    expect(screen.getByTestId('peers-last-result')).toBeInTheDocument();
  });
  it('push surfaces error when api rejects', async () => {
    const push = vi.fn().mockRejectedValue(new Error('push-fail'));
    const user = userEvent.setup();
    renderWithProviders(<WorkflowPeers api={mkApi({ pushWorkflowToPeer: push })} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    const sel = screen.getByTestId('peers-row-p1-aaaaaaaaaaa-wf') as HTMLSelectElement;
    await user.selectOptions(sel, 'w1');
    await user.click(screen.getByTestId('peers-row-p1-aaaaaaaaaaa-push'));
    await waitFor(() =>
      expect(screen.getByTestId('peers-last-result'))
        .toHaveTextContent(/push-fail/));
  });
  it('credential rotation saves via setWorkflowPeerCredentials', async () => {
    const save = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(
      <WorkflowPeers api={mkApi({ setWorkflowPeerCredentials: save })} />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    await user.type(
      screen.getByTestId('peers-row-p1-aaaaaaaaaaa-cred-user'), 'u2');
    await user.type(
      screen.getByTestId('peers-row-p1-aaaaaaaaaaa-cred-pass'), 'p2');
    await user.click(screen.getByTestId('peers-row-p1-aaaaaaaaaaa-cred-save'));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith('p1-aaaaaaaaaaa', 'u2', 'p2'));
  });
  it('embedded=true suppresses the HeroHeader', async () => {
    renderWithProviders(<WorkflowPeers api={mkApi({})} embedded />);
    await waitFor(() => expect(screen.getByTestId('peers-table')).toBeInTheDocument());
    expect(screen.queryByText('Peers', { selector: 'h1' })).toBeInTheDocument(); // visually-hidden h1
  });
});
