import * as ShellReact from 'react';
import * as ShellReactJsxRuntime from 'react/jsx-runtime';
import * as ShellReactDom from 'react-dom';
import * as ShellReactDomClient from 'react-dom/client';
import * as ShellReactRouterDom from 'react-router-dom';
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
  getDataSetMeta: typeof edgeApi.getDataSetMeta;
  listDataSets: typeof edgeApi.listDataSets;
  readAggregateValues: typeof edgeApi.readAggregateValues;
  readAggregateFormSyncState: typeof edgeApi.readAggregateFormSyncState;
  health: typeof edgeApi.health;
  getDataSetFormMetadata: typeof edgeApi.getDataSetFormMetadata;
  getDataEntryFormHtml: typeof edgeApi.getDataEntryFormHtml;
  listValidationRules: typeof edgeApi.listValidationRules;
  listAllDataElements: typeof edgeApi.listAllDataElements;
  listAllCategoryCombos: typeof edgeApi.listAllCategoryCombos;
  listAllCategoryOptionCombos: typeof edgeApi.listAllCategoryOptionCombos;
  getCompletion: typeof edgeApi.getCompletion;
  markCompletion: typeof edgeApi.markCompletion;
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
  // Capture app (unified) — program + stage pickers surface.
  listPrograms: typeof edgeApi.listPrograms;
  listCaptureProgramStages: typeof edgeApi.listCaptureProgramStages;
  getCaptureStageForm: typeof edgeApi.getCaptureStageForm;
  listCaptureProgramEvents: typeof edgeApi.listCaptureProgramEvents;
  // G3 — program rules + variables, parsed client-side.
  listProgramRules: typeof edgeApi.listProgramRules;
  listProgramRuleVariables: typeof edgeApi.listProgramRuleVariables;
} {
  return {
    submitAggregate: edgeApi.submitAggregate,
    submitEvent: edgeApi.submitEvent,
    listEvents: edgeApi.listEvents,
    listDrafts: edgeApi.listDrafts,
    dhis2Ping: edgeApi.dhis2Ping,
    getDataSetMeta: edgeApi.getDataSetMeta,
    listDataSets: edgeApi.listDataSets,
    readAggregateValues: edgeApi.readAggregateValues,
    readAggregateFormSyncState: edgeApi.readAggregateFormSyncState,
    health: edgeApi.health,
    getDataSetFormMetadata: edgeApi.getDataSetFormMetadata,
    getDataEntryFormHtml: edgeApi.getDataEntryFormHtml,
    listValidationRules: edgeApi.listValidationRules,
    listAllDataElements: edgeApi.listAllDataElements,
    listAllCategoryCombos: edgeApi.listAllCategoryCombos,
    listAllCategoryOptionCombos: edgeApi.listAllCategoryOptionCombos,
    getCompletion: edgeApi.getCompletion,
    markCompletion: edgeApi.markCompletion,
    listTrackerEntities: edgeApi.listTrackerEntities,
    enrolTei: edgeApi.enrolTei,
    listCaptureWorkflows: edgeApi.listCaptureWorkflows,
    listCaptureRuns: edgeApi.listCaptureRuns,
    startCaptureRun: edgeApi.startCaptureRun,
    getCaptureRun: edgeApi.getCaptureRun,
    getCaptureRunForm: edgeApi.getCaptureRunForm,
    getCaptureRunData: edgeApi.getCaptureRunData,
    advanceCaptureRun: edgeApi.advanceCaptureRun,
    listPrograms: edgeApi.listPrograms,
    listCaptureProgramStages: edgeApi.listCaptureProgramStages,
    getCaptureStageForm: edgeApi.getCaptureStageForm,
    listCaptureProgramEvents: edgeApi.listCaptureProgramEvents,
    listProgramRules: edgeApi.listProgramRules,
    listProgramRuleVariables: edgeApi.listProgramRuleVariables,
  };
}

/**
 * Flatten the shell's AuthContext into the shape documented by
 * `@der/app-sdk`: apps read `auth.username`, `auth.displayName`,
 * `auth.roles[]` directly. When the shell is in INITIAL / ANONYMOUS
 * / EDGE_DOWN (no user), return a safe empty shape so apps never
 * see `undefined.displayName`.
 */
function useAppAuth(): {
  readonly username: string;
  readonly displayName: string;
  readonly roles: readonly string[];
} {
  const ctx = useShellAuth();
  if (ctx.state.status !== 'AUTHENTICATED') {
    return { username: '', displayName: '', roles: [] };
  }
  const u = ctx.state.user;
  return {
    username: u.username ?? '',
    displayName: u.displayName ?? u.username ?? '',
    roles: u.roles ?? [],
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

/**
 * Flatten the shell's OrgUnitBinding context value into the shape
 * documented by `@der/app-sdk` — apps read `ou.bound`,
 * `ou.orgUnitUid`, `ou.orgUnitPath` directly, not `ou.state.binding.*`.
 * LOADING / ERROR / unbound surfaces as `bound=false` so apps can
 * render their "not provisioned" fallback consistently.
 */
function useAppOrgUnit(): {
  readonly bound: boolean;
  readonly orgUnitUid: string;
  readonly orgUnitPath: string;
  readonly orgUnitDisplayName: string;
} {
  const ctx = useShellOrgUnit();
  if (ctx.state.status !== 'READY' || !ctx.state.binding.bound) {
    return { bound: false, orgUnitUid: '', orgUnitPath: '', orgUnitDisplayName: '' };
  }
  const b = ctx.state.binding;
  return {
    bound: true,
    orgUnitUid: b.orgUnitId ?? '',
    orgUnitPath: b.orgUnitPath ?? '',
    orgUnitDisplayName: b.orgUnitDisplayName ?? b.orgUnitId ?? '',
  };
}

export const sdkRuntime = {
  useAuth: useAppAuth,
  useOrgUnitBinding: useAppOrgUnit,
  useOnlineStatus: useAppOnline,
  useDerApi,
  ScreenCard: ShellScreenCard,
  StatusPill: ShellStatusPill,
} as const;

/**
 * Install the SDK on globalThis once, before any app can load.
 *
 * Also publishes the shell's React / ReactDOM / Router instances
 * so the generated /vendor/<name>.js files can re-export from them
 * — guaranteeing shell and apps share **one** React, which is
 * what React's hook rules (and our shared context providers)
 * require.
 */
export function installSdkRuntime(): void {
  const g = globalThis as unknown as {
    __DER_SDK_RUNTIME__: typeof sdkRuntime;
    __DER_SHELL_VENDOR__: Record<string, unknown>;
  };
  g.__DER_SDK_RUNTIME__ = sdkRuntime;
  g.__DER_SHELL_VENDOR__ = {
    react: ShellReact,
    'react/jsx-runtime': ShellReactJsxRuntime,
    'react-dom': ShellReactDom,
    'react-dom/client': ShellReactDomClient,
    'react-router-dom': ShellReactRouterDom,
  };
}
