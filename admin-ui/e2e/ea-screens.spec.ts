/**
 * Per-screen Playwright specs for the EA admin console (1.0.0 gap G5).
 *
 * Covers each shipped EA* component. The Phase 06 Release 2/3 implementation
 * grouped some EA-* screens into neighbours (e.g. EA-09/12/13/15/16/17 are
 * sub-states of their siblings), so this suite tests the 19 shipped
 * components, one spec per primary heading. That's the mapping from the
 * screen register to the real codebase.
 */
import { test, expect } from '@playwright/test';
import { mock, stubBaseline } from './_fixtures';

test.beforeEach(async ({ page }) => {
  await stubBaseline(page);
});

test.describe('EA family', () => {
  test('EA-01 SetupWelcome at /', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('ea01-heading')).toBeVisible();
  });

  test('EA-02 UsersList at /provisioning/users', async ({ page }) => {
    await mock(page, '**/edge-api/v1/provisioning/users', { users: [] });
    await page.goto('/provisioning/users');
    await expect(page.getByTestId('ea02-heading')).toBeVisible();
  });

  test('EA-03 UserCreate at /provisioning/users/new', async ({ page }) => {
    await page.goto('/provisioning/users/new');
    await expect(page.getByTestId('ea03-heading')).toBeVisible();
  });

  test('EA-04 CompatInspector at /compat', async ({ page }) => {
    await page.goto('/compat');
    await expect(page.getByTestId('ea04-heading')).toBeVisible();
  });

  test('EA-05 CompatHistory at /compat/history', async ({ page }) => {
    await mock(page, '**/edge-api/v1/compat/history**', { snapshots: [] });
    await page.goto('/compat/history');
    await expect(page.getByTestId('ea05-heading')).toBeVisible();
  });

  test('EA-06 JobsList at /sync/jobs', async ({ page }) => {
    await mock(page, '**/edge-api/v1/sync/jobs**', []);
    await page.goto('/sync/jobs');
    await expect(page.getByTestId('ea06-heading')).toBeVisible();
  });

  test('EA-07 JobTrigger at /sync/jobs/trigger', async ({ page }) => {
    await page.goto('/sync/jobs/trigger');
    await expect(page.getByTestId('ea07-heading')).toBeVisible();
  });

  test('EA-08 DriftInspector at /sync/drift', async ({ page }) => {
    await mock(page, '**/edge-api/v1/sync/drift**', { status: 'OK' });
    await page.goto('/sync/drift');
    await expect(page.getByTestId('ea08-heading')).toBeVisible();
  });

  test('EA-10 ConflictList at /journal/conflicts', async ({ page }) => {
    await mock(page, '**/edge-api/v1/journal/conflicts**', []);
    await page.goto('/journal/conflicts');
    await expect(page.getByTestId('ea10-heading')).toBeVisible();
  });

  test('EA-11 ConflictResolve at /conflicts/:id', async ({ page }) => {
    await page.goto('/conflicts/op-xyz');
    await expect(page.getByTestId('ea11-heading')).toBeVisible();
  });

  test('EA-14 WorkerHealth at /journal/worker', async ({ page }) => {
    await mock(page, '**/edge-api/v1/journal/worker', {
      enabled: true, lastTick: null, lastBatchSize: 0, backlog: {},
    });
    await page.goto('/journal/worker');
    await expect(page.getByTestId('ea14-heading')).toBeVisible();
  });

  test('EA-APR-01 ApprovalQueue at /approvals', async ({ page }) => {
    await mock(page, '**/edge-api/v1/approvals/pending**', { rows: [] });
    await page.goto('/approvals');
    await expect(page.getByTestId('apr-heading')).toBeVisible();
  });

  test('EA-CWF-01 CaptureWorkflowList at /workflows', async ({ page }) => {
    await mock(page, '**/edge-api/v1/workflows', { workflows: [] });
    await page.goto('/workflows');
    await expect(page.getByTestId('cwf01-heading')).toBeVisible();
  });

  test('EA-CWF-02 CaptureWorkflowDesigner at /workflows/new', async ({ page }) => {
    await page.goto('/workflows/new');
    await expect(page.getByTestId('cwf02-heading')).toBeVisible();
  });

  test('EA-DVC-01 DeviceFleet at /devices', async ({ page }) => {
    await mock(page, '**/edge-api/v1/devices', { devices: [] });
    await page.goto('/devices');
    await expect(page.getByTestId('dvc01-heading')).toBeVisible();
  });

  test('EA-ANA-01 FacilityAnalytics at /analytics', async ({ page }) => {
    await mock(page, '**/edge-api/v1/analytics/summary**', {
      rows: [], lastRefreshedAt: null,
    });
    await mock(page, '**/edge-api/v1/analytics/rejections**', { count: 0 });
    await page.goto('/analytics');
    await expect(page.getByTestId('ana01-heading')).toBeVisible();
  });

  test('EA-AUD-01 AuditVerify at /audit/verify', async ({ page }) => {
    await mock(page, '**/edge-api/v1/security/audit/verify', {
      ok: true, totalRows: 0, firstBreakAuditId: null, firstBreakReason: null,
    });
    await page.goto('/audit/verify');
    await expect(page.getByTestId('aud01-heading')).toBeVisible();
  });

  test('EA-18 MetadataOverview at /metadata', async ({ page }) => {
    await mock(page, '**/api/**', { items: [] });
    await page.goto('/metadata');
    await expect(page.getByTestId('ea18-heading')).toBeVisible();
  });

  test('EA-19 RecoveryTools at /recovery', async ({ page }) => {
    await page.goto('/recovery');
    await expect(page.getByTestId('ea19-heading')).toBeVisible();
  });

  test('EA-23 BackupList at /backup', async ({ page }) => {
    await mock(page, '**/edge-api/v1/backup/runs', []);
    await page.goto('/backup');
    await expect(page.getByTestId('ea23-heading')).toBeVisible();
  });

  test('EA-25 RestoreList at /restore', async ({ page }) => {
    await mock(page, '**/edge-api/v1/restore/runs', []);
    await page.goto('/restore');
    await expect(page.getByTestId('ea25-heading')).toBeVisible();
  });

  test('EA-27 EvaluationReports at /evaluation', async ({ page }) => {
    await mock(page, '**/edge-api/v1/sync/jobs**', []);
    await mock(page, '**/edge-api/v1/sync/drift**', { status: 'OK' });
    await page.goto('/evaluation');
    await expect(page.getByTestId('ea27-heading')).toBeVisible();
  });

  test('EA-31 AppsList at /apps', async ({ page }) => {
    await mock(page, '**/edge-api/v1/apps', []);
    await page.goto('/apps');
    await expect(page.getByTestId('ea31-heading')).toBeVisible();
  });

  test('EA-35 Diagnostics at /diagnostics', async ({ page }) => {
    await mock(page, '**/edge-api/v1/admin/diagnostics', {
      memoryMb: 1, uptimeSeconds: 0, schedulerBacklog: 0, journalBacklog: {},
    });
    await page.goto('/diagnostics');
    await expect(page.getByTestId('ea35-heading')).toBeVisible();
  });

  test('EA-36 Settings at /settings', async ({ page }) => {
    await mock(page, '**/edge-api/v1/admin/settings', {
      cron: {}, featureFlags: {}, roles: [],
    });
    await page.goto('/settings');
    await expect(page.getByTestId('ea36-heading')).toBeVisible();
  });
});
