import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import * as edgeApiModule from './api/edgeApi';
import { EdgeApiError, type SignInResponse } from './api/edgeApi';

const user: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'Alice', roles: ['OPERATOR'], expiresAt: '2026-10-22',
};

/*
 * App.tsx composes AuthProvider internally (so the tests cannot inject the
 * auth API dependency). We instead stub the module-level edgeApi.session so
 * the real AuthProvider resolves to a deterministic state at mount.
 */

describe('App', () => {
  function renderAt(path: string): void {
    render(
      <MemoryRouter initialEntries={[path]}>
        <CustomDataProvider data={{}}>
          <App />
        </CustomDataProvider>
      </MemoryRouter>,
    );
  }

  it('redirects / to /sign-in when the session probe fails', async () => {
    vi.spyOn(edgeApiModule, 'session').mockRejectedValue(
      new EdgeApiError(401, 'INVALID_CREDENTIALS', 'no'),
    );
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('signin-heading')).toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('redirects / to /edge-error when the session probe reports edge-down', async () => {
    vi.spyOn(edgeApiModule, 'session').mockRejectedValue(
      new EdgeApiError(503, 'EDGE_UNREACHABLE', 'down'),
    );
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('edge-error-notice')).toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('renders the launcher at / when authenticated', async () => {
    vi.spyOn(edgeApiModule, 'session').mockResolvedValue(user);
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('launcher-heading')).toBeInTheDocument());
    vi.restoreAllMocks();
  });
});
