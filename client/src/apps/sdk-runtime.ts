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
  submitEvent: typeof edgeApi.submitEvent;
  listEvents: typeof edgeApi.listEvents;
  listDrafts: typeof edgeApi.listDrafts;
  dhis2Ping: typeof edgeApi.dhis2Ping;
  // C-UI-5c slice-5 — tracker + workflow-capture surface.
  listTrackerEntities: typeof edgeApi.listTrackerEntities;
  enrolTei: typeof edgeApi.enrolTei;
  listCaptureWorkflows: typeof edgeApi.listCaptureWorkflows;
  listCaptureRuns: typeof edgeApi.listCaptureRuns;
  startCaptureRun: typeof edgeApi.startCaptureRun;
  getCaptureRun: typeof edgeApi.getCaptureRun;
  getCaptureRunForm: typeof edgeApi.getCaptureRunForm;
  getCaptureRunData: typeof edgeApi.getCaptureRunData;
  advanceCaptureRun: typeof edgeApi.advanceCaptureRun;
} {
  return {
    submitAggregate: edgeApi.submitAggregate,
    submitEvent: edgeApi.submitEvent,
    listEvents: edgeApi.listEvents,
    listDrafts: edgeApi.listDrafts,
    dhis2Ping: edgeApi.dhis2Ping,
    listTrackerEntities: edgeApi.listTrackerEntities,
    enrolTei: edgeApi.enrolTei,
    listCaptureWorkflows: edgeApi.listCaptureWorkflows,
    listCaptureRuns: edgeApi.listCaptureRuns,
    startCaptureRun: edgeApi.startCaptureRun,
    getCaptureRun: edgeApi.getCaptureRun,
    getCaptureRunForm: edgeApi.getCaptureRunForm,
    getCaptureRunData: edgeApi.getCaptureRunData,
    advanceCaptureRun: edgeApi.advanceCaptureRun,
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
