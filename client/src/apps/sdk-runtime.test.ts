import { afterEach, describe, expect, it } from 'vitest';
import { installSdkRuntime, sdkRuntime } from './sdk-runtime';

afterEach(() => {
  delete (globalThis as unknown as { __DER_SDK_RUNTIME__?: unknown }).__DER_SDK_RUNTIME__;
});

describe('installSdkRuntime', () => {
  it('writes the runtime registry to globalThis', () => {
    installSdkRuntime();
    const r = (globalThis as unknown as { __DER_SDK_RUNTIME__?: typeof sdkRuntime })
      .__DER_SDK_RUNTIME__;
    expect(r).toBe(sdkRuntime);
  });

  it('exposes the expected hook + component surface', () => {
    installSdkRuntime();
    const r = (globalThis as unknown as { __DER_SDK_RUNTIME__: typeof sdkRuntime })
      .__DER_SDK_RUNTIME__;
    for (const key of [
      'useAuth', 'useOrgUnitBinding', 'useOnlineStatus', 'useDerApi',
      'ScreenCard', 'StatusPill',
    ] as const) {
      expect(typeof r[key]).toBe('function');
    }
  });

  it('is idempotent — second install writes the same object', () => {
    installSdkRuntime();
    const first = (globalThis as unknown as { __DER_SDK_RUNTIME__: typeof sdkRuntime })
      .__DER_SDK_RUNTIME__;
    installSdkRuntime();
    const second = (globalThis as unknown as { __DER_SDK_RUNTIME__: typeof sdkRuntime })
      .__DER_SDK_RUNTIME__;
    expect(second).toBe(first);
  });
});
