/** Deterministic layout for the facility mesh canvas.
 *
 *  Reference image layout (6 devices): hex pattern — top-centre,
 *  upper-left, upper-right, bottom-centre, lower-left, lower-right.
 *  For >6 devices we fall back to a ring with the same radius. */

export interface Point { x: number; y: number; }

export interface LaidOutNode<T> {
  node: T;
  x: number;
  y: number;
}

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 760;
export const CENTRE: Point = { x: CANVAS_WIDTH / 2, y: 390 };

/** Card half-dimensions for collision reasoning in tests. */
export const DER_CARD = { w: 220, h: 92 };
export const DEVICE_CARD = { w: 170, h: 78 };
export const PEER_CARD = { w: 170, h: 78 };

/* ─── Device slots ─────────────────────────────────────────── */

/** Six canonical slots matching the reference image. Positions are
 *  centre-coordinates of the device card. Order is: 0 top, 1 upper-right,
 *  2 lower-right, 3 bottom, 4 lower-left, 5 upper-left. */
export const DEVICE_SLOTS: Point[] = [
  { x: CENTRE.x,       y: CENTRE.y - 230 }, // 0 top-centre
  { x: CENTRE.x + 290, y: CENTRE.y - 125 }, // 1 upper-right
  { x: CENTRE.x + 290, y: CENTRE.y + 125 }, // 2 lower-right
  { x: CENTRE.x,       y: CENTRE.y + 230 }, // 3 bottom-centre
  { x: CENTRE.x - 290, y: CENTRE.y + 125 }, // 4 lower-left
  { x: CENTRE.x - 290, y: CENTRE.y - 125 }, // 5 upper-left
];

export function layoutDevices<T>(nodes: T[]): LaidOutNode<T>[] {
  if (nodes.length <= DEVICE_SLOTS.length) {
    return nodes.map((node, i) => ({
      node,
      x: DEVICE_SLOTS[i].x,
      y: DEVICE_SLOTS[i].y,
    }));
  }
  // Fallback ring for >6 devices.
  return ringLayout(nodes, 260, -Math.PI / 2);
}

/* ─── Peer slots ───────────────────────────────────────────── */

/** Peer edges sit outside the device ring so cards never overlap. The
 *  slots are chosen to fall BETWEEN device slots (angular offset ~30°)
 *  — radius 400 keeps them well clear of the device ring at 290. */
export const PEER_SLOTS: Point[] = [
  { x: CENTRE.x + 400, y: CENTRE.y        }, // east
  { x: CENTRE.x - 400, y: CENTRE.y        }, // west
  { x: CENTRE.x + 340, y: CENTRE.y - 240  }, // ne corner
  { x: CENTRE.x - 340, y: CENTRE.y + 240  }, // sw corner
  { x: CENTRE.x + 340, y: CENTRE.y + 240  }, // se corner
  { x: CENTRE.x - 340, y: CENTRE.y - 240  }, // nw corner
];

export function layoutPeers<T>(nodes: T[]): LaidOutNode<T>[] {
  if (nodes.length <= PEER_SLOTS.length) {
    return nodes.map((node, i) => ({
      node,
      x: PEER_SLOTS[i].x,
      y: PEER_SLOTS[i].y,
    }));
  }
  return ringLayout(nodes, 420, 0);
}

/* ─── Ring fallback ────────────────────────────────────────── */

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

/** WAN cloud sits above the DER centre. */
export function wanPosition(): Point {
  return { x: CENTRE.x, y: CENTRE.y - 340 };
}
