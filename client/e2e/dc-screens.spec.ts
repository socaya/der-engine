/**
 * Per-screen Playwright specs for DC-01..DC-18 (1.0.0 gap G5).
 *
 * Each spec stubs the fetch calls the screen fires via `page.route()`,
 * navigates to the screen's route, and asserts the primary data-test
 * heading renders. These are structural smoke tests — they prove the
 * screen boots end-to-end against a built bundle, which the unit tests
 * cannot do (jsdom skips a lot of real DOM / Vite preview behaviour).
 */
import { test, expect } from '@playwright/test';
import {
  mock, mockDataSets, mockEvents, mockPrograms, stubBaseline,
} from './_fixtures';

test.beforeEach(async ({ page }) => {
  await stubBaseline(page);
});

test.describe('DC family', () => {
  test('DC-01 SignIn renders', async ({ page }) => {
    // Override session to 401 so AuthContext stays ANONYMOUS and / redirects to /sign-in.
    await page.route('**/edge-api/v1/auth/session', (r) => r.fulfill({
      status: 401, contentType: 'application/json', body: '{}',
    }));
    await page.goto('/sign-in');
    await expect(page.getByTestId('signin-heading')).toBeVisible();
  });

  test('DC-02 Launcher renders', async ({ page }) => {
    await page.goto('/launcher');
    await expect(page.getByTestId('launcher-heading')).toBeVisible();
  });

  test('DC-03 RecentWork renders', async ({ page }) => {
    await page.goto('/recent');
    await expect(page.getByTestId('recent-heading')).toBeVisible();
  });

  test('DC-04 SessionDetails renders', async ({ page }) => {
    await page.goto('/session');
    await expect(page.getByTestId('session-heading')).toBeVisible();
  });

  test('DC-05 EdgeConnectionError renders', async ({ page }) => {
    // Force EDGE_UNREACHABLE so AuthContext hits the EDGE_DOWN branch
    // and RequireAuth redirects to /edge-error.
    await page.route('**/edge-api/v1/auth/session', (r) => r.abort());
    await page.goto('/edge-error');
    await expect(page.getByTestId('edge-error-card')).toBeVisible();
  });

  test('DC-06 AggregateDatasetPicker renders', async ({ page }) => {
    await mock(page, '**/api/dataSets**', mockDataSets);
    await page.goto('/aggregate/datasets');
    await expect(page.getByTestId('aggregate-datasets-heading')).toBeVisible();
  });

  test('DC-07 AggregateEntry renders', async ({ page }) => {
    await mock(page, '**/api/dataValueSets**', { dataValues: [] });
    await mock(page, '**/api/dataSets**', mockDataSets);
    await page.goto('/aggregate/entry?orgUnit=ou1&period=202604');
    await expect(page.getByTestId('aggregate-entry-heading')).toBeVisible();
  });

  test('DC-08 ProgramPicker renders', async ({ page }) => {
    await mock(page, '**/api/programs**', mockPrograms);
    await page.goto('/programs');
    await expect(page.getByTestId('programs-heading')).toBeVisible();
  });

  test('DC-09 EventNew renders', async ({ page }) => {
    await page.goto('/programs/p1/events/new');
    await expect(page.getByTestId('event-new-heading')).toBeVisible();
  });

  test('DC-10 EventList renders', async ({ page }) => {
    await mock(page, '**/api/events**', mockEvents);
    await page.goto('/programs/p1/events');
    await expect(page.getByTestId('events-heading')).toBeVisible();
  });

  test('DC-11 TrackerSearch renders', async ({ page }) => {
    await page.goto('/tracker/p1/search');
    await expect(page.getByTestId('tracker-search-heading')).toBeVisible();
  });

  test('DC-12 TrackerDashboard renders', async ({ page }) => {
    await mock(page, '**/api/tracker**', { instances: [], total: 0 });
    await page.goto('/tracker/p1/tei/tei123');
    await expect(page.getByTestId('tracker-dashboard-heading')).toBeVisible();
  });

  test('DC-13 EnrollmentCreate renders', async ({ page }) => {
    await page.goto('/tracker/p1/enroll');
    await expect(page.getByTestId('enroll-heading')).toBeVisible();
  });

  test('DC-14 Tracker-stage EventNew renders', async ({ page }) => {
    await page.goto('/tracker/p1/stage/ps1/new');
    await expect(page.getByTestId('event-new-heading')).toBeVisible();
  });

  test('DC-15 ScheduledEvents renders', async ({ page }) => {
    await page.goto('/scheduled');
    await expect(page.getByTestId('scheduled-heading')).toBeVisible();
  });

  test('DC-16 SubmittedReview renders', async ({ page }) => {
    await mock(page, '**/edge-api/v1/activity/recent**', { entries: [] });
    await page.goto('/review');
    await expect(page.getByTestId('review-heading')).toBeVisible();
  });

  test('DC-17 Drafts renders', async ({ page }) => {
    await mock(page, '**/edge-api/v1/drafts', { drafts: [] });
    await page.goto('/drafts');
    await expect(page.getByTestId('drafts-heading')).toBeVisible();
  });

  test('DC-18 MetadataBrowser (organisation units) renders', async ({ page }) => {
    await mock(page, '**/api/organisationUnits**', {
      pager: { page: 1, pageSize: 25, total: 0, pageCount: 0 },
      organisationUnits: [],
    });
    await page.goto('/metadata/organisation-units');
    await expect(page.getByTestId('browser-organisationUnits-heading')).toBeVisible();
  });
});
