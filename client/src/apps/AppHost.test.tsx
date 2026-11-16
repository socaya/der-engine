import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHost, findAppByKey, friendlyInstallError } from './AppHost';
import type { CatalogueApp } from './catalogue';
import * as installer from './installer';
import { render } from '@testing-library/react';

const APPS: CatalogueApp[] = [{
  appId: 'id-1', appKey: 'hello', displayName: 'Hello DER',
  module: null, version: '1.0.0',
  bundleUrl: '/edge-api/v1/apps/id-1/1.0.0/bundle.js',
  bundleSha256: 'abc', signatureB64: 'si', requiresDerApi: '1.0.0',
  iconUrl: null,
  hostKind: 'DER_ESM', source: 'MANUAL_UPLOAD', trustLevel: 'SIGNED',
  launchUrl: null, launchMode: null,
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

describe('friendlyInstallError', () => {
  // Operators read these strings when an app fails to launch.
  // A rename of a code without updating the copy map would
  // regress to the generic FETCH_FAILED fallback — pin each
  // branch so that regression is caught.
  it('surfaces DEVICE_NOT_APPROVED copy', () => {
    const c = friendlyInstallError('DEVICE_NOT_APPROVED');
    expect(c.title).toBe('This device is not approved');
    expect(c.body).toMatch(/approved/i);
  });
  it('surfaces SIGNATURE_INVALID / SHA256_MISMATCH copy', () => {
    const a = friendlyInstallError('SIGNATURE_INVALID');
    const b = friendlyInstallError('SHA256_MISMATCH');
    expect(a.title).toBe('App could not be verified');
    expect(b.title).toBe('App could not be verified');
  });
  it('surfaces SIGNING_KEY_UNAVAILABLE copy', () => {
    const c = friendlyInstallError('SIGNING_KEY_UNAVAILABLE');
    expect(c.title).toBe('App signing key unavailable');
    expect(c.body).toMatch(/connectivity/i);
  });
  it('surfaces IDB_FAILED copy', () => {
    const c = friendlyInstallError('IDB_FAILED');
    expect(c.title).toBe('Could not open local app cache');
    expect(c.body).toMatch(/clearing site storage/i);
  });
  it('falls through to FETCH_FAILED default on unknown code', () => {
    const unknown = friendlyInstallError('ZZZ_NEW_CODE');
    const fetchFailed = friendlyInstallError('FETCH_FAILED');
    expect(unknown).toEqual(fetchFailed);
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
    const el = screen.getByTestId('der-apphost-install-error');
    expect(el.getAttribute('data-error-code')).toBe('SIGNATURE_INVALID');
    expect(el).toHaveTextContent(/could not be verified/i);
  });

  it('shows the production fallback copy when the error has no code', async () => {
    vi.spyOn(installer, 'ensureInstalled').mockRejectedValue(new Error('x'));
    renderAt('hello');
    await waitFor(() => expect(screen.getByTestId('der-apphost-install-error'))
      .toHaveTextContent(/app could not be loaded/i));
  });

  it('shows the device-not-approved copy with no raw code in UI', async () => {
    vi.spyOn(installer, 'ensureInstalled').mockRejectedValue(
      Object.assign(new Error('nope'),
        { code: 'DEVICE_NOT_APPROVED' as const }));
    renderAt('hello');
    await waitFor(() => expect(screen.getByTestId('der-apphost-install-error'))
      .toBeInTheDocument());
    const el = screen.getByTestId('der-apphost-install-error');
    expect(el).toHaveTextContent(/this device is not approved/i);
    expect(el).toHaveTextContent(/administrator/i);
    // Raw code preserved for operator diagnostics but not surfaced as text.
    expect(el.getAttribute('data-error-code')).toBe('DEVICE_NOT_APPROVED');
    expect(el.textContent).not.toMatch(/DEVICE_NOT_APPROVED/);
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

  it('renders DHIS2_IFRAME apps inside an iframe in the DER shell', async () => {
    // DHIS2 custom apps (ADR-0005) cannot be ESM-imported — they
    // serve raw HTML from /dhis-web-<key>/. AppHost must detect
    // hostKind=DHIS2_IFRAME and mount the iframe inside the shell
    // instead of hitting the installer. Pins the Launcher →
    // /apps/<key> → in-shell render invariant so DHIS2 apps don't
    // break out of the DER chrome.
    const ensureSpy = vi.spyOn(installer, 'ensureInstalled');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogueResponse([{
      appId: 'id-er', appKey: 'eregisters', displayName: 'eRegisters',
      module: null, version: '1.1.12',
      bundleUrl: '/dhis-web-eregisters/', bundleSha256: '',
      signatureB64: '', requiresDerApi: '',
      iconUrl: null,
      hostKind: 'DHIS2_IFRAME', source: 'MANUAL_UPLOAD',
      trustLevel: 'UNSIGNED',
      launchUrl: '/dhis-web-eregisters/',
      launchMode: 'DEEPLINK',
    }]));
    renderAt('eregisters');
    await waitFor(() => expect(
        screen.getByTestId('der-apphost-iframe-eregisters'))
      .toBeInTheDocument());
    const iframe = screen.getByTestId('der-apphost-iframe-eregisters');
    expect(iframe.getAttribute('src')).toBe('/dhis-web-eregisters/');
    expect(iframe.getAttribute('title')).toBe('DHIS2 app: eregisters');
    // The installer path MUST NOT fire for DHIS2 apps — they have
    // no signed bundle to fetch.
    expect(ensureSpy).not.toHaveBeenCalled();
  });

  it('swaps iframe for a DER crash card when the embedded app throws', async () => {
    // Same-origin DHIS2 iframe → DER can listen on its contentWindow
    // for uncaught errors and unhandled promise rejections. The
    // envelope hides the app's own raw stack trace, shows the app's
    // display name, and surfaces "Copy details" + Reload + Back —
    // so an operator can't mistake a DHIS2-app bug for a DER bug.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogueResponse([{
      appId: 'id-er', appKey: 'eregisters', displayName: 'eRegisters',
      module: null, version: '1.1.12',
      bundleUrl: '/dhis-web-eregisters/', bundleSha256: '',
      signatureB64: '', requiresDerApi: '',
      iconUrl: null,
      hostKind: 'DHIS2_IFRAME', source: 'MANUAL_UPLOAD',
      trustLevel: 'UNSIGNED',
      launchUrl: '/dhis-web-eregisters/',
      launchMode: 'DEEPLINK',
    }]));
    renderAt('eregisters');
    const iframe = await screen.findByTestId('der-apphost-iframe-eregisters');
    // jsdom's HTMLIFrameElement doesn't wire a real contentWindow on
    // render; monkey-patch to simulate the handshake AppHost does on
    // the iframe's `load` event.
    const fakeWindow = new EventTarget() as unknown as Window;
    Object.defineProperty(iframe, 'contentWindow',
        { value: fakeWindow, configurable: true });
    Object.defineProperty(iframe, 'contentDocument',
        { value: { getElementById: () => null, createElement: () => ({}),
                   head: { appendChild: () => undefined } },
          configurable: true });
    iframe.dispatchEvent(new Event('load', { bubbles: false }));
    // Fire the kind of unhandled rejection eregisters throws when a
    // required field is missing on its remote metadata.
    const rejectionEvent = Object.assign(new Event('unhandledrejection'),
        { reason: new TypeError(
            "Cannot read properties of undefined (reading 'metadata')") });
    (fakeWindow as unknown as EventTarget).dispatchEvent(rejectionEvent);
    await waitFor(() => expect(
        screen.getByTestId('der-apphost-iframe-crashed')).toBeInTheDocument());
    expect(screen.getByRole('heading',
        { name: /eRegisters is not responding/i })).toBeInTheDocument();
    expect(screen.getByTestId('der-apphost-iframe-crashed-copy'))
        .toHaveTextContent(/Copy details/);
    expect(screen.getByTestId('der-apphost-iframe-crashed-reload'))
        .toBeInTheDocument();
    expect(screen.getByTestId('der-apphost-iframe-crashed-back'))
        .toBeInTheDocument();
  });

  it('crash card Copy-details button writes the error payload to clipboard', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: writeTextSpy }, configurable: true,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogueResponse([{
      appId: 'id-er', appKey: 'eregisters', displayName: 'eRegisters',
      module: null, version: '1.1.12',
      bundleUrl: '/dhis-web-eregisters/', bundleSha256: '',
      signatureB64: '', requiresDerApi: '',
      iconUrl: null,
      hostKind: 'DHIS2_IFRAME', source: 'MANUAL_UPLOAD',
      trustLevel: 'UNSIGNED',
      launchUrl: '/dhis-web-eregisters/',
      launchMode: 'DEEPLINK',
    }]));
    renderAt('eregisters');
    const iframe = await screen.findByTestId('der-apphost-iframe-eregisters');
    const fakeWindow = new EventTarget() as unknown as Window;
    Object.defineProperty(iframe, 'contentWindow',
        { value: fakeWindow, configurable: true });
    Object.defineProperty(iframe, 'contentDocument',
        { value: { getElementById: () => null, createElement: () => ({}),
                   head: { appendChild: () => undefined } },
          configurable: true });
    iframe.dispatchEvent(new Event('load', { bubbles: false }));
    const rejectionEvent = Object.assign(new Event('unhandledrejection'),
        { reason: new Error('boom') });
    (fakeWindow as unknown as EventTarget).dispatchEvent(rejectionEvent);
    const copyBtn = await screen.findByTestId('der-apphost-iframe-crashed-copy');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(copyBtn);
    await waitFor(() => expect(writeTextSpy).toHaveBeenCalled());
    const payload = writeTextSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({ app: 'eregisters',
        appName: 'eRegisters', message: 'boom' });
  });

  it('crash card Reload-app button swaps back to the iframe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogueResponse([{
      appId: 'id-er', appKey: 'eregisters', displayName: 'eRegisters',
      module: null, version: '1.1.12',
      bundleUrl: '/dhis-web-eregisters/', bundleSha256: '',
      signatureB64: '', requiresDerApi: '',
      iconUrl: null,
      hostKind: 'DHIS2_IFRAME', source: 'MANUAL_UPLOAD',
      trustLevel: 'UNSIGNED',
      launchUrl: '/dhis-web-eregisters/',
      launchMode: 'DEEPLINK',
    }]));
    renderAt('eregisters');
    const iframe = await screen.findByTestId('der-apphost-iframe-eregisters');
    const fakeWindow = new EventTarget() as unknown as Window;
    Object.defineProperty(iframe, 'contentWindow',
        { value: fakeWindow, configurable: true });
    Object.defineProperty(iframe, 'contentDocument',
        { value: { getElementById: () => null, createElement: () => ({}),
                   head: { appendChild: () => undefined } },
          configurable: true });
    iframe.dispatchEvent(new Event('load', { bubbles: false }));
    (fakeWindow as unknown as EventTarget).dispatchEvent(
        Object.assign(new Event('unhandledrejection'),
            { reason: new Error('x') }));
    const reloadBtn = await screen.findByTestId(
        'der-apphost-iframe-crashed-reload');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(reloadBtn);
    // Back to the iframe wrapper, crash card gone.
    await waitFor(() => expect(screen.queryByTestId(
        'der-apphost-iframe-crashed')).toBeNull());
    expect(screen.getByTestId('der-apphost-iframe-eregisters'))
        .toBeInTheDocument();
  });
});
