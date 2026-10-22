import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EdgeConnectionError } from './EdgeConnectionError';
import { renderWithProviders } from '../test/renderWithProviders';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
};

describe('EdgeConnectionError', () => {
  it('renders the explanation + retry button', async () => {
    renderWithProviders(<EdgeConnectionError />, {
      authApi: {
        session: vi.fn().mockRejectedValue(new EdgeApiError(503, 'EDGE_UNREACHABLE', 'down')),
        signIn: vi.fn(),
        signOut: vi.fn(),
      },
    });
    await waitFor(() => expect(screen.getByTestId('edge-error-notice')).toBeInTheDocument());
    expect(screen.getByText(/DER edge runtime at this origin did not respond/i)).toBeInTheDocument();
    expect(screen.getByTestId('edge-error-retry')).toBeInTheDocument();
  });

  it('retry re-probes the session', async () => {
    // After retry succeeds, state transitions to AUTHENTICATED.
    const session = vi.fn()
      .mockRejectedValueOnce(new EdgeApiError(503, 'EDGE_UNREACHABLE', 'down'))
      .mockResolvedValueOnce(user);
    renderWithProviders(<EdgeConnectionError />, {
      authApi: { session, signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('edge-error-retry')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('edge-error-retry'));
    await waitFor(() => expect(session).toHaveBeenCalledTimes(2));
  });
});
