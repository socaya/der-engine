import JSZip from 'jszip';

export type ParsedManifest = Partial<{
  appKey: string; displayName: string; module: string;
  version: string; requiresDerApi: string;
}>;

/**
 * Which server endpoint a given bundle should be routed to.
 *
 *  - `dhis2`  → standard DHIS2 custom app `.zip` with
 *               `manifest.webapp` at root (ADR-0005). Posts to
 *               `/edge-api/v1/apps/install`; served at
 *               `/dhis-web-<appKey>/**`.
 *  - `signed` → DER-native signed bundle (`.js`/`.mjs` or `.zip`
 *               with `bundle.js`), ADR-0037. Posts to
 *               `/edge-api/v1/admin/apps/install`.
 *  - `unknown` → neither shape detected yet (no file picked, or an
 *                unrecognised layout). The operator can still
 *                hand-fill the signed-bundle form.
 */
export type ParsedKind = 'dhis2' | 'signed' | 'unknown';
export type ParsedFile = { kind: ParsedKind; fields: ParsedManifest };

/** Match the DHIS2 `manifest.webapp` shape → our form-field names. */
function webappToFields(raw: unknown): ParsedManifest {
  if (!raw || typeof raw !== 'object') return {};
  const w = raw as Record<string, unknown>;
  const pick = (k: string): string | undefined =>
    typeof w[k] === 'string' ? (w[k] as string) : undefined;
  return {
    appKey: pick('name'),
    displayName: pick('displayName'),
    module: pick('module'),
    version: pick('version'),
    requiresDerApi: pick('requires_der_api')
      ?? pick('requiresDerApi'),
  };
}

/**
 * Inspect a selected file and classify which install flow it maps
 * to. Returns the parsed field hints when a manifest is present;
 * caller uses the `kind` to decide whether to post to the DHIS2
 * endpoint or the signed-bundle endpoint. Never throws — any
 * parsing hiccup falls back to `unknown` so the admin can still
 * hand-fill the signed-bundle form.
 */
export async function parseAppManifest(file: File): Promise<ParsedFile> {
  const isZip = file.name.toLowerCase().endsWith('.zip')
             || file.type === 'application/zip';
  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const manifest = zip.file('manifest.webapp');
      const bundle = zip.file('bundle.js');
      if (manifest) {
        try {
          const json = JSON.parse(await manifest.async('string')) as unknown;
          return { kind: 'dhis2', fields: webappToFields(json) };
        } catch {
          return { kind: 'dhis2', fields: {} };
        }
      }
      if (bundle) {
        return { kind: 'signed', fields: {} };
      }
      return { kind: 'unknown', fields: {} };
    } catch {
      return { kind: 'unknown', fields: {} };
    }
  }
  // Raw .js / .mjs — signed-bundle flow. Read the first 4 KB and
  // look for the @der-app banner so we can pre-fill form fields.
  let head: string;
  try {
    const slice = file.slice(0, 4096);
    head = typeof slice.text === 'function'
      ? await slice.text()
      : await file.text();
  } catch {
    return { kind: 'signed', fields: {} };
  }
  const m = /@der-app\s+(\{[\s\S]*?\})\s*\*\//.exec(head);
  if (!m || !m[1]) return { kind: 'signed', fields: {} };
  try {
    return { kind: 'signed', fields: JSON.parse(m[1]) as ParsedManifest };
  } catch {
    return { kind: 'signed', fields: {} };
  }
}
