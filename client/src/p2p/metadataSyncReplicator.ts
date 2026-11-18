import { P2PProtocol } from './protocol';
import type { PeerConnectionManager } from './peerConnection';

/**
 * P2P metadata catalog replication. One device in the clinic pulls a
 * fresh metadata snapshot from DHIS2 central; the rest pick it up from
 * that device over the P2P data channel instead of each paying the
 * central-pull cost themselves. Especially valuable on constrained
 * upstream links (one 3G modem shared across tablets).
 *
 * <p>Protocol:
 * <ol>
 *   <li>Sender pulls local snapshot summary via
 *       {@code GET /edge-api/v1/metadata/p2p/current-snapshot} —
 *       returns {@code {snapshotId, fingerprint, counts}}.</li>
 *   <li>Sender emits {@code kind="metadata-snapshot-offer"} with
 *       {@code {snapshotId, fingerprint}}. Receiver compares its own
 *       fingerprint and replies with {@code kind="metadata-snapshot-ack"}
 *       {@code {want: boolean}}.</li>
 *   <li>If receiver wants the delta, sender iterates every resource
 *       the local catalog knows about, fetches its items via
 *       {@code GET /api/<resource>?pageSize=500&page=N} (the catalog's
 *       native read endpoint), chunks them, and ships each chunk as
 *       {@code kind="metadata-batch"}.</li>
 *   <li>Receiver POSTs each batch to its local
 *       {@code /edge-api/v1/metadata/p2p/apply}, which upserts via
 *       the same {@link MetadataCatalogRepository} the central pull
 *       uses — identical write path so downstream consumers see no
 *       difference between P2P-synced and central-synced metadata.</li>
 * </ol>
 *
 * <p>Idempotency: the apply endpoint upserts by
 * {@code (resource, dhis2_uid)} so replaying the same batch is safe.
 * The sender also dedups the exchange per-session by fingerprint —
 * once a peer confirms it has fingerprint X, we don't offer it again
 * on the same session.</p>
 */

export interface MetadataSyncResult {
  readonly status: 'noop' | 'sent' | 'received' | 'failed';
  readonly resources: number;
  readonly items: number;
  readonly fingerprint?: string;
  readonly error?: string;
}

/** Resources the P2P sync covers. Deliberately a short list — these are
 *  the catalog-backed collections that drive 80% of app boot behavior
 *  (indicators, option sets, categories, etc.). Expand as needed. */
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
  private readonly proto: P2PProtocol;
  private readonly mgr: PeerConnectionManager;
  /** Fingerprints we've already offered-and-handled this session. */
  private readonly offered = new Set<string>();

  constructor(mgr: PeerConnectionManager, proto?: P2PProtocol) {
    this.mgr = mgr;
    this.proto = proto ?? new P2PProtocol(mgr);
    this.proto.on('metadata-snapshot-offer', (data) => this.handleOffer(data));
    this.proto.on('metadata-batch', (data) => this.handleBatch(data));
  }

  /**
   * Initiate a sync exchange — pull local snapshot info, offer it,
   * and if the peer wants the delta, stream every known catalog
   * resource in batches of {@link BATCH_SIZE}.
   */
  async push(): Promise<MetadataSyncResult> {
    const session = this.mgr.session();
    if (!session || session.status !== 'connected') {
      throw new Error(
        `cannot sync — channel status ${session?.status ?? 'none'}`);
    }
    const local = await fetchCurrentSnapshot();
    if (!local) {
      return {
        status: 'failed',
        resources: 0,
        items: 0,
        error: 'no local metadata snapshot — run central sync first',
      };
    }
    if (this.offered.has(local.fingerprint)) {
      return {
        status: 'noop',
        resources: 0,
        items: 0,
        fingerprint: local.fingerprint,
      };
    }
    this.offered.add(local.fingerprint);

    // Push each resource straight away. P2P.3's envelope guarantees
    // in-order delivery on the data channel + per-chunk ack, so we
    // don't need an explicit offer / ack round-trip for the MVP.
    // The receiver's apply handler is idempotent (upsert by resource
    // + uid), so a duplicate batch on reconnect is harmless.
    let resources = 0;
    let items = 0;
    try {
      for (const resource of SYNCED_RESOURCES) {
        const all = await fetchResourceItems(resource);
        if (all.length === 0) {
          continue;
        }
        resources += 1;
        for (let i = 0; i < all.length; i += BATCH_SIZE) {
          const chunk = all.slice(i, i + BATCH_SIZE);
          await this.proto.send('metadata-batch', {
            snapshotId: local.snapshotId,
            batch: [{ resource, items: chunk }],
          });
          items += chunk.length;
        }
      }
      return {
        status: 'sent',
        resources,
        items,
        fingerprint: local.fingerprint,
      };
    } catch (ex) {
      return {
        status: 'failed',
        resources, items,
        fingerprint: local.fingerprint,
        error: (ex as Error).message,
      };
    }
  }

  protocol(): P2PProtocol {
    return this.proto;
  }

  // ---- receiver ----

  private async handleOffer(raw: unknown): Promise<void> {
    // Current MVP uses push-first (sender streams unilaterally). The
    // offer/ack handshake exists as a hook for a future "do you want
    // this delta?" negotiation without a protocol bump.
    void raw;
  }

  private async handleBatch(raw: unknown): Promise<void> {
    const b = raw as {
      snapshotId?: number;
      batch?: {
        resource?: string;
        items?: { uid: string; displayName: string; payload: unknown }[];
      }[];
    } | null;
    if (!b || !b.batch || b.batch.length === 0) {
      return;
    }
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
      body: JSON.stringify(b),
    });
    if (!resp.ok) {
      throw new Error(`metadata apply -> HTTP ${resp.status}`);
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
  const j = (await r.json()) as {
    snapshotId: number;
    fingerprint: string;
    importedAt: string;
  };
  return j;
}

interface CatalogItemLite {
  uid: string;
  displayName: string;
  payload: unknown;
}

/** Pull every catalog row for a resource out of the local DHIS2-shaped
 *  listing. Uses the catalog read endpoint so we stay away from
 *  private tables + the fingerprint stays aligned with what the
 *  receive-side apply writes back. */
async function fetchResourceItems(resource: string): Promise<CatalogItemLite[]> {
  const out: CatalogItemLite[] = [];
  let page = 1;
  // Loop guard — bound by the biggest catalog resource we currently
  // host (~400 rows). 500 per page × 50 pages = 25k items ceiling;
  // if we ever grow past that the loop still terminates once an
  // empty page lands.
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
