import { useEffect, useRef, useState } from 'react';

/**
 * ContextInspector — v3 §5.3 right-side overlay panel (320–380 px
 * on desktop, full-width sheet on narrow viewports) that surfaces
 * audit / sync / rule state on demand. Closed by default per
 * DER-STYLE-005 ("progressive disclosure"); operators click the
 * toolbar button or hit Alt+D to open it.
 *
 * <p>This first pass ships a two-tab layout: <em>Sync</em> (edge
 * link + queued-write count + last-drain nudge) and
 * <em>Context</em> (program + OU + device). Audit + rule-trace
 * tabs are deferred to a later slice when the server surfaces
 * per-record journal rows and per-form rule-trace blobs.</p>
 */
export function ContextInspector(
  { open, onClose, isOnline, queuedCount, onFlush,
    programLabel, programUid, modeLabel, ouLabel, ouUid,
    deviceId, deviceStatus, workflowCount }: {
    open: boolean;
    onClose: () => void;
    isOnline: boolean;
    queuedCount: number;
    onFlush: () => Promise<void>;
    programLabel: string | null;
    programUid: string | null;
    modeLabel: string | null;
    ouLabel: string;
    ouUid: string;
    deviceId: string | null;
    deviceStatus: string | null;
    workflowCount: number;
  },
): JSX.Element | null {
  const [tab, setTab] = useState<'sync' | 'context'>('sync');
  const [flushing, setFlushing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    // Move initial focus into the panel so Tab stays within it and
    // screen readers announce the dialog.
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const kind = !isOnline && queuedCount > 0 ? 'offline-held'
    : !isOnline ? 'offline'
    : queuedCount > 0 ? 'syncing'
    : 'live';
  const kindLabel = ({
    'live': 'Live sync',
    'syncing': `Syncing · ${queuedCount} pending`,
    'offline': 'Offline',
    'offline-held': `Offline · ${queuedCount} held locally`,
  } as Record<typeof kind, string>)[kind];
  const canFlush = isOnline && queuedCount > 0 && !flushing;

  return (
    <div className="cap-insp-backdrop"
         role="dialog" aria-modal="true" aria-label="Capture context inspector"
         data-test="cap-inspector"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={panelRef} tabIndex={-1} className="cap-insp">
        <header className="cap-insp__head">
          <h3 className="cap-insp__title">Context</h3>
          <button type="button"
                  className="cap-insp__close"
                  aria-label="Close inspector"
                  data-test="cap-insp-close"
                  onClick={onClose}>×</button>
        </header>
        <nav className="cap-insp__tabs" role="tablist"
             aria-label="Inspector tabs">
          <button type="button"
                  role="tab"
                  aria-selected={tab === 'sync'}
                  data-test="cap-insp-tab-sync"
                  className={'cap-insp__tab'
                    + (tab === 'sync' ? ' cap-insp__tab--active' : '')}
                  onClick={() => setTab('sync')}>
            Sync
          </button>
          <button type="button"
                  role="tab"
                  aria-selected={tab === 'context'}
                  data-test="cap-insp-tab-context"
                  className={'cap-insp__tab'
                    + (tab === 'context' ? ' cap-insp__tab--active' : '')}
                  onClick={() => setTab('context')}>
            Context
          </button>
        </nav>
        <div className="cap-insp__body" role="tabpanel"
             data-test={'cap-insp-body-' + tab}>
          {tab === 'sync' && (
            <section>
              <dl className="cap-info__dl">
                <div>
                  <dt>Edge link</dt>
                  <dd className={'cap-insp__sync-line cap-insp__sync-line--' + kind}>
                    <span className="cap-net-status__dot"
                          aria-hidden="true" />
                    {kindLabel}
                  </dd>
                </div>
                <div>
                  <dt>Queued writes</dt>
                  <dd>{queuedCount === 0
                    ? '0 (nothing waiting for central)'
                    : queuedCount + ' pending'}</dd>
                </div>
                <div>
                  <dt>Central sync</dt>
                  <dd>
                    {canFlush ? (
                      <button type="button"
                              className="cap-btn cap-btn--secondary"
                              data-test="cap-insp-flush"
                              style={{ padding: '2px 10px', fontSize: 11 }}
                              onClick={async () => {
                                setFlushing(true);
                                await onFlush();
                                setTimeout(() => setFlushing(false), 1000);
                              }}>
                        Flush drain now
                      </button>
                    ) : flushing ? (
                      <em>Draining…</em>
                    ) : (
                      <em>Nothing to flush</em>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="cap-insp__hint">
                Writes land on the facility edge first, then propagate
                to central DHIS2 on the journal drain. <em>Saved on
                edge</em> and <em>Synced centrally</em> are distinct
                states — the toolbar pill tracks the first, this
                flush button triggers the second.
              </p>
            </section>
          )}
          {tab === 'context' && (
            <section>
              <dl className="cap-info__dl">
                <div>
                  <dt>Program</dt>
                  <dd>{programLabel
                    ? <><strong>{programLabel}</strong><br/>
                        <code>{programUid}</code></>
                    : <em>none selected</em>}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{modeLabel ?? <em>—</em>}</dd>
                </div>
                <div>
                  <dt>Bound OU</dt>
                  <dd><strong>{ouLabel}</strong><br/>
                    <code>{ouUid}</code></dd>
                </div>
                <div>
                  <dt>Device</dt>
                  <dd>{deviceId
                    ? <><code>{deviceId}</code><br/>
                        status {deviceStatus ?? '—'}</>
                    : <em>enrolling…</em>}</dd>
                </div>
                <div>
                  <dt>Workflows</dt>
                  <dd>{workflowCount === 0
                    ? 'none assigned to this device'
                    : workflowCount + ' step-assigned'}</dd>
                </div>
              </dl>
              <p className="cap-insp__hint">
                A per-record <em>Audit</em> + <em>Rule trace</em> tab
                lands in a later slice once the DER edge surfaces
                per-row journal history.
              </p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
