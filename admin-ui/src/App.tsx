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
          <Route path="/" element={<RequireAuth><EASetupWelcome /></RequireAuth>} />
          <Route path="/provisioning/users"
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
                 element={<RequireAuth><EAMetadataOverview /></RequireAuth>} />
          <Route path="/recovery" element={<RequireAuth><EARecoveryTools /></RequireAuth>} />
          <Route path="/backup" element={<RequireAuth><EABackupList /></RequireAuth>} />
          <Route path="/restore" element={<RequireAuth><EARestoreList /></RequireAuth>} />
          <Route path="/evaluation"
                 element={<RequireAuth><EAEvaluationReports /></RequireAuth>} />
          <Route path="/apps" element={<RequireAuth><EAAppsList /></RequireAuth>} />
          <Route path="/diagnostics" element={<RequireAuth><EADiagnostics /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><EASettings /></RequireAuth>} />
        </Routes>
        </AdminShell>
      </AlertProvider>
    </AuthProvider>
  );
}
