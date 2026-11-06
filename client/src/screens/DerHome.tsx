import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import { count as countQueue } from '../offline/queue';

export interface DerHomeProps {
  readonly api?: Pick<typeof edgeApi, 'listDrafts' | 'journalWorkerHealth'>;
}

/**
 * ADR-0037 C-UI-3 — /. Three small cards plus nothing else.
 * Navigation moves through the topbar app-launcher overlay; this
 * screen just tells the operator who they are, where they are, and
 * what's waiting for them.
 *
 * - Bound-to: brand card. Pulled from the OU binding context.
 * - Pending:  three chips (queued offline, local drafts, journal
 *             attention backlog). Each is a Link to the relevant
 *             screen.
 * - Online :  reports navigator.onLine, not central reachability
 *             (which is covered by the Sync-Status screen).
 */
export function DerHome({ api = edgeApi }: DerHomeProps = {}): JSX.Element {
  const binding = useOrgUnitBinding();
  const online = useOnlineStatus();

  const [queued, setQueued] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [attention, setAttention] = useState<number | null>(null);

  // Offline-queue count from IndexedDB.
  useEffect(() => {
    let cancelled = false;
    countQueue('aggregate')
      .then((n) => { if (!cancelled) setQueued(n); })
      .catch(() => { if (!cancelled) setQueued(0); });
    return () => { cancelled = true; };
  }, [online]);

  // Draft count.
  useEffect(() => {
    let cancelled = false;
    api.listDrafts()
      .then((r) => { if (!cancelled) setDrafts(r.drafts.length); })
      .catch(() => { if (!cancelled) setDrafts(0); });
    return () => { cancelled = true; };
  }, [api]);

  // Attention count — PENDING + RETRYABLE + CONFLICT_REVIEW backlog
  // from the journal worker. Rolled into one chip for the operator.
  useEffect(() => {
    let cancelled = false;
    api.journalWorkerHealth()
      .then((h) => {
        if (cancelled) return;
        const total = ['PENDING', 'RETRYABLE', 'CONFLICT_REVIEW', 'UNKNOWN_OUTCOME']
          .reduce((n, k) => n + (h.backlog[k] ?? 0), 0);
        setAttention(total);
      })
      .catch(() => { if (!cancelled) setAttention(0); });
    return () => { cancelled = true; };
  }, [api]);

  const bound = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding
    : null;

  return (
    <div className="der-home" data-test="der-home">
      <section className="der-card der-card--brand" data-test="der-home-bound">
        <div className="der-card__title">Bound to</div>
        {bound ? (
          <>
            <div className="der-card__value">
              {bound.orgUnitDisplayName ?? bound.orgUnitId}
            </div>
            <div className="der-card__meta">
              <code>{bound.orgUnitId}</code>
              {bound.orgUnitPath && <> · <span>{bound.orgUnitPath}</span></>}
            </div>
            {bound.boundAt && (
              <div className="der-card__meta">
                Since {new Date(bound.boundAt).toLocaleString()}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="der-card__value">Not bound</div>
            <div className="der-card__meta">
              An admin must bind this edge to an organisation unit before
              capture can proceed.
            </div>
          </>
        )}
      </section>

      <h2 className="der-home__section-title">Pending</h2>
      <div className="der-home__grid">
        <section className="der-card" data-test="der-home-queued">
          <div className="der-card__title">Queued offline</div>
          <div className="der-card__value">{queued ?? '—'}</div>
          <div className="der-card__meta">
            {online ? 'Draining when the drain tick fires.'
                    : 'You are offline. They will sync on reconnect.'}
          </div>
          <Link to="/review" className="der-card__link"
                data-test="der-home-queued-link">
            Review submissions →
          </Link>
        </section>

        <section className="der-card" data-test="der-home-drafts">
          <div className="der-card__title">Local drafts</div>
          <div className="der-card__value">{drafts ?? '—'}</div>
          <div className="der-card__meta">Resume captures you haven&apos;t submitted.</div>
          <Link to="/drafts" className="der-card__link"
                data-test="der-home-drafts-link">
            Open drafts →
          </Link>
        </section>

        <section className="der-card" data-test="der-home-attention">
          <div className="der-card__title">Journal attention</div>
          <div className="der-card__value">{attention ?? '—'}</div>
          <div className="der-card__meta">
            Pending + retryable + conflict-review rows on this edge.
          </div>
          <Link to="/sync/status" className="der-card__link"
                data-test="der-home-attention-link">
            Open sync status →
          </Link>
        </section>
      </div>

      <h2 className="der-home__section-title">What next</h2>
      <section className="der-card" data-test="der-home-next">
        <div className="der-card__meta">
          Use the app launcher
          <span style={{ display: 'inline-flex', verticalAlign: 'middle',
                          margin: '0 6px', opacity: 0.7 }}
                 aria-hidden="true">▦</span>
          in the top-right to open a Server Module — DHIS2 status,
          Synchronisation, Network, Workflows (capture runs), Data
          (aggregate entry, programs, drafts), or Administration.
        </div>
      </section>
    </div>
  );
}
