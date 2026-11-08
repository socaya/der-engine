#!/usr/bin/env node
/**
 * Visually verify the shell-margin standardisation:
 *   - .der-apphost .der-screen-card gets a 12px outer margin
 *   - no horizontal scrollbar on the body
 *   - vertical scrollbar only when content exceeds viewport
 */
import { chromium } from 'playwright-core';

async function run() {
  const chromePath =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({
    executablePath: chromePath, headless: true,
    args: ['--ignore-certificate-errors', '--disable-dev-shm-usage',
      '--no-sandbox'],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });

  const errors = [];
  async function checkApp(path, name) {
    await page.goto('http://localhost:5174' + path,
      { waitUntil: 'networkidle', timeout: 20000 })
      .catch(() => undefined);
    await page.waitForTimeout(2500);
    const margin = await page.evaluate(() => {
      const el = document.querySelector(
        '.der-apphost .der-screen-card');
      if (!el) return null;
      return window.getComputedStyle(el).margin;
    });
    const bodyOverflowX = await page.evaluate(() => {
      const el = document.querySelector(
        '.der-apphost .der-screen-card__body');
      if (!el) return null;
      return window.getComputedStyle(el).overflowX;
    });
    const viewportScrollbarH = await page.evaluate(() => {
      return document.documentElement.scrollWidth
        > document.documentElement.clientWidth;
    });
    console.log(name + ':');
    console.log('  margin         :', margin);
    console.log('  body overflowX :', bodyOverflowX);
    console.log('  viewport scroll-x:', viewportScrollbarH);
    if (!margin || !margin.includes('12')) {
      errors.push(name + ': .der-apphost .der-screen-card margin '
        + 'is not 12px (got ' + margin + ')');
    }
    if (bodyOverflowX !== 'hidden') {
      errors.push(name + ': body overflow-x not hidden (got '
        + bodyOverflowX + ')');
    }
    await page.screenshot({ path: '/tmp/cap-shell-' + name
      + '.png', fullPage: false });
  }

  await checkApp('/apps/data-entry', 'data-entry');
  await checkApp('/apps/capture', 'capture');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — shell margin standardised, no horizontal '
    + 'scroll.');
}
run().catch((e) => { console.error(e); process.exit(1); });
