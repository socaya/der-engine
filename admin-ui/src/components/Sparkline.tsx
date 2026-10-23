/**
 * D2: tiny inline SVG sparkline. No new deps. Takes an array of
 * numbers and renders a smooth line with an optional end-point dot.
 */
export interface SparklineProps {
  readonly values: readonly number[];
  readonly width?: number;
  readonly height?: number;
  readonly color?: string;
  readonly ariaLabel?: string;
  readonly testId?: string;
}

export function Sparkline({
  values,
  width = 120,
  height = 28,
  color,
  ariaLabel,
  testId = 'sparkline',
}: SparklineProps): JSX.Element {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} data-test={testId} aria-label={ariaLabel ?? ''}>
        <line
          x1="0" y1={height - 1} x2={width} y2={height - 1}
          stroke="var(--der-border-strong)" strokeWidth={1}
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].split(',').map(Number);
  const strokeColor = color ?? 'var(--der-blue)';
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-test={testId}
      role="img"
      aria-label={ariaLabel ?? `Sparkline over ${values.length} points`}
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(' ')}
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={strokeColor} />
    </svg>
  );
}
