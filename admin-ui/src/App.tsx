import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { AdminShell } from './components/AdminShell';
import { AlertProvider } from './components/AlertStack';
import { OrgUnitProvider } from './components/OrgUnitContext';
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
  CapMetadataSync, CapSyncSchedule, CapSyncSettings,
  CapWorkflowRuns, CapStepAssignments, CapReferralHistory,
  CapAggregate, CapEvents, CapTracker, CapDrafts, CapMaintenance,
  CapUserMappings, CapRoles, CapSessions, CapCredentials,
  CapDeviceEnrolment, CapOwnership, CapConnections, CapDeviceDiagnostics,
  CapOperatorMetrics, CapServiceHealth, CapStorage,
  CapProvisioningSetup, CapReleases, CapNetwork,
} from './screens/CapabilityScreens';
import { MockupDashboard } from './screens/Dashboard';
import { MockupSystemOverview } from './screens/SystemOverview';
import { MockupSyncOverview } from './screens/SyncOverview';
import { MockupMetadata, MockupMetadataDetail } from './screens/Metadata';
import { MockupDataManagement } from './screens/DataManagement';
import { MockupDataQueues, MockupDataDetail } from './screens/DataQueues';
import { MockupSyncHistory, MockupSyncHistoryDetail } from './screens/SyncHistory';
import { MockupUsersDashboard, MockupUserDetail } from './screens/UsersDashboard';
import { MockupDhis2Overview } from './screens/Dhis2Overview';
import { MockupWorkspace } from './screens/Workspace';
import { MockupAdminTasks } from './screens/AdminTasks';
import { MockupSystemInformation } from './screens/SystemInformation';
import { MockupCompatMatrix } from './screens/CompatMatrix';
import {
  MockupDriftInspector, MockupConflictList, MockupConflictDetail,
  MockupWorkerHealth,
  MockupDeviceFleet, MockupDeviceDetail, MockupApprovalQueue, MockupApprovalDetail,
  MockupReferralInbox, MockupReferralDetail,
  MockupBackupList, MockupRestoreList, MockupCompatInspector,
  MockupAuditEvents, MockupFacilityAnalytics,
} from './screens/MoreScreens';
import {
  NetworkOverview, NetworkAccessPoint, NetworkConnectedDevices,
  NetworkInterfaces, NetworkPeers, NetworkSecurity,
  NetworkDiagnostics, NetworkSettings,
} from './screens/Network';
import { DeviceMessaging } from './screens/DeviceMessaging';
import { Compliance } from './screens/Compliance';
import { MeshTopology } from './screens/MeshTopology';
import { Hardware } from './screens/Hardware';
import { Fleet } from './screens/Fleet';
import { Testing } from './screens/Testing';
import { Packaging } from './screens/Packaging';

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
      <OrgUnitProvider>
        <KeyboardShortcuts />
        <ActiveJobsWatcher />
        <AdminShell>
          <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/" element={<RequireAuth><MockupWorkspace /></RequireAuth>} />
          <Route path="/overview-legacy" element={<RequireAuth><MockupSystemOverview /></RequireAuth>} />
          <Route path="/setup-welcome-legacy" element={<RequireAuth><EASetupWelcome /></RequireAuth>} />
          <Route path="/provisioning/users"
                 element={<RequireAuth><MockupUsersDashboard /></RequireAuth>} />
          <Route path="/provisioning/users-legacy"
                 element={<RequireAuth><EAUsersList /></RequireAuth>} />
          <Route path="/provisioning/users/new"
                 element={<RequireAuth><EAUserCreate /></RequireAuth>} />
          <Route path="/provisioning/users/:userId"
                 element={<RequireAuth><MockupUserDetail /></RequireAuth>} />
          {/* der-2.0.17 — standard URL layout: /dhis2/* for every
              DHIS2-integration surface. Legacy paths kept as
              redirect-equivalent routes so bookmarks continue to work.
              A single component mounts at both locations. */}
          <Route path="/dhis2" element={<RequireAuth><MockupDhis2Overview /></RequireAuth>} />
          {/* /dhis2/connection is merged into the hub at /dhis2 (der-2.0.30). */}
          <Route path="/dhis2/connection" element={<Navigate to="/dhis2" replace />} />
          <Route path="/dhis2/organisation-unit" element={<RequireAuth><CapOrgUnitBinding /></RequireAuth>} />
          <Route path="/dhis2/program-rules" element={<RequireAuth><CapProgramRules /></RequireAuth>} />
          <Route path="/dhis2/compat" element={<RequireAuth><MockupCompatMatrix /></RequireAuth>} />
          <Route path="/dhis2/compat-legacy-inspector" element={<RequireAuth><MockupCompatInspector /></RequireAuth>} />
          <Route path="/dhis2/compat-history" element={<RequireAuth><EACompatHistory /></RequireAuth>} />
          <Route path="/dhis2/metadata" element={<RequireAuth><MockupMetadata /></RequireAuth>} />
          <Route path="/dhis2/metadata/:resource/:id" element={<RequireAuth><MockupMetadataDetail /></RequireAuth>} />
          <Route path="/dhis2/metadata-drift" element={<RequireAuth><MockupDriftInspector /></RequireAuth>} />
          <Route path="/dhis2/metadata-sync" element={<RequireAuth><CapMetadataSync /></RequireAuth>} />
          {/* Legacy aliases — kept so existing links / bookmarks still work. */}
          <Route path="/compat" element={<RequireAuth><MockupCompatInspector /></RequireAuth>} />
          <Route path="/compat-legacy" element={<RequireAuth><EACompatInspector /></RequireAuth>} />
          <Route path="/compat/history"
                 element={<RequireAuth><EACompatHistory /></RequireAuth>} />
          {/* /sync/jobs merged into /sync/history in der-2.1.36 — both read listJobs. */}
          <Route path="/sync/jobs" element={<Navigate to="/sync/history" replace />} />
          <Route path="/sync/jobs-legacy" element={<RequireAuth><EAJobsList /></RequireAuth>} />
          <Route path="/sync/jobs/trigger"
                 element={<RequireAuth><EAJobTrigger /></RequireAuth>} />
          <Route path="/sync/drift" element={<RequireAuth><MockupDriftInspector /></RequireAuth>} />
          <Route path="/sync/drift-legacy" element={<RequireAuth><EADriftInspector /></RequireAuth>} />
          <Route path="/sync/attention"
                 element={<RequireAuth><MockupConflictList /></RequireAuth>} />
          <Route path="/sync/attention/:operationId"
                 element={<RequireAuth><MockupConflictDetail /></RequireAuth>} />
          <Route path="/journal/conflicts" element={<Navigate to="/sync/attention" replace />} />
          <Route path="/journal/conflicts-legacy"
                 element={<RequireAuth><EAConflictList /></RequireAuth>} />
          <Route path="/conflicts/:id"
                 element={<RequireAuth><ConflictResolveRoute /></RequireAuth>} />
          <Route path="/sync/worker"
                 element={<RequireAuth><MockupWorkerHealth /></RequireAuth>} />
          <Route path="/journal/worker" element={<Navigate to="/sync/worker" replace />} />
          <Route path="/journal/worker-legacy"
                 element={<RequireAuth><EAWorkerHealth /></RequireAuth>} />
          <Route path="/approvals"
                 element={<RequireAuth><MockupApprovalQueue /></RequireAuth>} />
          <Route path="/approvals/:operationId"
                 element={<RequireAuth><MockupApprovalDetail /></RequireAuth>} />
          <Route path="/approvals-legacy"
                 element={<RequireAuth><EAApprovalQueue /></RequireAuth>} />
          <Route path="/workflows"
                 element={<RequireAuth><EACaptureWorkflowList /></RequireAuth>} />
          <Route path="/workflows/:id"
                 element={<RequireAuth><WorkflowDesignerRoute /></RequireAuth>} />
          <Route path="/devices"
                 element={<RequireAuth><MockupDeviceFleet /></RequireAuth>} />
          <Route path="/devices-legacy"
                 element={<RequireAuth><EADeviceFleet /></RequireAuth>} />
          <Route path="/devices/:deviceId"
                 element={<RequireAuth><MockupDeviceDetail /></RequireAuth>} />
          <Route path="/analytics"
                 element={<RequireAuth><MockupFacilityAnalytics /></RequireAuth>} />
          <Route path="/analytics-legacy"
                 element={<RequireAuth><EAFacilityAnalytics /></RequireAuth>} />
          <Route path="/audit/verify"
                 element={<RequireAuth><EAAuditVerify /></RequireAuth>} />
          <Route path="/audit/events"
                 element={<RequireAuth><MockupAuditEvents /></RequireAuth>} />
          <Route path="/audit/events-legacy"
                 element={<RequireAuth><EAAuditEvents /></RequireAuth>} />
          <Route path="/referral/inbox"
                 element={<RequireAuth><MockupReferralInbox /></RequireAuth>} />
          <Route path="/referral/inbox/:inboxId"
                 element={<RequireAuth><MockupReferralDetail /></RequireAuth>} />
          <Route path="/referral/inbox-legacy"
                 element={<RequireAuth><EAReferralInbox /></RequireAuth>} />
          <Route path="/metadata"
                 element={<RequireAuth><MockupMetadata /></RequireAuth>} />
          <Route path="/metadata-legacy"
                 element={<RequireAuth><EAMetadataOverview /></RequireAuth>} />
          <Route path="/recovery" element={<RequireAuth><EARecoveryTools /></RequireAuth>} />
          <Route path="/backup" element={<RequireAuth><MockupBackupList /></RequireAuth>} />
          <Route path="/backup-legacy" element={<RequireAuth><EABackupList /></RequireAuth>} />
          <Route path="/restore" element={<RequireAuth><MockupRestoreList /></RequireAuth>} />
          <Route path="/restore-legacy" element={<RequireAuth><EARestoreList /></RequireAuth>} />
          <Route path="/evaluation"
                 element={<RequireAuth><EAEvaluationReports /></RequireAuth>} />
          <Route path="/apps" element={<RequireAuth><EAAppsList /></RequireAuth>} />
          <Route path="/diagnostics" element={<RequireAuth><EADiagnostics /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><EASettings /></RequireAuth>} />
          {/* Network module per docs/requirements/DER_Network_Module_Design_Specification.md. */}
          <Route path="/network" element={<RequireAuth><NetworkOverview /></RequireAuth>} />
          <Route path="/network/access-point" element={<RequireAuth><NetworkAccessPoint /></RequireAuth>} />
          <Route path="/network/clients" element={<RequireAuth><NetworkConnectedDevices /></RequireAuth>} />
          <Route path="/network/interfaces" element={<RequireAuth><NetworkInterfaces /></RequireAuth>} />
          <Route path="/network/peers" element={<RequireAuth><NetworkPeers /></RequireAuth>} />
          <Route path="/network/security" element={<RequireAuth><NetworkSecurity /></RequireAuth>} />
          <Route path="/network/diagnostics" element={<RequireAuth><NetworkDiagnostics /></RequireAuth>} />
          <Route path="/network/settings" element={<RequireAuth><NetworkSettings /></RequireAuth>} />
          <Route path="/network/messaging" element={<RequireAuth><DeviceMessaging /></RequireAuth>} />
          <Route path="/network/mesh" element={<RequireAuth><MeshTopology /></RequireAuth>} />
          <Route path="/system/hardware" element={<RequireAuth><Hardware /></RequireAuth>} />
          <Route path="/fleet" element={<RequireAuth><Fleet /></RequireAuth>} />
          <Route path="/testing" element={<RequireAuth><Testing /></RequireAuth>} />
          <Route path="/packaging" element={<RequireAuth><Packaging /></RequireAuth>} />
          <Route path="/compliance" element={<RequireAuth><Compliance /></RequireAuth>} />
          {/* Previously capability-gap screens — now implemented against
              existing /edge-api/v1 endpoints. */}
          <Route path="/dashboard" element={<RequireAuth><MockupWorkspace /></RequireAuth>} />
          <Route path="/admin-tasks" element={<RequireAuth><MockupAdminTasks /></RequireAuth>} />
          <Route path="/dashboard-legacy" element={<RequireAuth><MockupDashboard /></RequireAuth>} />
          <Route path="/system/information" element={<RequireAuth><MockupSystemInformation /></RequireAuth>} />
          <Route path="/system/information-legacy" element={<RequireAuth><CapSystemInformation /></RequireAuth>} />
          <Route path="/integration" element={<RequireAuth><MockupDhis2Overview /></RequireAuth>} />
          <Route path="/integration/connection" element={<RequireAuth><CapCentralConnection /></RequireAuth>} />
          <Route path="/integration/organisation-unit" element={<RequireAuth><CapOrgUnitBinding /></RequireAuth>} />
          <Route path="/integration/program-rules" element={<RequireAuth><CapProgramRules /></RequireAuth>} />
          <Route path="/sync" element={<RequireAuth><MockupSyncOverview /></RequireAuth>} />
          <Route path="/sync/history" element={<RequireAuth><MockupSyncHistory /></RequireAuth>} />
          <Route path="/sync/history/:runId" element={<RequireAuth><MockupSyncHistoryDetail /></RequireAuth>} />
          <Route path="/sync/queues" element={<Navigate to="/sync/data" replace />} />
          <Route path="/sync/metadata" element={<RequireAuth><CapMetadataSync /></RequireAuth>} />
          <Route path="/sync/data" element={<RequireAuth><MockupDataQueues /></RequireAuth>} />
          <Route path="/sync/data/:operationId" element={<RequireAuth><MockupDataDetail /></RequireAuth>} />
          <Route path="/sync/schedule" element={<RequireAuth><CapSyncSchedule /></RequireAuth>} />
          <Route path="/sync/settings" element={<RequireAuth><CapSyncSettings /></RequireAuth>} />
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
      </OrgUnitProvider>
      </AlertProvider>
    </AuthProvider>
  );
}
