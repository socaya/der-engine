import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { HeroHeader } from '../../components/HeroHeader';
import { ErrorBlock } from '../../components/ScreenStates';

/**
 * §2.3.58 — admin-side Activity overview. Shows at-a-glance counts of
 * work in the operational queues (My queue / Approvals / Referrals)
 * so admins can see where backlog builds up without owning the
 * day-to-day capture work, which happens on the device-side client UI.
 *
 * Every card drills into the full operator surface (status: 'contextual'
 * in the nav registry) so admins can inspect but don't live there.
 */

interface Tile {
  readonly label: string;
  readonly count: number | null;
  readonly tone: 'info' | 'warning' | 'danger' | 'neutral';
  readonly to: string;
  readonly cta: string;
  readonly description: string;
}

export interface WorkflowActivityProps {
  api?: Pick<typeof edgeApi, 'workflowQueue' | 'listPendingApprovals'
                               | 'listWorkflows'>;
}

export function WorkflowActivity({ api = edgeApi }:
    WorkflowActivityProps = {}): JSX.Element {
  const [workflowCount, setWorkflowCount] = useState<number | null>(null);
  const [queueReady, setQueueReady] = useState<number | null>(null);
  const [queueBlocked, setQueueBlocked] = useState<number | null>(null);
  const [approvals, setApprovals] = useState<number | null>(null);
  const [referrals, setReferrals] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listWorkflows()
      .then((r) => setWorkflowCount(r.workflows.length))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    api.workflowQueue({ allDevices: true })
      .then((r) => {
        setQueueReady(r.rows.filter((x) => x.readiness === 'READY').length);
        setQueueBlocked(r.rows.filter((x) => x.readiness === 'BLOCKED').length);
      })
      .catch(() => { setQueueReady(0); setQueueBlocked(0); });
    api.listPendingApprovals()
      .then((r) => setApprovals(r.rows.length))
      .catch(() => setApprovals(0));
    fetch('/edge-api/v1/referral/inbox?limit=500',
          { credentials: 'include', headers: { Accept: 'application/json' } })
      .then((r) => r.ok ? r.json() : { rows: [] })
      .then((body: { rows?: unknown[] }) => setReferrals(body.rows?.length ?? 0))
      .catch(() => setReferrals(0));
  }, [api]);

  const tiles: Tile[] = [
    {
      label: 'Workflows defined',
      count: workflowCount,
      tone: 'info',
      to: '/workflows/manage',
      cta: 'Manage',
      description: 'Capture workflows configured on this edge.',
    },
    {
      label: 'Ready to capture',
      count: queueReady,
      tone: 'info',
      to: '/workflows/queue',
      cta: 'View queue',
      description: 'Steps across all devices that are ready for operators to capture.',
    },
    {
      label: 'Blocked (waiting on predecessor)',
      count: queueBlocked,
      tone: 'neutral',
      to: '/workflows/queue',
      cta: 'View queue',
      description: 'Steps waiting on an earlier step to finish before they open.',
    },
    {
      label: 'Approvals pending',
      count: approvals,
      tone: approvals !== null && approvals > 0 ? 'warning' : 'neutral',
      to: '/approvals',
      cta: 'Review',
      description: 'Operations awaiting a reviewer sign-off before draining to DHIS2.',
    },
    {
      label: 'Referrals pending intake',
      count: referrals,
      tone: referrals !== null && referrals > 0 ? 'warning' : 'neutral',
      to: '/referral/inbox',
      cta: 'Open inbox',
      description: 'Patients referred to this edge’s organisation unit awaiting intake.',
    },
  ];

  return (
    <div className="ea-screen" data-test="wf-activity-root">
      <HeroHeader
        title="Activity"
        actions={
          <Link to="/workflows/manage" className="ea-btn ea-btn--primary ea-btn--sm">
            Open workflow management
          </Link>
        }
      />
      <h1 className="ea-visually-hidden" data-test="wf-activity-heading">
        Workflow activity
      </h1>

      {error && (
        <ErrorBlock title="Could not load activity"
                     testId="wf-activity-error">{error}</ErrorBlock>
      )}

      <div className="ea-wf-activity-grid" data-test="wf-activity-tiles">
        {tiles.map((t) => (
          <div key={t.label}
                className={'ea-wf-activity-tile ea-wf-activity-tile--' + t.tone}
                data-test={`wf-activity-tile-${t.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="ea-wf-activity-tile-count">
              {t.count == null ? <span className="ea-text-muted">—</span> : t.count}
            </div>
            <div className="ea-wf-activity-tile-label">{t.label}</div>
            <p className="ea-wf-activity-tile-desc">{t.description}</p>
            <Link to={t.to} className="ea-btn ea-btn--ghost ea-btn--sm">
              {t.cta} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
