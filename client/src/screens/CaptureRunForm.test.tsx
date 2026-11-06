import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptureRunForm } from './CaptureRunForm';
import { renderWithProviders } from '../test/renderWithProviders';
import { CaptureFormError } from '../api/edgeApi';
import type {
  CaptureAdvanceResponse,
  CaptureFormAssembly,
  CaptureFormDataPrefill,
  CaptureRunSummary,
} from '../api/edgeApi';
import { Route, Routes } from 'react-router-dom';

const healthy = {
  service: 'der-server', status: 'ok', version: '0',
  dhis2Integrated: true, dhis2Reference: { version: '2.44' }, timestamp: 'now',
};

const run: CaptureRunSummary = {
  runId: 'r-1',
  workflowId: 'wf-1',
  workflowVersion: 2,
  businessKey: 'OU-A:2026W40',
  currentStepId: 'step-1',
  state: 'OPEN',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-05T12:00:00Z',
};

function aggForm(): CaptureFormAssembly {
  return {
    formType: 'AGGREGATE',
    bindingKind: 'DATA_SET',
    bindingUid: 'ds1',
    displayName: 'HIV monthly',
    ownership: { ownerRole: 'OPERATOR', ownerDeviceId: 'dev-1', isMyStep: true },
    sections: [{
      sectionUid: 's', displayName: 'Core',
      fields: [{
        fieldRef: 'de1', dataElementUid: 'de1', categoryOptionComboUid: null,
        dataElementDisplayName: 'Doses', categoryOptionComboDisplayName: null,
        valueType: 'NUMBER', optionSetUid: null, requirement: 'OPTIONAL',
      }, {
        fieldRef: 'de2:cc', dataElementUid: 'de2', categoryOptionComboUid: 'cc',
        dataElementDisplayName: 'Attend', categoryOptionComboDisplayName: 'Male',
        valueType: 'NUMBER', optionSetUid: null, requirement: 'OPTIONAL',
      }, {
        fieldRef: 'readonly', dataElementUid: 'readonly', categoryOptionComboUid: null,
        dataElementDisplayName: 'Note', categoryOptionComboDisplayName: null,
        valueType: 'TEXT', optionSetUid: null, requirement: 'READONLY',
      }],
    }],
    upstreamContext: [],
  };
}

function eventForm(): CaptureFormAssembly {
  return {
    ...aggForm(),
    formType: 'EVENT_STAGE',
    bindingKind: 'PROGRAM_STAGE',
    bindingUid: 'stage1',
    sections: [{
      sectionUid: 's', displayName: 'Event',
      fields: [{
        fieldRef: 'de1', dataElementUid: 'de1', categoryOptionComboUid: null,
        dataElementDisplayName: 'Doses', categoryOptionComboDisplayName: null,
        valueType: 'NUMBER', optionSetUid: null, requirement: 'OPTIONAL',
      }],
    }],
  };
}

function prefill(): CaptureFormDataPrefill {
  return { cells: {}, lastUpdatedAt: null };
}

function advResp(partial: Partial<CaptureAdvanceResponse> = {}): CaptureAdvanceResponse {
  return {
    ...run, state: 'OPEN', currentStepId: 'step-2',
    completedByThisCall: false, ...partial,
  };
}

function withRoute(ui: JSX.Element): JSX.Element {
  return (
    <Routes>
      <Route path="/capture/runs/:id/form" element={ui} />
    </Routes>
  );
}

afterEach(() => { vi.restoreAllMocks(); });

describe('CaptureRunForm', () => {
  it('loads the form + prefill and renders aggregate context fields', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue({
        cells: { de1: '42' }, lastUpdatedAt: '2026-11-05T11:00:00Z',
      }),
      advanceCaptureRun: vi.fn(),
      submitAggregate: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    expect(await screen.findByTestId('capture-form-heading')).toHaveTextContent('HIV monthly');
    const ou = screen.getByTestId('capture-form-orgunit').querySelector('input') as HTMLInputElement;
    const per = screen.getByTestId('capture-form-period').querySelector('input') as HTMLInputElement;
    expect(ou.value).toBe('OU-A');
    expect(per.value).toBe('2026W40');
    expect(
      screen.getByTestId('capture-field-de1').querySelector('input'),
    ).toHaveValue(42);
  });

  it('submits aggregate payload, advances, and shows the success banner', async () => {
    const submitAggregate = vi.fn().mockResolvedValue({ status: 'OK' });
    const advanceCaptureRun = vi.fn().mockResolvedValue(
      advResp({ state: 'COMPLETED', currentStepId: null, completedByThisCall: true }),
    );
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate,
      advanceCaptureRun,
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    const de1 = screen.getByTestId('capture-field-de1').querySelector('input')!;
    fireEvent.change(de1, { target: { value: '10' } });
    const de2 = screen.getByTestId('capture-field-de2:cc').querySelector('input')!;
    fireEvent.change(de2, { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    await waitFor(() => {
      expect(submitAggregate).toHaveBeenCalledWith({
        dataValues: [
          { dataElement: 'de1', orgUnit: 'OU-A', period: '2026W40', value: '10' },
          { dataElement: 'de2', orgUnit: 'OU-A', period: '2026W40', value: '5',
            categoryOptionCombo: 'cc' },
        ],
      });
    });
    expect(advanceCaptureRun).toHaveBeenCalledWith('r-1');
    expect(await screen.findByTestId('capture-form-saved')).toHaveTextContent('Run completed');
  });

  it('shows awaiting state when server reports AWAITING', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn().mockResolvedValue({ status: 'OK' }),
      advanceCaptureRun: vi.fn().mockResolvedValue(advResp({ state: 'AWAITING' })),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('capture-form-saved')).toHaveTextContent('awaiting dependencies');
    });
  });

  it('shows the submit error when submitAggregate rejects with CaptureFormError', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn().mockRejectedValue(
        new CaptureFormError(409, 'WORKFLOW_RUN_BLOCKED', 'blocked', ['s-prev']),
      ),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    const err = await screen.findByTestId('capture-form-submit-error');
    expect(err).toHaveTextContent('WORKFLOW_RUN_BLOCKED');
  });

  it('shows a plain Error submit message when the error is not a CaptureFormError', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn().mockRejectedValue(new Error('boom')),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    expect(await screen.findByTestId('capture-form-submit-error')).toHaveTextContent('boom');
  });

  it('non-Error submit rejection surfaces as string', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn().mockRejectedValue('nope'),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    expect(await screen.findByTestId('capture-form-submit-error')).toBeInTheDocument();
  });

  it('shows a load-error banner when getCaptureRun throws CaptureFormError', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockRejectedValue(
        new CaptureFormError(404, 'WORKFLOW_RUN_NOT_FOUND', 'not found'),
      ),
      getCaptureRunForm: vi.fn(),
      getCaptureRunData: vi.fn(),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    expect(await screen.findByTestId('capture-form-load-error')).toHaveTextContent(
      'WORKFLOW_RUN_NOT_FOUND',
    );
  });

  it('plain Error on load surfaces as message', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockRejectedValue(new Error('x')),
      getCaptureRunForm: vi.fn(),
      getCaptureRunData: vi.fn(),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    expect(await screen.findByTestId('capture-form-load-error')).toHaveTextContent('x');
  });

  it('non-Error load rejection surfaces as string', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockRejectedValue('x'),
      getCaptureRunForm: vi.fn(),
      getCaptureRunData: vi.fn(),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    expect(await screen.findByTestId('capture-form-load-error')).toBeInTheDocument();
  });

  it('shows offline banner when dhis2Integrated=false', async () => {
    const api = {
      health: vi.fn().mockResolvedValue({ ...healthy, dhis2Integrated: false }),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await waitFor(() => {
      expect(screen.getByTestId('capture-form-offline')).toBeInTheDocument();
    });
  });

  it('EVENT_STAGE path posts /api/events via submitEvent and advances', async () => {
    const submitEvent = vi.fn().mockResolvedValue({ status: 'OK' });
    const advance = vi.fn().mockResolvedValue(advResp({ state: 'OPEN' }));
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue({ ...run, businessKey: 'tei-1' }),
      getCaptureRunForm: vi.fn().mockResolvedValue(eventForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: advance,
    } as never;
    renderWithProviders(
      withRoute(<CaptureRunForm api={api} submitEvent={submitEvent} />),
      { route: '/capture/runs/r-1/form' },
    );
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-form-orgunit').querySelector('input')!,
      { target: { value: 'OU-X' } },
    );
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '9' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    await waitFor(() => {
      expect(submitEvent).toHaveBeenCalled();
    });
    const body = submitEvent.mock.calls[0][0] as {
      events: { programStage: string; orgUnit: string; dataValues: unknown[] }[]
    };
    expect(body.events[0].programStage).toBe('stage1');
    expect(body.events[0].orgUnit).toBe('OU-X');
    expect(body.events[0].dataValues).toEqual([{ dataElement: 'de1', value: '9' }]);
    expect(advance).toHaveBeenCalledWith('r-1');
  });

  it('EVENT_STAGE submit button stays disabled when orgUnit is empty', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue({ ...run, businessKey: 'tei-1' }),
      getCaptureRunForm: vi.fn().mockResolvedValue(eventForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    expect(screen.getByTestId('capture-form-submit')).toBeDisabled();
  });

  it('submit disabled when run is COMPLETED', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue({ ...run, state: 'COMPLETED' }),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    expect(screen.getByTestId('capture-form-submit')).toBeDisabled();
  });

  it('submit disabled when the step is not owned by the device', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue({
        ...aggForm(),
        ownership: { ownerRole: 'REVIEWER', ownerDeviceId: null, isMyStep: false },
      }),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    expect(screen.getByTestId('capture-form-submit')).toBeDisabled();
  });

  it('operator edits aggregate orgUnit + period and the next submit uses new values', async () => {
    const submitAggregate = vi.fn().mockResolvedValue({ status: 'OK' });
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue(run),
      getCaptureRunForm: vi.fn().mockResolvedValue(aggForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate,
      advanceCaptureRun: vi.fn().mockResolvedValue(advResp()),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-form-orgunit').querySelector('input')!,
      { target: { value: 'OU-NEW' } },
    );
    fireEvent.change(
      screen.getByTestId('capture-form-period').querySelector('input')!,
      { target: { value: '2026W41' } },
    );
    fireEvent.change(
      screen.getByTestId('capture-field-de1').querySelector('input')!,
      { target: { value: '7' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    await waitFor(() => {
      expect(submitAggregate).toHaveBeenCalledWith({
        dataValues: [
          { dataElement: 'de1', orgUnit: 'OU-NEW', period: '2026W41', value: '7' },
        ],
      });
    });
  });

  it('EVENT_STAGE operator can set a custom occurredAt', async () => {
    const submitEvent = vi.fn().mockResolvedValue({ status: 'OK' });
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue({ ...run, businessKey: 'tei-1' }),
      getCaptureRunForm: vi.fn().mockResolvedValue(eventForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn().mockResolvedValue(advResp()),
    } as never;
    renderWithProviders(
      withRoute(<CaptureRunForm api={api} submitEvent={submitEvent} />),
      { route: '/capture/runs/r-1/form' },
    );
    await screen.findByTestId('capture-form-heading');
    fireEvent.change(
      screen.getByTestId('capture-form-orgunit').querySelector('input')!,
      { target: { value: 'OU-X' } },
    );
    fireEvent.change(
      screen.getByTestId('capture-form-occurred').querySelector('input')!,
      { target: { value: '2026-11-01T10:00:00Z' } },
    );
    fireEvent.click(screen.getByTestId('capture-form-submit'));
    await waitFor(() => {
      expect(submitEvent).toHaveBeenCalled();
    });
    const body = submitEvent.mock.calls[0][0] as {
      events: { occurredAt: string }[]
    };
    expect(body.events[0].occurredAt).toBe('2026-11-01T10:00:00Z');
  });

  it('EVENT_STAGE with no businessKey colon leaves orgUnit empty', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(healthy),
      getCaptureRun: vi.fn().mockResolvedValue({ ...run, businessKey: 'opaque' }),
      getCaptureRunForm: vi.fn().mockResolvedValue(eventForm()),
      getCaptureRunData: vi.fn().mockResolvedValue(prefill()),
      submitAggregate: vi.fn(),
      advanceCaptureRun: vi.fn(),
    } as never;
    renderWithProviders(withRoute(<CaptureRunForm api={api} />), {
      route: '/capture/runs/r-1/form',
    });
    await screen.findByTestId('capture-form-heading');
    expect(
      (screen.getByTestId('capture-form-orgunit').querySelector('input') as HTMLInputElement).value,
    ).toBe('');
  });
});
