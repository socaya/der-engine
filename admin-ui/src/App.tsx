import { Link, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import {
  EASetupWelcome, EAUsersList, EAUserCreate, EACompatInspector, EACompatHistory,
  EAJobsList, EAJobTrigger, EADriftInspector, EAConflictList, EAConflictResolve,
  EAWorkerHealth, EAMetadataOverview, EAApprovalQueue,
} from './screens/EACoreScreens';
import {
  EARecoveryTools, EABackupList, EARestoreList, EAEvaluationReports,
  EAAppsList, EADiagnostics, EASettings,
} from './screens/EARemainderScreens';

function ConflictResolveRoute(): JSX.Element {
  const { id = '' } = useParams();
  return <EAConflictResolve operationId={id} />;
}

/**
 * DER administration console. Phase 06 Release 2 wires the first 18 EA-*
 * screens behind react-router. Each route is auth-guarded; mutating actions
 * additionally gate on the ADMIN role server-side.
 */
export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <div className="ea-shell">
        <header>
          <strong data-test="brand">DER Administration</strong>
          <nav aria-label="Primary">
            <Link to="/" data-test="nav-home">Overview</Link>
            <Link to="/provisioning/users" data-test="nav-provisioning">Provisioning</Link>
            <Link to="/compat" data-test="nav-compat">Compatibility</Link>
            <Link to="/sync/jobs" data-test="nav-jobs">Jobs</Link>
            <Link to="/sync/drift" data-test="nav-drift">Drift</Link>
            <Link to="/journal/conflicts" data-test="nav-conflicts">Conflicts</Link>
            <Link to="/journal/worker" data-test="nav-worker">Worker</Link>
            <Link to="/approvals" data-test="nav-approvals">Approvals</Link>
            <Link to="/metadata" data-test="nav-metadata">Metadata</Link>
          </nav>
        </header>
        <main data-der-app="admin-ui">
          <Routes>
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
            <Route path="/metadata"
                   element={<RequireAuth><EAMetadataOverview /></RequireAuth>} />
            {/* Phase 06 Release 3 — EA-19..36 */}
            <Route path="/recovery" element={<RequireAuth><EARecoveryTools /></RequireAuth>} />
            <Route path="/backup" element={<RequireAuth><EABackupList /></RequireAuth>} />
            <Route path="/restore" element={<RequireAuth><EARestoreList /></RequireAuth>} />
            <Route path="/evaluation"
                   element={<RequireAuth><EAEvaluationReports /></RequireAuth>} />
            <Route path="/apps" element={<RequireAuth><EAAppsList /></RequireAuth>} />
            <Route path="/diagnostics" element={<RequireAuth><EADiagnostics /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><EASettings /></RequireAuth>} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
