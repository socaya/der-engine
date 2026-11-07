import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { DeviceBoot } from './device/DeviceBoot';
import { RequireAuth } from './components/RequireAuth';
import { SignIn } from './screens/SignIn';
import { DerHome } from './screens/DerHome';
import { SessionDetails } from './screens/SessionDetails';
import { RecentWork } from './screens/RecentWork';
import { EdgeConnectionError } from './screens/EdgeConnectionError';
import { OrgUnitBindingProvider } from './orgunit/OrgUnitBindingContext';
import { DerShell } from './shell/DerShell';
import { AggregateDatasetPicker } from './screens/AggregateDatasetPicker';
import { ProgramPicker } from './screens/ProgramPicker';
import { ScheduledEvents } from './screens/ScheduledEvents';
import { SubmittedReview } from './screens/SubmittedReview';
import { Drafts } from './screens/Drafts';
import { Dhis2Status } from './screens/Dhis2Status';
import { SyncStatus } from './screens/SyncStatus';
import { NetworkStatus } from './screens/NetworkStatus';
import { OfflineQueue } from './screens/OfflineQueue';
import { AppHost } from './apps/AppHost';

/**
 * DER device-client router. The device client is a capture + view
 * surface — metadata management lives in admin-ui. Metadata on the
 * client is consumed only as:
 *   - form fields (D-CAP-3 envelope projection)
 *   - filter options in capture + review screens
 *   - validation inputs: program rules (PRs) and validation rules
 *     (VRs), option sets, min/max, compulsory flags
 * There are no standalone metadata-browsing routes.
 */
export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <OrgUnitBindingProvider>
      <DeviceBoot />
      <Routes>
        {/* Full-viewport routes — no shell chrome. */}
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/edge-error" element={<EdgeConnectionError />} />
        {/* Everything else runs inside the DerShell. */}
        <Route path="/*" element={<DerShell><InnerRoutes /></DerShell>} />
      </Routes>
      </OrgUnitBindingProvider>
    </AuthProvider>
  );
}

function InnerRoutes(): JSX.Element {
  return (
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <DerHome />
              </RequireAuth>
            }
          />
          <Route
            path="/launcher"
            element={
              <RequireAuth>
                <DerHome />
              </RequireAuth>
            }
          />
          <Route
            path="/session"
            element={
              <RequireAuth>
                <SessionDetails />
              </RequireAuth>
            }
          />
          <Route
            path="/recent"
            element={
              <RequireAuth>
                <RecentWork />
              </RequireAuth>
            }
          />
          {/* Phase 06 / C-UI-5e — the capture screens migrate to
              DER-dispatched apps. Shell routes redirect for one
              release so existing bookmarks + tests continue to
              work; AppHost shows a clear "install from admin"
              message when the app isn't yet in the catalogue. */}
          <Route path="/aggregate/datasets" element={
            <RequireAuth><AggregateDatasetPicker /></RequireAuth>
          } />
          <Route path="/aggregate/entry"
                 element={<Navigate to="/apps/data-entry" replace />} />
          <Route path="/programs" element={
            <RequireAuth><ProgramPicker /></RequireAuth>
          } />
          <Route path="/programs/:program/events"
                 element={<Navigate to="/apps/capture" replace />} />
          <Route path="/programs/:program/events/new"
                 element={<Navigate to="/apps/capture" replace />} />
          <Route path="/tracker/:program/search"
                 element={<Navigate to="/apps/capture" replace />} />
          <Route path="/tracker/:program/tei/:tei"
                 element={<Navigate to="/apps/capture" replace />} />
          <Route path="/tracker/:program/enroll"
                 element={<Navigate to="/apps/capture" replace />} />
          <Route path="/tracker/:program/stage/:stage/new"
                 element={<Navigate to="/apps/capture" replace />} />
          <Route path="/scheduled" element={
            <RequireAuth><ScheduledEvents /></RequireAuth>
          } />
          <Route path="/review" element={
            <RequireAuth><SubmittedReview /></RequireAuth>
          } />
          <Route path="/drafts" element={
            <RequireAuth><Drafts /></RequireAuth>
          } />
          {/* ADR-0036 — workflow-scoped capture (now via dispatched app) */}
          <Route path="/capture/runs"
                 element={<Navigate to="/apps/workflow-capture" replace />} />
          <Route path="/capture/runs/:id/form"
                 element={<Navigate to="/apps/workflow-capture" replace />} />
          {/* Server-Module status surfaces */}
          <Route path="/dhis2/status" element={
            <RequireAuth><Dhis2Status /></RequireAuth>
          } />
          <Route path="/sync/status" element={
            <RequireAuth><SyncStatus /></RequireAuth>
          } />
          <Route path="/network/status" element={
            <RequireAuth><NetworkStatus /></RequireAuth>
          } />
          <Route path="/queue" element={
            <RequireAuth><OfflineQueue /></RequireAuth>
          } />
          {/* ADR-0037 C-UI-5b — DER-dispatched apps. */}
          <Route path="/apps/:appKey" element={
            <RequireAuth><AppHost /></RequireAuth>
          } />
        </Routes>
  );
}
