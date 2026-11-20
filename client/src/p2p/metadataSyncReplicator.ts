import type { DerPeerProtocol} from './derPeerProtocol';
import { DppError } from './derPeerProtocol';
import type { PeerConnectionManager } from './peerConnection';

/**
 * P2P metadata catalog replication migrated to DPP/1 (ADR-0038).
 * Resource {@code metadata}, action {@code batch}: sender streams
 * catalog rows in chunks of {@link BATCH_SIZE}, receiver upserts
 * via the same path the central pull uses.
 *
 * <p>Clinic scenario: one device pulls fresh metadata from DHIS2
 * central on the morning WiFi window, the rest of the clinic picks
 * up the delta from that device over the mesh instead of each paying
 * the central-pull cost. Especially valuable on constrained upstream
 * links (one 3G modem shared across tablets).</p>
 *
 * <p>DPP/1 benefits:
 * <ul>
 *   <li>Per-chunk NACK: when the receiver's upsert fails on one
 *       resource (e.g. transient PG lock), that chunk retries
 *       automatically on the next flush instead of being lost.</li>
 *   <li>Fingerprint dedup rides on DPP's per-session HELLO — once
 *       we offer a fingerprint it stays in {@link #offered} so
 *       repeat flushes on the same session are cheap no-ops.</li>
 *   <li>Shared handshake + protocol instance across replicators.</li>
 * </ul></p>
 */

export interface MetadataSyncResult {
  readonly status: 'noop' | 'sent' | 'failed';
  readonly resources: number;
  readonly items: number;
  readonly fingerprint?: string;
  readonly error?: string;
}

const SYNCED_RESOURCES = [
  'indicators', 'indicatorTypes', 'indicatorGroups',
  'optionSets', 'optionGroups',
  'categoryCombos', 'categoryOptions', 'categoryOptionGroups',
  'organisationUnitGroups', 'organisationUnitGroupSets',
  'organisationUnitLevels',
  'dataElementGroups', 'dataElementGroupSets',
  'programIndicators', 'programRuleVariables',
  'relationshipTypes', 'userGroups', 'userRoles',
  'legendSets', 'validationRules',
] as const;

const BATCH_SIZE = 50;

export class MetadataSyncReplicator {
  private readonly dpp: DerPeerProtocol;
  private readonly mgr: PeerConnectionManager;
  private readonly offered = new Set<string>();

  constructor(mgr: PeerConnectionManager, dpp: DerPeerProtocol) {
    this.mgr = mgr;
    this.dpp = dpp;
    this.dpp.on('metadata', 'batch', async (frame) => {
      await this.applyBatch(frame.payload);
    });
  }

  async push(): Promise<MetadataSyncResult> {
    const session = this.mgr.session();
    if (!session || session.status !== 'connected') {
      throw new Error(
        `cannot sync — channel status ${session?.status ?? 'none'}`);
    }
    const local = await fetchCurrentSnapshot();
    if (!local) {
      return {
        status: 'failed', resources: 0, items: 0,
        error: 'no local metadata snapshot — run central sync first',
      };
    }
    if (this.offered.has(local.fingerprint)) {
      return {
        status: 'noop', resources: 0, items: 0,
        fingerprint: local.fingerprint,
      };
    }
    this.offered.add(local.fingerprint);

    let resources = 0;
    let items = 0;
    try {
      for (const resource of SYNCED_RESOURCES) {
        const all = await fetchResourceItems(resource);
        if (all.length === 0) continue;
        resources += 1;
        for (let i = 0; i < all.length; i += BATCH_SIZE) {
          const chunk = all.slice(i, i + BATCH_SIZE);
          await this.dpp.send('metadata', 'batch', {
            snapshotId: local.snapshotId,
            batch: [{ resource, items: chunk }],
          });
          items += chunk.length;
        }
      }
      return {
        status: 'sent', resources, items,
        fingerprint: local.fingerprint,
      };
    } catch (ex) {
      return {
        status: 'failed', resources, items,
        fingerprint: local.fingerprint,
        error: ex instanceof DppError
          ? `${ex.code}: ${ex.message}`
          : (ex as Error).message,
      };
    }
  }

  protocol(): DerPeerProtocol {
    return this.dpp;
  }

  // ---- receiver ----

  private async applyBatch(raw: unknown): Promise<void> {
    const sourceDevice = this.mgr.session()?.remoteDevice ?? 'unknown';
    const resp = await fetch('/edge-api/v1/metadata/p2p/apply', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-DER-Device-Id': this.mgr.session()?.localDevice ?? '',
        'X-DER-On-Behalf-Of': sourceDevice,
      },
      body: JSON.stringify(raw),
    });
    if (!resp.ok) {
      throw new DppError('METADATA_APPLY_FAILED',
        `/metadata/p2p/apply -> HTTP ${resp.status}`);
    }
  }
}

// ---- helpers ----

interface SnapshotSummary {
  readonly snapshotId: number;
  readonly fingerprint: string;
  readonly importedAt: string;
}

async function fetchCurrentSnapshot(): Promise<SnapshotSummary | null> {
  const r = await fetch('/edge-api/v1/metadata/p2p/current-snapshot', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (r.status === 204) return null;
  if (!r.ok) return null;
  return (await r.json()) as SnapshotSummary;
}

interface CatalogItemLite {
  uid: string;
  displayName: string;
  payload: unknown;
}

async function fetchResourceItems(resource: string): Promise<CatalogItemLite[]> {
  const out: CatalogItemLite[] = [];
  let page = 1;
  for (let i = 0; i < 50; i += 1) {
    const r = await fetch(
      `/api/${encodeURIComponent(resource)}?pageSize=500&page=${page}`,
      { credentials: 'include', headers: { Accept: 'application/json' } },
    );
    if (!r.ok) break;
    const body = (await r.json()) as Record<string, unknown>;
    const rows = Array.isArray(body[resource]) ? body[resource] as unknown[] : [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const obj = row as { id?: string; displayName?: string; name?: string };
      if (typeof obj.id !== 'string') continue;
      out.push({
        uid: obj.id,
        displayName: obj.displayName ?? obj.name ?? obj.id,
        payload: row,
      });
    }
    if (rows.length < 500) break;
    page += 1;
  }
  return out;
}
