import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Launcher } from './Launcher';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SignInResponse } from '../api/edgeApi';

const operator: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
};

describe('Launcher', () => {
  it('renders a section per Server Module with its tiles', async () => {
    renderWithProviders(<Launcher />, {
      authApi: { session: vi.fn().mockResolvedValue(operator), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('launcher-heading')).toBeInTheDocument());
    for (const id of ['dhis2', 'sync', 'network', 'workflows', 'data', 'admin']) {
      expect(screen.getByTestId(`module-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`module-${id}-heading`)).toBeInTheDocument();
      expect(screen.getByTestId(`module-${id}-tiles`)).toBeInTheDocument();
    }
    for (const id of [
      'tile-dhis2-status', 'tile-sync-status', 'tile-network-status',
      'tile-capture', 'tile-aggregate', 'tile-session', 'tile-recent',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    // Metadata is consumed in forms/filters/validations/rules, not browsed.
    for (const id of ['tile-ou', 'tile-ds', 'tile-de', 'tile-prg', 'tile-tet']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    // Metadata sync is server-managed; no client-side trigger.
    expect(screen.queryByTestId('sync-card')).toBeNull();
    expect(screen.queryByTestId('sync-button')).toBeNull();
  });
});
