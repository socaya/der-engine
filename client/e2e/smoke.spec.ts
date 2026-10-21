import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('client Phase 00 smoke', () => {
  test('renders the client shell with brand, nav, version banner and dhis2 reference', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('heading')).toHaveText('DER Client');
    await expect(page.getByTestId('brand')).toHaveText('DER Client');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByTestId('der-version')).not.toBeEmpty();
    await expect(page.getByTestId('dhis2-reference')).toHaveText('unknown');
    await expect(page.getByText(/synchronised/i)).toHaveCount(0);
  });

  test('passes axe accessibility checks on the main page', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
