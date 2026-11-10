import { useCallback, useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAlert } from '../components/AlertStack';
import { Panel } from './shared';

const ALL_ENTITY_SCOPES = [
  'AGGREGATE_DATA_VALUE',
  'AGGREGATE_DATASET_COMPLETION',
  'EVENT',
  'TRACKED_ENTITY',
  'ENROLLMENT',
  'PROGRAM_STAGE_EVENT',
  'RELATIONSHIP',
  'ENROLMENT_NOTE',
] as const;

const SCOPE_LABEL: Record<string, string> = {
  AGGREGATE_DATA_VALUE: 'Aggregate data values',
  AGGREGATE_DATASET_COMPLETION: 'Dataset completions',
  EVENT: 'Events (event-only programs)',
  TRACKED_ENTITY: 'Tracked entities',
  ENROLLMENT: 'Enrolments',
  PROGRAM_STAGE_EVENT: 'Tracker stage events',
  RELATIONSHIP: 'Relationships',
  ENROLMENT_NOTE: 'Enrolment notes',
  GLOBAL: 'Global default',
};

const MODE_HELP: Record<edgeApi.SyncMode, string> = {
  INSTANT: 'Fire a drain tick within ~200 ms of every write (when central is reachable). The scheduled cron still runs as a safety net.',
  SCHEDULED: 'Only the scheduled cron drains rows for this scope.',
  PAUSED: 'Hold writes locally — the drain will skip them until you resume.',
};

export function SyncPolicyScreen(
  { api = edgeApi }:
  { api?: Pick<typeof edgeApi, 'listSyncPolicies' | 'upsertSyncPolicy'
            | 'resetSyncPolicy' | 'syncPolicySummary' | 'syncPolicyAudit'> } = {},
): JSX.Element {
  const alert = useAlert();
  const [rows, setRows] = useState<edgeApi.SyncPolicyRow[] | null>(null);
  const [heldByScope, setHeldByScope] = useState<Map<string, number>>(
    new Map());
  const [auditEntries, setAuditEntries] = useState<edgeApi.SyncPolicyAuditEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState<string | null>(null);

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

  const byScope = useMemo(() => {
    const m = new Map<string, edgeApi.SyncPolicyRow>();
    (rows ?? []).forEach((r) => m.set(r.scope, r));
    return m;
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
      <ErrorBlock title="Could not load sync policies"
                  testId="sync-policy-error">
        {err}
      </ErrorBlock>
    );
  }
  if (!rows) return <LoadingBlock testId="sync-policy-loading" />;

  const global = byScope.get('GLOBAL');

  return (
    <div data-test="sync-policy-screen">
      <ScreenHeader title="Sync policy"
        subtitle="Control how DER ships writes to DHIS2 central — pick a mode globally and optionally override per data type." />

      {/* Success + failure toasts are delivered via the shared
          AlertStack (useAlert) so operators see them in the same
          place as every other admin-wide alert. */}

      <Panel title="Global default">
        <p style={{ margin: '0 0 10px', fontSize: 12,
                     color: 'var(--der-text-muted, #6b7280)' }}>
          Applies to every data type unless an override below changes it.
        </p>
        {global && (
          <PolicyEditor row={global}
                        scope="GLOBAL"
                        canReset={false}
                        saving={savingScope === 'GLOBAL'}
                        onSave={(mode, cron, reason) => save('GLOBAL', mode, cron, reason)} />
        )}
      </Panel>

      <Panel title="Per data-type overrides">
        <p style={{ margin: '0 0 10px', fontSize: 12,
                     color: 'var(--der-text-muted, #6b7280)' }}>
          Each row inherits the global default unless you set an explicit
          mode. Use Pause for a single type during a central-side outage
          without stopping everything else.
        </p>
        <div className="sync-policy-grid"
             data-test="sync-policy-overrides"
             style={{ display: 'grid', gap: 10 }}>
          {ALL_ENTITY_SCOPES.map((scope) => {
            const row = byScope.get(scope);
            return (
              <PolicyEditor key={scope}
                            row={row ?? null}
                            scope={scope}
                            held={heldByScope.get(scope) ?? 0}
                            canReset={row != null && !(row.inherited ?? false)}
                            saving={savingScope === scope}
                            onSave={(mode, cron, reason) =>
                              save(scope, mode, cron, reason)}
                            onReset={() => reset(scope)} />
            );
          })}
        </div>
      </Panel>

      <PolicyAuditPanel entries={auditEntries} />
    </div>
  );
}

function PolicyAuditPanel(
  { entries }: { entries: edgeApi.SyncPolicyAuditEntry[] },
): JSX.Element {
  return (
    <Panel title="Recent changes">
      <p style={{ margin: '0 0 10px', fontSize: 12,
                   color: 'var(--der-text-muted, #6b7280)' }}>
        Every save and reset is appended to the security audit log.
        Newest first.
      </p>
      {entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13,
                     color: 'var(--der-text-muted, #6b7280)' }}>
          No policy changes recorded yet.
        </p>
      ) : (
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
    return `${scope}: ${from} → ${to}${reason}`;
  } catch {
    return json;
  }
}

function PolicyEditor(
  { row, scope, held = 0, canReset, saving, onSave, onReset }: {
    row: edgeApi.SyncPolicyRow | null;
    scope: string;
    held?: number;
    canReset: boolean;
    saving: boolean;
    onSave: (mode: edgeApi.SyncMode, cron?: string | null, reason?: string | null) => void;
    onReset?: () => void;
  },
): JSX.Element {
  const inherited = row?.inherited ?? false;
  const effective: edgeApi.SyncMode = row?.mode ?? 'SCHEDULED';
  const [mode, setMode] = useState<edgeApi.SyncMode>(effective);
  const [cron, setCron] = useState<string>(row?.cron ?? '0 * * * * ?');
  const [reason, setReason] = useState<string>(row?.pausedReason ?? '');

  // Resync local state if the row is refetched (after save).
  useEffect(() => {
    setMode(effective);
    setCron(row?.cron ?? '0 * * * * ?');
    setReason(row?.pausedReason ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.mode, row?.cron, row?.pausedReason]);

  const label = SCOPE_LABEL[scope] ?? scope;
  const dirty = mode !== effective
    || (mode === 'SCHEDULED' && cron !== (row?.cron ?? '0 * * * * ?'))
    || (mode === 'PAUSED' && reason !== (row?.pausedReason ?? ''));
  const canSave = dirty
    && !(mode === 'SCHEDULED' && !cron.trim())
    && !(mode === 'PAUSED' && !reason.trim());

  return (
    <div className="sync-policy-row"
         data-test={`sync-policy-row-${scope}`}
         style={{
           border: '1px solid var(--der-border-soft, #e2e6ef)',
           borderRadius: 8,
           padding: 12,
           background: 'var(--der-surface, #fff)',
         }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                     alignItems: 'baseline', gap: 12, marginBottom: 8,
                     flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>
          {label}
          {held > 0 && effective === 'PAUSED' && (
            <span
              data-test={`sync-policy-held-${scope}`}
              title={`${held} pending row${held === 1 ? '' : 's'} held because this scope is paused`}
              style={{
                marginLeft: 8,
                display: 'inline-block',
                padding: '1px 8px',
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(214, 138, 26, 0.12)',
                color: 'var(--der-warning, #d68a1a)',
                borderRadius: 10,
              }}>
              {held} held
            </span>
          )}
        </strong>
        <span style={{ fontSize: 12, color: 'var(--der-text-muted, #6b7280)' }}>
          {scope === 'GLOBAL'
            ? 'Fallback for everything else'
            : inherited
              ? `Inherits Global (currently ${effective})`
              : `Overridden to ${effective}`}
        </span>
      </div>

      <div role="radiogroup" aria-label={`Mode for ${label}`}
           style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {(['INSTANT', 'SCHEDULED', 'PAUSED'] as edgeApi.SyncMode[]).map((m) => (
          <label key={m}
                 className={`sync-policy-tile${mode === m ? ' is-active' : ''}`}
                 data-test={`sync-policy-tile-${scope}-${m}`}
                 style={{
                   flex: '1 1 160px',
                   border: `2px solid ${mode === m
                     ? 'var(--der-primary, #2563eb)'
                     : 'var(--der-border-soft, #e2e6ef)'}`,
                   borderRadius: 6,
                   padding: '8px 12px',
                   cursor: 'pointer',
                   background: mode === m
                     ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                 }}>
            <input type="radio"
                   name={`mode-${scope}`}
                   checked={mode === m}
                   value={m}
                   onChange={() => setMode(m)}
                   style={{ marginRight: 6 }} />
            <strong>{m[0] + m.slice(1).toLowerCase()}</strong>
            <div style={{ fontSize: 11,
                           color: 'var(--der-text-muted, #6b7280)',
                           marginTop: 2 }}>
              {MODE_HELP[m]}
            </div>
          </label>
        ))}
      </div>

      {mode === 'SCHEDULED' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center',
                         marginBottom: 6 }}>
          <span style={{ minWidth: 80, fontSize: 12 }}>Cron</span>
          <input value={cron}
                 onChange={(e) => setCron(e.target.value)}
                 placeholder="0 * * * * ?"
                 data-test={`sync-policy-cron-${scope}`}
                 style={{ flex: 1, padding: '4px 8px', fontSize: 13,
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4,
                           fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
        </label>
      )}

      {mode === 'PAUSED' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                         marginBottom: 6 }}>
          <span style={{ minWidth: 80, fontSize: 12 }}>Reason</span>
          <input value={reason}
                 onChange={(e) => setReason(e.target.value)}
                 placeholder="Why are you pausing this? (audit trail)"
                 data-test={`sync-policy-reason-${scope}`}
                 style={{ flex: 1, padding: '4px 8px', fontSize: 13,
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8,
                     justifyContent: 'flex-end' }}>
        {onReset && canReset && (
          <button type="button"
                  className="ea-btn ea-btn--secondary"
                  data-test={`sync-policy-reset-${scope}`}
                  disabled={saving}
                  onClick={onReset}>
            Reset to Global
          </button>
        )}
        <button type="button"
                className="ea-btn ea-btn--primary"
                data-test={`sync-policy-save-${scope}`}
                disabled={!canSave || saving}
                onClick={() => onSave(mode,
                  mode === 'SCHEDULED' ? cron : null,
                  mode === 'PAUSED' ? reason : null)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
