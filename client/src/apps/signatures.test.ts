import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  base64ToBytes, fetchSigningKey, sha256Hex, verifyBundle,
} from './signatures';

const B64 = 'dGVzdA=='; // "test"

function ok(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}
function err(status: number): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as unknown as Response;
}

describe('base64ToBytes', () => {
  it('decodes standard base64', () => {
    expect(Array.from(base64ToBytes(B64))).toEqual([116, 101, 115, 116]);
  });
  it('handles empty string', () => {
    expect(base64ToBytes('').length).toBe(0);
  });
});

describe('sha256Hex', () => {
  it('matches the reference "abc" digest', async () => {
    const out = await sha256Hex(new TextEncoder().encode('abc'));
    expect(out).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('uses the safe fallback when SubtleCrypto is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    const out = await sha256Hex(new TextEncoder().encode('abc'));
    expect(out).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    vi.unstubAllGlobals();
  });
});

describe('fetchSigningKey', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({
      algorithm: 'Ed25519', publicKeyB64: B64,
    }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns the typed info', async () => {
    const info = await fetchSigningKey();
    expect(info).toEqual({ algorithm: 'Ed25519', publicKeyB64: B64 });
  });

  it('throws on non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(err(503));
    await expect(fetchSigningKey()).rejects.toThrow(/signing-key fetch failed/);
  });

  it('throws on wrong algorithm', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      ok({ algorithm: 'RSA', publicKeyB64: B64 }));
    await expect(fetchSigningKey()).rejects.toThrow(/malformed/);
  });

  it('throws on missing publicKeyB64', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      ok({ algorithm: 'Ed25519' }));
    await expect(fetchSigningKey()).rejects.toThrow(/malformed/);
  });
});

describe('verifyBundle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns false when subtle.verify rejects', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new Error('x'));
    const ok = await verifyBundle(new Uint8Array([1]), B64, B64);
    expect(ok).toBe(false);
  });

  it('returns false when subtle.verify returns false', async () => {
    const stub = { type: 'public' } as unknown as CryptoKey;
    vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue(stub);
    vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(false);
    expect(await verifyBundle(new Uint8Array([1]), B64, B64)).toBe(false);
  });

  it('returns true when subtle.verify returns true', async () => {
    const stub = { type: 'public' } as unknown as CryptoKey;
    vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue(stub);
    vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(true);
    expect(await verifyBundle(new Uint8Array([1]), B64, B64)).toBe(true);
  });

  it('verifies with the safe fallback when SubtleCrypto is unavailable', async () => {
    // RFC 8032 section 7.1, test vector 1 (empty message).
    const fromHex = (hex: string): Uint8Array => Uint8Array.from(
      hex.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
    const publicKey = fromHex(
      'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
    const signature = fromHex(
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155'
      + '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
    const toBase64 = (bytes: Uint8Array): string =>
      btoa(String.fromCharCode(...bytes));
    vi.stubGlobal('crypto', {});

    expect(await verifyBundle(
      new Uint8Array(), toBase64(signature), toBase64(publicKey),
    )).toBe(true);
  });
});
