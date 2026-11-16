import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppCatalogue } from './catalogue';

const GOOD = {
  appId: 'a1', appKey: 'data-entry', displayName: 'Data Entry',
  module: 'Data', version: '1.0.0', bundleUrl: '/b',
  bundleSha256: 'ab', signatureB64: 'si', requiresDerApi: '1.0.0',
  iconUrl: '/i',
};

function okJson(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('useAppCatalogue', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ apps: [GOOD] }),
    );
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stays empty when disabled', () => {
    const { result } = renderHook(() => useAppCatalogue(false));
    expect(result.current.apps).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fetches once when enabled and exposes the list', async () => {
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
    expect(result.current.apps[0].appKey).toBe('data-entry');
  });

  it('drops entries missing required fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ apps: [{ appKey: 'half' }, GOOD] }),
    );
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
    expect(result.current.apps[0].appKey).toBe('data-entry');
  });

  it('drops null + non-object entries from the apps list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ apps: [null, 'string', 42, GOOD] }),
    );
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
    expect(result.current.apps[0].appKey).toBe('data-entry');
  });

  it('passes cache: no-store so browsers never serve a stale catalogue', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ apps: [GOOD] }));
    renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    expect(init.cache).toBe('no-store');
  });

  it('returns [] for non-array apps field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ apps: 'nope' }),
    );
    const { result } = renderHook(() => useAppCatalogue(true));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.apps).toEqual([]);
  });

  it('returns [] when the server reports !ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: false, json: () => Promise.resolve({}) } as unknown as Response,
    );
    const { result } = renderHook(() => useAppCatalogue(true));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.apps).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAppCatalogue(true));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.apps).toEqual([]);
  });

  it('coerces a non-string module to null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ apps: [{ ...GOOD, module: 42 }] }),
    );
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
    expect(result.current.apps[0].module).toBeNull();
  });

  it('returns [] for a non-object payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson('oops'));
    const { result } = renderHook(() => useAppCatalogue(true));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.apps).toEqual([]);
  });

  it('merges /apps/installed DHIS2 entries into the catalogue', async () => {
    // Union path — the first fetch returns the signed-bundle list,
    // the second returns a DHIS2 custom app row that sanitizeDhis2
    // must normalise.
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve(okJson({ apps: [GOOD] }));
      }
      return Promise.resolve(okJson([{
        appId: 'dhis2-ereg', appKey: 'eregisters',
        displayName: 'eRegisters', version: '1.1.12',
      }]));
    });
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(2));
    const dhis2 = result.current.apps.find((a) => a.appKey === 'eregisters');
    expect(dhis2).toBeDefined();
    expect(dhis2!.hostKind).toBe('DHIS2_IFRAME');
    expect(dhis2!.launchUrl).toBe('/dhis-web-eregisters/');
    expect(dhis2!.launchMode).toBe('DEEPLINK');
    expect(dhis2!.trustLevel).toBe('UNSIGNED');
  });

  it('dedupes on appKey — signed bundle wins over the DHIS2 alias', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve(okJson({ apps: [
          { ...GOOD, appKey: 'collision' }] }));
      }
      return Promise.resolve(okJson([{
        appId: 'c2', appKey: 'collision',
        displayName: 'Collision (DHIS2)', version: '2.0',
      }]));
    });
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
    expect(result.current.apps[0].hostKind).toBe('DER_ESM');
  });

  it('skips malformed DHIS2 rows missing required fields', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve(okJson({ apps: [] }));
      // Various malformed shapes — none should land in the catalogue.
      return Promise.resolve(okJson([
        null,
        'not-an-object',
        { appKey: 'missing-id' },
        { appId: 'x', appKey: 'missing-version' },
      ]));
    });
    const { result } = renderHook(() => useAppCatalogue(true));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.apps).toEqual([]);
  });

  it('returns [] when /apps/installed is not an array', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve(okJson({ apps: [GOOD] }));
      return Promise.resolve(okJson({ not: 'an array' }));
    });
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
    expect(result.current.apps[0].appKey).toBe('data-entry');
  });

  it('attaches X-DER-Device-Id when localStorage carries one', async () => {
    const getItem = vi.fn().mockReturnValue('DEVICE-ABC');
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem }, configurable: true,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ apps: [] }));
    renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-DER-Device-Id']).toBe('DEVICE-ABC');
  });

  it('tolerates localStorage access errors', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => { throw new Error('no storage'); } },
      configurable: true,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ apps: [GOOD] }));
    const { result } = renderHook(() => useAppCatalogue(true));
    await waitFor(() => expect(result.current.apps.length).toBe(1));
  });
});
