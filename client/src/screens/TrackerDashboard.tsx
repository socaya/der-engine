import { useParams, Link } from 'react-router-dom';
import { OfflineBanner } from '../components/ScreenStates';

/** DC-12 — tracker TEI dashboard stub. */
export function TrackerDashboard(): JSX.Element {
  const { program = '', tei = '' } = useParams();
  return (
    <div className="der-tracker-dashboard">
      <h1 data-test="tracker-dashboard-heading">
        Tracker dashboard — <span data-test="tracker-dashboard-tei">{tei}</span>
      </h1>
      <OfflineBanner testId="tracker-dashboard-offline" />
      <p data-test="tracker-dashboard-program">Program: {program}</p>
      <nav>
        <Link to={`/tracker/${program}/stage/__PLACEHOLDER__/new`}
              data-test="tracker-dashboard-add-event">
          Add stage event
        </Link>
        {' | '}
        <Link to={`/tracker/${program}/search`} data-test="tracker-dashboard-back">
          Back to search
        </Link>
      </nav>
    </div>
  );
}
