import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveSignInBackgroundImage,
  resolveSignInLayout,
  type SignInLayoutKind,
} from './resolve';

function setMeta(name: string, content: string): void {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

function clearMetas(): void {
  for (const el of Array.from(document.head.querySelectorAll('meta'))) {
    el.remove();
  }
}

describe('resolveSignInLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearMetas();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    window.localStorage.clear();
    clearMetas();
    vi.unstubAllEnvs();
  });

  it('defaults to sidebar — matches DHIS2 look', () => {
    expect(resolveSignInLayout()).toBe('sidebar');
  });

  it('honours env override', () => {
    vi.stubEnv('VITE_DER_SIGNIN_LAYOUT', 'hero');
    expect(resolveSignInLayout()).toBe('hero');
  });

  it('ignores unknown env value', () => {
    vi.stubEnv('VITE_DER_SIGNIN_LAYOUT', 'bogus');
    expect(resolveSignInLayout()).toBe('sidebar');
  });

  it('meta tag overrides env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_LAYOUT', 'hero');
    setMeta('der-signin-layout', 'marketing');
    expect(resolveSignInLayout()).toBe('marketing');
  });

  it('ignores unknown meta value', () => {
    setMeta('der-signin-layout', 'bogus');
    expect(resolveSignInLayout()).toBe('sidebar');
  });

  it('server override beats meta + env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_LAYOUT', 'hero');
    setMeta('der-signin-layout', 'marketing');
    expect(resolveSignInLayout({ layout: 'standard', backgroundUrl: null }))
      .toBe('standard');
  });

  it('device localStorage beats server override', () => {
    window.localStorage.setItem('der.signin.layout', 'hero');
    expect(resolveSignInLayout({ layout: 'standard', backgroundUrl: null }))
      .toBe('hero');
  });

  it('ignores server override with unknown layout', () => {
    expect(resolveSignInLayout(
      { layout: 'bogus' as never, backgroundUrl: null })).toBe('sidebar');
  });

  it('ignores server override when layout is null', () => {
    setMeta('der-signin-layout', 'hero');
    expect(resolveSignInLayout({ layout: null, backgroundUrl: null }))
      .toBe('hero');
  });

  it('localStorage overrides meta + env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_LAYOUT', 'hero');
    setMeta('der-signin-layout', 'marketing');
    window.localStorage.setItem('der.signin.layout', 'standard');
    expect(resolveSignInLayout()).toBe('standard');
  });

  it('ignores unknown localStorage value', () => {
    window.localStorage.setItem('der.signin.layout', 'bogus');
    expect(resolveSignInLayout()).toBe('sidebar');
  });

  it.each<SignInLayoutKind>(['standard', 'sidebar', 'hero', 'marketing'])(
    'accepts every supported layout: %s',
    (kind) => {
      window.localStorage.setItem('der.signin.layout', kind);
      expect(resolveSignInLayout()).toBe(kind);
    },
  );

  it('survives localStorage.getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('blocked'); });
    try {
      expect(resolveSignInLayout()).toBe('sidebar');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('resolveSignInBackgroundImage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearMetas();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    window.localStorage.clear();
    clearMetas();
    vi.unstubAllEnvs();
  });

  it('returns null by default', () => {
    expect(resolveSignInBackgroundImage()).toBeNull();
  });

  it('reads from env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_BACKGROUND', '/bg.jpg');
    expect(resolveSignInBackgroundImage()).toBe('/bg.jpg');
  });

  it('meta tag overrides env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_BACKGROUND', '/env.jpg');
    setMeta('der-signin-background', '/meta.jpg');
    expect(resolveSignInBackgroundImage()).toBe('/meta.jpg');
  });

  it('localStorage overrides meta + env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_BACKGROUND', '/env.jpg');
    setMeta('der-signin-background', '/meta.jpg');
    window.localStorage.setItem('der.signin.backgroundImage', '/device.jpg');
    expect(resolveSignInBackgroundImage()).toBe('/device.jpg');
  });

  it('server backgroundUrl beats meta + env', () => {
    vi.stubEnv('VITE_DER_SIGNIN_BACKGROUND', '/env.jpg');
    setMeta('der-signin-background', '/meta.jpg');
    expect(resolveSignInBackgroundImage(
      { layout: null, backgroundUrl: '/server.jpg' })).toBe('/server.jpg');
  });

  it('device localStorage beats server', () => {
    window.localStorage.setItem('der.signin.backgroundImage', '/device.jpg');
    expect(resolveSignInBackgroundImage(
      { layout: null, backgroundUrl: '/server.jpg' })).toBe('/device.jpg');
  });

  it('empty-string localStorage override clears the image', () => {
    setMeta('der-signin-background', '/meta.jpg');
    window.localStorage.setItem('der.signin.backgroundImage', '');
    expect(resolveSignInBackgroundImage()).toBe('');
  });

  it('survives localStorage.getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('blocked'); });
    try {
      expect(resolveSignInBackgroundImage()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
