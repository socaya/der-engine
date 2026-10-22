import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/renderWithProviders';
import { ProgramPicker } from './ProgramPicker';
import { EventList } from './EventList';
import { EventNew } from './EventNew';
import { TrackerSearch } from './TrackerSearch';
import { TrackerDashboard } from './TrackerDashboard';
import { EnrollmentCreate } from './EnrollmentCreate';
import { ScheduledEvents } from './ScheduledEvents';
import { SubmittedReview } from './SubmittedReview';
import { Drafts } from './Drafts';

const h = (ok = true) => ({ service: 's', status: 'ok', version: '0',
  dhis2Integrated: ok, dhis2Reference: { version: '2.44' }, timestamp: 'n' });

afterEach(() => vi.restoreAllMocks());

describe('ProgramPicker DC-08', () => {
  it('renders programs with routing to tracker or events', async () => {
    const api = {
      metadataList: vi.fn().mockResolvedValue({ programs: [
        { id: 'p1', displayName: 'TB tracker', programType: 'WITH_REGISTRATION' },
        { id: 'p2', displayName: 'Mortality', programType: 'WITHOUT_REGISTRATION' },
      ] }),
      health: vi.fn().mockResolvedValue(h()),
    };
    renderWithProviders(<ProgramPicker api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('programs-heading')).toBeInTheDocument());
    expect(screen.getByTestId('program-open-p1')).toHaveTextContent('Tracker');
    expect(screen.getByTestId('program-open-p2')).toHaveTextContent('Events');
  });
  it('empty + offline', async () => {
    renderWithProviders(<ProgramPicker api={{
      metadataList: vi.fn().mockResolvedValue({ programs: [] }),
      health: vi.fn().mockResolvedValue(h(false)),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('programs-empty')).toBeInTheDocument());
    expect(screen.getByTestId('programs-offline')).toBeInTheDocument();
  });
  it('error path (string reject)', async () => {
    renderWithProviders(<ProgramPicker api={{
      metadataList: vi.fn().mockRejectedValue('x'),
      health: vi.fn().mockResolvedValue(h()),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('programs-error')).toBeInTheDocument());
  });
  it('falls back to items[]', async () => {
    renderWithProviders(<ProgramPicker api={{
      metadataList: vi.fn().mockResolvedValue({ items: [{ id: 'x', displayName: 'X' }] }),
      health: vi.fn().mockResolvedValue(h()),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('program-x')).toBeInTheDocument());
  });
});

describe('EventList DC-10/12', () => {
  it('loads events (legacy shape)', async () => {
    const api = {
      listEvents: vi.fn().mockResolvedValue({ events: [{
        event: 'E12345678', program: 'p', programStage: 'ps', orgUnit: 'ou',
        occurredAt: '2026-10-22T10:00:00Z', status: 'ACTIVE',
      }], total: 1 }),
      listTrackerEvents: vi.fn(),
      health: vi.fn().mockResolvedValue(h()),
    };
    renderWithProviders(<EventList api={api as never} />, { route: '/programs/P1/events' });
    await userEvent.type(await screen.findByTestId('events-orgunit'), 'OU');
    await userEvent.click(screen.getByTestId('events-load'));
    await waitFor(() => expect(screen.getByTestId('event-E12345678')).toBeInTheDocument());
  });
  it('tracker shape', async () => {
    const api = {
      listEvents: vi.fn(),
      listTrackerEvents: vi.fn().mockResolvedValue({ instances: [], total: 0 }),
      health: vi.fn().mockResolvedValue(h()),
    };
    renderWithProviders(<EventList api={api as never} trackerShape />,
      { route: '/programs/P1/events' });
    await userEvent.type(await screen.findByTestId('events-orgunit'), 'OU');
    await userEvent.click(screen.getByTestId('events-load'));
    await waitFor(() => expect(screen.getByTestId('events-empty')).toBeInTheDocument());
  });
  it('error', async () => {
    const api = {
      listEvents: vi.fn().mockRejectedValue(new Error('x')),
      listTrackerEvents: vi.fn(),
      health: vi.fn().mockResolvedValue(h(false)),
    };
    renderWithProviders(<EventList api={api as never} />, { route: '/programs/P1/events' });
    await userEvent.type(await screen.findByTestId('events-orgunit'), 'OU');
    await userEvent.click(screen.getByTestId('events-load'));
    await waitFor(() => expect(screen.getByTestId('events-error')).toBeInTheDocument());
    expect(screen.getByTestId('events-offline')).toBeInTheDocument();
  });
});

describe('EventNew DC-09/14', () => {
  it('submits and shows pill', async () => {
    const submit = vi.fn().mockResolvedValue({});
    renderWithProviders(<EventNew submit={submit}
      api={{ health: vi.fn().mockResolvedValue(h()), listEvents: vi.fn() } as never} />,
      { route: '/programs/P/events/new' });
    await userEvent.type(screen.getByTestId("event-new-orgunit"), 'OU');
    await userEvent.type(screen.getByTestId("event-new-stage"), 'PS');
    await userEvent.click(screen.getByTestId('event-new-submit'));
    await waitFor(() => expect(screen.getByTestId('event-new-saved')).toBeInTheDocument());
  });
  it('error path', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('bad'));
    renderWithProviders(<EventNew submit={submit}
      api={{ health: vi.fn().mockResolvedValue(h()), listEvents: vi.fn() } as never} />,
      { route: '/programs/P/events/new' });
    await userEvent.type(screen.getByTestId("event-new-orgunit"), 'OU');
    await userEvent.type(screen.getByTestId("event-new-stage"), 'PS');
    await userEvent.click(screen.getByTestId('event-new-submit'));
    await waitFor(() => expect(screen.getByTestId('event-new-error')).toBeInTheDocument());
  });
  it('submits with data element populated and non-Error reject', async () => {
    const submit = vi.fn().mockRejectedValue('nope');
    renderWithProviders(<EventNew submit={submit}
      api={{ health: vi.fn().mockResolvedValue(h()), listEvents: vi.fn() } as never} />,
      { route: '/programs/P/events/new' });
    await userEvent.type(screen.getByTestId("event-new-orgunit"), 'OU');
    await userEvent.type(screen.getByTestId("event-new-stage"), 'PS');
    await userEvent.type(screen.getByTestId("event-new-de"), 'DE');
    await userEvent.type(screen.getByTestId("event-new-value"), '1');
    await userEvent.click(screen.getByTestId('event-new-submit'));
    await waitFor(() => expect(screen.getByTestId('event-new-error')).toBeInTheDocument());
  });
});

describe('TrackerSearch DC-11', () => {
  it('search returns rows', async () => {
    const search = vi.fn().mockResolvedValue([{ tei: 'T1', display: 'Alice' }]);
    renderWithProviders(<TrackerSearch search={search} />,
      { route: '/tracker/P/search' });
    await userEvent.type(screen.getByTestId("tracker-search-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('tracker-search-submit'));
    await waitFor(() => expect(screen.getByTestId('tracker-tei-T1')).toBeInTheDocument());
  });
  it('empty state', async () => {
    renderWithProviders(<TrackerSearch search={vi.fn().mockResolvedValue([])} />,
      { route: '/tracker/P/search' });
    await userEvent.type(screen.getByTestId("tracker-search-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('tracker-search-submit'));
    await waitFor(() => expect(screen.getByTestId('tracker-search-empty')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<TrackerSearch search={vi.fn().mockRejectedValue('fail')} />,
      { route: '/tracker/P/search' });
    await userEvent.type(screen.getByTestId("tracker-search-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('tracker-search-submit'));
    await waitFor(() => expect(screen.getByTestId('tracker-search-error')).toBeInTheDocument());
  });
  it('default search returns empty', async () => {
    renderWithProviders(<TrackerSearch />, { route: '/tracker/P/search' });
    await userEvent.type(screen.getByTestId("tracker-search-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('tracker-search-submit'));
    await waitFor(() => expect(screen.getByTestId('tracker-search-empty')).toBeInTheDocument());
  });
});

describe('TrackerDashboard DC-12', () => {
  it('renders TEI id from route', () => {
    renderWithProviders(
      <Routes><Route path="/tracker/:program/tei/:tei" element={<TrackerDashboard />} /></Routes>,
      { route: '/tracker/P1/tei/T42' });
    expect(screen.getByTestId('tracker-dashboard-tei')).toHaveTextContent('T42');
  });
});

describe('EnrollmentCreate DC-13', () => {
  it('submits enrolment', async () => {
    const submit = vi.fn().mockResolvedValue({});
    renderWithProviders(<EnrollmentCreate submit={submit} />,
      { route: '/tracker/P/enroll' });
    await userEvent.type(screen.getByTestId("enroll-tet"), 'TET');
    await userEvent.type(screen.getByTestId("enroll-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('enroll-submit'));
    await waitFor(() => expect(screen.getByTestId('enroll-pill')).toBeInTheDocument());
  });
  it('error path', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('x'));
    renderWithProviders(<EnrollmentCreate submit={submit} />,
      { route: '/tracker/P/enroll' });
    await userEvent.type(screen.getByTestId("enroll-tet"), 'TET');
    await userEvent.type(screen.getByTestId("enroll-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('enroll-submit'));
    await waitFor(() => expect(screen.getByTestId('enroll-error')).toBeInTheDocument());
  });
  it('default submit (no injection) rejects via fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as never;
    renderWithProviders(<EnrollmentCreate />, { route: '/tracker/P/enroll' });
    await userEvent.type(screen.getByTestId("enroll-tet"), 'TET');
    await userEvent.type(screen.getByTestId("enroll-orgunit"), 'OU');
    await userEvent.click(screen.getByTestId('enroll-submit'));
    await waitFor(() => expect(screen.getByTestId('enroll-error')).toBeInTheDocument());
  });
});

describe('ScheduledEvents DC-15', () => {
  it('rows', async () => {
    renderWithProviders(<ScheduledEvents load={() => Promise.resolve([
      { event: 'E1234567', program: 'P', programStage: 'PS', orgUnit: 'OU',
        dueAt: '2026-10-23', status: 'SCHEDULE' },
    ])} />);
    await waitFor(() => expect(screen.getByTestId('scheduled-event-E1234567')).toBeInTheDocument());
  });
  it('empty', async () => {
    renderWithProviders(<ScheduledEvents load={() => Promise.resolve([])} />);
    await waitFor(() => expect(screen.getByTestId('scheduled-empty')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<ScheduledEvents load={() => Promise.reject(new Error('bad'))} />);
    await waitFor(() => expect(screen.getByTestId('scheduled-error')).toBeInTheDocument());
  });
  it('default empty', async () => {
    renderWithProviders(<ScheduledEvents />);
    await waitFor(() => expect(screen.getByTestId('scheduled-empty')).toBeInTheDocument());
  });
  it('non-Error reject', async () => {
    renderWithProviders(<ScheduledEvents load={() => Promise.reject('x')} />);
    await waitFor(() => expect(screen.getByTestId('scheduled-error')).toBeInTheDocument());
  });
});

describe('SubmittedReview DC-16', () => {
  it('filters and displays rows', async () => {
    const api = {
      recentActivity: vi.fn().mockResolvedValue({ entries: [
        { auditId: 1, eventType: 'EVENT_WRITE_SUCCESS', outcome: 'SUCCESS',
          observedAt: '2026-10-22' },
        { auditId: 2, eventType: 'AGGREGATE_WRITE_REJECTED', outcome: 'DENIED',
          observedAt: '2026-10-22' },
        { auditId: 3, eventType: 'SIGN_IN_SUCCESS', outcome: 'SUCCESS',
          observedAt: '2026-10-22' },
      ] }),
      health: vi.fn().mockResolvedValue(h()),
    };
    renderWithProviders(<SubmittedReview api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('review-heading')).toBeInTheDocument());
    expect(screen.getByTestId('review-row-type-1')).toBeInTheDocument();
    expect(screen.getByTestId('review-row-type-2')).toBeInTheDocument();
    expect(screen.queryByTestId('review-row-type-3')).toBeNull();
  });
  it('empty', async () => {
    renderWithProviders(<SubmittedReview api={{
      recentActivity: vi.fn().mockResolvedValue({ entries: [] }),
      health: vi.fn().mockResolvedValue(h(false)),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('review-empty')).toBeInTheDocument());
    expect(screen.getByTestId('review-offline')).toBeInTheDocument();
  });
  it('error', async () => {
    renderWithProviders(<SubmittedReview api={{
      recentActivity: vi.fn().mockRejectedValue(new Error('x')),
      health: vi.fn().mockResolvedValue(h()),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('review-error')).toBeInTheDocument());
  });
});

describe('Drafts DC-17', () => {
  it('lists and deletes', async () => {
    const api = {
      listDrafts: vi.fn()
        .mockResolvedValueOnce({ drafts: [{ draftId: 'd1', kind: 'EVENT', title: 'draft',
          payload: {}, updatedAt: '2026-10-22' }] })
        .mockResolvedValueOnce({ drafts: [] }),
      deleteDraft: vi.fn().mockResolvedValue(undefined),
    };
    renderWithProviders(<Drafts api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('draft-title-d1')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('draft-delete-d1'));
    await waitFor(() => expect(screen.getByTestId('drafts-empty')).toBeInTheDocument());
  });
  it('error on list', async () => {
    renderWithProviders(<Drafts api={{
      listDrafts: vi.fn().mockRejectedValue(new Error('bad')),
      deleteDraft: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('drafts-error')).toBeInTheDocument());
  });
  it('error on delete', async () => {
    const api = {
      listDrafts: vi.fn().mockResolvedValue({ drafts: [{ draftId: 'd1', kind: 'E',
        title: 't', payload: {}, updatedAt: 'now' }] }),
      deleteDraft: vi.fn().mockRejectedValue('x'),
    };
    renderWithProviders(<Drafts api={api as never} />);
    await userEvent.click(await screen.findByTestId('draft-delete-d1'));
    await waitFor(() => expect(screen.getByTestId('drafts-error')).toBeInTheDocument());
  });
  it('empty default', async () => {
    renderWithProviders(<Drafts api={{
      listDrafts: vi.fn().mockResolvedValue({ drafts: [] }),
      deleteDraft: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('drafts-empty')).toBeInTheDocument());
  });
});

describe('EventNew — default submit implementation', () => {
  it('uses global fetch when no submit prop is given — success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'OK' }) });
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      renderWithProviders(<EventNew api={{
        health: vi.fn().mockResolvedValue(h()),
        listEvents: vi.fn(),
      } as never} />, { route: '/programs/P/events/new' });
      await userEvent.type(screen.getByTestId("event-new-orgunit"), 'OU');
      await userEvent.type(screen.getByTestId("event-new-stage"), 'PS');
      await userEvent.click(screen.getByTestId('event-new-submit'));
      await waitFor(() => expect(screen.getByTestId('event-new-saved')).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith('/api/events', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }));
    } finally {
      globalThis.fetch = original;
    }
  });

  it('rejects when the default fetch returns non-OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      renderWithProviders(<EventNew api={{
        health: vi.fn().mockResolvedValue(h()),
        listEvents: vi.fn(),
      } as never} />, { route: '/programs/P/events/new' });
      await userEvent.type(screen.getByTestId("event-new-orgunit"), 'OU');
      await userEvent.type(screen.getByTestId("event-new-stage"), 'PS');
      await userEvent.click(screen.getByTestId('event-new-submit'));
      await waitFor(() => expect(screen.getByTestId('event-new-error')).toBeInTheDocument());
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('EventList — empty response falls back', () => {
  it('neither events nor instances returns empty after Load', async () => {
    renderWithProviders(<EventList api={{
      health: vi.fn().mockResolvedValue(h()),
      listEvents: vi.fn().mockResolvedValue({ total: 0 } as never),
      listTrackerEvents: vi.fn(),
    } as never} />, { route: '/programs/P/events' });
    await userEvent.type(screen.getByTestId('events-orgunit'), 'OU');
    await userEvent.click(screen.getByTestId('events-load'));
    await waitFor(() => expect(screen.getByTestId('events-empty')).toBeInTheDocument());
  });
});

describe('Drafts — alternate error-type branches', () => {
  it('listDrafts rejecting a non-Error renders the stringified error', async () => {
    const api = {
      listDrafts: vi.fn().mockRejectedValue('plain-string-reject'),
      deleteDraft: vi.fn(),
    };
    renderWithProviders(<Drafts api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('drafts-error')).toBeInTheDocument());
  });
  it('deleteDraft rejecting an Error renders Error.message', async () => {
    const api = {
      listDrafts: vi.fn().mockResolvedValue({ drafts: [{ draftId: 'd1', kind: 'E',
        title: 't', payload: {}, updatedAt: 'now' }] }),
      deleteDraft: vi.fn().mockRejectedValue(new Error('cant delete')),
    };
    renderWithProviders(<Drafts api={api as never} />);
    await userEvent.click(await screen.findByTestId('draft-delete-d1'));
    await waitFor(() => expect(screen.getByText('cant delete')).toBeInTheDocument());
  });
});
