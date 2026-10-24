import { Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { AdminShell } from './components/AdminShell';
import { AlertProvider } from './components/AlertStack';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { ActiveJobsWatcher } from './components/ActiveJobsWatcher';
import {
  EASetupWelcome, EAUsersList, EAUserCreate, EACompatInspector, EACompatHistory,
  EAJobsList, EAJobTrigger, EADriftInspector, EAConflictList, EAConflictResolve,
  EAWorkerHealth, EAMetadataOverview, EAApprovalQueue, EACaptureWorkflowList,
  EACaptureWorkflowDesigner, EADeviceFleet, EAFacilityAnalytics,
  EAAuditVerify, EAAuditEvents, EAReferralInbox,
} from './screens/EACoreScreens';
import {
  EARecoveryTools, EABackupList, EARestoreList, EAEvaluationReports,
  EAAppsList, EADiagnostics, EASettings,
} from './screens/EARemainderScreens';
import { SignIn } from './screens/SignIn';
import {
  CapSystemInformation,
  CapCentralConnection, CapOrgUnitBinding, CapProgramRules,
  CapMetadataSync, CapDataExchange, CapSyncSchedule,
  CapWorkflowRuns, CapStepAssignments, CapReferralHistory,
  CapAggregate, CapEvents, CapTracker, CapDrafts, CapMaintenance,
  CapUserMappings, CapRoles, CapSessions, CapCredentials,
  CapDeviceEnrolment, CapOwnership, CapConnections, CapDeviceDiagnostics,
  CapOperatorMetrics, CapServiceHealth, CapStorage,
  CapProvisioningSetup, CapReleases, CapNetwork,
} from './screens/CapabilityScreens';
import { MockupDashboard } from './screens/mockups/Dashboard';
import { MockupSystemOverview } from './screens/mockups/SystemOverview';
import { MockupSyncOverview } from './screens/mockups/SyncOverview';
import { MockupMetadata } from './screens/mockups/Metadata';
import { MockupDataManagement } from './screens/mockups/DataManagement';
import { MockupDataQueues } from './screens/mockups/DataQueues';
import { MockupSyncHistory } from './screens/mockups/SyncHistory';
import { MockupUsersDashboard } from './screens/mockups/UsersDashboard';

function ConflictResolveRoute(): JSX.Element {
  const { id = '' } = useParams();
  return <EAConflictResolve operationId={id} />;
}

function WorkflowDesignerRoute(): JSX.Element {
  const { id = '' } = useParams();
  return <EACaptureWorkflowDesigner workflowId={id} />;
}

/**
 * DER administration console. Routed shell with 36 EA-* screens.
 *
 * UI design (alpha.3 of 2.0.3): primary @dhis2/ui so operators moving
 * between DHIS2 Core apps and DER feel at home; Atlaskit reserved for
 * future data-heavy widgets where @dhis2/ui lacks an equivalent.
 */
export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <AlertProvider>
        <KeyboardShortcuts />
        <ActiveJobsWatcher />
        <AdminShell>
          <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/" element={<RequireAuth><MockupSystemOverview /></RequireAuth>} />
          <Route path="/overview-legacy" element={<RequireAuth><EASetupWelcome /></RequireAuth>} />
          <Route path="/provisioning/users"
                 element={<RequireAuth><MockupUsersDashboard /></RequireAuth>} />
          <Route path="/provisioning/users-legacy"
                 element={<RequireAuth><EAUsersList /></RequireAuth>} />
          <Route path="/provisioning/users/new"
                 element={<RequireAuth><EAUserCreate /></RequireAuth>} />
          <Route path="/compat" element={<RequireAuth><EACompatInspector /></RequireAuth>} />
          <Route path="/compat/history"
                 element={<RequireAuth><EACompatHistory /></RequireAuth>} />
          <Route path="/sync/jobs" element={<RequireAuth><EAJobsList /></RequireAuth>} />
          <Route path="/sync/jobs/trigger"
                 element={<RequireAuth><EAJobTrigger /></RequireAuth>} />
          <Route path="/sync/drift" element={<RequireAuth><EADriftInspector /></RequireAuth>} />
          <Route path="/journal/conflicts"
                 element={<RequireAuth><EAConflictList /></RequireAuth>} />
          <Route path="/conflicts/:id"
                 element={<RequireAuth><ConflictResolveRoute /></RequireAuth>} />
          <Route path="/journal/worker"
                 element={<RequireAuth><EAWorkerHealth /></RequireAuth>} />
          <Route path="/approvals"
                 element={<RequireAuth><EAApprovalQueue /></RequireAuth>} />
          <Route path="/workflows"
                 element={<RequireAuth><EACaptureWorkflowList /></RequireAuth>} />
          <Route path="/workflows/:id"
                 element={<RequireAuth><WorkflowDesignerRoute /></RequireAuth>} />
          <Route path="/devices"
                 element={<RequireAuth><EADeviceFleet /></RequireAuth>} />
          <Route path="/analytics"
                 element={<RequireAuth><EAFacilityAnalytics /></RequireAuth>} />
          <Route path="/audit/verify"
                 element={<RequireAuth><EAAuditVerify /></RequireAuth>} />
          <Route path="/audit/events"
                 element={<RequireAuth><EAAuditEvents /></RequireAuth>} />
          <Route path="/referral/inbox"
                 element={<RequireAuth><EAReferralInbox /></RequireAuth>} />
          <Route path="/metadata"
                 element={<RequireAuth><MockupMetadata /></RequireAuth>} />
          <Route path="/metadata-legacy"
                 element={<RequireAuth><EAMetadataOverview /></RequireAuth>} />
          <Route path="/recovery" element={<RequireAuth><EARecoveryTools /></RequireAuth>} />
          <Route path="/backup" element={<RequireAuth><EABackupList /></RequireAuth>} />
          <Route path="/restore" element={<RequireAuth><EARestoreList /></RequireAuth>} />
          <Route path="/evaluation"
                 element={<RequireAuth><EAEvaluationReports /></RequireAuth>} />
          <Route path="/apps" element={<RequireAuth><EAAppsList /></RequireAuth>} />
          <Route path="/diagnostics" element={<RequireAuth><EADiagnostics /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><EASettings /></RequireAuth>} />
          {/* Previously capability-gap screens — now implemented against
              existing /edge-api/v1 endpoints. */}
          <Route path="/dashboard" element={<RequireAuth><MockupDashboard /></RequireAuth>} />
          <Route path="/system/information" element={<RequireAuth><CapSystemInformation /></RequireAuth>} />
          <Route path="/integration/connection" element={<RequireAuth><CapCentralConnection /></RequireAuth>} />
          <Route path="/integration/organisation-unit" element={<RequireAuth><CapOrgUnitBinding /></RequireAuth>} />
          <Route path="/integration/program-rules" element={<RequireAuth><CapProgramRules /></RequireAuth>} />
          <Route path="/sync" element={<RequireAuth><MockupSyncOverview /></RequireAuth>} />
          <Route path="/sync/history" element={<RequireAuth><MockupSyncHistory /></RequireAuth>} />
          <Route path="/sync/queues" element={<RequireAuth><MockupDataQueues /></RequireAuth>} />
          <Route path="/sync/metadata" element={<RequireAuth><CapMetadataSync /></RequireAuth>} />
          <Route path="/sync/data" element={<RequireAuth><CapDataExchange /></RequireAuth>} />
          <Route path="/sync/schedule" element={<RequireAuth><CapSyncSchedule /></RequireAuth>} />
          <Route path="/workflows/runs" element={<RequireAuth><CapWorkflowRuns /></RequireAuth>} />
          <Route path="/workflows/assignments" element={<RequireAuth><CapStepAssignments /></RequireAuth>} />
          <Route path="/referral/history" element={<RequireAuth><CapReferralHistory /></RequireAuth>} />
          <Route path="/data" element={<RequireAuth><MockupDataManagement /></RequireAuth>} />
          <Route path="/data/aggregate" element={<RequireAuth><CapAggregate /></RequireAuth>} />
          <Route path="/data/events" element={<RequireAuth><CapEvents /></RequireAuth>} />
          <Route path="/data/tracker" element={<RequireAuth><CapTracker /></RequireAuth>} />
          <Route path="/data/drafts" element={<RequireAuth><CapDrafts /></RequireAuth>} />
          <Route path="/data/maintenance" element={<RequireAuth><CapMaintenance /></RequireAuth>} />
          <Route path="/access/mappings" element={<RequireAuth><CapUserMappings /></RequireAuth>} />
          <Route path="/access/roles" element={<RequireAuth><CapRoles /></RequireAuth>} />
          <Route path="/access/sessions" element={<RequireAuth><CapSessions /></RequireAuth>} />
          <Route path="/access/credentials" element={<RequireAuth><CapCredentials /></RequireAuth>} />
          <Route path="/devices/enrolment" element={<RequireAuth><CapDeviceEnrolment /></RequireAuth>} />
          <Route path="/devices/ownership" element={<RequireAuth><CapOwnership /></RequireAuth>} />
          <Route path="/devices/connections" element={<RequireAuth><CapConnections /></RequireAuth>} />
          <Route path="/devices/diagnostics" element={<RequireAuth><CapDeviceDiagnostics /></RequireAuth>} />
          <Route path="/monitoring/metrics" element={<RequireAuth><CapOperatorMetrics /></RequireAuth>} />
          <Route path="/monitoring/health" element={<RequireAuth><CapServiceHealth /></RequireAuth>} />
          <Route path="/monitoring/storage" element={<RequireAuth><CapStorage /></RequireAuth>} />
          <Route path="/setup" element={<RequireAuth><CapProvisioningSetup /></RequireAuth>} />
          <Route path="/settings/releases" element={<RequireAuth><CapReleases /></RequireAuth>} />
          <Route path="/settings/network" element={<RequireAuth><CapNetwork /></RequireAuth>} />
        </Routes>
        </AdminShell>
      </AlertProvider>
    </AuthProvider>
  );
}
