import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignIn } from './SignIn';
import { AuthProvider } from '../auth/AuthContext';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

function user(name = 'alice'): SignInResponse {
  return {
    userId: 'u1',
    username: name,
    displayName: name,
    roles: ['ADMIN'],
    expiresAt: '2099-01-01T00:00:00Z',
  };
}

function renderAt(route: string, api: {
  session: () => Promise<SignInResponse>;
  signIn: (u: string, p: string) => Promise<SignInResponse>;
  signOut: () => Promise<void>;
}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider api={api}>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/" element={<div data-test="landed-home">home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SignIn', () => {
  it('renders the sign-in form', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    expect(screen.getByTestId('sign-in-username')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-password')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-submit')).toBeDisabled();
  });

  it('submit button enables once both fields have content', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sign-in-username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByTestId('sign-in-password'), { target: { value: 'p' } });
    expect(screen.getByTestId('sign-in-submit')).not.toBeDisabled();
  });

  it('submits and navigates to the originating route on success', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sign-in-username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByTestId('sign-in-password'), { target: { value: 'password' } });
    await userEvent.click(screen.getByTestId('sign-in-submit'));
    await waitFor(() => expect(screen.getByTestId('landed-home')).toBeInTheDocument());
    expect(api.signIn).toHaveBeenCalledWith('alice', 'password');
  });

  it('renders a sign-in error alert when signIn throws', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'bad creds')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sign-in-username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByTestId('sign-in-password'), { target: { value: 'wrong' } });
    await userEvent.click(screen.getByTestId('sign-in-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/invalid/i));
  });

  it('surfaces non-EdgeApi failure as generic error', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(new Error('boom')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sign-in-username'), { target: { value: 'a' } });
    fireEvent.change(screen.getByTestId('sign-in-password'), { target: { value: 'p' } });
    await userEvent.click(screen.getByTestId('sign-in-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/sign-in failed/i));
  });
});
