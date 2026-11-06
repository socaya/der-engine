import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, InputField, NoticeBox } from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type {
  CaptureAdvanceResponse,
  CaptureFormAssembly,
  CaptureFormDataPrefill,
  CaptureRunSummary,
} from '../api/edgeApi';
import { CaptureFormError } from '../api/edgeApi';
import { CaptureFormRenderer, type FieldValue } from '../components/CaptureFormRenderer';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';
import {
  ErrorBlock,
  LoadingBlock,
  OfflineBanner,
} from '../components/ScreenStates';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export interface CaptureRunFormProps {
  readonly api?: Pick<
    typeof edgeApi,
    'getCaptureRun'
    | 'getCaptureRunForm'
    | 'getCaptureRunData'
    | 'advanceCaptureRun'
    | 'submitAggregate'
    | 'health'
  >;
  readonly submitEvent?: (payload: unknown) => Promise<unknown>;
}

/**
 * ADR-0036 — workflow-run-scoped capture form screen.
 *
 * Fetches the D-CAP-3 envelope + any prefill, renders it via
 * CaptureFormRenderer, posts the submit through the appropriate DHIS2
 * write path (ADR-0004 /api/* emulation — aggregate or events), then
 * advances the run on success.
 *
 * Version compatibility: write bodies target the DHIS2 payload shape
 * that DER supports across 2.41-2.44 (same as the rest of the client's
 * write code paths).
 */
export function CaptureRunForm(
  { api = edgeApi, submitEvent }: CaptureRunFormProps = {},
): JSX.Element {
  const { id: runId = '' } = useParams();
  const binding = useOrgUnitBinding();
  const boundOrgUnit = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding.orgUnitId ?? ''
    : '';
  const boundOrgUnitName = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding.orgUnitDisplayName ?? boundOrgUnit
    : '';

  const [run, setRun] = useState<CaptureRunSummary | null>(null);
  const [form, setForm] = useState<CaptureFormAssembly | null>(null);
  const [prefill, setPrefill] = useState<CaptureFormDataPrefill | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // orgUnit is read-only — sourced from the bound-OU context (ADR-0015).
  // period + occurredAt remain operator-editable within the capture flow.
  const [period, setPeriod] = useState('');
  const [occurredAt, setOccurredAt] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [advance, setAdvance] = useState<CaptureAdvanceResponse | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [r, f, d] = await Promise.all([
        api.getCaptureRun(runId),
        api.getCaptureRunForm(runId),
        api.getCaptureRunData(runId),
      ]);
      setRun(r);
      setForm(f);
      setPrefill(d);
      // seed editable values from prefill
      const seed: Record<string, FieldValue> = {};
      for (const [k, v] of Object.entries(d.cells)) seed[k] = v;
      setValues(seed);
      // orgUnit is the bound OU (set outside this callback). For aggregate
      // we still parse the period out of the business key if present.
      if (f.formType === 'AGGREGATE' && r.businessKey.includes(':')) {
        const [, per] = r.businessKey.split(':', 2);
        setPeriod(per ?? '');
      }
    } catch (err) {
      if (err instanceof CaptureFormError) {
        setLoadError(`${err.code}: ${err.message}`);
      } else {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [api, runId]);

  useEffect(() => {
    let cancelled = false;
    api.health().then((h) => { if (!cancelled) setOffline(!h.dhis2Integrated); })
       .catch(() => undefined);
    void refresh();
    return () => { cancelled = true; };
  }, [api, refresh]);

  function updateField(fieldRef: string, value: FieldValue): void {
    setValues((prev) => ({ ...prev, [fieldRef]: value }));
  }

  function toStringValue(v: FieldValue): string {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return v;
  }

  async function doSubmit(): Promise<void> {
    if (!form || !run) return;
    setStatus('saving');
    setSubmitError(null);
    try {
      if (form.formType === 'AGGREGATE') {
        const dataValues = form.sections.flatMap((s) =>
          s.fields
            .filter((f) => f.requirement !== 'READONLY' && values[f.fieldRef] !== undefined
                        && values[f.fieldRef] !== '')
            .map((f) => {
              const dv: { dataElement: string; value: string; categoryOptionCombo?: string } = {
                dataElement: f.dataElementUid,
                value: toStringValue(values[f.fieldRef]!),
              };
              if (f.categoryOptionComboUid) {
                dv.categoryOptionCombo = f.categoryOptionComboUid;
              }
              return dv;
            }),
        );
        await api.submitAggregate({
          dataSet: form.bindingUid,
          orgUnit: boundOrgUnit,
          period,
          dataValues,
        });
      } else {
        // EVENT_STAGE / TRACKER_STAGE — bindingUid is the programStage
        const dvs = form.sections.flatMap((s) =>
          s.fields
            .filter((f) => f.requirement !== 'READONLY' && values[f.fieldRef] !== undefined
                        && values[f.fieldRef] !== '')
            .map((f) => ({
              dataElement: f.dataElementUid,
              value: toStringValue(values[f.fieldRef]!),
            })),
        );
        const body = {
          events: [{
            programStage: form.bindingUid,
            orgUnit: boundOrgUnit,
            occurredAt: occurredAt || new Date().toISOString(),
            status: 'ACTIVE',
            dataValues: dvs,
          }],
        };
        const impl = submitEvent ?? ((payload: unknown) =>
          fetch('/api/events', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
        await impl(body);
      }
      // advance the run
      const adv = await api.advanceCaptureRun(runId);
      setAdvance(adv);
      setRun(adv);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      if (err instanceof CaptureFormError) {
        setSubmitError(`${err.code}: ${err.message}`);
      } else {
        setSubmitError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (loadError) {
    return (
      <ErrorBlock title="Could not load run" testId="capture-form-load-error">
        {loadError}
      </ErrorBlock>
    );
  }
  if (!run || !form || !prefill) {
    return <LoadingBlock testId="capture-form-loading" />;
  }

  const canSubmit = form.ownership.isMyStep
    && run.state !== 'COMPLETED'
    && run.state !== 'REJECTED'
    && boundOrgUnit !== ''
    && (form.formType !== 'AGGREGATE' || period !== '');

  return (
    <div className="der-capture-run-form">
      <nav className="der-capture-run-form__crumbs">
        <Link to="/capture/runs" data-test="capture-form-back">
          ← Back to runs
        </Link>
      </nav>
      <header className="der-capture-run-form__header">
        <h1 data-test="capture-form-heading">
          {form.displayName}
        </h1>
        <p data-test="capture-form-run-meta">
          Run <code>{run.runId}</code> · step <code>{run.currentStepId ?? '—'}</code>
          {' · state '}<strong>{run.state}</strong>
        </p>
      </header>
      {offline && <OfflineBanner testId="capture-form-offline" />}

      {!boundOrgUnit && (
        <NoticeBox error title="This edge is not bound to an organisation unit"
                   dataTest="capture-form-unbound">
          An admin must bind this edge to an organisation unit on the DER
          server before capture can proceed.
        </NoticeBox>
      )}
      {boundOrgUnit && (
        <div className="der-capture-run-form__context">
          <div className="der-field" data-test="capture-form-orgunit">
            <span>Organisation unit</span>
            <strong>{boundOrgUnitName}</strong>
            <code>{boundOrgUnit}</code>
          </div>
          {form.formType === 'AGGREGATE' && (
            <InputField
              label="Period"
              value={period}
              disabled={!form.ownership.isMyStep}
              dataTest="capture-form-period"
              onChange={({ value }) => setPeriod(value ?? '')}
            />
          )}
          {form.formType !== 'AGGREGATE' && (
            <InputField
              label="Occurred at (ISO-8601, optional)"
              value={occurredAt}
              disabled={!form.ownership.isMyStep}
              dataTest="capture-form-occurred"
              onChange={({ value }) => setOccurredAt(value ?? '')}
            />
          )}
        </div>
      )}

      <CaptureFormRenderer
        form={form}
        values={values}
        onChange={updateField}
        disabled={status === 'saving'}
      />

      <div className="der-capture-run-form__actions">
        <Button
          primary
          loading={status === 'saving'}
          disabled={!canSubmit || status === 'saving'}
          dataTest="capture-form-submit"
          onClick={() => { void doSubmit(); }}
        >
          Submit &amp; advance
        </Button>
      </div>

      {status === 'saved' && advance && (
        <NoticeBox
          valid={advance.state === 'COMPLETED'}
          title={
            advance.completedByThisCall
              ? 'Run completed'
              : advance.state === 'AWAITING'
                ? 'Submitted — awaiting dependencies'
                : 'Submitted — advanced to next step'
          }
          dataTest="capture-form-saved"
        >
          {advance.currentStepId
            ? <>Next step: <code>{advance.currentStepId}</code></>
            : 'No further steps.'}
        </NoticeBox>
      )}
      {status === 'error' && submitError && (
        <ErrorBlock title="Submit failed" testId="capture-form-submit-error">
          {submitError}
        </ErrorBlock>
      )}
    </div>
  );
}
