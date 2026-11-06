import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { DerHeader } from './components/DerHeader';
import { DeviceBoot } from './device/DeviceBoot';
import { RequireAuth } from './components/RequireAuth';
import { SignIn } from './screens/SignIn';
import { Launcher } from './screens/Launcher';
import { SessionDetails } from './screens/SessionDetails';
import { RecentWork } from './screens/RecentWork';
import { EdgeConnectionError } from './screens/EdgeConnectionError';
import { OrgUnitBindingProvider } from './orgunit/OrgUnitBindingContext';
import { AggregateDatasetPicker } from './screens/AggregateDatasetPicker';
import { AggregateEntry } from './screens/AggregateEntry';
import { ProgramPicker } from './screens/ProgramPicker';
import { EventList } from './screens/EventList';
import { EventNew } from './screens/EventNew';
import { TrackerSearch } from './screens/TrackerSearch';
import { TrackerDashboard } from './screens/TrackerDashboard';
import { EnrollmentCreate } from './screens/EnrollmentCreate';
import { ScheduledEvents } from './screens/ScheduledEvents';
import { SubmittedReview } from './screens/SubmittedReview';
import { Drafts } from './screens/Drafts';
import { CaptureRunList } from './screens/CaptureRunList';
import { CaptureRunForm } from './screens/CaptureRunForm';
import { Dhis2Status } from './screens/Dhis2Status';
import { SyncStatus } from './screens/SyncStatus';
import { NetworkStatus } from './screens/NetworkStatus';

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
      <DerHeader />
      <DeviceBoot />
      <main className="der-main" data-test="der-main">
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/edge-error" element={<EdgeConnectionError />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Launcher />
              </RequireAuth>
            }
          />
          <Route
            path="/launcher"
            element={
              <RequireAuth>
                <Launcher />
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
          {/* Phase 06 Release 1 — DC-06..17 */}
          <Route path="/aggregate/datasets" element={
            <RequireAuth><AggregateDatasetPicker /></RequireAuth>
          } />
          <Route path="/aggregate/entry" element={
            <RequireAuth><AggregateEntry /></RequireAuth>
          } />
          <Route path="/programs" element={
            <RequireAuth><ProgramPicker /></RequireAuth>
          } />
          <Route path="/programs/:program/events" element={
            <RequireAuth><EventList /></RequireAuth>
          } />
          <Route path="/programs/:program/events/new" element={
            <RequireAuth><EventNew /></RequireAuth>
          } />
          <Route path="/tracker/:program/search" element={
            <RequireAuth><TrackerSearch /></RequireAuth>
          } />
          <Route path="/tracker/:program/tei/:tei" element={
            <RequireAuth><TrackerDashboard /></RequireAuth>
          } />
          <Route path="/tracker/:program/enroll" element={
            <RequireAuth><EnrollmentCreate /></RequireAuth>
          } />
          <Route path="/tracker/:program/stage/:stage/new" element={
            <RequireAuth><EventNew /></RequireAuth>
          } />
          <Route path="/scheduled" element={
            <RequireAuth><ScheduledEvents /></RequireAuth>
          } />
          <Route path="/review" element={
            <RequireAuth><SubmittedReview /></RequireAuth>
          } />
          <Route path="/drafts" element={
            <RequireAuth><Drafts /></RequireAuth>
          } />
          {/* ADR-0036 — workflow-scoped capture */}
          <Route path="/capture/runs" element={
            <RequireAuth><CaptureRunList /></RequireAuth>
          } />
          <Route path="/capture/runs/:id/form" element={
            <RequireAuth><CaptureRunForm /></RequireAuth>
          } />
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
        </Routes>
      </main>
      </OrgUnitBindingProvider>
    </AuthProvider>
  );
}
