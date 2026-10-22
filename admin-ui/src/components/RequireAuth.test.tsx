import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';
import { RequireAuth } from './RequireAuth';

function user(): SignInResponse {
  return { userId: 'u', username: 'a', displayName: 'A', roles: ['ADMIN'], expiresAt: 'x' };
}

function TestApp(): JSX.Element {
  return (
    <Routes>
      <Route path="/sign-in" element={<div data-test="landed-sign-in">sign-in</div>} />
      <Route path="/edge-error" element={<div data-test="landed-edge-error">edge-down</div>} />
      <Route path="/" element={<RequireAuth><div data-test="landed-home">home</div></RequireAuth>} />
    </Routes>
  );
}

function renderWith(apiOverrides: Parameters<typeof AuthProvider>[0]['api']): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider api={apiOverrides}>
        <TestApp />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('RequireAuth', () => {
  it('shows the loading state during INITIAL', () => {
    // Never-resolving session promise keeps state at INITIAL.
    renderWith({
      session: vi.fn().mockReturnValue(new Promise(() => undefined)),
      signIn: vi.fn(), signOut: vi.fn(),
    });
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
  });

  it('redirects to /sign-in when ANONYMOUS', async () => {
    renderWith({
      session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
      signIn: vi.fn(), signOut: vi.fn(),
    });
    await waitFor(() => expect(screen.getByTestId('landed-sign-in')).toBeInTheDocument());
  });

  it('redirects to /edge-error when EDGE_DOWN', async () => {
    renderWith({
      session: vi.fn().mockRejectedValue(new EdgeApiError(0, 'EDGE_UNREACHABLE', 'down')),
      signIn: vi.fn(), signOut: vi.fn(),
    });
    await waitFor(() => expect(screen.getByTestId('landed-edge-error')).toBeInTheDocument());
  });

  it('renders children when AUTHENTICATED', async () => {
    renderWith({
      session: vi.fn().mockResolvedValue(user()),
      signIn: vi.fn(), signOut: vi.fn(),
    });
    await waitFor(() => expect(screen.getByTestId('landed-home')).toBeInTheDocument());
  });
});
