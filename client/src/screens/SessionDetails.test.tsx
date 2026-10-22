import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { SessionDetails } from './SessionDetails';
import { renderWithProviders } from '../test/renderWithProviders';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

const authed: SignInResponse = {
  userId: 'u1', username: 'alice', displayName: 'Alice', roles: ['OPERATOR', 'REVIEWER'],
  expiresAt: '2026-10-22T09:01:28Z',
};

describe('SessionDetails', () => {
  it('renders the signed-in session rows', async () => {
    renderWithProviders(<SessionDetails />, {
      authApi: { session: vi.fn().mockResolvedValue(authed), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('session-heading')).toBeInTheDocument());
    expect(screen.getByTestId('session-userId').textContent).toContain('u1');
    expect(screen.getByTestId('session-username').textContent).toBe('alice');
    expect(screen.getByTestId('session-roles').textContent).toContain('OPERATOR');
    expect(screen.getByTestId('session-roles').textContent).toContain('REVIEWER');
    expect(screen.getByTestId('session-expires').textContent).toBe('2026-10-22T09:01:28Z');
  });

  it('shows the defensive placeholder when unauthenticated', async () => {
    renderWithProviders(
      <Routes><Route path="/" element={<SessionDetails />} /></Routes>,
      {
        authApi: {
          session: vi.fn().mockRejectedValue(new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no')),
          signIn: vi.fn(), signOut: vi.fn(),
        },
      },
    );
    await waitFor(() => expect(screen.getByTestId('session-placeholder')).toBeInTheDocument());
  });
});
