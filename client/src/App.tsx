import { Route, Routes } from 'react-router-dom';
import { HeaderBar } from '@dhis2/ui';
import { AuthProvider } from './auth/AuthContext';
import { DeviceBoot } from './device/DeviceBoot';
import { RequireAuth } from './components/RequireAuth';
import { SignIn } from './screens/SignIn';
import { Launcher } from './screens/Launcher';
import { SessionDetails } from './screens/SessionDetails';
import { RecentWork } from './screens/RecentWork';
import { MetadataBrowser } from './screens/MetadataBrowser';
import { EdgeConnectionError } from './screens/EdgeConnectionError';
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

/**
 * DER device-client router. Routes correspond to screen IDs in
 * `docs/ui/source-screen-inventory.csv`:
 *
 *   /sign-in                             DC-01
 *   /session                             DC-02
 *   /launcher                            DC-03
 *   /recent                              DC-04
 *   /metadata/organisation-units         DC-05 metadata lane (writes land in Phase 03.5)
 *   /metadata/data-sets                  DC-05 continued
 *   /metadata/data-elements              DC-05 continued
 *   /metadata/programs                   DC-08 + DC-11 metadata lane
 *   /metadata/tracked-entity-types       DC-11 metadata lane
 *   /edge-error                          DC-18
 *
 * The DHIS2 Application-Platform HeaderBar is at the top so visually the
 * client is indistinguishable from a stock DHIS2 app running against DER.
 */
export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <HeaderBar appName="DER Edge Runtime" />
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
          <Route
            path="/metadata/organisation-units"
            element={
              <RequireAuth>
                <MetadataBrowser
                  resource="organisationUnits"
                  title="Organisation units"
                  extraColumns={[{ header: 'Level', field: 'level' }]}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/metadata/data-sets"
            element={
              <RequireAuth>
                <MetadataBrowser
                  resource="dataSets"
                  title="Data sets"
                  extraColumns={[{ header: 'Period type', field: 'periodType' }]}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/metadata/data-elements"
            element={
              <RequireAuth>
                <MetadataBrowser
                  resource="dataElements"
                  title="Data elements"
                  extraColumns={[
                    { header: 'Value type', field: 'valueType' },
                    { header: 'Domain', field: 'domainType' },
                  ]}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/metadata/programs"
            element={
              <RequireAuth>
                <MetadataBrowser
                  resource="programs"
                  title="Programs"
                  extraColumns={[{ header: 'Program type', field: 'programType' }]}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/metadata/tracked-entity-types"
            element={
              <RequireAuth>
                <MetadataBrowser
                  resource="trackedEntityTypes"
                  title="Tracked entity types"
                />
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
        </Routes>
      </main>
    </AuthProvider>
  );
}
