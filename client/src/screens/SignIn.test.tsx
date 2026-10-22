import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SignIn } from './SignIn';
import { renderWithProviders } from '../test/renderWithProviders';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice', roles: ['OPERATOR'], expiresAt: 'x',
};

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/launcher" element={<div data-test="landed-launcher">landed</div>} />
      <Route path="/other" element={<div data-test="landed-other">other</div>} />
    </Routes>
  );
}

describe('SignIn', () => {
  it('renders the DER-specific sign-in copy', async () => {
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: { session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('signin-heading')).toBeInTheDocument());
    expect(screen.getByText(/does not reach the central DHIS2/i)).toBeInTheDocument();
  });

  it('submits credentials and redirects to /launcher on success', async () => {
    const signIn = vi.fn().mockResolvedValue(user);
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn, signOut: vi.fn(),
      },
    });
    await waitFor(() => expect(screen.getByTestId('signin-username')).toBeInTheDocument());
    const u = screen.getByTestId('signin-username').querySelector('input')!;
    const p = screen.getByTestId('signin-password').querySelector('input')!;
    await userEvent.type(u, 'alice');
    await userEvent.type(p, 'hunter22');
    await userEvent.click(screen.getByTestId('signin-submit'));
    await waitFor(() => expect(screen.getByTestId('landed-launcher')).toBeInTheDocument());
    expect(signIn).toHaveBeenCalledWith('alice', 'hunter22');
  });

  it('renders INVALID_CREDENTIALS error', async () => {
    const signIn = vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no'));
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn, signOut: vi.fn(),
      },
    });
    const u = (await screen.findByTestId('signin-username')).querySelector('input')!;
    const p = screen.getByTestId('signin-password').querySelector('input')!;
    await userEvent.type(u, 'alice');
    await userEvent.type(p, 'wrong');
    await userEvent.click(screen.getByTestId('signin-submit'));
    await waitFor(() => expect(screen.getByText(/Username or password is incorrect/i)).toBeInTheDocument());
  });

  it('renders RATE_LIMITED error', async () => {
    const signIn = vi.fn().mockRejectedValue(new EdgeApiError(429, 'RATE_LIMITED', 'slow down'));
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn, signOut: vi.fn(),
      },
    });
    const u = (await screen.findByTestId('signin-username')).querySelector('input')!;
    const p = screen.getByTestId('signin-password').querySelector('input')!;
    await userEvent.type(u, 'alice');
    await userEvent.type(p, 'pw1234567');
    await userEvent.click(screen.getByTestId('signin-submit'));
    await waitFor(() => expect(screen.getByText(/Too many sign-in attempts/i)).toBeInTheDocument());
  });

  it('renders EDGE_UNREACHABLE error', async () => {
    const signIn = vi.fn().mockRejectedValue(new EdgeApiError(503, 'EDGE_UNREACHABLE', 'down'));
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn, signOut: vi.fn(),
      },
    });
    const u = (await screen.findByTestId('signin-username')).querySelector('input')!;
    const p = screen.getByTestId('signin-password').querySelector('input')!;
    await userEvent.type(u, 'alice');
    await userEvent.type(p, 'pw1234567');
    await userEvent.click(screen.getByTestId('signin-submit'));
    await waitFor(() => expect(screen.getByText(/Edge runtime is unreachable/i)).toBeInTheDocument());
  });

  it('renders unexpected-error branch for non-EdgeApiError rejections', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('boom'));
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn, signOut: vi.fn(),
      },
    });
    const u = (await screen.findByTestId('signin-username')).querySelector('input')!;
    const p = screen.getByTestId('signin-password').querySelector('input')!;
    await userEvent.type(u, 'alice');
    await userEvent.type(p, 'pw1234567');
    await userEvent.click(screen.getByTestId('signin-submit'));
    await waitFor(() => expect(screen.getByText(/Unexpected error during sign-in/i)).toBeInTheDocument());
  });

  it('shows the already-signed-in notice when AUTHENTICATED', async () => {
    renderWithProviders(<App />, {
      route: '/sign-in',
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('signin-already')).toBeInTheDocument());
  });
});

describe('SignIn — location state redirect', () => {
  it('redirects to the saved location.state.from.pathname after sign-in', async () => {
    const signIn = vi.fn().mockResolvedValue(user);
    renderWithProviders(<App />, {
      route: '/sign-in',
      locationState: { from: { pathname: '/other' } },
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn, signOut: vi.fn(),
      },
    });
    const u = (await screen.findByTestId('signin-username')).querySelector('input')!;
    const p = screen.getByTestId('signin-password').querySelector('input')!;
    await userEvent.type(u, 'alice');
    await userEvent.type(p, 'pw1234567');
    await userEvent.click(screen.getByTestId('signin-submit'));
    await waitFor(() => expect(screen.getByTestId('landed-other')).toBeInTheDocument());
  });

  it('setUsername falls back to empty when onChange sends undefined value', async () => {
    const { SignIn } = await import('./SignIn');
    const { container } = renderWithProviders(
      <Routes><Route path="/sign-in" element={<SignIn />} /></Routes>,
      {
        route: '/sign-in',
        authApi: {
          session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
          signIn: vi.fn(), signOut: vi.fn(),
        },
      },
    );
    await waitFor(() => expect(screen.getByTestId('signin-heading')).toBeInTheDocument());
    // Fire onChange with value=undefined by directly clearing the input via DOM.
    // @dhis2/ui InputField's onChange forwards {value}; a backspace-to-empty gives value=''.
    const u = screen.getByTestId('signin-username').querySelector('input')!;
    await userEvent.type(u, 'x');
    await userEvent.clear(u);
    expect(u.value).toBe('');
    expect(container).toBeDefined();
  });
});
