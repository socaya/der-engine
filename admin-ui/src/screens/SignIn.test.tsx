import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function usernameInput(): HTMLInputElement {
  return screen.getByTestId('sign-in-username-field')
    .querySelector('input') as HTMLInputElement;
}

function passwordInput(): HTMLInputElement {
  return screen.getByTestId('sign-in-password-field')
    .querySelector('input') as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByTestId('sign-in-submit')
    .querySelector('button') as HTMLButtonElement;
}

describe('SignIn (Atlaskit)', () => {
  it('renders the sign-in form', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    expect(screen.getByTestId('sign-in-username-field')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-password-field')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-submit')).toBeInTheDocument();
    expect(usernameInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
  });

  it('submits and navigates on success', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockResolvedValue(user()),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'alice' } });
    fireEvent.change(passwordInput(), { target: { value: 'password' } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(screen.getByTestId('landed-home')).toBeInTheDocument());
    expect(api.signIn).toHaveBeenCalledWith('alice', 'password');
  });

  it('renders invalid-credentials error', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'bad creds')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'alice' } });
    fireEvent.change(passwordInput(), { target: { value: 'wrong' } });
    fireEvent.click(submitButton());
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
    fireEvent.change(usernameInput(), { target: { value: 'a' } });
    fireEvent.change(passwordInput(), { target: { value: 'p' } });
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/sign-in failed/i));
  });

  it('surfaces EDGE_UNREACHABLE from signIn', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(
        new EdgeApiError(401, 'INVALID_CREDENTIALS', 'needed')),
      signIn: vi.fn().mockRejectedValue(
        new EdgeApiError(0, 'EDGE_UNREACHABLE', 'down')),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    renderAt('/sign-in', api);
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeInTheDocument());
    fireEvent.change(usernameInput(), { target: { value: 'a' } });
    fireEvent.change(passwordInput(), { target: { value: 'p' } });
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/unreachable/i));
  });
});
