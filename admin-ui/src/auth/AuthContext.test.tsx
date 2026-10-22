import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

function user(name = 'alice'): SignInResponse {
  return { userId: 'u', username: name, displayName: 'Alice', roles: ['ADMIN'], expiresAt: '2026-10-22' };
}

function Probe(): JSX.Element {
  const { state, signIn, signOut, refresh } = useAuth();
  const name = state.status === 'AUTHENTICATED' ? state.user.username : '';
  return (
    <div>
      <div data-test="status">{state.status}</div>
      <div data-test="username">{name}</div>
      <button type="button" onClick={() => { signIn('alice', 'pw1234567').catch(() => undefined); }}>sign-in</button>
      <button type="button" onClick={() => { signOut().catch(() => undefined); }}>sign-out</button>
      <button type="button" onClick={() => { refresh().catch(() => undefined); }}>refresh</button>
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('AuthContext', () => {
  it('resolves ANONYMOUS when session probe says 401', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS'));
  });

  it('resolves EDGE_DOWN when session probe says EDGE_UNREACHABLE', async () => {
    const api = {
      session: vi.fn().mockRejectedValue(new EdgeApiError(0, 'EDGE_UNREACHABLE', 'down')),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('EDGE_DOWN'));
  });

  it('resolves AUTHENTICATED when session probe succeeds', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(user()),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('AUTHENTICATED'));
    expect(screen.getByTestId('username').textContent).toBe('alice');
  });

  it('signIn promotes ANONYMOUS → AUTHENTICATED', async () => {
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

  it('signOut sets ANONYMOUS even when server rejects', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(user()),
      signIn: vi.fn(),
      signOut: vi.fn().mockRejectedValue(new EdgeApiError(500, 'UNKNOWN', 'oops')),
    };
    render(<AuthProvider api={api}><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('AUTHENTICATED'));
    await act(async () => { await api.signOut().catch(() => undefined); });
    await userEvent.click(screen.getByText('sign-out'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS'));
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

  it('useAuth outside the provider throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<Probe />)).toThrow(/useAuth must be called inside <AuthProvider>/);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('AuthContext — default edgeApi fallback', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('uses the real edgeApi module when no api prop is passed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => '',
    }) as unknown as typeof fetch;
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS'));
  });
});
