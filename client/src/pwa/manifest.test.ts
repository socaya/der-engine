import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal smoke test for the PWA manifest + SW. Both files live in
 * client/public/ so Vite ships them verbatim at the site root. The
 * test guards against a schema drift that would break the Chrome +
 * iOS "Add to Home screen" install prompt.
 */

const PUBLIC = resolve(__dirname, '..', '..', 'public');

describe('PWA manifest + service worker', () => {
  it('manifest.webmanifest is served at the site root', () => {
    expect(existsSync(`${PUBLIC}/manifest.webmanifest`)).toBe(true);
  });

  it('manifest declares the minimum fields Chrome + iOS require', () => {
    const raw = readFileSync(`${PUBLIC}/manifest.webmanifest`, 'utf-8');
    const m = JSON.parse(raw) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string; type: string; purpose: string }[];
    };
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(m.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(Array.isArray(m.icons) && m.icons.length).toBeGreaterThan(0);
    const icon = m.icons[0];
    expect(icon.src.startsWith('/')).toBe(true);
    expect(icon.type).toBe('image/svg+xml');
    expect(icon.purpose).toMatch(/\bany\b/);
  });

  it('icon.svg exists at the manifest-declared path', () => {
    const m = JSON.parse(
      readFileSync(`${PUBLIC}/manifest.webmanifest`, 'utf-8'));
    const iconRel = (m.icons as { src: string }[])[0].src.replace(/^\//, '');
    expect(existsSync(`${PUBLIC}/${iconRel}`)).toBe(true);
  });

  it('sw.js registers install + activate + fetch listeners', () => {
    const sw = readFileSync(`${PUBLIC}/sw.js`, 'utf-8');
    expect(sw).toMatch(/addEventListener\(['"]install['"]/);
    expect(sw).toMatch(/addEventListener\(['"]activate['"]/);
    expect(sw).toMatch(/addEventListener\(['"]fetch['"]/);
  });

  it('sw.js does not intercept /api or /edge-api — writes go through the IDB queue', () => {
    const sw = readFileSync(`${PUBLIC}/sw.js`, 'utf-8');
    // Both prefixes must be mentioned in a guard that bypasses the SW.
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/\/edge-api\//);
  });
});
