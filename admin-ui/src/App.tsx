import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { AdminShell } from './components/AdminShell';
import { AlertProvider } from './components/AlertStack';
import { OrgUnitProvider } from './components/OrgUnitContext';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { ActiveJobsWatcher } from './components/ActiveJobsWatcher';
import {
  EAUserCreate, EAJobTrigger, EACaptureWorkflowList,
  EACaptureWorkflowDesigner, EAAuditVerify,
} from './screens/EACoreScreens';
import {
  EARecoveryTools, EAEvaluationReports,
  EADiagnostics, EASettings,
} from './screens/EARemainderScreens';
import { SignIn } from './screens/SignIn';
import { SyncPolicyScreen } from './screens/SyncPolicyScreen';
import { DevicesScreen } from './screens/DevicesScreen';
import { WorkflowForm } from './screens/workflow/WorkflowForm';
import { WorkflowQueue } from './screens/workflow/WorkflowQueue';
import { WorkflowPeers } from './screens/workflow/WorkflowPeers';
import { WorkflowImportInbox } from './screens/workflow/WorkflowImportInbox';
import { WorkflowActivity } from './screens/workflow/WorkflowActivity';
import { WorkflowMonitoring } from './screens/workflow/WorkflowMonitoring';
import { WorkflowRunDetail } from './screens/workflow/WorkflowRunDetail';
import { WorkflowPeerExchange } from './screens/workflow/WorkflowPeerExchange';
import { RunValidation } from './screens/workflow/RunValidation';
import { SnapshotList } from './screens/metadata/SnapshotList';
import { SnapshotDiff } from './screens/metadata/SnapshotDiff';
import {
  CapOrgUnitBinding, CapProgramRules,
  CapMetadataSync, CapSyncSchedule,
  CapWorkflowRuns, CapStepAssignments, CapReferralHistory,
  CapDrafts, CapMaintenance,
  CapUserMappings, CapRoles, RoleEditorPage, CapAuthorities, AuthorityDetailPage,
  CapSessions, CapCredentials,
  CapDeviceEnrolment, CapOwnership, CapConnections, CapDeviceDiagnostics,
  CapOperatorMetrics, CapServiceHealth, CapStorage,
  CapProvisioningSetup, CapReleases, CapNetwork,
} from './screens/CapabilityScreens';
import { LoginAppearance } from './screens/LoginAppearance';
import { RelationshipDiagnostics }
  from './screens/RelationshipDiagnostics';
import { RelationshipTypeAliases }
  from './screens/RelationshipTypeAliases';
import { CompositeKindCatalogue }
  from './screens/CompositeKindCatalogue';
import { AppCatalogue } from './screens/AppCatalogue';
import { DataAggregate } from './screens/DataAggregate';
import { DataAggregateDetail } from './screens/DataAggregateDetail';
import { DataEvents } from './screens/DataEvents';
import { DataEventDetail } from './screens/DataEventDetail';
import { DataTracker } from './screens/DataTracker';
import { DataTeiDetail } from './screens/DataTeiDetail';
import { SyncOverview } from './screens/SyncOverview';
import { Metadata, MetadataDetail } from './screens/Metadata';
import { DataManagement } from './screens/DataManagement';
import { DataQueues, DataDetail } from './screens/DataQueues';
import { SyncHistory, SyncHistoryDetail } from './screens/SyncHistory';
import { UsersDashboard, UserDetail, UserDhis2Mapping } from './screens/UsersDashboard';
import { Dhis2Overview } from './screens/Dhis2Overview';
import { Workspace } from './screens/Workspace';
import { AdminTasks } from './screens/AdminTasks';
import { SystemInformation } from './screens/SystemInformation';
import { CompatMatrix } from './screens/CompatMatrix';
import {
  DriftInspector, ConflictList, AttentionDetailScreen,
  WorkerHealthScreen,
  DeviceDetail, ApprovalQueue, ApprovalDetail,
  ReferralInbox, ReferralDetail,
  BackupList, RestoreList,
  AuditEvents, FacilityAnalytics, SupportBundle,
  ConfigEditor, OperationalReport, UserScope,
  SiteConfig, Decommission, Dhis2Mappings,
  OperatorMetrics, SecurityAuditTrail,
} from './screens/MoreScreens';
import {
  NetworkOverview, NetworkAccessPoint,
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

/** Legacy /conflicts/:id bookmarks forward to the rich
 *  /sync/attention/:operationId detail where the real resolution flow
 *  (strategy picker, rationale, preview) lives. */
function ConflictBookmarkForward(): JSX.Element {
  const { id = '' } = useParams();
  return <Navigate to={`/sync/attention/${encodeURIComponent(id)}`} replace />;
}

function WorkflowDesignerRoute(): JSX.Element {
  const { id = '' } = useParams();
  return <EACaptureWorkflowDesigner workflowId={id} />;
}

/** §2.3.106 R-AA — preserve :operationId when forwarding bookmarks
 *  from the pre-move /sync/data/:operationId URL to its new home
 *  under /data/queue. */
function SyncDataLegacyRedirect(): JSX.Element {
  const { operationId = '' } = useParams();
  return <Navigate to={`/data/queue/${operationId}`} replace />;
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
          <Route path="/" element={<RequireAuth><Workspace /></RequireAuth>} />
          <Route path="/provisioning/users"
                 element={<RequireAuth><UsersDashboard /></RequireAuth>} />
          <Route path="/provisioning/users/new"
                 element={<RequireAuth><EAUserCreate /></RequireAuth>} />
          <Route path="/provisioning/users/:userId"
                 element={<RequireAuth><UserDetail /></RequireAuth>} />
          <Route path="/provisioning/users/:userId/dhis2-mapping"
                 element={<RequireAuth><UserDhis2Mapping /></RequireAuth>} />
          {/* DHIS2 integration surface — canonical paths only. */}
          <Route path="/dhis2" element={<RequireAuth><Dhis2Overview /></RequireAuth>} />
          <Route path="/dhis2/connection" element={<Navigate to="/dhis2" replace />} />
          <Route path="/dhis2/organisation-unit" element={<RequireAuth><CapOrgUnitBinding /></RequireAuth>} />
          <Route path="/dhis2/program-rules" element={<RequireAuth><CapProgramRules /></RequireAuth>} />
          <Route path="/dhis2/compat" element={<RequireAuth><CompatMatrix /></RequireAuth>} />
          <Route path="/dhis2/metadata" element={<RequireAuth><Metadata /></RequireAuth>} />
          <Route path="/dhis2/metadata/:resource/:id" element={<RequireAuth><MetadataDetail /></RequireAuth>} />
          <Route path="/dhis2/metadata-drift" element={<RequireAuth><DriftInspector /></RequireAuth>} />
          <Route path="/dhis2/metadata-sync" element={<RequireAuth><CapMetadataSync /></RequireAuth>} />
          {/* UI-6 — bookmark-friendly redirects for the handful of
              aliases shipped in earlier releases. */}
          <Route path="/compat" element={<Navigate to="/dhis2/compat" replace />} />
          <Route path="/compat/history" element={<Navigate to="/dhis2/compat" replace />} />
          <Route path="/sync/jobs" element={<Navigate to="/sync/history" replace />} />
          <Route path="/sync/jobs/trigger"
                 element={<RequireAuth><EAJobTrigger /></RequireAuth>} />
          <Route path="/sync/drift" element={<Navigate to="/dhis2/metadata-drift" replace />} />
          <Route path="/sync/attention"
                 element={<RequireAuth><ConflictList /></RequireAuth>} />
          <Route path="/sync/attention/:operationId"
                 element={<RequireAuth><AttentionDetailScreen /></RequireAuth>} />
          <Route path="/journal/conflicts" element={<Navigate to="/sync/attention" replace />} />
          <Route path="/conflicts/:id"
                 element={<ConflictBookmarkForward />} />
          <Route path="/sync/worker"
                 element={<RequireAuth><WorkerHealthScreen /></RequireAuth>} />
          <Route path="/journal/worker" element={<Navigate to="/sync/worker" replace />} />
          <Route path="/approvals"
                 element={<RequireAuth><ApprovalQueue /></RequireAuth>} />
          <Route path="/approvals/:operationId"
                 element={<RequireAuth><ApprovalDetail /></RequireAuth>} />
          <Route path="/workflows"
                 element={<RequireAuth><WorkflowActivity /></RequireAuth>} />
          <Route path="/workflows/manage"
                 element={<RequireAuth><EACaptureWorkflowList /></RequireAuth>} />
          <Route path="/workflows/monitoring"
                 element={<RequireAuth><WorkflowMonitoring /></RequireAuth>} />
          <Route path="/workflows/monitoring/runs/:runId"
                 element={<RequireAuth><WorkflowRunDetail /></RequireAuth>} />
          <Route path="/workflows/peer-exchange"
                 element={<RequireAuth><WorkflowPeerExchange /></RequireAuth>} />
          <Route path="/workflows/new"
                 element={<RequireAuth><WorkflowForm /></RequireAuth>} />
          <Route path="/workflows/queue"
                 element={<RequireAuth><WorkflowQueue /></RequireAuth>} />
          <Route path="/workflows/peers"
                 element={<RequireAuth><WorkflowPeers /></RequireAuth>} />
          <Route path="/workflows/import-inbox"
                 element={<RequireAuth><WorkflowImportInbox /></RequireAuth>} />
          <Route path="/workflows/runs/:runId/validation"
                 element={<RequireAuth><RunValidation /></RequireAuth>} />
          <Route path="/metadata/snapshots"
                 element={<RequireAuth><SnapshotList /></RequireAuth>} />
          <Route path="/metadata/snapshots/:a/diff/:b"
                 element={<RequireAuth><SnapshotDiff /></RequireAuth>} />
          <Route path="/workflows/:id/advanced"
                 element={<RequireAuth><WorkflowDesignerRoute /></RequireAuth>} />
          <Route path="/workflows/:id"
                 element={<RequireAuth><WorkflowForm /></RequireAuth>} />
          <Route path="/devices"
                 element={<RequireAuth><DevicesScreen /></RequireAuth>} />
          <Route path="/devices/:deviceId"
                 element={<RequireAuth><DeviceDetail /></RequireAuth>} />
          {/* UI-1 — /fleet and /network/clients both roll into
              /devices (unified fleet + LAN-mesh view). */}
          <Route path="/fleet"
                 element={<Navigate to="/devices" replace />} />
          <Route path="/network/clients"
                 element={<Navigate to="/devices?source=LAN_CLIENT" replace />} />
          <Route path="/analytics"
                 element={<RequireAuth><FacilityAnalytics /></RequireAuth>} />
          <Route path="/audit/verify"
                 element={<RequireAuth><EAAuditVerify /></RequireAuth>} />
          <Route path="/audit/trail"
                 element={<RequireAuth><SecurityAuditTrail /></RequireAuth>} />
          <Route path="/audit/events"
                 element={<RequireAuth><AuditEvents /></RequireAuth>} />
          <Route path="/referral/inbox"
                 element={<RequireAuth><ReferralInbox /></RequireAuth>} />
          <Route path="/referral/inbox/:inboxId"
                 element={<RequireAuth><ReferralDetail /></RequireAuth>} />
          <Route path="/metadata"
                 element={<Navigate to="/dhis2/metadata" replace />} />
          <Route path="/recovery" element={<RequireAuth><EARecoveryTools /></RequireAuth>} />
          <Route path="/backup" element={<RequireAuth><BackupList /></RequireAuth>} />
          <Route path="/restore" element={<RequireAuth><RestoreList /></RequireAuth>} />
          <Route path="/evaluation"
                 element={<RequireAuth><EAEvaluationReports /></RequireAuth>} />
          {/* C-UI-5a merged `/apps` with the former `/apps/catalogue`
              — one Apps surface, signed-bundle catalogue. */}
          <Route path="/apps" element={<RequireAuth><AppCatalogue /></RequireAuth>} />
          <Route path="/apps/catalogue" element={<Navigate to="/apps" replace />} />
          <Route path="/diagnostics" element={<RequireAuth><EADiagnostics /></RequireAuth>} />
          <Route path="/diagnostics/relationships"
                 element={<RequireAuth><RelationshipDiagnostics /></RequireAuth>} />
          <Route path="/dhis2/relationship-types"
                 element={<RequireAuth><RelationshipTypeAliases /></RequireAuth>} />
          <Route path="/dhis2/composite-kinds"
                 element={<RequireAuth><CompositeKindCatalogue /></RequireAuth>} />
          <Route path="/support-bundle"
                 element={<RequireAuth><SupportBundle /></RequireAuth>} />
          <Route path="/configuration"
                 element={<RequireAuth><ConfigEditor /></RequireAuth>} />
          <Route path="/reports/operational"
                 element={<RequireAuth><OperationalReport /></RequireAuth>} />
          <Route path="/users/scope"
                 element={<RequireAuth><UserScope /></RequireAuth>} />
          <Route path="/site/config"
                 element={<RequireAuth><SiteConfig /></RequireAuth>} />
          <Route path="/decommission"
                 element={<RequireAuth><Decommission /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><EASettings /></RequireAuth>} />
          {/* Network module per docs/requirements/DER_Network_Module_Design_Specification.md. */}
          <Route path="/network" element={<RequireAuth><NetworkOverview /></RequireAuth>} />
          <Route path="/network/access-point" element={<RequireAuth><NetworkAccessPoint /></RequireAuth>} />
          {/* UI-1 — /network/clients retired; redirect lives earlier
              in this routes table so only /network/clients-legacy
              still points at the old screen for bookmark forensics. */}
          <Route path="/network/interfaces" element={<RequireAuth><NetworkInterfaces /></RequireAuth>} />
          <Route path="/network/peers" element={<RequireAuth><NetworkPeers /></RequireAuth>} />
          {/* Workflow definition sharing (moved from /workflows/peer-exchange
              in 2.3.59). Both routes resolve to the same component. */}
          <Route path="/network/workflow-sharing"
                 element={<RequireAuth><WorkflowPeerExchange /></RequireAuth>} />
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
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/admin-tasks" element={<RequireAuth><AdminTasks /></RequireAuth>} />
          <Route path="/system/information" element={<RequireAuth><SystemInformation /></RequireAuth>} />
          {/* /integration and /integration/* were the pre-2.0.17
              paths for DHIS2 surfaces; canonical names now live
              under /dhis2/*. */}
          <Route path="/integration" element={<Navigate to="/dhis2" replace />} />
          <Route path="/integration/connection" element={<Navigate to="/dhis2" replace />} />
          <Route path="/integration/organisation-unit" element={<Navigate to="/dhis2/organisation-unit" replace />} />
          <Route path="/integration/program-rules" element={<Navigate to="/dhis2/program-rules" replace />} />
          <Route path="/sync" element={<RequireAuth><SyncOverview /></RequireAuth>} />
          <Route path="/sync/history" element={<RequireAuth><SyncHistory /></RequireAuth>} />
          <Route path="/sync/history/:runId" element={<RequireAuth><SyncHistoryDetail /></RequireAuth>} />
          <Route path="/sync/queues" element={<Navigate to="/data/queue" replace />} />
          {/* §2.3.117 R-AN — /sync/metadata and /dhis2/metadata-sync
              both rendered CapMetadataSync. Canonicalised under the
              DHIS2 Integration group; /sync/metadata redirects. */}
          <Route path="/sync/metadata" element={<Navigate to="/dhis2/metadata-sync" replace />} />
          {/* §2.3.106 R-AA — Data Queue lives under Data (operators think
              of outbound records as data, not as a sync-worker detail).
              /sync/data redirects to the new canonical path. */}
          <Route path="/sync/data" element={<Navigate to="/data/queue" replace />} />
          <Route path="/sync/data/:operationId" element={<SyncDataLegacyRedirect />} />
          <Route path="/data/queue" element={<RequireAuth><DataQueues /></RequireAuth>} />
          <Route path="/data/queue/:operationId" element={<RequireAuth><DataDetail /></RequireAuth>} />
          <Route path="/sync/schedule" element={<RequireAuth><CapSyncSchedule /></RequireAuth>} />
          {/* UI-11 — /sync/settings was DHIS2 connection health in
              disguise; redirect to Compatibility check where the
              content belongs. */}
          <Route path="/sync/settings" element={<Navigate to="/dhis2/compat" replace />} />
          <Route path="/sync/policy" element={<RequireAuth><SyncPolicyScreen /></RequireAuth>} />
          <Route path="/workflows/runs" element={<RequireAuth><CapWorkflowRuns /></RequireAuth>} />
          <Route path="/workflows/assignments" element={<RequireAuth><CapStepAssignments /></RequireAuth>} />
          <Route path="/referral/history" element={<RequireAuth><CapReferralHistory /></RequireAuth>} />
          <Route path="/data" element={<RequireAuth><DataManagement /></RequireAuth>} />
          <Route path="/data/aggregate" element={<RequireAuth><DataAggregate /></RequireAuth>} />
          <Route path="/data/aggregate/:valueId"
                 element={<RequireAuth><DataAggregateDetail /></RequireAuth>} />
          <Route path="/data/events" element={<RequireAuth><DataEvents /></RequireAuth>} />
          <Route path="/data/events/:eventId"
                 element={<RequireAuth><DataEventDetail /></RequireAuth>} />
          <Route path="/data/tracker" element={<RequireAuth><DataTracker /></RequireAuth>} />
          <Route path="/data/tracker/tei/:teiUid"
                 element={<RequireAuth><DataTeiDetail /></RequireAuth>} />
          <Route path="/data/drafts" element={<RequireAuth><CapDrafts /></RequireAuth>} />
          <Route path="/data/maintenance" element={<RequireAuth><CapMaintenance /></RequireAuth>} />
          <Route path="/access/mappings" element={<RequireAuth><CapUserMappings /></RequireAuth>} />
          <Route path="/access/roles" element={<RequireAuth><CapRoles /></RequireAuth>} />
          <Route path="/access/roles/new" element={<RequireAuth><RoleEditorPage /></RequireAuth>} />
          <Route path="/access/roles/:roleId" element={<RequireAuth><RoleEditorPage /></RequireAuth>} />
          <Route path="/access/authorities" element={<RequireAuth><CapAuthorities /></RequireAuth>} />
          <Route path="/access/authorities/:authority"
                 element={<RequireAuth><AuthorityDetailPage /></RequireAuth>} />
          <Route path="/access/sessions" element={<RequireAuth><CapSessions /></RequireAuth>} />
          <Route path="/access/credentials" element={<RequireAuth><CapCredentials /></RequireAuth>} />
          <Route path="/access/dhis2-mappings"
                 element={<RequireAuth><Dhis2Mappings /></RequireAuth>} />
          <Route path="/devices/enrolment" element={<RequireAuth><CapDeviceEnrolment /></RequireAuth>} />
          <Route path="/devices/ownership" element={<RequireAuth><CapOwnership /></RequireAuth>} />
          <Route path="/devices/connections" element={<RequireAuth><CapConnections /></RequireAuth>} />
          <Route path="/devices/diagnostics" element={<RequireAuth><CapDeviceDiagnostics /></RequireAuth>} />
          <Route path="/monitoring/metrics" element={<RequireAuth><CapOperatorMetrics /></RequireAuth>} />
          <Route path="/admin/metrics/operators"
                 element={<RequireAuth><OperatorMetrics /></RequireAuth>} />
          <Route path="/metrics/operators"
                 element={<RequireAuth><OperatorMetrics /></RequireAuth>} />
          <Route path="/monitoring/health" element={<RequireAuth><CapServiceHealth /></RequireAuth>} />
          <Route path="/monitoring/storage" element={<RequireAuth><CapStorage /></RequireAuth>} />
          <Route path="/setup" element={<RequireAuth><CapProvisioningSetup /></RequireAuth>} />
          <Route path="/settings/releases" element={<RequireAuth><CapReleases /></RequireAuth>} />
          <Route path="/settings/network" element={<RequireAuth><CapNetwork /></RequireAuth>} />
          <Route path="/settings/login" element={<RequireAuth><LoginAppearance /></RequireAuth>} />
        </Routes>
        </AdminShell>
      </OrgUnitProvider>
      </AlertProvider>
    </AuthProvider>
  );
}
