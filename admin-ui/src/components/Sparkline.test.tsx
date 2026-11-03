import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sparkline } from './Sparkline';

/* Sparkline is a pure SVG presenter. Two code paths: short-input
 * stub line (<2 values) and polyline + end-dot (≥2 values). */

describe('Sparkline', () => {
  it('empty array renders the stub baseline', () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    /* Stub path uses <line> not <polyline>. */
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.querySelector('line')).not.toBeNull();
  });

  it('single value also renders stub baseline', () => {
    const { container } = render(<Sparkline values={[42]} />);
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.querySelector('line')).not.toBeNull();
  });

  it('two or more values render a polyline + end dot', () => {
    const { container } = render(<Sparkline values={[1, 5, 3, 7, 2]} />);
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(container.querySelector('circle')).not.toBeNull();
  });

  it('ariaLabel falls back to generated label when omitted', () => {
    render(<Sparkline values={[1, 2, 3]} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toMatch(/3 points/);
  });

  it('custom ariaLabel overrides the generated one', () => {
    render(<Sparkline values={[1, 2]} ariaLabel="CPU load last hour" />);
    expect(screen.getByRole('img',
      { name: 'CPU load last hour' })).toBeInTheDocument();
  });

  it('custom color + testId are applied', () => {
    const { container } = render(
      <Sparkline values={[1, 2, 3]}
                 color="#ff00aa"
                 testId="my-sparkline" />);
    expect(screen.getByTestId('my-sparkline')).toBeInTheDocument();
    const polyline = container.querySelector('polyline');
    expect(polyline?.getAttribute('stroke')).toBe('#ff00aa');
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#ff00aa');
  });

  it('flat values (all identical) still render — span=0 fallback', () => {
    /* All equal values trigger the `max - min || 1` guard. */
    const { container } = render(<Sparkline values={[5, 5, 5, 5]} />);
    expect(container.querySelector('polyline')).not.toBeNull();
  });

  it('custom width/height propagate to the svg element', () => {
    const { container } = render(
      <Sparkline values={[1, 2]} width={200} height={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('200');
    expect(svg?.getAttribute('height')).toBe('50');
  });
});
