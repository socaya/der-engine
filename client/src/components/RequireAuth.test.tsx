import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { renderWithProviders } from '../test/renderWithProviders';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice', roles: ['OPERATOR'], expiresAt: 'x',
};

function Guarded(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<RequireAuth><div data-test="protected">OK</div></RequireAuth>} />
      <Route path="/sign-in" element={<div data-test="redirected-signin">sign in please</div>} />
      <Route path="/edge-error" element={<div data-test="redirected-edge-error">edge down</div>} />
    </Routes>
  );
}

describe('RequireAuth', () => {
  it('renders children when AUTHENTICATED', async () => {
    renderWithProviders(<Guarded />, {
      authApi: { session: vi.fn().mockResolvedValue(user), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('protected')).toBeInTheDocument());
  });

  it('redirects to /sign-in when ANONYMOUS', async () => {
    renderWithProviders(<Guarded />, {
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
        signIn: vi.fn(), signOut: vi.fn(),
      },
    });
    await waitFor(() => expect(screen.getByTestId('redirected-signin')).toBeInTheDocument());
  });

  it('redirects to /edge-error when EDGE_DOWN', async () => {
    renderWithProviders(<Guarded />, {
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(503, 'EDGE_UNREACHABLE', 'down')),
        signIn: vi.fn(), signOut: vi.fn(),
      },
    });
    await waitFor(() => expect(screen.getByTestId('redirected-edge-error')).toBeInTheDocument());
  });

  it('renders a loader while INITIAL', async () => {
    let resolveSession: (u: SignInResponse) => void = () => {};
    const session = vi.fn().mockImplementation(() => new Promise<SignInResponse>((r) => { resolveSession = r; }));
    renderWithProviders(<Guarded />, {
      authApi: { session, signIn: vi.fn(), signOut: vi.fn() },
    });
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    resolveSession(user);
    await waitFor(() => expect(screen.getByTestId('protected')).toBeInTheDocument());
  });
});
