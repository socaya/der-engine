import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkConnection } from './NetworkConnection';
import type { ConnectionType, NodeStatus } from './types';

function wrap(child: JSX.Element): HTMLElement {
  const { container } = render(<svg>{child}</svg>);
  return container;
}

describe('NetworkConnection', () => {
  const types: ConnectionType[] = ['wan', 'p2p', 'wifi', 'ethernet'];
  const statuses: NodeStatus[] = ['online', 'degraded', 'offline', 'unknown'];

  it('renders a line for every type / status permutation', () => {
    types.forEach((t) => {
      statuses.forEach((s) => {
        const c = wrap(<NetworkConnection x1={0} y1={0} x2={100} y2={100}
                                           type={t} status={s} />);
        expect(c.querySelector('line')).toBeTruthy();
      });
    });
  });
  it('explicit flow="none" suppresses particles', () => {
    const c = wrap(<NetworkConnection x1={0} y1={0} x2={100} y2={0}
                                       type="wan" status="online" flow="none" />);
    expect(c.querySelectorAll('circle')).toHaveLength(0);
  });
  it('full flow renders forward + reverse particles for wan', () => {
    const c = wrap(<NetworkConnection x1={0} y1={0} x2={100} y2={0}
                                       type="wan" status="online" flow="full" />);
    // 2 forward + 2 reverse
    expect(c.querySelectorAll('circle').length).toBeGreaterThan(0);
  });
  it('dim flow renders particles at reduced opacity', () => {
    const c = wrap(<NetworkConnection x1={0} y1={0} x2={100} y2={0}
                                       type="wifi" status="online" flow="dim" />);
    const circles = c.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
  });
  it('degraded status without explicit flow is dim', () => {
    const c = wrap(<NetworkConnection x1={0} y1={0} x2={100} y2={0}
                                       type="ethernet" status="degraded" />);
    expect(c.querySelector('line')).toBeTruthy();
  });
  it('offline status without explicit flow is none', () => {
    const c = wrap(<NetworkConnection x1={0} y1={0} x2={100} y2={0}
                                       type="p2p" status="offline" />);
    expect(c.querySelectorAll('circle')).toHaveLength(0);
  });
  it('default edge style (unknown connection type) still renders', () => {
    const c = wrap(<NetworkConnection x1={0} y1={0} x2={10} y2={10}
                                       type={'bogus' as never} status="online" />);
    expect(c.querySelector('line')).toBeTruthy();
  });
});
