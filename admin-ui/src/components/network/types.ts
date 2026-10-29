/** DER Mesh Topology — client-side types mirroring GET /network/mesh/topology. */

export type NodeStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type ConnectionType = 'wifi' | 'ethernet' | 'p2p' | 'wan';
export type SyncState = 'synced' | 'syncing' | 'pending' | 'error';
export type FormFactor = 'WORKSTATION' | 'LAPTOP' | 'TABLET' | 'MOBILE' | 'UNKNOWN';

export interface SyncInfo {
  state: SyncState;
  pending: number;
}

export interface DerNode {
  id: 'der';
  name: string;
  type: string;
  status: NodeStatus;
  fingerprint: string;
  ipAddress: string | null;
  hostname: string | null;
  centralBridge: boolean;
}

export interface WanInfo {
  status: NodeStatus;
  state: string;
  centralDhis2Available: boolean;
  internetAvailable: boolean;
  lastProbeAt: string | null;
}

export interface DeviceNode {
  id: string;              // deviceId UUID
  name: string;
  type: string;            // workstation / laptop / tablet / mobile / unknown
  formFactor: FormFactor;
  status: NodeStatus;
  lastSeen: string | null;
  userAgent: string | null;
  firmwareVersion: string | null;
  deviceStatus: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REVOKED';
  sync: SyncInfo;
}

export interface PeerNode {
  id: string;              // "peer-" + UUID
  name: string;
  type: 'peer-edge';
  status: NodeStatus;
  endpoint: string;
  state: string | null;
  trust: string | null;
  lastHandshake: string | null;
}

export interface Connection {
  source: string;
  target: string;
  type: ConnectionType;
  status: NodeStatus;
}

export interface TopologySummary {
  devices: number;
  devicesOnline: number;
  devicesDegraded: number;
  devicesOffline: number;
  syncQueueTotal: number;
  peers: number;
  peersConnected: number;
  wanStatus: NodeStatus;
}

export interface TopologyResponse {
  site: { id: string; name: string };
  wan: WanInfo;
  der: DerNode;
  devices: DeviceNode[];
  peers: PeerNode[];
  connections: Connection[];
  summary: TopologySummary;
}

/** Union of every selectable node. */
export type SelectedNode =
  | ({ kind: 'der' } & DerNode)
  | ({ kind: 'wan' } & WanInfo)
  | ({ kind: 'device' } & DeviceNode)
  | ({ kind: 'peer' } & PeerNode);
