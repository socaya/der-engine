import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppDispatcher } from './AppDispatcher';
import type { CatalogueApp } from './catalogue';

const ESM_APP: CatalogueApp = {
  appId: 'id-esm', appKey: 'analytics', displayName: 'Analytics',
  module: null, version: '1.0.0',
  bundleUrl: '/edge-api/v1/apps/id-esm/1.0.0/bundle.js',
  bundleSha256: 'abc', signatureB64: 'si', requiresDerApi: '1.0.0',
  iconUrl: null,
  hostKind: 'DER_ESM', source: 'DER_BUILTIN', trustLevel: 'SIGNED',
  launchUrl: null, launchMode: null,
};

const IFRAME_APP: CatalogueApp = {
  appId: 'id-iframe', appKey: 'who-anc', displayName: 'WHO ANC',
  module: null, version: '2.1.3',
  bundleUrl: '',
  bundleSha256: '', signatureB64: '', requiresDerApi: '1.0.0',
  iconUrl: null,
  hostKind: 'DHIS2_IFRAME', source: 'CENTRAL_SYNC', trustLevel: 'UNSIGNED',
  launchUrl: '/dhis-web-who-anc/',
  launchMode: 'DEEPLINK',
};

function catalogueResponse(apps: CatalogueApp[]): Response {
  return new Response(JSON.stringify({ apps }),
    { status: 200, headers: { 'content-type': 'application/json' } });
}

function renderAt(appKey: string): void {
  render(
    <MemoryRouter initialEntries={[`/apps/${appKey}`]}>
      <Routes>
        <Route path="/apps/:appKey" element={<AppDispatcher />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AppDispatcher', () => {
  it('mounts DHIS2_IFRAME entries inside the DER shell by default', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    // Both AppDispatcher and AppHost run their own useAppCatalogue
    // fetch, so the stub must yield a fresh Response per call (a
    // single shared Response has a one-shot body stream).
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve(catalogueResponse([IFRAME_APP])));
    renderAt('who-anc');
    // Default dispatch is AppHost's in-shell iframe branch (data-test
    // der-apphost-iframe-<key>). Operators keep the DER chrome visible
    // around the embedded DHIS2 app.
    await waitFor(() => expect(
      screen.queryByTestId('der-apphost-iframe-who-anc')).not.toBeNull());
    // No new-tab deep-link under the default launch mode.
    expect(openSpy).not.toHaveBeenCalled();
    // The pinned-IFRAME IframeHost mount must NOT fire by default.
    expect(screen.queryByTestId('der-iframehost-frame')).toBeNull();
  });

  it('still mounts IframeHost when an admin pins launchMode=IFRAME', async () => {
    const pinnedIframe = { ...IFRAME_APP, launchMode: 'IFRAME' as const };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      catalogueResponse([pinnedIframe]));
    renderAt('who-anc');
    const frame = await screen.findByTestId('der-iframehost-frame');
    expect(frame.getAttribute('src')).toBe('/dhis-web-who-anc/');
    expect(frame.getAttribute('sandbox'))
      .toBe('allow-scripts allow-same-origin allow-forms allow-downloads');
    expect(frame.getAttribute('title')).toBe('WHO ANC');
  });

  it('routes DER_ESM entries to AppHost (not the iframe host)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      catalogueResponse([ESM_APP]));
    renderAt('analytics');
    await waitFor(() =>
      expect(screen.queryByTestId('der-apphost-loading')).toBeInTheDocument());
    expect(screen.queryByTestId('der-iframehost-frame')).toBeNull();
  });

  it('shows unknown-app for a key not in the catalogue', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      catalogueResponse([ESM_APP]));
    renderAt('not-installed');
    await waitFor(() =>
      expect(screen.queryByTestId('der-dispatcher-unknown')).toBeInTheDocument());
  });

  it('sets provenance data-attrs on the iframe wrapper when pinned IFRAME', async () => {
    const pinnedIframe = { ...IFRAME_APP, launchMode: 'IFRAME' as const };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      catalogueResponse([pinnedIframe]));
    renderAt('who-anc');
    const wrapper = await screen.findByTestId('der-iframehost');
    expect(wrapper.getAttribute('data-app-key')).toBe('who-anc');
    expect(wrapper.getAttribute('data-trust-level')).toBe('UNSIGNED');
    expect(wrapper.getAttribute('data-source')).toBe('CENTRAL_SYNC');
  });
});
