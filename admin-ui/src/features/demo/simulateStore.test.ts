import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* simulateStore uses module-level state that depends on localStorage
 * at import time. Each test resets the module via vi.resetModules so
 * the read-from-storage path runs fresh with the mocked value. */

describe('simulateStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => { window.localStorage.clear(); });

  it('defaults to auto when storage is empty', async () => {
    const { getSimulateMode } = await import('./simulateStore');
    expect(getSimulateMode()).toBe('auto');
  });

  it('reads the stored mode when it is one of auto/on/off', async () => {
    window.localStorage.setItem('der.demo.internetSimulate', 'on');
    const { getSimulateMode } = await import('./simulateStore');
    expect(getSimulateMode()).toBe('on');
  });

  it('ignores bogus stored values and falls back to auto', async () => {
    window.localStorage.setItem('der.demo.internetSimulate', 'bogus');
    const { getSimulateMode } = await import('./simulateStore');
    expect(getSimulateMode()).toBe('auto');
  });

  it('setSimulateMode no-ops when value unchanged', async () => {
    const { getSimulateMode, setSimulateMode,
            subscribeSimulateMode } = await import('./simulateStore');
    const cb = vi.fn();
    subscribeSimulateMode(cb);
    setSimulateMode(getSimulateMode());  /* same as current */
    expect(cb).not.toHaveBeenCalled();
  });

  it('setSimulateMode persists + notifies subscribers', async () => {
    const { getSimulateMode, setSimulateMode,
            subscribeSimulateMode } = await import('./simulateStore');
    const cb = vi.fn();
    subscribeSimulateMode(cb);
    setSimulateMode('off');
    expect(getSimulateMode()).toBe('off');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('der.demo.internetSimulate'))
      .toBe('off');
  });

  it('subscribers that unsubscribe are not called again', async () => {
    const { setSimulateMode,
            subscribeSimulateMode } = await import('./simulateStore');
    const cb = vi.fn();
    const unsub = subscribeSimulateMode(cb);
    setSimulateMode('on');
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    setSimulateMode('off');
    /* Still only the first call. */
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('localStorage throw is swallowed — in-memory state still updates', async () => {
    const { getSimulateMode, setSimulateMode } = await import('./simulateStore');
    const originalSet = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new Error('quota');
    });
    try {
      setSimulateMode('on');
      expect(getSimulateMode()).toBe('on');
    } finally {
      window.localStorage.setItem = originalSet;
    }
  });

  it('localStorage getItem throw at import is swallowed', async () => {
    const originalGet = window.localStorage.getItem;
    window.localStorage.getItem = vi.fn(() => {
      throw new Error('denied');
    });
    try {
      const { getSimulateMode } = await import('./simulateStore');
      expect(getSimulateMode()).toBe('auto');
    } finally {
      window.localStorage.getItem = originalGet;
    }
  });

  it('resolveSimulate — on always true', async () => {
    const { resolveSimulate } = await import('./simulateStore');
    expect(resolveSimulate('on', false)).toBe(true);
    expect(resolveSimulate('on', true)).toBe(true);
  });

  it('resolveSimulate — off always false', async () => {
    const { resolveSimulate } = await import('./simulateStore');
    expect(resolveSimulate('off', false)).toBe(false);
    expect(resolveSimulate('off', true)).toBe(false);
  });

  it('resolveSimulate — auto follows centralIsLocal', async () => {
    const { resolveSimulate } = await import('./simulateStore');
    expect(resolveSimulate('auto', true)).toBe(true);
    expect(resolveSimulate('auto', false)).toBe(false);
  });

  it('resolveSimulate — unknown mode falls through to auto behaviour', async () => {
    const { resolveSimulate } = await import('./simulateStore');
    expect(resolveSimulate('weird' as unknown as 'auto', true)).toBe(true);
    expect(resolveSimulate('weird' as unknown as 'auto', false)).toBe(false);
  });
});
