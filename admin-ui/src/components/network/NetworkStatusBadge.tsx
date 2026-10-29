import type { NodeStatus } from './types';

const TONE: Record<NodeStatus, { fill: string; label: string }> = {
  online:   { fill: 'var(--der-success-ink, #16a34a)', label: 'Online' },
  degraded: { fill: 'var(--der-warning-ink, #d97706)', label: 'Degraded' },
  offline:  { fill: 'var(--der-danger-ink, #dc2626)',  label: 'Offline' },
  unknown:  { fill: 'var(--der-ink-500, #6b7280)',     label: 'Unknown' },
};

/** Small coloured dot + optional label. */
export function NetworkStatusBadge(
  { status, showLabel = false, size = 10 }:
    { status: NodeStatus; showLabel?: boolean; size?: number }
): JSX.Element {
  const t = TONE[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          aria-label={t.label}>
      <span style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: t.fill,
      }} />
      {showLabel && <span style={{ fontSize: 12 }}>{t.label}</span>}
    </span>
  );
}

export function statusLabel(status: NodeStatus): string {
  return TONE[status].label;
}

export function statusFill(status: NodeStatus): string {
  return TONE[status].fill;
}
