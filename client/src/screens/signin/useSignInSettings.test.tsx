import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignInSettings } from './useSignInSettings';

function okJson(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}
function err(status: number): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as unknown as Response;
}

describe('useSignInSettings', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({
      layout: 'hero', appTitle: 'My clinic', appIntro: 'Welcome',
      submitLabel: 'Enter', footerHtml: '<a>help</a>',
      hasBackground: true, backgroundUrl: '/x.png', backgroundEtag: 'abc',
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches once on mount and exposes the sanitized payload', async () => {
    const { result } = renderHook(() => useSignInSettings());
    await waitFor(() => expect(result.current.layout).toBe('hero'));
    expect(result.current.appTitle).toBe('My clinic');
    expect(result.current.submitLabel).toBe('Enter');
    expect(result.current.hasBackground).toBe(true);
    expect(result.current.backgroundUrl).toBe('/x.png');
  });

  it('keeps empty settings when the server returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(err(503));
    const { result } = renderHook(() => useSignInSettings());
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.layout).toBeNull();
    expect(result.current.appTitle).toBeNull();
  });

  it('keeps empty settings when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSignInSettings());
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.layout).toBeNull();
  });

  it('rejects unknown layout values from the server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ layout: 'rogue' }));
    const { result } = renderHook(() => useSignInSettings());
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.layout).toBeNull();
  });

  it('coerces non-string fields to null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({
      layout: null, appTitle: 42, appIntro: {}, submitLabel: null,
      footerHtml: ['x'], hasBackground: 'yes', backgroundUrl: 7,
      backgroundEtag: null,
    }));
    const { result } = renderHook(() => useSignInSettings());
    await new Promise(r => setTimeout(r, 10));
    expect(result.current).toEqual({
      layout: null, appTitle: null, appIntro: null, submitLabel: null,
      footerHtml: null, hasBackground: false, backgroundUrl: null,
      backgroundEtag: null,
    });
  });

  it('returns empty for a non-object payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson('oops'));
    const { result } = renderHook(() => useSignInSettings());
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.layout).toBeNull();
    expect(result.current.hasBackground).toBe(false);
  });
});
