import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeApiError } from '../../api/edgeApi';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  SignInLayoutHero,
  SignInLayoutMarketing,
  SignInLayoutSidebar,
  SignInLayoutStandard,
} from './index';

const rejectSession = () => vi.fn().mockRejectedValue(
  new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no'));

function render(el: JSX.Element): void {
  renderWithProviders(
    <Routes>
      <Route path="/sign-in" element={el} />
    </Routes>,
    {
      route: '/sign-in',
      authApi: { session: rejectSession(), signIn: vi.fn(), signOut: vi.fn() },
    },
  );
}

describe('SignIn layouts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.reject(new Error('stubbed')));
  });
  afterEach(() => {
    document.documentElement.style.removeProperty('--der-signin-bg-image');
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('standard — renders heading + boxed card', async () => {
    render(<SignInLayoutStandard />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    expect(screen.getByTestId('der-signin').className).toMatch(/der-signin--standard/);
    expect(screen.getByTestId('der-signin-card').className).toContain('der-signin__card');
  });

  it('sidebar — renders brand panel + unboxed form', async () => {
    render(<SignInLayoutSidebar />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    const root = screen.getByTestId('der-signin');
    expect(root.className).toMatch(/der-signin--sidebar/);
    // Plain variant — not the boxed `__card`.
    expect(screen.getByTestId('der-signin-card').className).toContain('der-signin__form');
    // Heading uses the dark tone (since it sits on a white panel).
    expect(screen.getByTestId('der-signin-heading').className).toMatch(/der-signin-heading--dark/);
  });

  it('hero — full-bleed layout wraps a boxed card', async () => {
    render(<SignInLayoutHero />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    expect(screen.getByTestId('der-signin').className).toMatch(/der-signin--hero/);
    expect(screen.getByTestId('der-signin-card').className).toContain('der-signin__card');
  });

  it('marketing — splits panel + floating card', async () => {
    render(<SignInLayoutMarketing />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    expect(screen.getByTestId('der-signin').className).toMatch(/der-signin--marketing/);
    expect(screen.getByTestId('der-signin-card').className).toContain('der-signin__card');
  });

  it('sidebar — applies the resolved bg image to --der-signin-bg-image', async () => {
    window.localStorage.setItem('der.signin.backgroundImage', '/my-bg.jpg');
    render(<SignInLayoutSidebar />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    const v = document.documentElement.style.getPropertyValue('--der-signin-bg-image');
    expect(v).toBe('url("/my-bg.jpg")');
  });

  it('sidebar — leaves bg var untouched when no image is configured', async () => {
    document.documentElement.style.removeProperty('--der-signin-bg-image');
    render(<SignInLayoutSidebar />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    expect(document.documentElement.style.getPropertyValue('--der-signin-bg-image')).toBe('');
  });

  it('hero — applies the resolved bg image', async () => {
    window.localStorage.setItem('der.signin.backgroundImage', '/hero.jpg');
    render(<SignInLayoutHero />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    expect(document.documentElement.style.getPropertyValue('--der-signin-bg-image'))
      .toBe('url("/hero.jpg")');
  });

  it('marketing — applies the resolved bg image', async () => {
    window.localStorage.setItem('der.signin.backgroundImage', '/mkt.jpg');
    render(<SignInLayoutMarketing />);
    await waitFor(() => expect(screen.getByTestId('der-signin-heading')).toBeInTheDocument());
    expect(document.documentElement.style.getPropertyValue('--der-signin-bg-image'))
      .toBe('url("/mkt.jpg")');
  });
});

describe('SignIn delegator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.reject(new Error('stubbed')));
  });
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders sidebar by default', async () => {
    const { SignIn } = await import('../SignIn');
    render(<SignIn />);
    await waitFor(() => expect(screen.getByTestId('der-signin')).toBeInTheDocument());
    expect(screen.getByTestId('der-signin').className).toMatch(/der-signin--sidebar/);
  });

  it('switches layout when localStorage overrides it', async () => {
    window.localStorage.setItem('der.signin.layout', 'hero');
    const { SignIn } = await import('../SignIn');
    render(<SignIn />);
    await waitFor(() => expect(screen.getByTestId('der-signin')).toBeInTheDocument());
    expect(screen.getByTestId('der-signin').className).toMatch(/der-signin--hero/);
  });

  it.each(['standard', 'marketing'] as const)(
    'renders %s when localStorage pins it',
    async (kind) => {
      window.localStorage.setItem('der.signin.layout', kind);
      const { SignIn } = await import('../SignIn');
      render(<SignIn />);
      await waitFor(() => expect(screen.getByTestId('der-signin')).toBeInTheDocument());
      expect(screen.getByTestId('der-signin').className)
        .toMatch(new RegExp(`der-signin--${kind}`));
    },
  );
});
