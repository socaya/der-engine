import { useEffect, useState } from 'react';
import type { CaptureApi } from '../shared/types';

interface TeiRow {
  readonly trackedEntity?: string;
  readonly trackedEntityInstance?: string;
  readonly displayName?: string;
  readonly lastUpdated?: string;
}

/**
 * Tracker (WITH_REGISTRATION) workflow inside the unified
 * Capture shell. First-pass scaffold:
 *   • List tracked entities for program + bound OU
 *   • Honest "coming in G4/G5" strip for registration + stages
 *     so the UI doesn't lie about what's implemented
 *
 * Follow-up slices (per requirements doc §18 Phase 3 "Tracker
 * MVP" and §22.2 Gates G4-G5) will replace the stub with:
 *   • Search-first registration (TR-002, TR-010)
 *   • TE overview + enrolment switcher (TR-020-TR-022)
 *   • Program-stage timeline (TR-030-TR-037)
 *   • Shared FormEngine for stage events (reuses the same
 *     component the EventWorkflow uses today)
 */
export function TrackerWorkflow(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string; orgUnitDisplayName: string;
    hashRoute: string;
  },
): JSX.Element {
  const [rows, setRows] = useState<TeiRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'err'>('idle');

  useEffect(() => {
    setStatus('loading');
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listTrackerEntities(programUid, orgUnitUid, 50);
        if (cancelled) return;
        const list = r.trackedEntities ?? r.instances ?? [];
        setRows(list);
        setStatus('idle');
      } catch {
        if (!cancelled) {
          setRows([]);
          setStatus('err');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, orgUnitUid, api]);

  return (
    <>
      <div className="cap-strip cap-strip--info" data-test="cap-tracker-notice">
        Tracker workflow — scaffold. Registration, enrolment and
        program-stage timeline are being built (requirements doc
        §18 Phase 3 / §22.2 Gates G4-G5). The list below reads from
        the DER tracker mirror so you can confirm program + OU
        scoping while the full workflow lands slice by slice.
      </div>

      <div className="cap-section-head">
        <h2 className="cap-section-head__title">Tracked entities</h2>
        <span className="cap-section-head__count">
          {status === 'loading' ? 'loading…'
            : status === 'err' ? 'failed to load'
            : rows.length === 0 ? 'none yet' : `${rows.length} shown`}
        </span>
        <span className="cap-section-head__rule" />
      </div>

      {rows.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 14 }}>
          {status === 'loading'
            ? 'Fetching tracked entities assigned to your OU…'
            : status === 'err'
            ? 'The tracker mirror could not be reached. Check the '
              + 'edge connection and retry.'
            : 'No tracked entities yet for this program at this '
              + 'organisation unit.'}
        </p>
      ) : (
        <ul className="cap-list" data-test="ct-tei-list">
          {rows.map((r, i) => {
            const uid = r.trackedEntity ?? r.trackedEntityInstance
              ?? ('row-' + i);
            return (
              <li key={uid + i} className="cap-list__row">
                <div>
                  <code>{uid}</code>
                  {r.displayName && (
                    <span style={{ marginLeft: 10 }}>
                      {r.displayName}
                    </span>
                  )}
                </div>
                <span className="cap-list__when">
                  {r.lastUpdated ?? '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
