import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  CapDashboard, CapSystemInformation, CapCentralConnection,
  CapOrgUnitBinding, CapProgramRules, CapSyncOverview, CapSyncHistory,
  CapDataQueues, CapMetadataSync, CapDataExchange,
  CapSyncSettings, CapSyncSchedule, CapWorkflowRuns, CapStepAssignments,
  CapReferralHistory, CapDataOverview, CapAggregate, CapEvents, CapTracker,
  CapDrafts, CapMaintenance, CapUserMappings, CapRoles, CapSessions,
  CapCredentials, CapDeviceEnrolment, CapOwnership, CapConnections,
  CapDeviceDiagnostics, CapOperatorMetrics,
} from './CapabilityScreens';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* CapabilityScreens.tsx exports 35 top-level sub-screens, each
 * calling one or more edgeApi helpers at mount. For a baseline
 * depth-lift we drive every spy-able export to a never-resolving
 * promise so each sub-screen renders its LoadingBlock. This gives
 * line coverage of the imports + mount graphs without having to
 * synthesise 35 unrelated response shapes.
 *
 * The six sub-screens with real logic (CapDrafts, CapMaintenance,
 * CapWorkflowRuns, CapOperatorMetrics, etc.) get follow-up
 * depth-lifts in dedicated test files when needed; this file
 * just establishes the mount surface. */
function stubEverythingPending(): void {
  const noop = (): Promise<never> => new Promise(() => undefined);
  const mod = edgeApi as unknown as Record<string, unknown>;
  for (const key of Object.keys(mod)) {
    if (typeof mod[key] === 'function') {
      try {
        (vi.spyOn(mod, key as never) as { mockImplementation(impl: unknown): unknown })
          .mockImplementation(noop);
      } catch { /* exports like EdgeApiError can't be spied */ }
    }
  }
}

interface MountCase { name: string; component: () => JSX.Element; route?: string }

const cases: MountCase[] = [
  { name: 'CapDashboard',          component: CapDashboard },
  { name: 'CapSystemInformation',  component: CapSystemInformation },
  { name: 'CapCentralConnection',  component: CapCentralConnection },
  { name: 'CapOrgUnitBinding',     component: CapOrgUnitBinding },
  { name: 'CapProgramRules',       component: CapProgramRules },
  { name: 'CapSyncOverview',       component: CapSyncOverview },
  { name: 'CapSyncHistory',        component: CapSyncHistory },
  { name: 'CapDataQueues',         component: CapDataQueues },
  { name: 'CapMetadataSync',       component: CapMetadataSync },
  { name: 'CapDataExchange',       component: CapDataExchange },
  { name: 'CapSyncSettings',       component: CapSyncSettings },
  { name: 'CapSyncSchedule',       component: CapSyncSchedule },
  { name: 'CapWorkflowRuns',       component: CapWorkflowRuns },
  { name: 'CapStepAssignments',    component: CapStepAssignments },
  { name: 'CapReferralHistory',    component: CapReferralHistory },
  { name: 'CapDataOverview',       component: CapDataOverview },
  { name: 'CapAggregate',          component: CapAggregate },
  { name: 'CapEvents',             component: CapEvents },
  { name: 'CapTracker',            component: CapTracker },
  { name: 'CapDrafts',             component: CapDrafts,
    route: '/admin/data/drafts' },
  { name: 'CapMaintenance',        component: CapMaintenance },
  { name: 'CapUserMappings',       component: CapUserMappings },
  { name: 'CapRoles',              component: CapRoles },
  { name: 'CapSessions',           component: CapSessions },
  { name: 'CapCredentials',        component: CapCredentials },
  { name: 'CapDeviceEnrolment',    component: CapDeviceEnrolment },
  { name: 'CapOwnership',          component: CapOwnership },
  { name: 'CapConnections',        component: CapConnections },
  { name: 'CapDeviceDiagnostics',  component: CapDeviceDiagnostics },
  { name: 'CapOperatorMetrics',    component: CapOperatorMetrics },
];

describe('CapabilityScreens — surface mount test', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const sc of cases) {
    it(`${sc.name} mounts without throwing`, () => {
      stubEverythingPending();
      const Comp = sc.component;
      const { container } = renderWithProviders(
        /* Wrap in a Routes block when the component reads route
         * params (CapDrafts reads ?workflowRunId= via useSearchParams
         * but tolerates null; wrapping it still works). */
        sc.route ? (
          <Routes>
            <Route path="/admin/data/*" element={<Comp />} />
          </Routes>
        ) : <Comp />,
        { authApi, route: sc.route ?? '/' });
      expect(container.firstChild).not.toBeNull();
    });
  }
});
