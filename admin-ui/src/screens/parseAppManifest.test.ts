import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { File as NodeFile } from 'node:buffer';
import { parseAppManifest } from './parseAppManifest';

// jsdom's File ships without text()/arrayBuffer() in the version
// pinned under @testing-library/jest-dom — the parser relies on
// both. Use Node's spec-compliant File implementation locally so
// these tests exercise the real code path. Production bundle is
// untouched; the AppCatalogue UI tests spy on parseAppManifest
// directly rather than constructing files, so the jsdom global
// File stays in place where FormData interop matters.
function makeFile(parts: Array<Uint8Array | string>, name: string,
                     type: string): File {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (NodeFile as any)(parts, name, { type }) as File;
}

async function zipFile(name: string, entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [k, v] of Object.entries(entries)) {
    zip.file(k, v);
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return makeFile([bytes], name, 'application/zip');
}

describe('parseAppManifest', () => {
  it('returns dhis2 kind when manifest.webapp is at root', async () => {
    const f = await zipFile('x.zip', {
      'manifest.webapp': JSON.stringify({
        name: 'eregisters', displayName: 'eRegisters', version: '1.1.12',
      }),
      'index.html': '<!doctype html>',
    });
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('dhis2');
    expect(r.fields.appKey).toBe('eregisters');
    expect(r.fields.displayName).toBe('eRegisters');
    expect(r.fields.version).toBe('1.1.12');
  });

  it('returns dhis2 kind with empty fields when manifest is malformed', async () => {
    const f = await zipFile('x.zip', { 'manifest.webapp': 'not json' });
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('dhis2');
    expect(r.fields).toEqual({});
  });

  it('returns signed kind when zip contains bundle.js (no manifest.webapp)', async () => {
    const f = await zipFile('x.zip', { 'bundle.js': 'export default 1;' });
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('signed');
  });

  it('returns unknown when zip has neither manifest.webapp nor bundle.js', async () => {
    const f = await zipFile('x.zip', { 'other.txt': 'hello' });
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('unknown');
  });

  it('returns unknown on a non-zip file masquerading as .zip', async () => {
    const f = makeFile(['not a zip'], 'x.zip', 'application/zip');
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('unknown');
  });

  it('parses @der-app banner from a raw .js file as signed kind', async () => {
    const js = '/* @der-app { "appKey": "my-app", "version": "1.0.0", '
             + '"displayName": "My App", "requiresDerApi": "2.44" } */\n'
             + 'export default function() {}';
    const f = makeFile([js], 'bundle.js', 'application/javascript');
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('signed');
    expect(r.fields.appKey).toBe('my-app');
    expect(r.fields.version).toBe('1.0.0');
    expect(r.fields.displayName).toBe('My App');
  });

  it('returns signed kind with empty fields when .js has no banner', async () => {
    const f = makeFile(['export default 1;'], 'bundle.js',
      'application/javascript');
    const r = await parseAppManifest(f);
    expect(r.kind).toBe('signed');
    expect(r.fields).toEqual({});
  });

  it('tolerates requires_der_api snake-case per the DHIS2 manifest convention', async () => {
    const f = await zipFile('x.zip', {
      'manifest.webapp': JSON.stringify({
        name: 'x', version: '1.0.0', requires_der_api: '2.44',
      }),
    });
    const r = await parseAppManifest(f);
    expect(r.fields.requiresDerApi).toBe('2.44');
  });
});
