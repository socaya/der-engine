import { describe, expect, it } from 'vitest';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, CENTRE,
  DEVICE_SLOTS, PEER_SLOTS,
  layoutDevices, layoutPeers, ringLayout,
  wanPosition, internetPosition,
} from './topologyLayout';

/* topologyLayout.ts is a pure layout helper. Tests cover the two
 * canonical slot arrays, the fallback ring layout when node count
 * exceeds slots, the fixed WAN/Internet positions, and the empty-
 * array edge case. */

describe('topologyLayout — constants', () => {
  it('canvas + centre point align to the expected 1000×760 frame', () => {
    expect(CANVAS_WIDTH).toBe(1000);
    expect(CANVAS_HEIGHT).toBe(760);
    expect(CENTRE.x).toBe(CANVAS_WIDTH / 2);
    expect(CENTRE.y).toBe(390);
  });

  it('device slots are 6 and all around the centre', () => {
    expect(DEVICE_SLOTS).toHaveLength(6);
    for (const s of DEVICE_SLOTS) {
      expect(Math.abs(s.x - CENTRE.x)).toBeGreaterThanOrEqual(0);
    }
  });

  it('peer slots are 6 and sit outside the device ring', () => {
    expect(PEER_SLOTS).toHaveLength(6);
    for (const s of PEER_SLOTS) {
      /* Horizontal distance from centre is at least 170 (closest pair). */
      expect(Math.abs(s.x - CENTRE.x)).toBeGreaterThanOrEqual(170);
    }
  });
});

describe('layoutDevices', () => {
  it('up to 6 nodes use fixed DEVICE_SLOTS positions', () => {
    const laid = layoutDevices(['a', 'b', 'c']);
    expect(laid).toHaveLength(3);
    expect(laid[0]).toEqual({ node: 'a', x: DEVICE_SLOTS[0].x,
                               y: DEVICE_SLOTS[0].y });
    expect(laid[1]).toEqual({ node: 'b', x: DEVICE_SLOTS[1].x,
                               y: DEVICE_SLOTS[1].y });
    expect(laid[2]).toEqual({ node: 'c', x: DEVICE_SLOTS[2].x,
                               y: DEVICE_SLOTS[2].y });
  });

  it('exactly 6 nodes fills every slot', () => {
    const laid = layoutDevices(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(laid).toHaveLength(6);
    expect(laid[5].x).toBe(DEVICE_SLOTS[5].x);
  });

  it('more than 6 nodes falls back to the ring', () => {
    const laid = layoutDevices(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(laid).toHaveLength(7);
    /* Ring layout starts at startRad=-π/2 which means the first
     * point is directly above the centre. */
    const r = Math.hypot(laid[0].x - CENTRE.x, laid[0].y - CENTRE.y);
    expect(r).toBeCloseTo(260, 1);
  });

  it('empty array returns empty array', () => {
    expect(layoutDevices([])).toEqual([]);
  });
});

describe('layoutPeers', () => {
  it('up to 6 nodes use fixed PEER_SLOTS positions', () => {
    const laid = layoutPeers([1, 2]);
    expect(laid[0]).toEqual({ node: 1, x: PEER_SLOTS[0].x,
                               y: PEER_SLOTS[0].y });
    expect(laid[1]).toEqual({ node: 2, x: PEER_SLOTS[1].x,
                               y: PEER_SLOTS[1].y });
  });

  it('more than 6 nodes falls back to the ring at radius 420', () => {
    const laid = layoutPeers([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(laid).toHaveLength(8);
    const r = Math.hypot(laid[0].x - CENTRE.x, laid[0].y - CENTRE.y);
    expect(r).toBeCloseTo(420, 1);
  });

  it('empty array returns empty array', () => {
    expect(layoutPeers([])).toEqual([]);
  });
});

describe('ringLayout', () => {
  it('empty array returns empty array (n=0 short-circuit)', () => {
    expect(ringLayout([], 100)).toEqual([]);
  });

  it('single node sits at startRad (default -π/2 ≡ directly above)', () => {
    const laid = ringLayout(['n'], 100);
    expect(laid[0].x).toBeCloseTo(CENTRE.x, 2);
    expect(laid[0].y).toBeCloseTo(CENTRE.y - 100, 2);
  });

  it('four nodes space at 90°, startRad=0', () => {
    const laid = ringLayout(['a', 'b', 'c', 'd'], 100, 0);
    /* First point at angle 0 (east). */
    expect(laid[0].x).toBeCloseTo(CENTRE.x + 100, 2);
    expect(laid[0].y).toBeCloseTo(CENTRE.y, 2);
    /* Second at 90° (south). */
    expect(laid[1].x).toBeCloseTo(CENTRE.x, 2);
    expect(laid[1].y).toBeCloseTo(CENTRE.y + 100, 2);
  });

  it('nodes preserve their original references', () => {
    const payloads = [{ id: 'a' }, { id: 'b' }];
    const laid = ringLayout(payloads, 50);
    expect(laid[0].node).toBe(payloads[0]);
    expect(laid[1].node).toBe(payloads[1]);
  });
});

describe('fixed anchor positions', () => {
  it('wanPosition is directly above centre at y−310', () => {
    const p = wanPosition();
    expect(p.x).toBe(CENTRE.x);
    expect(p.y).toBe(CENTRE.y - 310);
  });

  it('internetPosition sits between DER and WAN (y−165)', () => {
    const p = internetPosition();
    expect(p.x).toBe(CENTRE.x);
    expect(p.y).toBe(CENTRE.y - 165);
    /* Vertically between DER (CENTRE.y) and WAN (y-310). */
    expect(p.y).toBeLessThan(CENTRE.y);
    expect(p.y).toBeGreaterThan(wanPosition().y);
  });
});
