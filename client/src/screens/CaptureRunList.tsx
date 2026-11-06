import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumnHeader,
  DataTableHead,
  DataTableRow,
  InputField,
  Modal,
  ModalActions,
  ModalContent,
  ModalTitle,
  SingleSelectField,
  SingleSelectOption,
  Tag,
} from '@dhis2/ui';
import * as edgeApi from '../api/edgeApi';
import type { CaptureRunSummary, CaptureWorkflowSummary } from '../api/edgeApi';
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  OfflineBanner,
} from '../components/ScreenStates';

export interface CaptureRunListProps {
  readonly api?: Pick<
    typeof edgeApi,
    'listCaptureRuns' | 'startCaptureRun' | 'listCaptureWorkflows' | 'health'
  >;
}

type StateFilter = '' | CaptureRunSummary['state'];

function stateTag(state: CaptureRunSummary['state']): JSX.Element {
  switch (state) {
    case 'OPEN':
      return <Tag positive>Open</Tag>;
    case 'AWAITING':
      return <Tag neutral>Awaiting</Tag>;
    case 'COMPLETED':
      return <Tag>Completed</Tag>;
    case 'REJECTED':
      return <Tag negative>Rejected</Tag>;
  }
}

export function CaptureRunList(
  { api = edgeApi }: CaptureRunListProps = {},
): JSX.Element {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const workflowId = search.get('workflowId') ?? '';
  const stateParam = (search.get('state') ?? '') as StateFilter;

  const [workflows, setWorkflows] = useState<CaptureWorkflowSummary[] | null>(null);
  const [runs, setRuns] = useState<CaptureRunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const [startOpen, setStartOpen] = useState(false);
  const [startBusinessKey, setStartBusinessKey] = useState('');
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.health().then((h) => { if (!cancelled) setOffline(!h.dhis2Integrated); })
       .catch(() => undefined);
    api.listCaptureWorkflows().then((resp) => {
      if (!cancelled) setWorkflows(resp.workflows.filter((w) => w.enabled));
    }).catch(() => {
      if (!cancelled) setWorkflows([]);
    });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!workflowId) {
      setRuns(null);
      return;
    }
    let cancelled = false;
    setRuns(null);
    setError(null);
    api.listCaptureRuns({
      workflowId,
      state: stateParam === '' ? undefined : stateParam,
    }).then((resp) => {
      if (!cancelled) setRuns(resp.runs);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });
    return () => { cancelled = true; };
  }, [api, workflowId, stateParam]);

  async function doStart(): Promise<void> {
    if (!workflowId || !startBusinessKey) return;
    setStartBusy(true);
    setStartError(null);
    try {
      const run = await api.startCaptureRun(workflowId, startBusinessKey.trim());
      setStartOpen(false);
      setStartBusinessKey('');
      navigate(`/capture/runs/${run.runId}/form`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setStartBusy(false);
    }
  }

  function updateParam(key: 'workflowId' | 'state', value: string): void {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value); else next.delete(key);
    setSearch(next, { replace: true });
  }

  return (
    <div className="der-capture-runs">
      <h1 data-test="capture-runs-heading">Capture — workflow runs</h1>
      <p>
        Workflow-scoped data capture (ADR-0036). Pick a workflow to list its
        open runs, resume a run, or start a new one for a business key.
      </p>
      {offline && <OfflineBanner testId="capture-runs-offline" />}

      <div className="der-capture-filters">
        <SingleSelectField
          label="Workflow"
          selected={
            (workflows ?? []).some((w) => w.workflowId === workflowId)
              ? workflowId
              : ''
          }
          onChange={({ selected }) => updateParam('workflowId', selected)}
          dataTest="capture-runs-workflow"
          loading={workflows === null}
        >
          {(workflows ?? []).map((w) => (
            <SingleSelectOption
              key={w.workflowId}
              value={w.workflowId}
              label={w.displayName}
              dataTest={`capture-runs-workflow-${w.workflowId}`}
            />
          ))}
        </SingleSelectField>

        <SingleSelectField
          label="State"
          selected={stateParam}
          onChange={({ selected }) => updateParam('state', selected)}
          dataTest="capture-runs-state"
        >
          <SingleSelectOption value="" label="All" />
          <SingleSelectOption value="OPEN" label="Open" />
          <SingleSelectOption value="AWAITING" label="Awaiting" />
          <SingleSelectOption value="COMPLETED" label="Completed" />
          <SingleSelectOption value="REJECTED" label="Rejected" />
        </SingleSelectField>

        <Button
          primary
          disabled={!workflowId}
          onClick={() => setStartOpen(true)}
          dataTest="capture-runs-start"
        >
          Start run
        </Button>
      </div>

      {!workflowId && (
        <EmptyBlock title="Pick a workflow" testId="capture-runs-pick">
          Choose a capture workflow above to list its runs.
        </EmptyBlock>
      )}
      {workflowId && error && (
        <ErrorBlock title="Could not load runs" testId="capture-runs-error">
          {error}
        </ErrorBlock>
      )}
      {workflowId && !error && runs === null && (
        <LoadingBlock testId="capture-runs-loading" />
      )}
      {workflowId && runs !== null && runs.length === 0 && (
        <EmptyBlock title="No runs" testId="capture-runs-empty">
          No runs match the current filter. Use <strong>Start run</strong> to
          begin one.
        </EmptyBlock>
      )}
      {workflowId && runs !== null && runs.length > 0 && (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableColumnHeader>Run</DataTableColumnHeader>
              <DataTableColumnHeader>Business key</DataTableColumnHeader>
              <DataTableColumnHeader>Current step</DataTableColumnHeader>
              <DataTableColumnHeader>State</DataTableColumnHeader>
              <DataTableColumnHeader>Updated</DataTableColumnHeader>
              <DataTableColumnHeader>Action</DataTableColumnHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {runs.map((r) => (
              <DataTableRow key={r.runId} dataTest={`capture-run-row-${r.runId}`}>
                <DataTableCell>
                  <span data-test={`capture-run-${r.runId}`}>
                    {r.runId.slice(0, 8)}…
                  </span>
                </DataTableCell>
                <DataTableCell>{r.businessKey}</DataTableCell>
                <DataTableCell>{r.currentStepId ?? '—'}</DataTableCell>
                <DataTableCell>{stateTag(r.state)}</DataTableCell>
                <DataTableCell>{r.updatedAt}</DataTableCell>
                <DataTableCell>
                  <Link
                    to={`/capture/runs/${r.runId}/form`}
                    data-test={`capture-run-open-${r.runId}`}
                  >
                    Open
                  </Link>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      {startOpen && (
        <Modal onClose={() => setStartOpen(false)} dataTest="capture-runs-start-modal">
          <ModalTitle>Start capture run</ModalTitle>
          <ModalContent>
            <p>
              Business key identifies this run uniquely within the workflow —
              e.g. an orgUnit+period, a tracked entity UID, or an enrollment UID.
            </p>
            <InputField
              label="Business key"
              value={startBusinessKey}
              onChange={({ value }) => setStartBusinessKey(value ?? '')}
              dataTest="capture-runs-start-key"
            />
            {startError && (
              <ErrorBlock title="Start failed" testId="capture-runs-start-error">
                {startError}
              </ErrorBlock>
            )}
          </ModalContent>
          <ModalActions>
            <Button
              secondary
              onClick={() => setStartOpen(false)}
              dataTest="capture-runs-start-cancel"
            >
              Cancel
            </Button>
            <Button
              primary
              loading={startBusy}
              disabled={startBusy || !startBusinessKey.trim()}
              onClick={() => { void doStart(); }}
              dataTest="capture-runs-start-confirm"
            >
              Start run
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}
