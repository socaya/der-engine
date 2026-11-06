/**
 * Ed25519 signature verification for DER-dispatched app bundles.
 *
 * DER's server holds the signing keypair sealed via SecretEnvelope;
 * the public key (raw 32 bytes, base64) is served at
 * `/edge-api/v1/apps/signing-key`. The client imports it as a
 * WebCrypto `CryptoKey` and verifies each bundle's signature
 * before the module is ever imported.
 *
 * Browser support: Ed25519 landed in Chrome 113 (May 2023),
 * Firefox 130 (Sep 2024), Safari 17 (Sep 2023). DER targets modern
 * evergreen browsers; a feature-detect shim is unnecessary.
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
  return crypto.subtle.importKey(
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
    const key = await importVerifyKey(publicKeyB64);
    const signature = base64ToBytes(signatureB64);
    return await crypto.subtle.verify(
      { name: 'Ed25519' } as never,
      key,
      signature.buffer as ArrayBuffer,
      bundleBytes.buffer as ArrayBuffer,
    );
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
  const digest = await crypto.subtle.digest(
    'SHA-256', bytes.buffer as ArrayBuffer);
  const view = new Uint8Array(digest);
  let hex = '';
  for (const b of view) hex += b.toString(16).padStart(2, '0');
  return hex;
}
