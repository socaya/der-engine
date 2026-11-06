/**
 * `/vendor/der-app-sdk.js` source — the thin bridge every DER-
 * dispatched app imports via `import … from '@der/app-sdk'`.
 *
 * The shell registers its own hook implementations on
 * `globalThis.__DER_SDK_RUNTIME__` at boot. This bridge just
 * forwards each exported symbol to that registry so apps and
 * shell share one React instance (hooks require this) + one
 * context tree (AuthContext, OrgUnitBinding, etc.).
 */

type UnknownFn = (...args: unknown[]) => unknown;

interface SdkRuntime {
  readonly useAuth: UnknownFn;
  readonly useOrgUnitBinding: UnknownFn;
  readonly useOnlineStatus: UnknownFn;
  readonly useDerApi: UnknownFn;
  readonly ScreenCard: UnknownFn;
  readonly StatusPill: UnknownFn;
}

function runtime(): SdkRuntime {
  const r = (globalThis as unknown as
    { __DER_SDK_RUNTIME__?: SdkRuntime }).__DER_SDK_RUNTIME__;
  if (!r) {
    throw new Error(
      '@der/app-sdk: shell runtime is not installed. '
      + 'Apps can only load inside the DER device client.');
  }
  return r;
}

export const useAuth = ((...a: unknown[]) => runtime().useAuth(...a));
export const useOrgUnitBinding = ((...a: unknown[]) => runtime().useOrgUnitBinding(...a));
export const useOnlineStatus = ((...a: unknown[]) => runtime().useOnlineStatus(...a));
export const useDerApi = ((...a: unknown[]) => runtime().useDerApi(...a));
export const ScreenCard = ((...a: unknown[]) => runtime().ScreenCard(...a));
export const StatusPill = ((...a: unknown[]) => runtime().StatusPill(...a));
