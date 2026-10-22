import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock AuthContext so AuthProvider doesn't do its real session probe —
// RequireAuth sees AUTHENTICATED immediately.
vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
  useAuth: () => ({
    state: { status: 'AUTHENTICATED', user: {
      userId: 'u', username: 'a', displayName: 'A', roles: ['ADMIN'], expiresAt: 'x',
    } },
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Stub every EA screen with a <div data-test> so the route table is
// what we're testing — not the screens themselves.
vi.mock('./screens/EACoreScreens', () => ({
  EASetupWelcome:      () => <div data-test="s-setup">setup</div>,
  EAUsersList:         () => <div data-test="s-users">users</div>,
  EAUserCreate:        () => <div data-test="s-usernew">usernew</div>,
  EACompatInspector:   () => <div data-test="s-compat">compat</div>,
  EACompatHistory:     () => <div data-test="s-compat-history">compat-history</div>,
  EAJobsList:          () => <div data-test="s-jobs">jobs</div>,
  EAJobTrigger:        () => <div data-test="s-jobs-trigger">jobs-trigger</div>,
  EADriftInspector:    () => <div data-test="s-drift">drift</div>,
  EAConflictList:      () => <div data-test="s-conflicts">conflicts</div>,
  EAConflictResolve:   ({ operationId }: { operationId: string }) =>
    <div data-test="s-conflict-resolve">resolve-{operationId}</div>,
  EAWorkerHealth:      () => <div data-test="s-worker">worker</div>,
  EAMetadataOverview:  () => <div data-test="s-metadata">metadata</div>,
  EAApprovalQueue:     () => <div data-test="s-approvals">approvals</div>,
  EACaptureWorkflowList: () => <div data-test="s-workflows">workflows</div>,
  EACaptureWorkflowDesigner: ({ workflowId }: { workflowId?: string }) =>
    <div data-test="s-workflow-designer">designer-{workflowId}</div>,
}));

vi.mock('./screens/EARemainderScreens', () => ({
  EARecoveryTools:     () => <div data-test="s-recovery">recovery</div>,
  EABackupList:        () => <div data-test="s-backup">backup</div>,
  EARestoreList:       () => <div data-test="s-restore">restore</div>,
  EAEvaluationReports: () => <div data-test="s-eval">eval</div>,
  EAAppsList:          () => <div data-test="s-apps">apps</div>,
  EADiagnostics:       () => <div data-test="s-diag">diag</div>,
  EASettings:          () => <div data-test="s-settings">settings</div>,
}));

// RequireAuth passes through unconditionally thanks to the mocked useAuth.
vi.mock('./components/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
}));

async function renderAt(route: string): Promise<void> {
  const { default: App } = await import('./App');
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
}

afterEach(() => vi.resetModules());

describe('App routing', () => {
  it('renders the admin nav + brand', async () => {
    await renderAt('/');
    expect(screen.getByTestId('brand').textContent).toBe('DER Administration');
    expect(screen.getByTestId('nav-provisioning')).toBeInTheDocument();
    expect(screen.getByTestId('nav-compat')).toBeInTheDocument();
    expect(screen.getByTestId('nav-worker')).toBeInTheDocument();
  });

  it.each([
    ['/',                        's-setup'],
    ['/provisioning/users',      's-users'],
    ['/provisioning/users/new',  's-usernew'],
    ['/compat',                  's-compat'],
    ['/compat/history',          's-compat-history'],
    ['/sync/jobs',               's-jobs'],
    ['/sync/jobs/trigger',       's-jobs-trigger'],
    ['/sync/drift',              's-drift'],
    ['/journal/conflicts',       's-conflicts'],
    ['/journal/worker',          's-worker'],
    ['/approvals',               's-approvals'],
    ['/workflows',               's-workflows'],
    ['/metadata',                's-metadata'],
    ['/recovery',                's-recovery'],
    ['/backup',                  's-backup'],
    ['/restore',                 's-restore'],
    ['/evaluation',              's-eval'],
    ['/apps',                    's-apps'],
    ['/diagnostics',             's-diag'],
    ['/settings',                's-settings'],
  ])('route %s mounts %s', async (route, testId) => {
    await renderAt(route);
    await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument());
  });

  it('/conflicts/:id passes the id into the resolve screen', async () => {
    await renderAt('/conflicts/op-xyz');
    await waitFor(() => expect(screen.getByTestId('s-conflict-resolve').textContent)
      .toBe('resolve-op-xyz'));
  });

  it('/workflows/:id passes the id into the designer', async () => {
    await renderAt('/workflows/wf-abc');
    await waitFor(() => expect(screen.getByTestId('s-workflow-designer').textContent)
      .toBe('designer-wf-abc'));
  });
});
