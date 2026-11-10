import { useCallback, useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAlert } from '../components/AlertStack';
import { CronPicker } from '../components/CronPicker';
import { UiIcon } from '../components/UiIcon';

/** UI-10 — Sync Policy admin screen.
 *
 *  <p>Cleaner layout + first-class coverage of EVERY DER↔DHIS2
 *  sync object: both outbound writes (entity types) and scheduled
 *  background jobs (metadata pull, data pull, compat probe, drift
 *  snapshot, referral inbox/escalation, backup drain, analytics
 *  refresh). Cron entry is a preset dropdown + optional custom
 *  field so operators don't have to hand-write Quartz
 *  expressions.</p>
 */

const SCOPE_LABEL: Record<string, string> = {
  GLOBAL: 'Global default',
  // Writes
  AGGREGATE_DATA_VALUE:         'Aggregate values',
  AGGREGATE_DATASET_COMPLETION: 'Dataset completions',
  EVENT:                         'Events',
  TRACKED_ENTITY:                'Tracked entities',
  ENROLLMENT:                    'Enrolments',
  PROGRAM_STAGE_EVENT:           'Stage events',
  RELATIONSHIP:                  'Relationships',
  ENROLMENT_NOTE:                'Enrolment notes',
  // Scheduled
  METADATA_SYNC:        'Metadata sync (pull)',
  DATA_PULL:            'Data pull',
  COMPAT_REFRESH:       'Compatibility probe',
  DRIFT_SNAPSHOT:       'Drift snapshot',
  ANALYTICS_REFRESH:    'Analytics refresh',
  REFERRAL_INBOX:       'Referral inbox poll',
  REFERRAL_ESCALATION:  'Referral escalation',
  BACKUP_DRAIN:         'Backup / restore drain',
};

const SCOPE_HINT: Record<string, string> = {
  METADATA_SYNC:   'Pulls metadata catalogue from DHIS2 central',
  DATA_PULL:       'Pulls central-side aggregate / events / tracker data',
  COMPAT_REFRESH:  'Probes DHIS2 version + schema compatibility',
  DRIFT_SNAPSHOT:  'Captures a metadata snapshot for change detection',
  REFERRAL_INBOX:  'Polls the peer referral inbox',
  REFERRAL_ESCALATION: 'Escalates overdue referrals',
  BACKUP_DRAIN:    'Runs scheduled backup / restore jobs',
  ANALYTICS_REFRESH: 'Refreshes the analytics cache',
};

export function SyncPolicyScreen(
  { api = edgeApi }:
  { api?: Pick<typeof edgeApi, 'listSyncPolicies' | 'upsertSyncPolicy'
            | 'resetSyncPolicy' | 'syncPolicySummary' | 'syncPolicyAudit'> } = {},
): JSX.Element {
  const alert = useAlert();
  const [rows, setRows] = useState<edgeApi.SyncPolicyRow[] | null>(null);
  const [heldByScope, setHeldByScope] = useState<Map<string, number>>(new Map());
  const [auditEntries, setAuditEntries] =
    useState<edgeApi.SyncPolicyAuditEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [openScope, setOpenScope] = useState<string | null>('GLOBAL');

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const [p, s, a] = await Promise.all([
        api.listSyncPolicies(),
        (api.syncPolicySummary ?? edgeApi.syncPolicySummary)(),
        (api.syncPolicyAudit ?? edgeApi.syncPolicyAudit)(50),
      ]);
      setRows(p.policies);
      const m = new Map<string, number>();
      s.scopes.forEach((x) => m.set(x.scope, x.held ?? 0));
      setHeldByScope(m);
      setAuditEntries(a.entries);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message ?? 'Failed to load sync policies');
    }
  }, [api]);

  useEffect(() => { void refetch(); }, [refetch]);

  const byKind = useMemo(() => {
    const out: Record<edgeApi.SyncPolicyKind, edgeApi.SyncPolicyRow[]> = {
      GLOBAL: [], WRITE: [], SCHEDULED: [],
    };
    (rows ?? []).forEach((r) => {
      if (r.scope === 'GLOBAL') out.GLOBAL.push(r);
      else out[(r.kind ?? 'WRITE')].push(r);
    });
    return out;
  }, [rows]);

  async function save(scope: string, mode: edgeApi.SyncMode,
      cron?: string | null, reason?: string | null): Promise<void> {
    setSavingScope(scope);
    try {
      await api.upsertSyncPolicy(scope, { mode, cron, reason });
      alert.show({ kind: 'success',
        message: `Saved ${SCOPE_LABEL[scope] ?? scope} → ${mode}` });
      await refetch();
    } catch (e) {
      alert.show({ kind: 'critical', title: 'Save failed',
        message: (e as Error).message });
    } finally {
      setSavingScope(null);
    }
  }
  async function reset(scope: string): Promise<void> {
    setSavingScope(scope);
    try {
      await api.resetSyncPolicy(scope);
      alert.show({ kind: 'success',
        message: `Reset ${SCOPE_LABEL[scope] ?? scope} to inherit Global` });
      await refetch();
    } catch (e) {
      alert.show({ kind: 'critical', title: 'Reset failed',
        message: (e as Error).message });
    } finally {
      setSavingScope(null);
    }
  }

  if (err && !rows) {
    return (
      <ErrorBlock title="Could not load sync policies" testId="sync-policy-error">
        {err}
      </ErrorBlock>
    );
  }
  if (!rows) return <LoadingBlock testId="sync-policy-loading" />;

  const global = byKind.GLOBAL[0];

  return (
    <div data-test="sync-policy-screen">
      <ScreenHeader title="Sync policy"
        subtitle="Decide how DER ships data to — and pulls from — DHIS2 central. Applies to every sync object: outbound writes and scheduled background jobs." />

      {global && (
        <Panel title="Global default">
          <PolicyRow
            row={global}
            held={0}
            saving={savingScope === 'GLOBAL'}
            isOpen={openScope === 'GLOBAL'}
            onToggle={() => setOpenScope((v) => v === 'GLOBAL' ? null : 'GLOBAL')}
            onSave={(mode, cron, reason) => save('GLOBAL', mode, cron, reason)}
            allowReset={false} />
        </Panel>
      )}

      <Panel title="Outbound writes"
             subtitle="Entity types that DER pushes to DHIS2 central. Each row inherits Global unless overridden.">
        <div style={{ display: 'grid', gap: 6 }}>
          {byKind.WRITE.map((r) => (
            <PolicyRow key={r.scope}
              row={r}
              held={heldByScope.get(r.scope) ?? 0}
              saving={savingScope === r.scope}
              isOpen={openScope === r.scope}
              onToggle={() => setOpenScope((v) => v === r.scope ? null : r.scope)}
              onSave={(mode, cron, reason) => save(r.scope, mode, cron, reason)}
              onReset={() => reset(r.scope)}
              allowReset={!(r.inherited ?? false)} />
          ))}
        </div>
      </Panel>

      <Panel title="Scheduled jobs"
             subtitle="Background pulls + maintenance tasks. INSTANT doesn't apply — these are cron-only.">
        <div style={{ display: 'grid', gap: 6 }}>
          {byKind.SCHEDULED.map((r) => (
            <PolicyRow key={r.scope}
              row={r}
              held={0}
              saving={savingScope === r.scope}
              isOpen={openScope === r.scope}
              onToggle={() => setOpenScope((v) => v === r.scope ? null : r.scope)}
              onSave={(mode, cron, reason) => save(r.scope, mode, cron, reason)}
              onReset={() => reset(r.scope)}
              allowReset={!(r.inherited ?? false)}
              scheduledOnly />
          ))}
        </div>
      </Panel>

      <PolicyAuditPanel entries={auditEntries} />
    </div>
  );
}

function Panel(
  { title, subtitle, children }:
  { title: string; subtitle?: string; children: React.ReactNode },
): JSX.Element {
  return (
    <section className="ea-panel" style={{ marginBottom: 14 }}>
      <header className="ea-panel-head"
              style={{ paddingBottom: 6 }}>
        <h2 className="ea-panel-title">{title}</h2>
        {subtitle && (
          <p className="ea-text-muted"
             style={{ margin: 0, fontSize: 12 }}>
            {subtitle}
          </p>
        )}
      </header>
      <div className="ea-panel-body">{children}</div>
    </section>
  );
}

/** One scope rendered as a compact row that expands into its editor. */
function PolicyRow(
  { row, held, saving, isOpen, onToggle, onSave, onReset,
    allowReset, scheduledOnly = false }: {
    row: edgeApi.SyncPolicyRow;
    held: number;
    saving: boolean;
    isOpen: boolean;
    onToggle: () => void;
    onSave: (mode: edgeApi.SyncMode, cron?: string | null, reason?: string | null) => void;
    onReset?: () => void;
    allowReset: boolean;
    scheduledOnly?: boolean;
  },
): JSX.Element {
  const inherited = row.inherited ?? false;
  const effective: edgeApi.SyncMode = row.mode;
  const [mode, setMode] = useState<edgeApi.SyncMode>(effective);
  const [cron, setCron] = useState<string>(row.cron ?? '0 * * * * ?');
  const [reason, setReason] = useState<string>(row.pausedReason ?? '');
  const [hint] = useState<string | undefined>(SCOPE_HINT[row.scope]);

  useEffect(() => {
    setMode(effective);
    setCron(row.cron ?? '0 * * * * ?');
    setReason(row.pausedReason ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.mode, row.cron, row.pausedReason]);

  const label = SCOPE_LABEL[row.scope] ?? row.scope;
  const dirty = mode !== effective
    || (mode === 'SCHEDULED' && cron !== (row.cron ?? '0 * * * * ?'))
    || (mode === 'PAUSED' && reason !== (row.pausedReason ?? ''));
  const canSave = dirty
    && !(mode === 'SCHEDULED' && !cron.trim())
    && !(mode === 'PAUSED' && !reason.trim());
  const availableModes: edgeApi.SyncMode[] = scheduledOnly
    ? ['SCHEDULED', 'PAUSED']
    : ['INSTANT', 'SCHEDULED', 'PAUSED'];

  return (
    <div className="ea-policy-row"
         data-test={`sync-policy-row-${row.scope}`}
         style={{
           border: '1px solid var(--der-border-soft, #e2e6ef)',
           borderRadius: 6,
           background: 'var(--der-surface, #fff)',
         }}>
      {/* Compact summary bar — click to expand editor. */}
      <button type="button"
              onClick={onToggle}
              data-test={`sync-policy-toggle-${row.scope}`}
              className="ea-policy-row__head"
              style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center',
                gap: 10, padding: '10px 12px',
                background: 'transparent', border: 0, cursor: 'pointer',
                fontSize: 13,
              }}>
        <UiIcon icon={isOpen ? 'edit' : 'cog'} size={12} />
        <strong>{label}</strong>
        <ModeChip mode={effective} />
        {held > 0 && effective === 'PAUSED' && (
          <span className="ea-chip ea-chip--warning"
                data-test={`sync-policy-held-${row.scope}`}
                title={`${held} pending row${held === 1 ? '' : 's'} held by this paused scope`}
                style={{ fontSize: 11 }}>
            {held} held
          </span>
        )}
        {row.scope === 'GLOBAL' ? (
          <span className="ea-text-muted" style={{ fontSize: 11,
                                                    marginLeft: 'auto' }}>
            Fallback for every other scope
          </span>
        ) : (
          <span className="ea-text-muted" style={{ fontSize: 11,
                                                    marginLeft: 'auto' }}>
            {inherited ? `Inherits Global` : `Overridden`}
            {hint ? ` · ${hint}` : ''}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="ea-policy-row__body"
             data-test={`sync-policy-body-${row.scope}`}
             style={{ padding: '2px 12px 12px',
                       borderTop: '1px solid var(--der-border-soft, #edf0f5)' }}>
          <div role="radiogroup" aria-label={`Mode for ${label}`}
               style={{ display: 'flex', gap: 6, flexWrap: 'wrap',
                         margin: '10px 0 10px' }}>
            {availableModes.map((m) => (
              <button type="button"
                      key={m}
                      data-test={`sync-policy-tile-${row.scope}-${m}`}
                      onClick={() => setMode(m)}
                      className={'ea-btn ea-btn--sm'
                        + (mode === m ? ' ea-btn--primary' : ' ea-btn--ghost')}>
                {m[0] + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {mode === 'SCHEDULED' && (
            <div style={{ marginBottom: 10 }}>
              <div className="ea-field-label"
                   style={{ fontSize: 11, marginBottom: 4 }}>
                Schedule
              </div>
              <CronPicker value={cron}
                           onChange={setCron} />
            </div>
          )}

          {mode === 'PAUSED' && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                             marginBottom: 10 }}>
              <span style={{ minWidth: 80, fontSize: 12 }}>Reason</span>
              <input value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     placeholder="Why is this scope paused? (audit trail)"
                     data-test={`sync-policy-reason-${row.scope}`}
                     className="ea-input"
                     style={{ flex: 1 }} />
            </label>
          )}

          <div style={{ display: 'flex', gap: 8,
                         justifyContent: 'flex-end' }}>
            {onReset && allowReset && (
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      data-test={`sync-policy-reset-${row.scope}`}
                      disabled={saving}
                      onClick={onReset}>
                Reset to Global
              </button>
            )}
            <button type="button"
                    className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test={`sync-policy-save-${row.scope}`}
                    disabled={!canSave || saving}
                    onClick={() => onSave(mode,
                      mode === 'SCHEDULED' ? cron : null,
                      mode === 'PAUSED' ? reason : null)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeChip({ mode }: { mode: edgeApi.SyncMode }): JSX.Element {
  const tone = mode === 'INSTANT' ? 'success'
    : mode === 'SCHEDULED' ? 'info' : 'warning';
  return (
    <span className={`ea-chip ea-chip--${tone}`}
          style={{ fontSize: 11 }}>
      {mode[0] + mode.slice(1).toLowerCase()}
    </span>
  );
}

function PolicyAuditPanel(
  { entries }: { entries: edgeApi.SyncPolicyAuditEntry[] },
): JSX.Element {
  return (
    <Panel title="Recent changes"
           subtitle="Every save and reset is appended to the security audit log. Newest first.">
      {entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13,
                     color: 'var(--der-text-muted, #6b7280)' }}>
          No policy changes recorded yet.
        </p>
      ) : (
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="sync-policy-audit">
            <thead>
              <tr><th>When</th><th>Event</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.at + e.eventType}
                    data-test={`sync-policy-audit-row-${e.at}`}>
                  <td className="ea-mono" style={{ fontSize: 11 }}>
                    {new Date(e.at).toLocaleString()}
                  </td>
                  <td>
                    <span className={'ea-chip ea-chip--'
                        + (e.eventType === 'SYNC_POLICY_RESET' ? 'info' : 'warning')}>
                      {e.eventType === 'SYNC_POLICY_RESET' ? 'Reset' : 'Update'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {renderAuditDetail(e.detailJson)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function renderAuditDetail(json: string): string {
  try {
    const d = JSON.parse(json) as Record<string, unknown>;
    const scope = String(d.scope ?? '?');
    const from = d.fromMode ? String(d.fromMode) : '—';
    const to = d.toMode ? String(d.toMode) : '(reset)';
    const reason = d.toReason ? ` · "${String(d.toReason)}"` : '';
    const label = SCOPE_LABEL[scope] ?? scope;
    return `${label}: ${from} → ${to}${reason}`;
  } catch {
    return json;
  }
}
