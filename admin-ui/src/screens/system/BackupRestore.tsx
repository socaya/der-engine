import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, usePaged, TablePager, SyncStatusBar, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, InlineLoading, LoadingBlock } from '../../components/ScreenStates';

/* ─── /backup ────────────────────────────────────────────────────── */
/** FR-15-07 — Backup tools: schedule + verify + runs.
 *
 *  Server-side the pieces have shipped separately over several
 *  alphas: BackupController (/edge-api/v1/backup/runs + /request),
 *  BackupPitrController (/backup/pitr/wal + /verify/*), and the
 *  BACKUP_ROUTINE_DRAIN cron driven by settings.cron['backup.rotate'].
 *
 *  This screen pulls them together into one operator surface:
 *  the current schedule, latest WAL/PITR readiness, the most-recent
 *  verification outcome, a Verify-now action, and the backup runs
 *  table. */
type BackupSection = 'schedule' | 'pitr' | 'verify' | 'runs';

export function BackupList(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const activeSection: BackupSection =
    sectionParam === 'pitr' || sectionParam === 'verify' || sectionParam === 'runs'
      ? sectionParam : 'schedule';
  function goTo(section: BackupSection): void {
    const next = new URLSearchParams(searchParams);
    if (section === 'schedule') next.delete('section');
    else next.set('section', section);
    setSearchParams(next, { replace: true });
  }
  const [rows, setRows] = useState<edgeApi.BackupRow[] | null>(null);
  const [verify, setVerify] = useState<edgeApi.BackupVerifyStatus | null>(null);
  const [verifyHist, setVerifyHist] = useState<edgeApi.BackupVerifyRow[]>([]);
  const [wal, setWal] = useState<edgeApi.WalSummary | null>(null);
  const [settings, setSettings] = useState<edgeApi.SettingsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, c, d, e] = await Promise.allSettled([
      edgeApi.listBackups(),
      edgeApi.backupVerifyStatus(),
      edgeApi.backupVerifyHistory(10),
      edgeApi.backupPitrWal(),
      edgeApi.readSettings(),
    ]);
    if (a.status === 'fulfilled') setRows(a.value);
    else { setErr(a.reason instanceof Error ? a.reason.message : String(a.reason)); return; }
    if (b.status === 'fulfilled') setVerify(b.value);
    if (c.status === 'fulfilled') setVerifyHist(c.value);
    if (d.status === 'fulfilled') setWal(d.value);
    if (e.status === 'fulfilled') setSettings(e.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function requestBackupKind(kind: 'AUDIT' | 'FULL'): Promise<void> {
    setBusy(true);
    try { await edgeApi.requestBackup(kind); await reload(); } finally { setBusy(false); }
  }

  async function runVerifyNow(backupId?: number): Promise<void> {
    setVerifying(true);
    try { await edgeApi.backupVerifyRun(backupId); await reload(); }
    catch { /* verify failures surface in the history row */ }
    finally { setVerifying(false); }
  }

  if (err) return <ErrorBlock title="Backups failed" testId="err-backup">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const succ = rows.filter((r) => r.status === 'SUCCESS').length;
  const fail = rows.filter((r) => r.status === 'FAILED').length;
  const pend = rows.filter((r) => r.status === 'QUEUED' || r.status === 'REQUESTED').length;

  const cron = settings?.cron?.['backup.rotate'] ?? null;
  const lastSuccess = rows.find((r) => r.status === 'SUCCESS');
  const verifyLast = verify?.lastRun ?? null;
  const verifyOk = verifyLast?.outcome === 'PASSED' || verifyLast?.outcome === 'SUCCESS';
  const verifyTone: 'success' | 'warning' | 'danger' | 'muted' =
    !verifyLast ? 'muted'
    : verifyOk ? 'success'
    : 'danger';

  return (
    <div className="ea-screen" data-test="backup-tools">
      <SyncStatusBar
        tone={fail > 0 ? 'danger' : pend > 0 ? 'warning' : 'success'}
        title="Backup tools"
        statusLabel={`${rows.length} runs`}
        subtitle={
          <>
            <span>Scheduled backups, point-in-time recovery, and automated restore verification.</span>
            <span>·</span>
            <span>Successful <strong style={{ color: 'var(--der-ink-900)' }}>{succ}</strong></span>
            {pend > 0 && (<><span>·</span><span>In flight <strong style={{ color: 'var(--der-ink-900)' }}>{pend}</strong></span></>)}
            {fail > 0 && (<><span>·</span><span>Failed <strong style={{ color: 'var(--der-danger-ink)' }}>{fail}</strong></span></>)}
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" disabled={busy}
                    data-test="backup-audit"
                    onClick={() => { requestBackupKind('AUDIT').catch(() => undefined); }}>
              <UiIcon icon="plus" size={14} /><span>Audit backup</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                    data-test="backup-full"
                    onClick={() => { requestBackupKind('FULL').catch(() => undefined); }}>
              <UiIcon icon="backup" size={14} /><span>Full backup</span>
            </button>
          </>
        }
      />

      <nav className="ea-section-tabs"
           role="tablist"
           aria-label="Backup sections"
           data-test="backup-sections">
        <BackupSectionTab
          id="schedule" label="Schedule" icon="schedule"
          active={activeSection === 'schedule'}
          onClick={() => goTo('schedule')} />
        <BackupSectionTab
          id="pitr" label="PITR / WAL" icon="storage"
          count={wal?.segmentCount ?? undefined}
          active={activeSection === 'pitr'}
          onClick={() => goTo('pitr')} />
        <BackupSectionTab
          id="verify" label="Verification" icon="diagnostics"
          count={verifyHist.length || undefined}
          active={activeSection === 'verify'}
          onClick={() => goTo('verify')} />
        <BackupSectionTab
          id="runs" label="Runs" icon="history"
          count={rows.length || undefined}
          active={activeSection === 'runs'}
          onClick={() => goTo('runs')} />
      </nav>
      <div data-test="backup-section-body">
        {activeSection === 'schedule' && (
            <BackupScheduleEditor
              cron={cron}
              lastSuccess={lastSuccess ?? null}
              settings={settings}
              onSaved={() => { void reload(); }}
            />
          )}

          {activeSection === 'pitr' && (
            <Panel title="PITR / WAL archive"
                   action={
                     wal && <Status tone={wal.walEnabled && wal.walDirExists ? 'success' : 'muted'}>
                       {wal.walEnabled ? (wal.walDirExists ? 'Active' : 'Dir missing') : 'Disabled'}
                     </Status>
                   }>
              {!wal ? (
                <InlineLoading />
              ) : (
                <dl className="ea-def-list">
                  <div className="ea-def-row"><dt>WAL directory</dt>
                    <dd className="ea-mono" style={{ fontSize: 12 }}>{wal.walDirectory}</dd></div>
                  <div className="ea-def-row"><dt>Archived segments</dt>
                    <dd className="ea-mono" data-test="wal-segments">{wal.segmentCount ?? 0}</dd></div>
                  <div className="ea-def-row"><dt>Earliest archive</dt>
                    <dd className="ea-mono" style={{ fontSize: 12 }}>
                      {wal.earliestArchive ? fmtDate(wal.earliestArchive) : '—'}
                    </dd></div>
                  <div className="ea-def-row"><dt>Latest archive</dt>
                    <dd className="ea-mono" style={{ fontSize: 12 }}>
                      {wal.latestArchive ? fmtDate(wal.latestArchive) : '—'}
                    </dd></div>
                </dl>
              )}
            </Panel>
          )}

          {activeSection === 'verify' && (
            <Panel title="Restore verification"
                   action={
                     <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                             disabled={verifying || !verify?.enabled || !lastSuccess}
                             data-test="verify-now"
                             title={!verify?.enabled
                               ? 'Backup verification is disabled on this edge'
                               : !lastSuccess ? 'No successful backup to verify yet' : ''}
                             onClick={() => { runVerifyNow(lastSuccess?.runId).catch(() => undefined); }}>
                       <UiIcon icon="refresh" size={14} />
                       <span>{verifying ? 'Verifying…' : 'Verify now'}</span>
                     </button>
                   }>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Verification enabled</dt>
                  <dd data-test="verify-enabled">{verify?.enabled ? 'yes' : 'no'}</dd></div>
                <div className="ea-def-row"><dt>pg_restore</dt>
                  <dd className="ea-mono" style={{ fontSize: 12 }}>
                    {verify?.pgRestore ?? <span className="ea-text-muted">not found</span>}
                  </dd></div>
                <div className="ea-def-row"><dt>Last verify outcome</dt>
                  <dd data-test="verify-last-outcome">
                    <Status tone={verifyTone}>
                      {verifyLast?.outcome ?? 'never run'}
                    </Status>
                    {verifyLast && (
                      <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                        · {fmtAgo(verifyLast.verifiedAt)}
                      </span>
                    )}
                  </dd></div>
              </dl>
              {verifyHist.length > 0 && (
                <div className="ea-table-wrap" style={{ marginTop: 10 }}>
                  <table className="ea-table ea-table--dense" data-test="verify-history">
                    <thead><tr>
                      <th>Verified</th><th>Backup run</th><th>Outcome</th>
                      <th>Duration</th><th>Reason</th>
                    </tr></thead>
                    <tbody>
                      {verifyHist.map((v) => (
                        <tr key={v.verificationId}>
                          <td className="ea-mono" style={{ fontSize: 12 }}>{fmtDate(v.verifiedAt)}</td>
                          <td className="ea-mono">{v.backupRunId}</td>
                          <td>
                            <Status tone={
                              v.outcome === 'PASSED' || v.outcome === 'SUCCESS' ? 'success'
                              : 'danger'}>
                              {v.outcome}
                            </Status>
                          </td>
                          <td className="ea-mono">{v.durationMs} ms</td>
                          <td className="ea-text-muted">{v.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

        {activeSection === 'runs' && (
          <Panel title="Backup runs">
            {rows.length === 0 ? (
              <p className="ea-text-muted" style={{ margin: 0 }}>No backups yet.</p>
            ) : (
              <BackupRunsTable rows={rows} />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function BackupSectionTab(
  { id, label, icon, count, active, onClick }:
    { id: string; label: string;
      icon: 'schedule' | 'storage' | 'diagnostics' | 'history';
      count?: number; active: boolean; onClick: () => void },
): JSX.Element {
  return (
    <button type="button"
            role="tab"
            className={'ea-section-tab'
              + (active ? ' ea-section-tab--active' : '')}
            aria-selected={active}
            data-test={`backup-section-${id}`}
            onClick={onClick}>
      <UiIcon icon={icon} size={14} />
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className="ea-text-muted" style={{ fontSize: 11 }}>· {count}</span>
      )}
    </button>
  );
}

/** Inline cron editor for the backup rotation schedule. Lives on the
 *  Backup page so admins never have to jump to the Sync scheduler to
 *  change the backup cadence; posts to the same /admin/settings
 *  endpoint but with just the backup.rotate key flipped. */
function BackupScheduleEditor(
  { cron, lastSuccess, settings, onSaved }:
    { cron: string | null;
      lastSuccess: edgeApi.BackupRow | null;
      settings: edgeApi.SettingsPayload | null;
      onSaved: () => void },
): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cron ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(): void {
    setDraft(cron ?? '');
    setErr(null);
    setEditing(true);
  }

  async function save(): Promise<void> {
    if (!settings) return;
    setSaving(true); setErr(null);
    try {
      await edgeApi.saveSettings({
        ...settings,
        cron: { ...settings.cron, 'backup.rotate': draft.trim() },
      });
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  return (
    <Panel title="Backup schedule"
           action={!editing && (
             <button type="button"
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-test="backup-schedule-edit"
                     disabled={!settings}
                     onClick={startEdit}>
               <UiIcon icon="edit" size={14} />
               <span>Edit cron</span>
             </button>
           )}>
      <dl className="ea-def-list">
        <div className="ea-def-row">
          <dt>Backup cron</dt>
          <dd>
            {editing ? (
              <div className="ea-field" style={{ margin: 0 }}>
                <input type="text"
                       className="ea-input ea-mono"
                       data-test="backup-cron-input"
                       value={draft}
                       autoFocus
                       onChange={(e) => setDraft(e.target.value)} />
                <span className="ea-field-hint">
                  <code>seconds minutes hours day-of-month month day-of-week</code>
                </span>
              </div>
            ) : (
              <span className="ea-mono" data-test="backup-cron">{cron ?? '—'}</span>
            )}
          </dd>
        </div>
        <div className="ea-def-row">
          <dt>Last successful backup</dt>
          <dd>
            {lastSuccess
              ? <>{fmtDate(lastSuccess.requestedAt)}{' '}
                  <span className="ea-text-muted">· {fmtAgo(lastSuccess.requestedAt)}</span></>
              : <span className="ea-text-muted">never</span>}
          </dd>
        </div>
      </dl>
      {err && (
        <div className="ea-callout ea-callout--danger" role="alert"
             data-test="backup-schedule-err">{err}</div>
      )}
      {editing && (
        <div className="ea-mapping-form-actions">
          <button type="button"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-test="backup-schedule-cancel"
                  disabled={saving}
                  onClick={() => setEditing(false)}>Cancel</button>
          <button type="button"
                  className="ea-btn ea-btn--primary ea-btn--sm"
                  data-test="backup-schedule-save"
                  disabled={saving || draft.trim().length === 0}
                  onClick={() => { void save(); }}>
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      )}
    </Panel>
  );
}

function BackupRunsTable({ rows }: { rows: ReadonlyArray<edgeApi.BackupRow> }): JSX.Element {
  const paged = usePaged(rows, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr><th>Run ID</th><th>Kind</th><th>Status</th><th>Requested</th><th>Message</th></tr></thead>
        <tbody>
          {paged.rows.map((r) => (
            <tr key={r.runId}>
              <td className="ea-mono">{r.runId}</td>
              <td style={{ fontWeight: 500 }}>{r.kind}</td>
              <td>
                <Status tone={
                  r.status === 'SUCCESS' ? 'success'
                  : r.status === 'FAILED' ? 'danger' : 'warning'}>
                  {r.status}
                </Status>
              </td>
              <td className="ea-mono">{fmtDate(r.requestedAt)}</td>
              <td className="ea-text-muted">{r.message ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
    </div>
  );
}

/* ─── /restore ───────────────────────────────────────────────────── */
export function RestoreList(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.RestoreRow[] | null>(null);
  const [backups, setBackups] = useState<edgeApi.BackupRow[]>([]);
  const [verifyHist, setVerifyHist] = useState<edgeApi.BackupVerifyRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<edgeApi.RestoreKind>('LOCAL');
  const [localRunId, setLocalRunId] = useState<string>('');
  const [remoteUri, setRemoteUri] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, c] = await Promise.allSettled([
      edgeApi.listRestores(),
      edgeApi.listBackups(),
      edgeApi.backupVerifyHistory(25),
    ]);
    if (a.status === 'fulfilled') setRows(a.value);
    else { setErr(a.reason instanceof Error ? a.reason.message : String(a.reason)); return; }
    if (b.status === 'fulfilled') setBackups(b.value);
    if (c.status === 'fulfilled') setVerifyHist(c.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  /* EA-31 §"Show backup identity, version, checksum, scope,
   * verification results": restore from a LOCAL backup needs to show
   * the selected backup's run + the latest verify row for it so the
   * operator sees what they're about to replay. */
  const successBackups = backups.filter((b) => b.status === 'SUCCESS');
  const selected = successBackups.find((b) => String(b.runId) === localRunId);
  const selectedVerify = selected
    ? verifyHist.find((v) => v.backupRunId === selected.runId) ?? null
    : null;

  function canSubmit(): boolean {
    if (busy) return false;
    if (kind === 'LOCAL') return selected != null;
    if (kind === 'REMOTE') return remoteUri.trim().length > 0;
    return uploadFile != null;
  }

  async function submit(): Promise<void> {
    if (!canSubmit()) return;
    const label = kind === 'LOCAL' ? `backup run #${selected!.runId}`
      : kind === 'REMOTE' ? remoteUri.trim()
      : uploadFile!.name;
    if (!window.confirm(
      `Restore from ${label}?\n\nThis overwrites the local database.`)) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      let source: string;
      if (kind === 'UPLOAD') {
        const up = await edgeApi.uploadRestoreArchive(uploadFile!);
        source = up.uploadKey;
      } else if (kind === 'LOCAL') {
        source = `backup-run://${selected!.runId}`;
      } else {
        source = remoteUri.trim();
      }
      await edgeApi.requestRestore(kind, source);
      setMsg('Restore request recorded.');
      setRemoteUri(''); setUploadFile(null);
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (err && !rows) return <ErrorBlock title="Restores failed" testId="err-restore">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen" data-test="restore-tools">
      <SyncStatusBar
        tone="muted"
        title="Restore"
        statusLabel={`${rows.length} on record`}
      />

      {msg && (
        <div className="ea-callout ea-callout--success" role="status"
             data-test="restore-msg">{msg}</div>
      )}
      {err && (
        <ErrorBlock title="Restore action failed" testId="err-restore-action">{err}</ErrorBlock>
      )}

      <Panel title="Request a restore">
        <fieldset className="ea-field" data-test="restore-kind">
          <legend className="ea-field-label">Source</legend>
          <div className="ea-radio-group">
            {(['LOCAL', 'UPLOAD', 'REMOTE'] as const).map((k) => (
              <label key={k} className="ea-radio">
                <input type="radio" name="restore-kind"
                       data-test={`restore-kind-${k.toLowerCase()}`}
                       value={k} checked={kind === k}
                       onChange={() => setKind(k)} />
                <span>
                  {k === 'LOCAL' ? 'Local backup run'
                    : k === 'UPLOAD' ? 'Upload archive'
                    : 'Remote URI'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'LOCAL' && (
          <div className="ea-field">
            <label className="ea-field-label" htmlFor="restore-run-select">
              Backup run
            </label>
            <select id="restore-run-select"
                    className="ea-input"
                    data-test="restore-run-select"
                    value={localRunId}
                    onChange={(e) => setLocalRunId(e.target.value)}>
              <option value="">— choose —</option>
              {successBackups.map((b) => (
                <option key={b.runId} value={String(b.runId)}
                        data-test={`restore-run-opt-${b.runId}`}>
                  #{b.runId} · {b.kind} · {fmtDate(b.requestedAt)}
                </option>
              ))}
            </select>
            {successBackups.length === 0 && (
              <span className="ea-field-hint">No successful backups available.</span>
            )}
          </div>
        )}

        {kind === 'UPLOAD' && (
          <div className="ea-field">
            <label className="ea-field-label" htmlFor="restore-upload">
              Archive
            </label>
            <input type="file" id="restore-upload"
                   data-test="restore-upload"
                   onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            {uploadFile && (
              <span className="ea-field-hint"
                    data-test="restore-upload-chosen">
                {uploadFile.name} · {Math.round(uploadFile.size / 1024)} KB
              </span>
            )}
          </div>
        )}

        {kind === 'REMOTE' && (
          <label className="ea-field">
            <span className="ea-field-label">Source URI</span>
            <input className="ea-input ea-mono"
                   data-test="restore-remote-uri"
                   value={remoteUri}
                   onChange={(e) => setRemoteUri(e.target.value)}
                   placeholder="file:///path/to/backup.tar.gz" />
          </label>
        )}

        <div className="ea-mapping-form-actions">
          <button type="button" className="ea-btn ea-btn--primary"
                  data-test="restore-submit"
                  disabled={!canSubmit()}
                  onClick={() => { submit().catch(() => undefined); }}>
            {busy ? 'Submitting…' : 'Request restore'}
          </button>
        </div>
      </Panel>

      {kind === 'LOCAL' && selected && (
        <Panel title="Selected backup"
               action={
                 <Status tone={
                   selectedVerify == null ? 'muted'
                     : selectedVerify.outcome === 'PASSED'
                       || selectedVerify.outcome === 'SUCCESS' ? 'success'
                     : 'danger'}>
                   {selectedVerify?.outcome ?? 'Never verified'}
                 </Status>
               }>
          <dl className="ea-def-list" data-test="restore-selected-backup">
            <div className="ea-def-row"><dt>Run ID</dt>
              <dd className="ea-mono">{selected.runId}</dd></div>
            <div className="ea-def-row"><dt>Kind</dt>
              <dd>{selected.kind}</dd></div>
            <div className="ea-def-row"><dt>Requested at</dt>
              <dd className="ea-mono">{fmtDate(selected.requestedAt)}</dd></div>
            <div className="ea-def-row"><dt>Last verification</dt>
              <dd>
                {selectedVerify
                  ? (
                    <>
                      <span className="ea-mono">{fmtDate(selectedVerify.verifiedAt)}</span>
                      {selectedVerify.reason && (
                        <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                          · {selectedVerify.reason}
                        </span>
                      )}
                    </>
                  )
                  : <span className="ea-text-muted">
                      Not verified — restore will proceed without a round-trip proof.
                    </span>}
              </dd></div>
          </dl>
        </Panel>
      )}

      <Panel title="History">
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No restores recorded.</p>
        ) : (
          <RestoreRunsTable rows={rows} />
        )}
      </Panel>
    </div>
  );
}

function RestoreRunsTable({ rows }: { rows: ReadonlyArray<edgeApi.RestoreRow> }): JSX.Element {
  const paged = usePaged(rows, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr><th>Run ID</th><th>Source</th><th>Status</th><th>Requested</th></tr></thead>
        <tbody>
          {paged.rows.map((r) => (
            <tr key={r.runId}>
              <td className="ea-mono">{r.runId}</td>
              <td className="ea-mono" style={{ wordBreak: 'break-all' }}>{r.source}</td>
              <td>
                <Status tone={
                  r.status === 'SUCCESS' ? 'success'
                  : r.status === 'FAILED' ? 'danger' : 'warning'}>
                  {r.status}
                </Status>
              </td>
              <td className="ea-mono">{fmtDate(r.requestedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
    </div>
  );
}

