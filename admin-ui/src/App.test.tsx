import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock AuthContext so AuthProvider doesn't do its real session probe —
// RequireAuth sees AUTHENTICATED immediately.
vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
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
  EAWorkerHealth:      () => <div data-test="s-worker">worker</div>,
  EAMetadataOverview:  () => <div data-test="s-metadata">metadata</div>,
  EAApprovalQueue:     () => <div data-test="s-approvals">approvals</div>,
  EACaptureWorkflowList: () => <div data-test="s-workflows">workflows</div>,
  EACaptureWorkflowDesigner: ({ workflowId }: { workflowId?: string }) =>
    <div data-test="s-workflow-designer">designer-{workflowId}</div>,
  EADeviceFleet:       () => <div data-test="s-devices">devices</div>,
  EAFacilityAnalytics: () => <div data-test="s-analytics">analytics</div>,
  EAAuditVerify:       () => <div data-test="s-audit">audit</div>,
  EAAuditEvents:       () => <div data-test="s-audit-events">audit-events</div>,
  EAReferralInbox:     () => <div data-test="s-referral">referral</div>,
}));

vi.mock('./screens/workflow/WorkflowForm', () => ({
  WorkflowForm: () =>
    <div data-test="s-workflow-form">workflow-form</div>,
}));

vi.mock('./screens/workflow/WorkflowActivity', () => ({
  WorkflowActivity: () =>
    <div data-test="s-workflow-activity">workflow-activity</div>,
}));

vi.mock('./screens/workflow/WorkflowPeerExchange', () => ({
  WorkflowPeerExchange: () =>
    <div data-test="s-peer-exchange">peer-exchange</div>,
}));

vi.mock('./screens/workflow/WorkflowMonitoring', () => ({
  WorkflowMonitoring: () =>
    <div data-test="s-workflow-monitoring">workflow-monitoring</div>,
}));

vi.mock('./screens/EARemainderScreens', () => ({
  EARecoveryTools:     () => <div data-test="s-recovery">recovery</div>,
  EAEvaluationReports: () => <div data-test="s-eval">eval</div>,
  EADiagnostics:       () => <div data-test="s-diag">diag</div>,
  EASettings:          () => <div data-test="s-settings">settings</div>,
}));

vi.mock('./screens/AppCatalogue', () => ({
  AppCatalogue: () => <div data-test="ea-app-catalogue">catalogue</div>,
}));

// RequireAuth passes through unconditionally thanks to the mocked useAuth.
vi.mock('./components/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function renderAt(route: string): Promise<void> {
  const { default: App } = await import('./App');
  render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
}

afterEach(() => vi.resetModules());

describe('App routing', () => {
  it('renders the admin nav + brand', async () => {
    await renderAt('/');
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('nav-access')).toBeInTheDocument();
    // UI-2 — DHIS2 module id renamed from 'integration' to 'dhis2'.
    expect(screen.getByTestId('nav-dhis2')).toBeInTheDocument();
  });

  it.each([
    ['/setup-welcome-legacy',    's-setup'],
    ['/provisioning/users-legacy', 's-users'],
    ['/provisioning/users/new',  's-usernew'],
    ['/compat-legacy',           's-compat'],
    ['/compat/history',          's-compat-history'],
    ['/sync/jobs-legacy',        's-jobs'],
    ['/sync/jobs/trigger',       's-jobs-trigger'],
    ['/sync/drift-legacy',       's-drift'],
    ['/journal/conflicts-legacy', 's-conflicts'],
    ['/journal/worker-legacy',  's-worker'],
    ['/approvals-legacy',        's-approvals'],
    ['/workflows',                     's-workflow-activity'],
    ['/workflows/manage',              's-workflows'],
    ['/workflows/monitoring',          's-workflow-monitoring'],
    ['/workflows/peer-exchange',       's-peer-exchange'],
    ['/network/workflow-sharing',      's-peer-exchange'],
    ['/devices-legacy',          's-devices'],
    ['/analytics-legacy',        's-analytics'],
    ['/audit/verify',            's-audit'],
    ['/referral/inbox-legacy', 's-referral'],
    ['/metadata-legacy',         's-metadata'],
    ['/recovery',                's-recovery'],
    ['/evaluation',              's-eval'],
    ['/apps',                    'ea-app-catalogue'],
    ['/diagnostics',             's-diag'],
    ['/settings',                's-settings'],
  ])('route %s mounts %s', async (route, testId) => {
    await renderAt(route);
    await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument());
  });

  it('/conflicts/:id forwards to the attention detail route', async () => {
    await renderAt('/conflicts/op-xyz');
    /* AttentionDetailScreen (real, not stubbed) mounts; its initial
     * LoadingBlock or the detail root (data-test="conflict-detail")
     * is enough to prove the Navigate happened. */
    await waitFor(() => expect(
      screen.queryByTestId('loading')
      || screen.queryByTestId('conflict-detail')).toBeTruthy());
  });

  it('/workflows/:id/advanced passes the id into the designer', async () => {
    await renderAt('/workflows/wf-abc/advanced');
    await waitFor(() => expect(screen.getByTestId('s-workflow-designer').textContent)
      .toBe('designer-wf-abc'));
  });

  it('/workflows/:id renders the workflow form', async () => {
    await renderAt('/workflows/wf-abc');
    await waitFor(() => expect(screen.getByTestId('s-workflow-form')).toBeInTheDocument());
  });
});
