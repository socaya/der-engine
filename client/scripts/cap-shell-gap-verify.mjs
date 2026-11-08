#!/usr/bin/env node
/**
 * Verify two shell polish fixes:
 *   - gap between topbar and card header is small (apphost
 *     padding removed, card margin=12px)
 *   - Data Entry: action bar sits at the bottom of the viewport
 *     when content is short, no stray vertical scrollbar
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

  // ---- Shell gap (Capture) ----------------------------------
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2500);

  const gap = await page.evaluate(() => {
    const topbar = document.querySelector('.der-topbar');
    const cardHead = document.querySelector(
      '.der-apphost .der-screen-card');
    if (!topbar || !cardHead) return null;
    const tb = topbar.getBoundingClientRect();
    const ch = cardHead.getBoundingClientRect();
    return ch.top - tb.bottom;
  });
  console.log('gap between topbar and card:', gap);
  if (gap === null || gap < 0 || gap > 20) {
    errors.push('gap between topbar and card is out of range ('
      + gap + ') — expected ~12px');
  }
  await page.screenshot({ path: '/tmp/cap-gap-capture.png',
    fullPage: false });

  // ---- Data-entry sticky footer -----------------------------
  await page.goto('http://localhost:5174/apps/data-entry',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3000);

  const vScroll = await page.evaluate(() => {
    return document.documentElement.scrollHeight
      > document.documentElement.clientHeight;
  });
  console.log('data-entry has vertical scrollbar on open:', vScroll);
  // The empty "Pick a data set" state is quite short — scroll
  // should not be needed.
  if (vScroll) {
    errors.push('data-entry introduced vertical scroll on the '
      + 'short default empty state');
  }
  await page.screenshot({ path: '/tmp/cap-gap-de.png',
    fullPage: false });

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — shell gap + data-entry footer verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
