/**
 * Accessibility sweep — Playwright + axe-core across the shipped EA
 * admin screens. Initiative 9 cleanup. Covers WCAG 2 A/AA.
 */
import { test } from '@playwright/test';
import { assertNoAxeViolations, mock, stubBaseline } from './_fixtures';

test.beforeEach(async ({ page }) => {
  await stubBaseline(page);
});

test('/ (EA-01 setup) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/system/org-unit', {
    bound: true, orgUnitId: 'ou-1', orgUnitDisplayName: 'Clinic',
    orgUnitPath: '/root/ou-1', boundAt: '2026-10-22T00:00:00Z', boundBy: null,
  });
  await page.goto('/');
  await assertNoAxeViolations(page);
});

test('/provisioning/users (EA-02) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/provisioning/users', { users: [] });
  await page.goto('/provisioning/users');
  await assertNoAxeViolations(page);
});

test('/compat (EA-04) is accessible', async ({ page }) => {
  await page.goto('/compat');
  await assertNoAxeViolations(page);
});

test('/sync/jobs (EA-06) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/sync/jobs**', []);
  await page.goto('/sync/jobs');
  await assertNoAxeViolations(page);
});

test('/journal/conflicts (EA-10) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/journal/conflicts**', []);
  await page.goto('/journal/conflicts');
  await assertNoAxeViolations(page);
});

test('/journal/worker (EA-14) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/journal/worker', {
    enabled: true, lastTick: null, lastBatchSize: 0, backlog: {},
  });
  await page.goto('/journal/worker');
  await assertNoAxeViolations(page);
});

test('/approvals (EA-APR-01) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/approvals/pending**', { rows: [] });
  await page.goto('/approvals');
  await assertNoAxeViolations(page);
});

test('/backup (EA-23) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/backup/runs', []);
  await page.goto('/backup');
  await assertNoAxeViolations(page);
});

test('/settings (EA-36) is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/admin/settings', {
    cron: {}, featureFlags: {}, roles: [],
  });
  await page.goto('/settings');
  await assertNoAxeViolations(page);
});
