/** Deterministic radial layout for the mesh topology SVG.
 *
 *  Center = DER. Inner ring = local devices (up to 8). Outer ring = peer
 *  edges. The algorithm is intentionally simple so renders are stable
 *  across polls (no shuffling as data refreshes). */

export interface Point { x: number; y: number; }

export interface LaidOutNode<T> {
  node: T;
  x: number;
  y: number;
}

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 620;
export const CENTRE: Point = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

export const DEVICE_RING_RADIUS = 220;
export const PEER_RING_RADIUS = 290;
export const WAN_OFFSET_Y = 80;

/** Positions nodes evenly on a circle around CENTRE, starting at the top
 *  (–π/2) and going clockwise so entry 0 is north. */
export function ringLayout<T>(nodes: T[], radius: number,
                                 startRad = -Math.PI / 2): LaidOutNode<T>[] {
  const n = nodes.length;
  if (n === 0) {
    return [];
  }
  return nodes.map((node, i) => {
    const theta = startRad + (2 * Math.PI * i) / n;
    return {
      node,
      x: CENTRE.x + radius * Math.cos(theta),
      y: CENTRE.y + radius * Math.sin(theta),
    };
  });
}

/** WAN cloud lives above the DER node. */
export function wanPosition(): Point {
  return { x: CENTRE.x, y: CENTRE.y - WAN_OFFSET_Y - DEVICE_RING_RADIUS };
}
