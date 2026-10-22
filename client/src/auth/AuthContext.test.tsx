import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

function Probe(): JSX.Element {
  const { state, signIn, signOut, refresh } = useAuth();
  return (
    <div>
      <output data-test="status">{state.status}</output>
      {state.status === 'AUTHENTICATED' ? (
        <output data-test="username">{state.user.username}</output>
      ) : null}
      <button type="button" onClick={() => { signIn('alice', 'pw').catch(() => undefined); }}>sign-in</button>
      <button type="button" onClick={() => { signOut().catch(() => undefined); }}>sign-out</button>
      <button type="button" onClick={() => { refresh().catch(() => undefined); }}>refresh</button>
    </div>
  );
}

const user = (name = 'alice'): SignInResponse => ({
  userId: 'u', username: name, displayName: 'Alice', roles: ['OPERATOR'], expiresAt: '2026-10-22',
});

describe('AuthContext', () => {
  it('starts INITIAL and transitions to AUTHENTICATED when session resolves', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(user()),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('AUTHENTICATED'));
    expect(screen.getByTestId('username').textContent).toBe('alice');
  });

  it('transitions to ANONYMOUS when session rejects with non-edge error', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS'));
  });

  it('transitions to EDGE_DOWN when session errors with EDGE_UNREACHABLE', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(new EdgeApiError(503, 'EDGE_UNREACHABLE', 'down')),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('EDGE_DOWN'));
  });

  it('signIn switches state to AUTHENTICATED', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
      signIn: vi.fn().mockResolvedValue(user('bob')),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS'));
    await userEvent.click(screen.getByText('sign-in'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('AUTHENTICATED'));
    expect(screen.getByTestId('username').textContent).toBe('bob');
  });

  it('signOut sets ANONYMOUS even when the server reports an error', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(user()),
      signIn: vi.fn(),
      signOut: vi.fn().mockRejectedValue(new EdgeApiError(500, 'UNKNOWN', 'oops')),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('AUTHENTICATED'));
    await act(async () => {
      // signOut has a try/finally that always sets ANONYMOUS, swallowing errors.
      await (api.signOut().catch(() => {}));
    });
    await userEvent.click(screen.getByText('sign-out'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS'));
  });

  it('useAuth outside the provider throws', () => {
    // React 18 reroutes the throw to window.error; suppress to keep test clean.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalOnError = window.onerror;
    window.onerror = () => true;
    try {
      expect(() => render(<Probe />)).toThrow(/useAuth must be called inside <AuthProvider>/);
    } finally {
      window.onerror = originalOnError;
      consoleError.mockRestore();
    }
  });

  it('refresh re-probes the session', async () => {
    const api = {
      session: vi.fn().mockResolvedValueOnce(user('a')).mockResolvedValueOnce(user('b')),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('a'));
    await userEvent.click(screen.getByText('refresh'));
    await waitFor(() => expect(screen.getByTestId('username').textContent).toBe('b'));
  });
});
