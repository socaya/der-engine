import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Ed25519 signature verification for DER-dispatched app bundles.
 *
 * DER's server holds the signing keypair sealed via SecretEnvelope;
 * the public key (raw 32 bytes, base64) is served at
 * `/edge-api/v1/apps/signing-key`. The client imports it as a
 * WebCrypto `CryptoKey` and verifies each bundle's signature
 * before the module is ever imported.
 *
 * Native WebCrypto is preferred. Audited pure-JS fallbacks preserve
 * verification on LAN HTTP origins (where SubtleCrypto is unavailable)
 * and in browsers without native Ed25519 support.
 */

const SIGNING_KEY_URL = '/edge-api/v1/apps/signing-key';

export interface SigningKeyInfo {
  readonly algorithm: 'Ed25519';
  readonly publicKeyB64: string;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function fetchSigningKey(): Promise<SigningKeyInfo> {
  const r = await fetch(SIGNING_KEY_URL, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`signing-key fetch failed (${r.status})`);
  const json = await r.json() as { algorithm?: unknown; publicKeyB64?: unknown };
  if (json.algorithm !== 'Ed25519' || typeof json.publicKeyB64 !== 'string') {
    throw new Error('signing-key response is malformed');
  }
  return { algorithm: 'Ed25519', publicKeyB64: json.publicKeyB64 };
}

export async function importVerifyKey(publicKeyB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(publicKeyB64);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SubtleCrypto is unavailable');
  return subtle.importKey(
    'raw', raw.buffer as ArrayBuffer, { name: 'Ed25519' } as never,
    false, ['verify'],
  );
}

/**
 * Verifies that `signatureB64` is a valid Ed25519 signature over
 * `bundleBytes` under the server's signing key. Returns false (not
 * throws) on any failure so callers can treat verification as a
 * boolean gate rather than a control-flow break.
 */
export async function verifyBundle(
  bundleBytes: Uint8Array,
  signatureB64: string,
  publicKeyB64: string,
): Promise<boolean> {
  try {
    const signature = base64ToBytes(signatureB64);
    const publicKey = base64ToBytes(publicKeyB64);
    const subtle = globalThis.crypto?.subtle;

    // Prefer the browser implementation when it supports Ed25519. Browsers
    // served over a LAN HTTP origin may omit SubtleCrypto entirely, while
    // some older secure-context browsers expose it without Ed25519 support.
    // In either case, retain the same verification gate via noble-curves.
    if (subtle) {
      try {
        const key = await importVerifyKey(publicKeyB64);
        return await subtle.verify(
          { name: 'Ed25519' } as never,
          key,
          signature.slice().buffer,
          bundleBytes.slice().buffer,
        );
      } catch {
        // Fall through to the audited pure-JS implementation.
      }
    }
    return ed25519.verify(signature, bundleBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Hex-encoded SHA-256 of the bundle bytes, used to cross-check
 * the catalogue's `bundleSha256` before signature verification —
 * a cheap integrity gate before the expensive crypto call.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  let view: Uint8Array;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', bytes.slice().buffer);
      view = new Uint8Array(digest);
    } catch {
      view = sha256(bytes);
    }
  } else {
    view = sha256(bytes);
  }
  let hex = '';
  for (const b of view) hex += b.toString(16).padStart(2, '0');
  return hex;
}
