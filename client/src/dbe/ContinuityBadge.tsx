import { Link } from 'react-router-dom';

import { useContinuity, type ContinuityLevel } from './continuity';

/**
 * Compact topbar chip summarising DBE state. Three visual states
 * (green/amber/red) + tiny secondary numbers for queued writes and
 * live peers (future — DBE.4 wiring reads from the mesh bus).
 *
 * <p>Always clickable → navigates to {@code /peers} where the
 * Continuity card has the detail drill-down.</p>
 */
export function ContinuityBadge(): JSX.Element | null {
  const snap = useContinuity();
  if (!snap) return null;

  const { level, serverReachable, queued, storage } = snap;
  const className = `der-continuity-badge der-continuity-${level}`;
  const label = renderLabel(level, serverReachable);

  return (
    <Link to="/peers" className={className} title={titleFor(snap)}
      data-test="der-continuity-badge">
      <span className={`der-continuity-dot der-continuity-dot-${level}`} />
      <span>{label}</span>
      {queued > 0 && (
        <span className="der-continuity-pill">{queued}&nbsp;queued</span>
      )}
      {!storage.persistent && storage.browserSupported && (
        <span className="der-continuity-pill der-continuity-warn"
          title="Install the PWA for persistent storage">
          Install
        </span>
      )}
    </Link>
  );
}

function renderLabel(level: ContinuityLevel, serverReachable: boolean): string {
  if (serverReachable) return 'Online';
  if (level === 'degraded') return 'Offline — cached';
  return 'Offline';
}

function titleFor(s: ReturnType<typeof useContinuity>): string {
  if (!s) return '';
  const serverBits = s.serverReachable
    ? `server: reachable (last ok ${s.lastServerOkAt ?? '—'})`
    : `server: unreachable (last ok ${s.lastServerOkAt ?? 'never'})`;
  const storageBits = s.storage.persistent
    ? 'storage: persistent'
    : 'storage: best-effort — install PWA for guarantee';
  return `${serverBits}\n${storageBits}\nqueued: ${s.queued}\nSW cache: ${s.dbeShellCacheEntries} entries\nAPI mirror: ${s.dbeApiMirrorEntries} entries\nlast prefetch: ${s.prefetchLastRunAt ?? 'never'}`;
}
