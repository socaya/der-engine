import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* i18n module keeps module-level `current` state that depends on
 * localStorage + navigator.language at import time. Each test resets
 * modules so the detect() path runs with fresh inputs. */

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => { window.localStorage.clear(); });

  it('t() returns the key itself when no bundle has it', async () => {
    const { t } = await import('./index');
    expect(t('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
  });

  it('interpolates {param} placeholders', async () => {
    const { t } = await import('./index');
    /* Key is unknown → falls back to the key string, which has no
     * placeholders — so just verify interpolation doesn't crash
     * when no placeholder present. */
    expect(t('x {foo}', { foo: 'bar' })).toBe('x bar');
  });

  it('getLocale defaults to "en" when storage + navigator empty', async () => {
    Object.defineProperty(window, 'navigator', {
      configurable: true, writable: true,
      value: { language: '' },
    });
    const { getLocale } = await import('./index');
    expect(getLocale()).toBe('en');
  });

  it('getLocale reads locale from localStorage when present', async () => {
    window.localStorage.setItem('der.admin.locale', 'fr');
    const { getLocale } = await import('./index');
    expect(getLocale()).toBe('fr');
  });

  it('getLocale detects locale from navigator.language', async () => {
    Object.defineProperty(window, 'navigator', {
      configurable: true, writable: true,
      value: { language: 'pt-BR' },
    });
    const { getLocale } = await import('./index');
    expect(getLocale()).toBe('pt');
  });

  it('unknown navigator.language → falls back to "en"', async () => {
    Object.defineProperty(window, 'navigator', {
      configurable: true, writable: true,
      value: { language: 'xx-YY' },
    });
    const { getLocale } = await import('./index');
    expect(getLocale()).toBe('en');
  });

  it('setLocale persists + updates the current value', async () => {
    const { setLocale, getLocale } = await import('./index');
    setLocale('fr');
    expect(getLocale()).toBe('fr');
    expect(window.localStorage.getItem('der.admin.locale')).toBe('fr');
  });

  it('SUPPORTED exposes the known locales', async () => {
    const { SUPPORTED } = await import('./index');
    expect(SUPPORTED).toEqual(['en', 'fr', 'pt']);
  });

  it('invalid stored locale is ignored', async () => {
    window.localStorage.setItem('der.admin.locale', 'bogus');
    Object.defineProperty(window, 'navigator', {
      configurable: true, writable: true,
      value: { language: '' },
    });
    const { getLocale } = await import('./index');
    expect(getLocale()).toBe('en');
  });
});
