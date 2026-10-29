import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UiIcon } from '../components/UiIcon';

/** §8 — guided tour shown on first operator sign-in. Stores
 *  "tour.dismissed=true" in user_preference so it never shows
 *  twice for the same operator. */
export function OnboardingTour(): JSX.Element | null {
  const [open, setOpen]     = useState(false);
  const [step, setStep]     = useState(0);

  useEffect(() => {
    fetch('/edge-api/v1/user-prefs', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { prefs: {} })
      .then((b) => {
        if (!b.prefs || b.prefs['tour.dismissed'] !== 'true') setOpen(true);
      })
      .catch(() => undefined);
  }, []);

  function dismiss(): void {
    setOpen(false);
    fetch('/edge-api/v1/user-prefs/tour.dismissed', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'true' }),
    }).catch(() => undefined);
  }

  if (!open) return null;

  const steps = [
    {
      title: 'Welcome to DER',
      body: (
        <p>
          DER is the Edge Runtime that keeps your facility working when the
          central DHIS2 is unreachable. This five-step tour shows where every
          operational area lives. You can skip and come back any time.
        </p>
      ),
    },
    {
      title: 'Overview',
      body: (
        <>
          <p>
            The <strong>Overview</strong> page is the always-on health dashboard.
            Green dots → everything's fine. Yellow / red → operator attention
            needed.
          </p>
          <p>
            <Link to="/" onClick={dismiss} className="ea-link-btn">Open Overview →</Link>
          </p>
        </>
      ),
    },
    {
      title: 'Network',
      body: (
        <>
          <p>
            <strong>Network</strong> is where you manage the Access Point,
            Connected devices, Interfaces, Peers, Firewall, Device messaging
            and Mesh topology. Clicking <em>Enrol a device</em> on Connected
            Devices generates a QR code devices scan to join DER-EDGE.
          </p>
          <p>
            <Link to="/network" onClick={dismiss} className="ea-link-btn">Open Network →</Link>
          </p>
        </>
      ),
    },
    {
      title: 'Backup + Security',
      body: (
        <>
          <p>
            Under <strong>Security &amp; Audit</strong> you'll find the audit
            trail, Compliance (retention + right-to-erasure + audit anchors),
            Backup, Restore and Recovery. The scheduled backup verifier runs
            every Sunday 04:00.
          </p>
          <p>
            <Link to="/compliance" onClick={dismiss} className="ea-link-btn">Open Compliance →</Link>
          </p>
        </>
      ),
    },
    {
      title: "You're all set",
      body: (
        <>
          <p>
            Keep an eye on the top bar — a red dot means central DHIS2 is
            unreachable; DER keeps running regardless. Workflows under
            <strong> Workflows</strong> or <strong>Data</strong> are where
            you'll spend most of your day.
          </p>
          <p>
            Need help? Every page has a Diagnostics action in the top-right.
          </p>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="ea-modal-overlay"
         role="dialog" aria-modal="true" aria-labelledby="onboarding-title"
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 2000 }}>
      <div className="ea-modal"
           style={{ background: 'var(--der-surface)', border: '1px solid var(--der-border)',
                    padding: 24, maxWidth: 520, width: '90%', boxShadow: 'var(--el-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <UiIcon icon="overview" size={16} />
          <h2 id="onboarding-title" style={{ margin: 0, fontSize: 18 }}>
            {current.title}
          </h2>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--der-ink-700)' }}>
          {current.body}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 4 }} aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} style={{ height: 4, flex: 1,
              background: i <= step ? 'var(--der-primary)' : 'var(--der-border)' }} />
          ))}
        </div>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="ea-link-btn" onClick={dismiss}
                  aria-label="Skip the onboarding tour">
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                      onClick={() => setStep(step - 1)}>Back</button>
            )}
            {!isLast ? (
              <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                      onClick={() => setStep(step + 1)}>Next</button>
            ) : (
              <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                      onClick={dismiss}>Get started</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
