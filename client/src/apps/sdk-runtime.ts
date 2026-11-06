import { useAuth as useShellAuth } from '../auth/AuthContext';
import { useOrgUnitBinding as useShellOrgUnit } from '../orgunit/OrgUnitBindingContext';
import { useOnlineStatus as useShellOnline } from '../offline/useOnlineStatus';
import { count as queueCount } from '../offline/queue';
import * as edgeApi from '../api/edgeApi';
import { ScreenCard as ShellScreenCard, StatusPill as ShellStatusPill } from '../shell/ScreenCard';
import { useEffect, useState } from 'react';

/**
 * Shell-side implementation of the SDK surface. Installed on
 * `globalThis.__DER_SDK_RUNTIME__` at boot by `main.tsx`; the
 * published `/vendor/der-app-sdk.js` bridge forwards every
 * exported symbol to this object. One React instance, one context
 * tree, every DER-dispatched app feels native.
 */

function useDerApi(): {
  submitAggregate: typeof edgeApi.submitAggregate;
  listDrafts: typeof edgeApi.listDrafts;
  dhis2Ping: typeof edgeApi.dhis2Ping;
} {
  return {
    submitAggregate: edgeApi.submitAggregate,
    listDrafts: edgeApi.listDrafts,
    dhis2Ping: edgeApi.dhis2Ping,
  };
}

function useAppOnline(): { isOnline: boolean; queuedCount: number } {
  const isOnline = useShellOnline();
  const [queuedCount, setQ] = useState(0);
  useEffect(() => {
    let cancelled = false;
    queueCount().then((n) => { if (!cancelled) setQ(n); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [isOnline]);
  return { isOnline, queuedCount };
}

export const sdkRuntime = {
  useAuth: useShellAuth,
  useOrgUnitBinding: useShellOrgUnit,
  useOnlineStatus: useAppOnline,
  useDerApi,
  ScreenCard: ShellScreenCard,
  StatusPill: ShellStatusPill,
} as const;

/** Install the SDK on globalThis once, before any app can load. */
export function installSdkRuntime(): void {
  (globalThis as unknown as { __DER_SDK_RUNTIME__: typeof sdkRuntime })
    .__DER_SDK_RUNTIME__ = sdkRuntime;
}
