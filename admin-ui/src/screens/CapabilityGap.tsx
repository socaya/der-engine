import { useParams, useLocation } from 'react-router-dom';

/**
 * Placeholder for routes marked `capability-gap` in the navigation
 * registry. Per the navigation specification §3 and §5, we render
 * an honest "not yet implemented" page instead of inventing data or
 * mock endpoints.
 */
export function CapabilityGap(): JSX.Element {
  const loc = useLocation();
  const { label } = useParams();
  const title = typeof label === 'string' ? label : loc.pathname;
  return (
    <div className="ea-screen">
      <section className="ea-gap" data-test="capability-gap">
        <div className="ea-gap-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16v.5" />
          </svg>
        </div>
        <div className="ea-gap-body">
          <h1>Capability not available</h1>
          <p>
            This surface is defined in the DER admin navigation
            specification but no verified server endpoint ships yet.
            It will enable once the backing API is implemented and
            tested — the entry stays visible so operators understand
            the planned shape of the console.
          </p>
          <dl>
            <dt>Route</dt><dd><code>{loc.pathname}</code></dd>
            <dt>Label</dt><dd>{title}</dd>
            <dt>Status</dt><dd><span className="ea-chip ea-chip--warning">not available</span></dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
