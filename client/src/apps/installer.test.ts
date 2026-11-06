import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogueApp } from './catalogue';
import type * as SignaturesModule from './signatures';
import type { InstallError as InstallErrorType } from './installer';

vi.mock('./signatures', async () => {
  const actual = await vi.importActual<typeof SignaturesModule>('./signatures');
  return {
    ...actual,
    fetchSigningKey: vi.fn(),
    verifyBundle: vi.fn(),
  };
});

const signatures = await import('./signatures');
const {
  __resetForTests, ensureInstalled, evictApp, listInstalled,
} = await import('./installer');
type InstallError = InstallErrorType;

const BUNDLE = 'export default () => null';

let APP: CatalogueApp = {
  appId: 'id-1', appKey: 'hello', displayName: 'Hello DER',
  module: null, version: '1.0.0',
  bundleUrl: '/edge-api/v1/apps/id-1/1.0.0/bundle.js',
  bundleSha256: '',
  signatureB64: 'si',
  requiresDerApi: '1.0.0',
  iconUrl: null,
};

async function sha(s: string): Promise<string> {
  return signatures.sha256Hex(new TextEncoder().encode(s));
}

function bundleResponse(text: string): Response {
  return { ok: true,
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(text).buffer),
  } as unknown as Response;
}

beforeEach(async () => {
  await __resetForTests();
  APP = { ...APP, bundleSha256: await sha(BUNDLE) };
  vi.mocked(signatures.fetchSigningKey).mockResolvedValue({
    algorithm: 'Ed25519', publicKeyB64: 'pk',
  });
  vi.mocked(signatures.verifyBundle).mockResolvedValue(true);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(bundleResponse(BUNDLE));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await __resetForTests();
});

describe('ensureInstalled', () => {
  it('fetches, verifies and caches on first call', async () => {
    const txt = await ensureInstalled(APP);
    expect(txt).toBe(BUNDLE);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      APP.bundleUrl, expect.objectContaining({ credentials: 'include' }));
    const keys = await listInstalled();
    expect(keys.some((k) => k.startsWith('id-1@1.0.0@'))).toBe(true);
  });

  it('returns the cached entry on the second call without refetching', async () => {
    await ensureInstalled(APP);
    vi.mocked(globalThis.fetch).mockClear();
    const txt = await ensureInstalled(APP);
    expect(txt).toBe(BUNDLE);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('throws FETCH_FAILED on non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: false, status: 503,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as Response);
    const e = await ensureInstalled(APP).catch((x) => x) as InstallError;
    expect(e.code).toBe('FETCH_FAILED');
  });

  it('throws SHA256_MISMATCH when the catalogue hash disagrees', async () => {
    const bad = { ...APP, bundleSha256: 'ff'.repeat(32) };
    const e = await ensureInstalled(bad).catch((x) => x) as InstallError;
    expect(e.code).toBe('SHA256_MISMATCH');
  });

  it('throws SIGNING_KEY_UNAVAILABLE when the key fetch fails', async () => {
    vi.mocked(signatures.fetchSigningKey).mockRejectedValue(new Error('down'));
    const e = await ensureInstalled(APP).catch((x) => x) as InstallError;
    expect(e.code).toBe('SIGNING_KEY_UNAVAILABLE');
  });

  it('throws SIGNATURE_INVALID when verify returns false', async () => {
    vi.mocked(signatures.verifyBundle).mockResolvedValue(false);
    const e = await ensureInstalled(APP).catch((x) => x) as InstallError;
    expect(e.code).toBe('SIGNATURE_INVALID');
  });

  it('evictApp removes the cached entry', async () => {
    await ensureInstalled(APP);
    await evictApp(APP.appId, APP.version);
    const keys = await listInstalled();
    expect(keys.some((k) => k.startsWith('id-1@1.0.0@'))).toBe(false);
  });

  it("falls back to cached bundle when the server's actual bytes "
    + 'disagree with the catalogue sha', async () => {
    // Install A — catalogue A (sha_A), bundle A → cached under sha_A.
    await ensureInstalled(APP);
    const SHA_A = APP.bundleSha256;
    // Now the operator's catalogue refreshes with an advertised
    // sha_B, but the server's bundleUrl still returns bytes_X
    // (sha_X). Classic re-upload race. Without the fallback we'd
    // throw SHA256_MISMATCH; with it we reinstate sha_A and
    // return BUNDLE.
    const BUNDLE_X = 'export default () => null; // stray bytes';
    const SHA_B = 'ff'.repeat(32);
    const updated = { ...APP, bundleSha256: SHA_B };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(bundleResponse(BUNDLE_X));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const txt = await ensureInstalled(updated);
    expect(txt).toBe(BUNDLE);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('sha256 mismatch'));
    expect((await listInstalled()).some((k) => k.endsWith(`@${SHA_A}`))).toBe(true);
  });

  it('falls back to cached bundle when fetch itself throws', async () => {
    await ensureInstalled(APP);
    const SHA_B = 'ff'.repeat(32);
    const updated = { ...APP, bundleSha256: SHA_B };
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const txt = await ensureInstalled(updated);
    expect(txt).toBe(BUNDLE);
    expect(warn).toHaveBeenCalled();
  });

  it('still throws FETCH_FAILED when the fetch throws and no fallback exists', async () => {
    const SHA_B = 'ff'.repeat(32);
    const updated = { ...APP, bundleSha256: SHA_B };
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const e = await ensureInstalled(updated).catch((x) => x) as InstallError;
    expect(e.code).toBe('FETCH_FAILED');
  });

  it('falls back to cached bundle on FETCH_FAILED too', async () => {
    await ensureInstalled(APP);
    const SHA_B = 'ff'.repeat(32);
    const updated = { ...APP, bundleSha256: SHA_B };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: false, status: 503,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const txt = await ensureInstalled(updated);
    expect(txt).toBe(BUNDLE);
    expect(warn).toHaveBeenCalled();
  });

  it('evicts stale cached entry for the same app when sha256 changes', async () => {
    await ensureInstalled(APP);
    const UPDATED_BUNDLE = 'export default () => null; // v2';
    const updated = { ...APP, bundleSha256: await sha(UPDATED_BUNDLE) };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      bundleResponse(UPDATED_BUNDLE));
    const txt = await ensureInstalled(updated);
    expect(txt).toBe(UPDATED_BUNDLE);
    const keys = await listInstalled();
    expect(keys).toHaveLength(1);
    expect(keys[0]!.endsWith(`@${updated.bundleSha256}`)).toBe(true);
  });
});
