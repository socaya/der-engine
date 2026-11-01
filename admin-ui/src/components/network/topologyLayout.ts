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

/** Six canonical slots arranged around DER on the lateral + southern
 *  arc. The top-centre position is deliberately reserved for the WAN
 *  (DHIS2 Central) node so the DER↔WAN sync line travels straight
 *  up without crossing any device edge (§2.3.68 — "No line MUST
 *  cross over the DHIS2 central instance linkage between DER and
 *  DHIS2"). Order: 0 upper-right, 1 right, 2 lower-right,
 *  3 lower-left, 4 left, 5 upper-left. */
export const DEVICE_SLOTS: Point[] = [
  { x: CENTRE.x + 210, y: CENTRE.y - 200 }, // 0 upper-right
  { x: CENTRE.x + 300, y: CENTRE.y        }, // 1 east
  { x: CENTRE.x + 210, y: CENTRE.y + 200 }, // 2 lower-right
  { x: CENTRE.x - 210, y: CENTRE.y + 200 }, // 3 lower-left
  { x: CENTRE.x - 300, y: CENTRE.y        }, // 4 west
  { x: CENTRE.x - 210, y: CENTRE.y - 200 }, // 5 upper-left
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

/** Peer edges sit outside the device ring + south of DER so cards
 *  never overlap and no peer line crosses the DER↔DHIS2 vertical
 *  sync edge. Peer slots live on the lateral + southern arc only. */
export const PEER_SLOTS: Point[] = [
  { x: CENTRE.x + 420, y: CENTRE.y - 80  }, // east
  { x: CENTRE.x - 420, y: CENTRE.y - 80  }, // west
  { x: CENTRE.x + 360, y: CENTRE.y + 260 }, // se corner
  { x: CENTRE.x - 360, y: CENTRE.y + 260 }, // sw corner
  { x: CENTRE.x + 170, y: CENTRE.y + 320 }, // south-se
  { x: CENTRE.x - 170, y: CENTRE.y + 320 }, // south-sw
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

/** WAN (central DHIS2) sits directly above DER on the vertical
 *  centreline — the DER↔DHIS2 sync edge is the primary backbone of
 *  the facility, so it reads as the dominant uplink in the view.
 *  Devices + peers avoid the top-centre arc (see DEVICE_SLOTS) so
 *  this straight vertical edge is never crossed. */
export function wanPosition(): Point {
  return { x: CENTRE.x, y: CENTRE.y - 290 };
}
