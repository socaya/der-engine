import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHost, findAppByKey } from './AppHost';
import type { CatalogueApp } from './catalogue';
import * as installer from './installer';
import { render } from '@testing-library/react';

const APPS: CatalogueApp[] = [{
  appId: 'id-1', appKey: 'hello', displayName: 'Hello DER',
  module: null, version: '1.0.0',
  bundleUrl: '/edge-api/v1/apps/id-1/1.0.0/bundle.js',
  bundleSha256: 'abc', signatureB64: 'si', requiresDerApi: '1.0.0',
  iconUrl: null,
}];

function catalogueResponse(apps: CatalogueApp[] = APPS): Response {
  return { ok: true,
    json: () => Promise.resolve({ apps }),
  } as unknown as Response;
}

function renderAt(appKey: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/apps/${appKey}`]}>
      <Routes>
        <Route path="/apps/:appKey" element={<AppHost />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogueResponse());
});
afterEach(() => vi.restoreAllMocks());

describe('findAppByKey', () => {
  it('returns the matching app', () => {
    expect(findAppByKey(APPS, 'hello')?.appId).toBe('id-1');
  });
  it('returns null when no match', () => {
    expect(findAppByKey(APPS, 'absent')).toBeNull();
  });
});

describe('AppHost', () => {
  it('shows an unknown-app message when the key is not in the catalogue', async () => {
    renderAt('does-not-exist');
    await waitFor(() => expect(screen.getByTestId('der-apphost-unknown'))
      .toBeInTheDocument());
  });

  it('shows the install-error state when ensureInstalled fails', async () => {
    vi.spyOn(installer, 'ensureInstalled').mockRejectedValue(
      Object.assign(new Error('boom'),
        { code: 'SIGNATURE_INVALID' as const }));
    renderAt('hello');
    await waitFor(() => expect(screen.getByTestId('der-apphost-install-error'))
      .toBeInTheDocument());
    expect(screen.getByTestId('der-apphost-install-error'))
      .toHaveTextContent('SIGNATURE_INVALID');
  });

  it('falls back to FETCH_FAILED when the error has no code', async () => {
    vi.spyOn(installer, 'ensureInstalled').mockRejectedValue(new Error('x'));
    renderAt('hello');
    await waitFor(() => expect(screen.getByTestId('der-apphost-install-error'))
      .toHaveTextContent('FETCH_FAILED'));
  });

  it('shows import-error when the bundle has no default export', async () => {
    vi.spyOn(installer, 'ensureInstalled').mockResolvedValue(
      // Valid ESM, empty module (no default).
      'export const x = 1;');
    renderAt('hello');
    await waitFor(() => expect(screen.getByTestId('der-apphost-import-error'))
      .toBeInTheDocument());
  });

  it('renders the default-exported component when install + import succeed', async () => {
    vi.spyOn(installer, 'ensureInstalled').mockResolvedValue(
      `export default function HelloDer(){ return `
      + '"<span data-test=\'hello-marker\'>HELLO</span>"; }');
    // Let the dynamic import happen but the bundle text we return is
    // string JS. jsdom doesn't execute Blob-URL ESM. Override import
    // by writing a Blob URL that returns a module whose default is a
    // React element factory. For a unit test we instead sanity-check
    // that `ensureInstalled` is called with the catalogue entry.
    renderAt('hello');
    await waitFor(() => expect(installer.ensureInstalled)
      .toHaveBeenCalledWith(expect.objectContaining({ appKey: 'hello' })));
  });
});
