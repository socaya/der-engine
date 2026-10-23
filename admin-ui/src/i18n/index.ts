/**
 * D3: minimal i18n foundation. Full d2-i18n extraction is a Phase D
 * follow-up — this layer gives screens a `t()` function and
 * selectable language so copy can be externalised incrementally.
 *
 * Falls back to the English key when a locale is missing or the
 * message id doesn't exist.
 */

import en from './bundles/en.json';
import fr from './bundles/fr.json';
import pt from './bundles/pt.json';

export type Locale = 'en' | 'fr' | 'pt';

export const SUPPORTED: readonly Locale[] = ['en', 'fr', 'pt'] as const;

const BUNDLES: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  fr: fr as Record<string, string>,
  pt: pt as Record<string, string>,
};

const KEY = 'der.admin.locale';

function detect(): Locale {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
  if (saved && (SUPPORTED as readonly string[]).includes(saved)) {
    return saved as Locale;
  }
  if (typeof navigator !== 'undefined') {
    const first = (navigator.language || '').slice(0, 2).toLowerCase();
    if ((SUPPORTED as readonly string[]).includes(first)) {
      return first as Locale;
    }
  }
  return 'en';
}

let current: Locale = detect();

export function getLocale(): Locale {
  return current;
}

export function setLocale(l: Locale): void {
  current = l;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, l);
  }
}

export function t(key: string, params?: Record<string, string | number>): string {
  const bundle = BUNDLES[current] ?? BUNDLES.en;
  const fallback = BUNDLES.en;
  let msg = bundle[key] ?? fallback[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return msg;
}
