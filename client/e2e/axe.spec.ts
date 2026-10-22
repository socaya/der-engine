/**
 * Accessibility sweep — Playwright + axe-core across every DC route.
 * ADR-0017 / Initiative 9 cleanup. Covers WCAG 2 A/AA.
 */
import { test } from '@playwright/test';
import {
  assertNoAxeViolations, mock, mockDataSets, mockEvents, mockPrograms, stubBaseline,
} from './_fixtures';

test.beforeEach(async ({ page }) => {
  await stubBaseline(page);
});

test('/launcher is accessible', async ({ page }) => {
  await page.goto('/launcher');
  await assertNoAxeViolations(page);
});

test('/sign-in is accessible', async ({ page }) => {
  await page.route('**/edge-api/v1/auth/session', (r) => r.fulfill({
    status: 401, contentType: 'application/json', body: '{}',
  }));
  await page.goto('/sign-in');
  await assertNoAxeViolations(page);
});

test('/aggregate/datasets is accessible', async ({ page }) => {
  await mock(page, '**/api/dataSets**', mockDataSets);
  await page.goto('/aggregate/datasets');
  await assertNoAxeViolations(page);
});

test('/programs is accessible', async ({ page }) => {
  await mock(page, '**/api/programs**', mockPrograms);
  await page.goto('/programs');
  await assertNoAxeViolations(page);
});

test('/programs/:program/events is accessible', async ({ page }) => {
  await mock(page, '**/api/events**', mockEvents);
  await page.goto('/programs/p1/events');
  await assertNoAxeViolations(page);
});

test('/drafts is accessible', async ({ page }) => {
  await mock(page, '**/edge-api/v1/drafts', { drafts: [] });
  await page.goto('/drafts');
  await assertNoAxeViolations(page);
});

test('/edge-error is accessible', async ({ page }) => {
  await page.route('**/edge-api/v1/auth/session', (r) => r.abort());
  await page.goto('/edge-error');
  await assertNoAxeViolations(page);
});
