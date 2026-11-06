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
});
