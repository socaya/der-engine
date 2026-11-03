import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { SessionDetails } from './SessionDetails';
import { renderWithProviders } from '../test/renderWithProviders';
import { EdgeApiError, type SignInResponse } from '../api/edgeApi';

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { window.localStorage.clear(); });

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

  it('renders the enrolled-device row with its stored status', async () => {
    window.localStorage.setItem(
      'der_device_id', '11111111-2222-3333-4444-555555555555');
    window.localStorage.setItem('der_device_status', 'APPROVED');
    renderWithProviders(<SessionDetails />, {
      authApi: { session: vi.fn().mockResolvedValue(authed), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('session-heading')).toBeInTheDocument());
    const device = screen.getByTestId('session-device');
    expect(device.textContent).toContain('11111111');
    expect(device.textContent).toContain('APPROVED');
    expect(screen.queryByTestId('session-device-missing')).toBeNull();
  });

  it('falls back to UNKNOWN when a device id exists but status does not', async () => {
    window.localStorage.setItem(
      'der_device_id', '99999999-0000-0000-0000-000000000000');
    renderWithProviders(<SessionDetails />, {
      authApi: { session: vi.fn().mockResolvedValue(authed), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('session-heading')).toBeInTheDocument());
    const device = screen.getByTestId('session-device');
    expect(device.textContent).toContain('UNKNOWN');
  });

  it('shows the device-missing hint when no device has been enrolled', async () => {
    renderWithProviders(<SessionDetails />, {
      authApi: { session: vi.fn().mockResolvedValue(authed), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('session-heading')).toBeInTheDocument());
    expect(screen.getByTestId('session-device-missing')).toBeInTheDocument();
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
